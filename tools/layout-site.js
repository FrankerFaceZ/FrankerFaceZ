'use strict';

// ============================================================================
// Lay out a build for a static host.
//
// Static hosts cannot read dist/manifest.json to map the stable names the
// loader requests onto the current hashed files, so this writes a folder
// that already has the layout the client expects:
//   site/static/<every file in dist/>     content-hashed, cache forever
//   site/script/<stable name>             a copy of the current file
//   site/_headers                         CORS and caching for Cloudflare Pages
//
// Run it after a production build:
//   FFZ_CLIENT_HOST=https://ffz.example.pages.dev bun run build
//   bun run layout:site
// Then publish site/ as-is.
// ============================================================================

const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = path.resolve(process.env.SITE_DIR || path.join(ROOT, 'site'));

// The names the loader and the client request without a hash.
const STABLE_NAMES = [
	'script.min.js',
	'avalon.js',
	'clips.js',
	'player.js',
	'bridge.js',
	'esbridge.js',
	'experiments.json',
	'sample-chat-messages.json'
];

const HEADERS = `# Twitch fetches everything cross-origin.
/*
  Access-Control-Allow-Origin: *

# Hashed files never change once published.
/static/*
  Cache-Control: public, max-age=31536000, immutable

# Stable names point at the current build and must not linger in caches.
/script/*
  Cache-Control: no-cache
`;

const manifest_path = path.join(DIST, 'manifest.json');
if ( ! fs.existsSync(manifest_path) ) {
	console.error(`No build found at ${DIST}. Run a production build first.`);
	process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifest_path, 'utf8'));

fs.rmSync(SITE, {recursive: true, force: true});
fs.mkdirSync(path.join(SITE, 'static'), {recursive: true});
fs.mkdirSync(path.join(SITE, 'script'), {recursive: true});

// Everything in dist/ is served under /static/.
let copied = 0;
for(const entry of fs.readdirSync(DIST, {withFileTypes: true})) {
	if ( ! entry.isFile() )
		continue;
	fs.copyFileSync(path.join(DIST, entry.name), path.join(SITE, 'static', entry.name));
	copied++;
}

// Stable names get a copy of whatever the manifest currently maps them to.
const missing = [];
for(const name of STABLE_NAMES) {
	let file = manifest[name] || name;
	// Dev builds copy the loader as script.js rather than script.min.js.
	if ( name === 'script.min.js' && ! fs.existsSync(path.join(DIST, file)) && fs.existsSync(path.join(DIST, 'script.js')) )
		file = 'script.js';

	const source = path.join(DIST, file);
	if ( ! fs.existsSync(source) ) {
		missing.push(name);
		continue;
	}

	fs.copyFileSync(source, path.join(SITE, 'script', name));
}

fs.writeFileSync(path.join(SITE, '_headers'), HEADERS);

console.log(`Laid out ${copied} files under ${path.relative(ROOT, SITE)}/static and ${STABLE_NAMES.length - missing.length} stable names under script/.`);
if ( missing.length )
	console.warn(`Not in this build, skipped: ${missing.join(', ')}`);
