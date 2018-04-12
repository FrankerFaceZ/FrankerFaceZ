const webpack = require('webpack');
const path = require('path');

/* global module __dirname */

module.exports = {
	entry: {
		avalon: './src/main.js'
	},
	resolve: {
		extensions: ['.js', '.jsx'],
		alias: {
			res: path.resolve(__dirname, 'res/'),
			styles: path.resolve(__dirname, 'styles/'),
			root: __dirname,
			src: path.resolve(__dirname, 'src/'),
			utilities: path.resolve(__dirname, 'src/utilities/')
		}
	},
	externals: [
		function(context, request, callback) {
			if ( request === 'vue' && ! /utilities/.test(context) )
				return callback(null, 'root ffzVue');
			callback();
		}
	],
	output: {
		chunkFilename: '[name].[chunkhash].js',
		path: path.resolve(__dirname, 'dist'),
		jsonpFunction: 'ffzWebpackJsonp'
	},
	plugins: [
		new webpack.ExtendedAPIPlugin()
	],
	module: {
		rules: [{
			test: /\.s?css$/,
			use: [{
				loader: 'file-loader',
				options: {
					name: '[name].css'
				}
			}, {
				loader: 'extract-loader'
			}, {
				loader: 'css-loader',
				options: {
					sourceMap: true
				}
			}, {
				loader: 'sass-loader',
				options: {
					sourceMap: true
				}
			}]
		},
		{
			test: /\.jsx$/,
			exclude: /node_modules/,
			loader: 'babel-loader'
		},
		{
			test: /\.(graphql|gql)$/,
			exclude: /node_modules/,
			loader: 'graphql-tag/loader'
		},
		{
			test: /\.(?:eot|ttf|woff|woff2)$/,
			use: [{
				loader: 'file-loader',
				options: {
					name: '[name].[ext]'
				}
			}]
		},
		{
			test: /\.svg$/,
			loader: 'raw-loader'
		},
		{
			test: /\.vue$/,
			loader: 'vue-loader'
		}]
	}
}