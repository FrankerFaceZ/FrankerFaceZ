/* global Bun */
'use strict';

// ============================================================================
// Serve a production build the way a real host must.
//
// Lays out dist/ as the loader and client expect:
//   /static/<hashed file>   every file in dist/, long-lived
//   /script/<stable name>   the current hashed file for that name, via
//                           dist/manifest.json (avalon.js, experiments.json...)
//
// Build for it first, then run it with `bun run serve:dist`:
//   FFZ_CLIENT_HOST=http://localhost:8001 bun run build
// Rebuild whenever you like; the manifest is re-read per request, so a
// reload of the Twitch tab picks up the new build.
//
// Served over HTTPS with a self-signed certificate, because Firefox refuses
// a plain-HTTP script injected into the HTTPS twitch.tv page (Chrome allows
// it for localhost). The certificate is kept under ~/.frankerfacez/serve-dist
// (created with openssl on first run) so reinstalls do not discard one the
// browser already trusts. Trust it once by opening the loader URL printed
// below. Set HTTP=1 to serve plain HTTP instead.
// ============================================================================

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { execSync } = require('node:child_process');

const PORT = Number(process.env.PORT) || 8001;
const USE_HTTP = process.env.HTTP === '1';

// The certificate and the client log live outside the repository, so a
// reinstall of node_modules or a fresh worktree does not throw away a
// certificate the browser already trusts. Override with FFZ_SERVE_DIR.
const SERVE_DIR = path.resolve(process.env.FFZ_SERVE_DIR || path.join(os.homedir(), '.frankerfacez', 'serve-dist'));
fs.mkdirSync(SERVE_DIR, {recursive: true});

const CERT_PATH = path.join(SERVE_DIR, 'localhost.pem');
const CLIENT_LOG = path.join(SERVE_DIR, 'client.log');

// Find or create a self-signed certificate for localhost.
function findCertificate() {
	if ( fs.existsSync(CERT_PATH) )
		return CERT_PATH;

	// Adopt a certificate an earlier version or the dev server left under
	// node_modules, so the one the browser trusts keeps working.
	const root = path.resolve(__dirname, '..');
	for(const legacy of [
		path.join(root, 'node_modules', '.cache', 'ffz-serve-dist', 'server.pem'),
		path.join(root, 'node_modules', '.cache', 'rspack-dev-server', 'server.pem'),
		path.join(root, 'node_modules', '.cache', 'webpack-dev-server', 'server.pem')
	]) {
		if ( fs.existsSync(legacy) ) {
			fs.copyFileSync(legacy, CERT_PATH);
			return CERT_PATH;
		}
	}

	try {
		execSync(`openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -keyout "${CERT_PATH}" -out "${CERT_PATH}.crt"`, {stdio: 'ignore'});
		fs.appendFileSync(CERT_PATH, fs.readFileSync(`${CERT_PATH}.crt`));
		fs.unlinkSync(`${CERT_PATH}.crt`);
		return CERT_PATH;
	} catch(err) {
		return null;
	}
}
const DIST = path.resolve(__dirname, '..', 'dist');
const MANIFEST_PATH = path.join(DIST, 'manifest.json');

if ( ! fs.existsSync(MANIFEST_PATH) ) {
	console.error(`No build found at ${DIST}. Run a production build first.`);
	process.exit(1);
}

// Re-read on every request so a rebuild takes effect without a restart.
const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

// Only content-hashed names may be cached forever; dev builds emit some
// files (fonts, JSON) under stable names that change between builds.
const HASHED_NAME = /\.[0-9a-f]{8}\.[a-z0-9]+$/i;

function resolve(pathname) {
	if ( pathname.startsWith('/static/') ) {
		const file = pathname.slice('/static/'.length);
		return {file, cache: HASHED_NAME.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache'};
	}

	if ( pathname.startsWith('/script/') ) {
		let name = pathname.slice('/script/'.length);
		// Dev builds copy the loader as script.js rather than script.min.js.
		if ( name === 'script.min.js' && ! fs.existsSync(path.join(DIST, name)) && fs.existsSync(path.join(DIST, 'script.js')) )
			name = 'script.js';
		return {file: readManifest()[name] || name, cache: 'no-cache'};
	}

	return null;
}

let tls = null;
if ( ! USE_HTTP ) {
	const pem = findCertificate();
	if ( ! pem ) {
		console.error('No certificate found and openssl is unavailable. Run `bun run dev` once to generate one, or set HTTP=1.');
		process.exit(1);
	}
	const text = fs.readFileSync(pem, 'utf8');
	tls = {key: text, cert: text};
}

Bun.serve({
	port: PORT,
	tls,
	async fetch(req) {
		const url = new URL(req.url),
			headers = {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Private-Network': 'true'
			};

		// Log forwarding from a client built for this host (see
		// src/utilities/dev-log.ts). Entries go to stdout and CLIENT_LOG.
		if ( url.pathname === '/log' ) {
			if ( req.method === 'OPTIONS' )
				return new Response(null, {status: 204, headers: {...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type'}});

			if ( req.method === 'POST' ) {
				let entries = [];
				try { entries = JSON.parse(await req.text()); } catch(err) { /* ignore malformed */ }
				if ( ! Array.isArray(entries) )
					entries = [entries];

				const lines = entries.map(e => `[client ${new Date(e.time || Date.now()).toLocaleTimeString()}] ${String(e.level || '').toUpperCase()}${e.category ? ` [${e.category}]` : ''}: ${e.message}`);
				for(const line of lines)
					console.log(line);
				fs.appendFileSync(CLIENT_LOG, `${lines.join('\n')}\n`);
				return new Response(null, {status: 204, headers});
			}
		}

		const target = resolve(url.pathname);

		if ( ! target )
			return new Response('Not Found', {status: 404, headers});

		// Keep requests inside dist/.
		const full = path.resolve(DIST, target.file);
		if ( ! full.startsWith(DIST + path.sep) || ! fs.existsSync(full) || fs.statSync(full).isDirectory() )
			return new Response('Not Found', {status: 404, headers});

		headers['Cache-Control'] = target.cache;
		console.log(`${req.method} ${url.pathname} -> ${path.relative(DIST, full)}`);
		return new Response(Bun.file(full), {headers});
	}
});

const origin = `${tls ? 'https' : 'http'}://localhost:${PORT}`;
console.log(`Serving ${DIST} at ${origin}`);
console.log(`  loader:  ${origin}/script/script.min.js  (open this once to trust the certificate)`);
console.log(`  client:  ${origin}/script/avalon.js`);
console.log(`  build with: FFZ_CLIENT_HOST=${origin} bun run build`);
console.log(`  client log: ${CLIENT_LOG}`);
console.log(`  certificate: ${tls ? CERT_PATH : 'none (plain HTTP)'}`);
