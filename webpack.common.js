const webpack = require('webpack');
const path = require('path');
const CleanPlugin = require('clean-webpack-plugin');

module.exports = {
	entry: {
		avalon: './src/main.js'
	},
	resolve: {
		alias: {
			res: path.resolve(__dirname, 'res/'),
			styles: path.resolve(__dirname, 'styles/'),
			src: path.resolve(__dirname, 'src/'),
			utilities: path.resolve(__dirname, 'src/utilities/')
		}
	},
	output: {
		chunkFilename: '[name].[chunkhash].js',
		path: path.resolve(__dirname, 'dist'),
		jsonpFunction: 'ffzWebpackJsonp'
	},
	plugins: [
		new CleanPlugin(['dist']),
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