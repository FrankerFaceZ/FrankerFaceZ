const merge = require('webpack-merge');
const common = require('./webpack.web.common.js');
const path = require('path');

const CleanPlugin = require('clean-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');

/* global module __dirname */

const config = module.exports = merge(common, {
	devtool: 'source-map',

	module: {
		rules: [{
			test: /\.js$/,
			exclude: /node_modules/,
			use: {
				loader: 'babel-loader',
				options: {
					presets: ['env'],
					plugins: ['transform-runtime']
				}
			}
		}]
	},

	plugins: [
		new CleanPlugin(['dist/babel']),
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
		new ManifestPlugin({
			basePath: 'babel/',
			publicPath: 'babel/',
			map: data => {
				if ( data.name.endsWith('.scss') )
					data.name = `${data.name.substr(0,data.name.length - 5)}.css`;

				return data;
			}
		})
	],

	output: {
		publicPath: '//cdn.frankerfacez.com/static/babel/',
		path: path.resolve(__dirname, 'dist/babel'),
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
	if ( Array.isArray(rule.use) )
		for(const use of rule.use)
			if ( use.options && use.options.name && use.options.name.startsWith('[name].') )
				use.options.name = `[name].[hash].${use.options.name.slice(7)}`;
}