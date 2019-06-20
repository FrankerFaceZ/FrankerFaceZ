const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.clips.common.js');
const path = require('path');

const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

const Terser = require('terser');

// Get Git info

const commit_hash = require('child_process').execSync('git rev-parse HEAD').toString().trim();

/* global module Buffer __dirname */

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
				transform: content => {
					const text = content.toString('utf8');
					const minified = Terser.minify(text);
					return (minified && minified.code) ? Buffer.from(minified.code) : content;
				}
			}
		]),
		new ManifestPlugin({
			basePath: 'clips/',
			publicPath: 'clips/',
			map: data => {
				if ( data.name.endsWith('.scss') )
					data.name = `${data.name.substr(0,data.name.length - 5)}.css`;

				return data;
			}
		})
	],

	output: {
		publicPath: '//cdn.frankerfacez.com/static/clips/',
		path: path.resolve(__dirname, 'dist/clips'),
		filename: '[name].[hash].js'
	}
});