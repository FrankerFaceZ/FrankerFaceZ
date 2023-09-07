/* global module __dirname */

const path = require('path');
const semver = require('semver');
const {exec, execSync} = require('child_process');

const { VueLoaderPlugin } = require('vue-loader');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { EsbuildPlugin } = require('esbuild-loader');
const CopyPlugin = require('copy-webpack-plugin');


if ( process.env.NODE_ENV == null )
	process.env.NODE_ENV = 'production';

// Are we in development?
const DEV_SERVER = process.env.WEBPACK_SERVE == 'true';
const DEV_BUILD = process.env.NODE_ENV !== 'production';

// Is this for an extension?
const FOR_EXTENSION = !! process.env.FFZ_EXTENSION;

// Get the public path.
const FILE_PATH = DEV_SERVER
	? 'https://localhost:8000/script/'
	: FOR_EXTENSION
		? ''
		: 'https://cdn.frankerfacez.com/static/';


console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FOR_EXTENSION:', FOR_EXTENSION, FOR_EXTENSION ? ` (${process.env.FFZ_EXTENSION})` : '');
console.log('IS_DEV_BUILD:', DEV_BUILD);
console.log('IS SERVE:', DEV_SERVER);
console.log('FILE PATH:', FILE_PATH);


// Version Stuff
const VERSION = semver.parse(require('./package.json').version);
const commit_hash = DEV_SERVER
	? null
	: execSync('git rev-parse HEAD').toString().trim();


// The Config

const ENTRY_POINTS = {
	bridge: './src/bridge.js',
	player: './src/player.js',
	avalon: './src/main.js',
	clips: './src/clips.js'
};

const TARGET = 'es2020';

/** @type {import('webpack').Configuration} */
const config = {
	mode: DEV_BUILD
		? 'development'
		: 'production',
	devtool: DEV_BUILD
		? 'inline-source-map'
		: 'source-map',

	target: ['web', TARGET],

	resolve: {
		extensions: ['.js', '.jsx'],
		alias: {
			res: path.resolve(__dirname, 'res/'),
			styles: path.resolve(__dirname, 'styles/'),
			root: __dirname,
			src: path.resolve(__dirname, 'src/'),
			utilities: path.resolve(__dirname, 'src/utilities/'),
			site: path.resolve(__dirname, 'src/sites/twitch-twilight/')
		}
	},

	entry: ENTRY_POINTS,

	externals: [
		({context, request}, callback) => {
			if ( request === 'vue' && ! /utilities/.test(context) )
				return callback(null, 'root ffzVue');

			callback();
		}
	],

	output: {
		chunkFormat: 'array-push',
		clean: true,
		publicPath: FOR_EXTENSION
			? 'auto'
			: FILE_PATH,
		path: path.resolve(__dirname, 'dist'),
		filename: (FOR_EXTENSION || DEV_SERVER)
			? '[name].js'
			: '[name].[contenthash:8].js',
		chunkLoadingGlobal: 'ffzWebpackJsonp',
		crossOriginLoading: 'anonymous'
	},

	optimization: {
		minimizer: [
			new EsbuildPlugin({
				target: TARGET,
				keepNames: true
			})
		],
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
		new CopyPlugin({
			patterns: [
				{
					from: FOR_EXTENSION
						? './src/entry_ext.js'
						: './src/entry.js',
					to: (DEV_SERVER || DEV_BUILD)
						? 'script.js'
						: 'script.min.js'
				}
			]
		}),
		new VueLoaderPlugin(),
		new EsbuildPlugin({
			define: {
				__version_major__: JSON.stringify(VERSION.major),
				__version_minor__: JSON.stringify(VERSION.minor),
				__version_patch__: JSON.stringify(VERSION.patch),
				__version_prerelease__: JSON.stringify(VERSION.prerelease),
				__version_build__: JSON.stringify(process.env.FFZ_BUILD || null),
				__git_commit__: JSON.stringify(commit_hash),
				__extension__: FOR_EXTENSION
					? JSON.stringify(process.env.FFZ_EXTENSION)
					: JSON.stringify(false)
			}
		}),
		new WebpackManifestPlugin({
			publicPath: ''
		})
	],

	module: {
		rules: [
			{
				test: /\.jsx?$/,
				exclude: /node_modules/,
				loader: 'esbuild-loader',
				options: {
					loader: 'jsx',
					jsxFactory: 'createElement',
					target: TARGET
				}
			},
			{
				test: /\.(graphql|gql)$/,
				exclude: /node_modules/,
				use: [
					'graphql-tag/loader',
					'minify-graphql-loader'
				]
			},
			{
				test: /\.json$/,
				include: /src/,
				type: 'asset/resource',
				generator: {
					filename: (FOR_EXTENSION || DEV_BUILD)
						? '[name].json'
						: '[name].[contenthash:8].json'
				}
			},
			{
				test: /\.(?:otf|eot|ttf|woff|woff2)$/,
				use: [{
					loader: 'file-loader',
					options: {
						name: (FOR_EXTENSION || DEV_BUILD)
							? '[name].[ext]'
							: '[name].[contenthash:8].[ext]'
					}
				}]
			},
			{
				test: /\.md$/,
				type: 'asset/source',
			},
			{
				test: /\.svg$/,
				type: 'asset/source'
			},
			{
				test: /\.vue$/,
				loader: 'vue-loader'
			},
			{
				test: /\.(?:sa|sc|c)ss$/,
				resourceQuery: {
					not: [
						/css_tweaks/
					]
				},
				use: [
					{
						loader: 'file-loader',
						options: {
							name: (FOR_EXTENSION || DEV_BUILD)
								? '[name].css'
								: '[name].[contenthash:8].css'
						}
					},
					{
						loader: 'extract-loader',
						options: {
							publicPath: ''
						}
					},
					{
						loader: 'css-loader',
						options: {
							esModule: false,
							sourceMap: DEV_BUILD ? true : false
						}
					},
					{
						loader: 'sass-loader',
						options: {
							sourceMap: true
						}
					}
				]
			},
			{
				test: /\.(?:sa|sc|c)ss$/,
				resourceQuery: /css_tweaks/,
				use: [
					{
						loader: 'raw-loader'
					},
					{
						loader: 'extract-loader'
					},
					{
						loader: 'css-loader',
						options: {
							esModule: false,
							sourceMap: DEV_BUILD ? true : false
						}
					},
					{
						loader: 'sass-loader',
						options: {
							sourceMap: false
						}
					}
				]
			}
		]
	}

};

if ( DEV_SERVER )
	config.devServer = {
		client: false,
		webSocketServer: false,
		magicHtml: false,
		liveReload: false,
		hot: false,

		server: 'https',
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

		setupMiddlewares: (middlewares, devServer) => {

			devServer.app.get('/update_font', (req, res) => {
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

			devServer.app.get('/dev_server', (req, res) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader('Access-Control-Allow-Private-Network', 'true');

				res.json({
					path: process.cwd(),
					version: 2
				})
			});

			middlewares.unshift((req, res, next) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader('Access-Control-Allow-Private-Network', 'true');
				next();
			});

			return middlewares;
		}
	};


module.exports = config;
