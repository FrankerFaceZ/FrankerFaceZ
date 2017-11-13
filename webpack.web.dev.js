const path = require('path');
const merge = require('webpack-merge');
const common = require('./webpack.web.common.js');

const CopyPlugin = require('copy-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');

module.exports = merge(common, {
	devtool: 'inline-source-map',

	plugins: [
		new CopyPlugin([
			{
				from: './src/entry.js',
				to: 'script.js'
			}
		])
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
		publicPath: '/script/',

		proxy: {
			'**': {
				target: 'http://cdn.frankerfacez.com/',
				changeOrigin: true
			}
		},

		before(app) {
			// Because the headers config option is broken.
			app.get("/*", (req, res, next) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
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
		publicPath: '//localhost:8000/script/',
		filename: '[name].js',
		jsonpFunction: 'ffzWebpackJsonp'
	}
})