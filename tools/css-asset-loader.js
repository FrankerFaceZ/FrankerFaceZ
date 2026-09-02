'use strict';

// ============================================================================
// CSS Asset Loader
//
// FrankerFaceZ loads its stylesheets at runtime by URL (it injects <link>
// tags into Twitch's page) and loads the css_tweaks styles as raw CSS
// strings that it toggles on and off. Neither matches how bundlers want
// to treat CSS, so this loader sits in front of css-loader + sass-loader
// and turns their output into either:
//
//   mode: 'file'    an emitted .css asset, exporting its public URL
//   mode: 'string'  a JS module exporting the CSS as a string
//
// It replaces the deprecated extract-loader / file-loader / raw-loader
// chain. It works as a pitching loader: the remaining loaders (css-loader,
// sass-loader) are executed at build time via importModule, which also
// resolves url() references to emitted font assets.
// ============================================================================

const crypto = require('node:crypto');
const path = require('node:path');

// importModule needs an absolute URL for publicPath (Rspack rejects '' and
// relative values), but we want url() references relative to the CSS file,
// as they sit in the same output directory. So we execute with a sentinel
// base and strip it from the result.
const SENTINEL_BASE = 'https://css-asset-loader.invalid/';

module.exports = function cssAssetLoader(source) {
	// Not reached: pitch() short-circuits the chain.
	return source;
};

module.exports.pitch = function cssAssetPitch(remainingRequest) {
	const callback = this.async();
	const options = this.getOptions() || {};
	const mode = options.mode || 'file';

	// `!!` disables configured rules so only the remaining loaders run.
	this.importModule(`!!${remainingRequest}`, {
		publicPath: SENTINEL_BASE
	}).then(exports => {
		let css = exports && typeof exports === 'object' && 'default' in exports
			? exports.default
			: exports;

		if ( Array.isArray(css) )
			css = css.map(item => item[1]).join('\n');

		if ( typeof css !== 'string' )
			throw new Error(`css-asset-loader: expected css-loader to export a string (use exportType: 'string'), got ${typeof css}`);

		// Make asset URLs relative to the stylesheet.
		css = css.split(SENTINEL_BASE).join('');

		if ( mode === 'string' )
			return callback(null, `export default ${JSON.stringify(css)};`);

		const name = path.basename(this.resourcePath).replace(/\.(?:sa|sc|c)ss$/, ''),
			hash = crypto.createHash('sha256').update(css).digest('hex').slice(0, 8),
			filename = (options.filename || '[name].[contenthash:8].css')
				.replace('[name]', name)
				.replace('[contenthash:8]', hash)
				.replace('[contenthash]', hash);

		this.emitFile(filename, css);
		callback(null, `export default __webpack_public_path__ + ${JSON.stringify(filename)};`);
	}).catch(callback);
};
