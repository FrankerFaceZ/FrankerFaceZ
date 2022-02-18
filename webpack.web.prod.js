const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.web.common.js');

const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

const Terser = require('terser');

// Get Git info

const commit_hash = require('child_process').execSync('git rev-parse HEAD').toString().trim();

/* global module Buffer */

const minifier = content => {
	const text = content.toString('utf8');
	const minified = Terser.minify(text);
	return (minified && minified.code) ? Buffer.from(minified.code) : content;
};

module.exports = merge(common, {
	mode: 'production',
	devtool: 'source-map',

	optimization: {
		concatenateModules: false,
		minimizer: [
			new TerserPlugin({
				sourceMap: true,
				terserOptions: {
					keep_classnames: true,
					keep_fnames: true
				}
			})
		]
	},

	plugins: [
		new CleanWebpackPlugin(),
		new webpack.DefinePlugin({
			__git_commit__: JSON.stringify(commit_hash)
		}),
		new CopyPlugin([
			{
				from: './src/entry.js',
				to: 'script.min.js',
				transform: minifier
			}
		]),
		new WebpackManifestPlugin({
			publicPath: '',
			map: data => {
				if ( data.name.endsWith('.scss') )
					data.name = `${data.name.slice(0, -5)}.css`;

				return data;
			}
		})
	],

	output: {
		publicPath: '//cdn.frankerfacez.com/static/',
		filename: '[name].[hash].js'
	}
});