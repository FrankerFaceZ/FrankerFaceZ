
const path = require('path');
const semver = require('semver');
const {exec, execSync} = require('child_process');

const { rspack } = require('@rspack/core');
const { VueLoaderPlugin } = require('vue-loader');
const { RspackManifestPlugin } = require('rspack-manifest-plugin');


if ( process.env.NODE_ENV == null )
	process.env.NODE_ENV = 'production';

// Are we in development?
const DEV_SERVER = process.env.RSPACK_SERVE == 'true' || process.env.WEBPACK_SERVE == 'true';
const DEV_BUILD = process.env.NODE_ENV !== 'production';

// Is this for an extension?
const FOR_EXTENSION = !! process.env.FFZ_EXTENSION;

// Get the public path.
const FILE_PATH = DEV_SERVER
	? 'https://localhost:8000/script/'
	: FOR_EXTENSION
		? ''
		: 'https://cdn2.frankerfacez.com/static/';


console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FOR_EXTENSION:', FOR_EXTENSION, FOR_EXTENSION ? ` (${process.env.FFZ_EXTENSION})` : '');
console.log('IS_DEV_BUILD:', DEV_BUILD);
console.log('IS SERVE:', DEV_SERVER);
console.log('FILE PATH:', FILE_PATH);


// Version Stuff
const VERSION = semver.parse(require('./package.json').version);
const commit_hash = DEV_SERVER
	? null
	: process.env.CLIENT_COMMIT?.length > 0
		? process.env.CLIENT_COMMIT
		: execSync('git rev-parse HEAD').toString().trim();


// The Config

const ENTRY_POINTS = {
	bridge: './src/bridge.js',
	esbridge: './src/esbridge.js',
	player: './src/player.js',
	avalon: './src/main.ts',
	clips: './src/clips.js'
};

if ( FOR_EXTENSION )
	ENTRY_POINTS.worker = './src/worker.ts';

const COPY_PATTERNS = [
	{
		from: FOR_EXTENSION
			? './src/entry_ext.js'
			: './src/entry.js',
		to: (DEV_SERVER || DEV_BUILD)
			? 'script.js'
			: 'script.min.js'
	},
];

const TARGET = 'es2020';

// Hashed filenames in production, stable names for dev and extension builds.
const HASHED = ! (FOR_EXTENSION || DEV_BUILD);

const CSS_ASSET_LOADER = path.resolve(__dirname, 'tools/css-asset-loader.js');

// Loaders shared by both stylesheet rules. css-loader resolves url()
// references to emitted font assets; sass-loader compiles SCSS.
const STYLE_LOADERS = [
	{
		loader: 'css-loader',
		options: {
			exportType: 'string',
			esModule: true,
			sourceMap: false
		}
	},
	{
		loader: 'sass-loader',
		options: {
			sourceMap: false
		}
	}
];

// JSX in this project compiles to createElement from utilities/dom, not
// React. The same pragma applies to .js/.jsx and .ts/.tsx files.
const SWC_REACT = {
	pragma: 'createElement',
	pragmaFrag: 'Fragment',
	throwIfNamespace: true,
	development: false,
	runtime: 'classic'
};

/** @type {import('@rspack/core').Configuration} */
const config = {
	mode: DEV_BUILD
		? 'development'
		: 'production',
	devtool: DEV_BUILD
		? 'inline-source-map'
		: 'source-map',

	target: ['web', TARGET],

	resolve: {
		extensions: ['.js', '.jsx', '.ts', '.tsx'],
		alias: {
			res: path.resolve(__dirname, 'res/'),
			styles: path.resolve(__dirname, 'styles/'),
			root: __dirname,
			src: path.resolve(__dirname, 'src/'),
			utilities: path.resolve(__dirname, 'src/utilities/'),
			site: path.resolve(__dirname, 'src/sites/twitch-twilight/')
		}
	},

	node: {
		global: false
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

	// vue-loader 15 (Vue 2) needs the JS-based CSS pipeline, and so does
	// our css-asset-loader, so Rspack's native CSS handling is off.
	experiments: {
		css: false
	},

	optimization: {
		minimizer: [
			new rspack.SwcJsMinimizerRspackPlugin({
				minimizerOptions: {
					// Equivalent of esbuild's keepNames. The module system
					// derives module names from constructor.name, so class
					// names must survive minification.
					compress: {
						keep_classnames: true,
						keep_fnames: true
					},
					mangle: {
						keep_classnames: true,
						keep_fnames: true
					}
				}
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

	performance: {
		hints: false,
	},

	plugins: [
		new rspack.CopyRspackPlugin({
			patterns: COPY_PATTERNS
		}),
		new VueLoaderPlugin(),
		new rspack.DefinePlugin({
			__version_major__: JSON.stringify(VERSION.major),
			__version_minor__: JSON.stringify(VERSION.minor),
			__version_patch__: JSON.stringify(VERSION.patch),
			__version_prerelease__: JSON.stringify(VERSION.prerelease),
			__version_build__: JSON.stringify(process.env.FFZ_BUILD || null),
			__git_commit__: JSON.stringify(commit_hash),
			__extension__: FOR_EXTENSION
				? JSON.stringify(process.env.FFZ_EXTENSION)
				: JSON.stringify(false)
		}),
		new RspackManifestPlugin({
			publicPath: ''
		})
	],

	module: {
		rules: [
			{
				test: /\.jsx?$/,
				exclude: /node_modules/,
				loader: 'builtin:swc-loader',
				options: {
					jsc: {
						parser: {
							syntax: 'ecmascript',
							jsx: true
						},
						transform: {
							react: SWC_REACT
						},
						target: TARGET
					}
				}
			},
			{
				test: /\.tsx?$/,
				exclude: /node_modules/,
				loader: 'builtin:swc-loader',
				options: {
					jsc: {
						parser: {
							syntax: 'typescript',
							tsx: true
						},
						transform: {
							react: SWC_REACT
						},
						target: TARGET
					}
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
					filename: HASHED
						? '[name].[contenthash:8].json'
						: '[name].json'
				}
			},
			{
				// This stupid rule goes out to Mozilla, who consistantly
				// manage to have this one file not included in the bundle
				// the same way as every other build on every other machine
				// out of like twelve I've tested. So fine. We'll do it
				// your way. Whatever. I don't care.
				test: /entities.json$/,
				include: /node_modules/,
				type: 'asset/resource',
				generator: {
					filename: HASHED
						? '[name].[contenthash:8].json'
						: '[name].json'
				}
			},
			{
				test: /\.(?:otf|eot|ttf|woff|woff2)$/,
				type: 'asset/resource',
				generator: {
					filename: HASHED
						? '[name].[contenthash:8][ext]'
						: '[name][ext]'
				}
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
				// Stylesheets loaded at runtime by URL.
				test: /\.(?:sa|sc|c)ss$/,
				resourceQuery: {
					not: [
						/css_tweaks/
					]
				},
				type: 'javascript/auto',
				use: [
					{
						loader: CSS_ASSET_LOADER,
						options: {
							mode: 'file',
							filename: HASHED
								? '[name].[contenthash:8].css'
								: '[name].css'
						}
					},
					...STYLE_LOADERS
				]
			},
			{
				// CSS tweaks are bundled as strings and toggled at runtime.
				test: /\.(?:sa|sc|c)ss$/,
				resourceQuery: /css_tweaks/,
				type: 'javascript/auto',
				use: [
					{
						loader: CSS_ASSET_LOADER,
						options: {
							mode: 'string'
						}
					},
					...STYLE_LOADERS
				]
			}
		]
	}

};

if ( DEV_SERVER )
	config.devServer = {
		client: false,
		webSocketServer: false,
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

		proxy: [
			{
				context: ['**'],
				target: 'https://cdn2.frankerfacez.com/',
				changeOrigin: true
			},
		],

		setupMiddlewares: middlewares => {
			// Rspack's dev server does not expose an Express app, so these
			// are written as plain middleware using only node:http APIs.
			const redirect = (res, location) => {
				res.writeHead(302, {Location: location});
				res.end();
			};

			const routes = (req, res, next) => {
				const url = new URL(req.url, 'https://localhost');

				if ( url.pathname === '/script/script.min.js' )
					return redirect(res, '/script/script.js');

				if ( url.pathname === '/update_font' ) {
					const proc = exec('bun run font:save');

					proc.stdout.on('data', data => {
						console.log('FONT>>', data);
					});

					proc.stderr.on('data', data => {
						console.error('FONT>>', data);
					});

					proc.on('close', code => {
						console.log('FONT>> Exited with code', code);
						redirect(res, req.headers.referer || '/');
					});
					return;
				}

				if ( url.pathname === '/dev_server' ) {
					res.setHeader('Access-Control-Allow-Origin', '*');
					res.setHeader('Access-Control-Allow-Private-Network', 'true');
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify({
						path: process.cwd(),
						version: 2
					}));
					return;
				}

				next();
			};

			const cors = (req, res, next) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader('Access-Control-Allow-Private-Network', 'true');
				next();
			};

			middlewares.unshift(cors, routes);

			return middlewares.filter(middleware => middleware.name !== 'cross-origin-header-check');
		}
	};


module.exports = config;
