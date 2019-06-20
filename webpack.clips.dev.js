/* eslint-disable */
const path = require('path');
const merge = require('webpack-merge');
const common = require('./webpack.clips.common.js');

const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

/* global module */

module.exports = merge(common, {
	mode: 'development',
	devtool: 'inline-source-map',

	plugins: [
		new CopyPlugin([
			{
				from: './src/entry.js',
				to: 'script.js'
			}
		]),
		new webpack.DefinePlugin({
			__git_commit__: null
		})
	],

	devServer: {
		https: true,
		port: 8000,
		compress: true,
		inline: false,

		allowedHosts: [
			'.twitch.tv',
			'.frankerfacez.com'
		],

		contentBase: path.join(__dirname, 'dev_cdn'),
		publicPath: '/script/clips/',

		proxy: {
			'**': {
				target: 'https://cdn.frankerfacez.com/',
				changeOrigin: true
			}
		},

		before(app) {
			// Because the headers config option is broken.
			app.get('/*', (req, res, next) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				next();
			});

			app.get('/script/script.js', (req, res, next) => {
				req.url = req.url.replace(/^\/script/, '/script/clips');
				next();
			});

			app.get('/script/bridge.js', (req, res, next) => {
				req.url = req.url.replace(/^\/script/, '/script/clips');
				next();
			});

			app.get('/dev_server', (req, res) => {
				res.json({
					path: process.cwd(),
					version: 2
				})
			});
		}
	},

	output: {
		publicPath: '//localhost:8000/script/clips/',
		filename: '[name].js',
		jsonpFunction: 'ffzWebpackJsonp',
		crossOriginLoading: 'anonymous'
	}
})