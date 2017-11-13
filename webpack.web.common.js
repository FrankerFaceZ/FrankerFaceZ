const path = require('path');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
	resolve: {
		alias: {
			site: path.resolve(__dirname, 'src/sites/twitch-twilight/')
		}
	}
});