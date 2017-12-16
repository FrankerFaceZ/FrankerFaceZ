const merge = require('webpack-merge');
const common = require('./webpack.web.common.js');

const CopyPlugin = require('copy-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');

const uglify = require('uglify-es');

const config = module.exports = merge(common, {
	devtool: 'source-map',

	plugins: [
		new UglifyJSPlugin({
			sourceMap: true,
			uglifyOptions: {
				compress: {
					keep_fnames: true,
					keep_classnames: true
				},
				mangle: {
					keep_classnames: true,
					keep_fnames: true
				}
			}
		}),
		new CopyPlugin([
			{
				from: './src/entry.js',
				to: 'script.min.js',
				transform: (content) => {
					const text = content.toString('utf8');
					const minified = uglify.minify(text);
					return (minified && minified.code) ? Buffer.from(minified.code) : content;
				}
			}
		]),
		new ManifestPlugin({
			map: (data) => {
				if ( data.name.endsWith('.scss') )
					data.name = data.name.substr(0,data.name.length - 5) + '.css';

				return data;
			}
		})
	],

	output: {
		publicPath: '//cdn.frankerfacez.com/script/',
		filename: '[name].[hash].js'
	}
});


// This is why we can't have nice things.
// Why can't I just access process.env.NODE_ENV from
// one of these files when I set it with webpack's
// CLI? So stupid.
//
// So here we go.
// This is crap.
// But it works.

for(const rule of config.module.rules) {
	if ( rule.use )
		for(const use of rule.use)
			if ( use.options && use.options.name && use.options.name.startsWith('[name].') )
				use.options.name = '[name].[hash].' + use.options.name.slice(7)
}