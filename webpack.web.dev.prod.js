/* eslint-disable */
const path = require('path');
const merge = require('webpack-merge');
const prod = require('./webpack.web.prod.js');

const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

/* global module */

module.exports = merge(prod, {
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
		hot: false,
		https: true,
		port: 8000,
		compress: true,

		allowedHosts: [
			'.twitch.tv',
			'.frankerfacez.com'
		],

		static: {
			directory: path.join(__dirname, 'dev_cdn'),
		},

		devMiddleware: {
			publicPath: '/script/',
		},

		proxy: {
			'**': {
				target: 'https://cdn.frankerfacez.com/',
				changeOrigin: true
			}
		},

		onBeforeSetupMiddleware(devServer) {
			const app = devServer.app;

			// Because the headers config option is broken.
			app.get('/*', (req, res, next) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				next();
			});

			app.get('/update_font', (req, res) => {
				const proc = exec('npm run font:save');

				proc.stdout.on('data', data => {
					console.log('FONT>>', data);
				});

				proc.stderr.on('data', data => {
					console.error('FONT>>', data);
				});

				proc.on('close', code => {
					console.log('FONT>> Exited with code', code);
					res.redirect(req.headers.referer);
				});
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
		publicPath: '//localhost:8000/script/',
		filename: '[name].js',
		jsonpFunction: 'ffzWebpackJsonp',
		crossOriginLoading: 'anonymous'
	}
})