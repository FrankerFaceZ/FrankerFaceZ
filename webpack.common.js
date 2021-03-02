const webpack = require('webpack');
const path = require('path');
const semver = require('semver');

const VueLoaderPlugin = require('vue-loader/lib/plugin');

/* global process module __dirname */

const VERSION = semver.parse(require('./package.json').version);
const PRODUCTION = process.env.NODE_ENV === 'production';

const ENTRY_POINTS = {
	bridge: './src/bridge.js',
	player: './src/player.js',
	avalon: './src/main.js',
	clips: './src/clips.js'
};

module.exports = {
	entry: ENTRY_POINTS,
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
		jsonpFunction: 'ffzWebpackJsonp',
		crossOriginLoading: 'anonymous'
	},
	optimization: {
		splitChunks: {
			chunks(chunk) {
				return ! Object.keys(ENTRY_POINTS).includes(chunk.name);
			},
			cacheGroups: {
				vendors: false
			}
		}
	},
	plugins: [
		new VueLoaderPlugin(),
		new webpack.ExtendedAPIPlugin(),
		new webpack.DefinePlugin({
			__version_major__: VERSION.major,
			__version_minor__: VERSION.minor,
			__version_patch__: VERSION.patch,
			__version_prerelease__: VERSION.prerelease
		}),
	],
	module: {
		rules: [{
			test: /\.s?css$/,
			use: [{
				loader: 'file-loader',
				options: {
					name: PRODUCTION ? '[name].[hash].css' : '[name].css'
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
			test: /\.json$/,
			include: /src/,
			type: 'javascript/auto',
			loader: 'file-loader',
			options: {
				name: PRODUCTION ? '[name].[hash].json' : '[name].json'
			}
		},
		{
			test: /\.js$/,
			exclude: /node_modules/,
			loader: 'babel-loader',
			options: {
				cacheDirectory: true
			}
		},
		{
			test: /\.jsx$/,
			exclude: /node_modules/,
			loader: 'babel-loader',
			options: {
				cacheDirectory: true,
				plugins: [
					['@babel/plugin-transform-react-jsx', {
						pragma: 'createElement'
					}]
				]
			}
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
					name: PRODUCTION ? '[name].[hash].[ext]' : '[name].[ext]'
				}
			}]
		},
		{
			test: /\.md$/,
			loader: 'raw-loader'
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