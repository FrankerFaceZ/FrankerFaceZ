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

/**
 * Write the static-host layout for a build.
 *
 * @param {object} options
 * @param {string} options.dist The build directory, holding manifest.json.
 * @param {string} options.site The directory to write; it is emptied first.
 * @returns {{copied: number, stable: string[], missing: string[]}}
 */
function layoutSite({dist, site}) {
	const manifest_path = path.join(dist, 'manifest.json');
	if ( ! fs.existsSync(manifest_path) )
		throw new Error(`No build found at ${dist}. Run a production build first.`);

	const manifest = JSON.parse(fs.readFileSync(manifest_path, 'utf8'));

	fs.rmSync(site, {recursive: true, force: true});
	fs.mkdirSync(path.join(site, 'static'), {recursive: true});
	fs.mkdirSync(path.join(site, 'script'), {recursive: true});

	// Everything in dist/ is served under /static/.
	let copied = 0;
	for(const entry of fs.readdirSync(dist, {withFileTypes: true})) {
		if ( ! entry.isFile() )
			continue;
		fs.copyFileSync(path.join(dist, entry.name), path.join(site, 'static', entry.name));
		copied++;
	}

	// Stable names get a copy of whatever the manifest currently maps them to.
	const stable = [], missing = [];
	for(const name of STABLE_NAMES) {
		let file = manifest[name] || name;
		// Dev builds copy the loader as script.js rather than script.min.js.
		if ( name === 'script.min.js' && ! fs.existsSync(path.join(dist, file)) && fs.existsSync(path.join(dist, 'script.js')) )
			file = 'script.js';

		const source = path.join(dist, file);
		if ( ! fs.existsSync(source) ) {
			missing.push(name);
			continue;
		}

		fs.copyFileSync(source, path.join(site, 'script', name));
		stable.push(name);
	}

	fs.writeFileSync(path.join(site, '_headers'), HEADERS);

	return {copied, stable, missing};
}

module.exports = {layoutSite, STABLE_NAMES, HEADERS};

if ( require.main === module ) {
	const dist = path.join(ROOT, 'dist'),
		site = path.resolve(process.env.SITE_DIR || path.join(ROOT, 'site'));

	let result;
	try {
		result = layoutSite({dist, site});
	} catch(err) {
		console.error(err.message);
		process.exit(1);
	}

	console.log(`Laid out ${result.copied} files under ${path.relative(ROOT, site)}/static and ${result.stable.length} stable names under script/.`);
	if ( result.missing.length )
		console.warn(`Not in this build, skipped: ${result.missing.join(', ')}`);
}
