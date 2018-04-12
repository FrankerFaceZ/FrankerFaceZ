/* eslint-disable */
const path = require('path');
const merge = require('webpack-merge');
const dev = require('./webpack.web.dev.js');

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

/* global module */

module.exports = merge(dev, {
	module: {
		rules: [{
			test: /\.jsx?$/,
			exclude: /node_modules/,
			use: {
				loader: 'babel-loader',
				options: {
					cacheDirectory: true,
					plugins: ['transform-es2015-classes']
				}
			}
		}]
	},

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
		})
	]
});