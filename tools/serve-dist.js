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
// Plain HTTP on localhost is treated as a secure origin by browsers, so
// twitch.tv can load scripts from it without a certificate.
// ============================================================================

const path = require('node:path');
const fs = require('node:fs');

const PORT = Number(process.env.PORT) || 8001;
const DIST = path.resolve(__dirname, '..', 'dist');
const MANIFEST_PATH = path.join(DIST, 'manifest.json');

if ( ! fs.existsSync(MANIFEST_PATH) ) {
	console.error(`No build found at ${DIST}. Run a production build first.`);
	process.exit(1);
}

// Re-read on every request so a rebuild takes effect without a restart.
const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

function resolve(pathname) {
	if ( pathname.startsWith('/static/') )
		return {file: pathname.slice('/static/'.length), cache: 'public, max-age=31536000, immutable'};

	if ( pathname.startsWith('/script/') ) {
		const name = pathname.slice('/script/'.length);
		return {file: readManifest()[name] || name, cache: 'no-cache'};
	}

	return null;
}

Bun.serve({
	port: PORT,
	fetch(req) {
		const url = new URL(req.url),
			target = resolve(url.pathname),
			headers = {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Private-Network': 'true'
			};

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

console.log(`Serving ${DIST} at http://localhost:${PORT}`);
console.log(`  loader:  http://localhost:${PORT}/script/script.min.js`);
console.log(`  client:  http://localhost:${PORT}/script/avalon.js`);
