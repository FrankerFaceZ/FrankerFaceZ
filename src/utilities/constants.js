'use strict';

export const DEBUG = localStorage.ffzDebugMode === 'true' && document.body.classList.contains('ffz-dev');
export const SERVER = DEBUG ? '//localhost:8000' : 'https://cdn.frankerfacez.com';

export const CLIENT_ID = 'a3bc9znoz6vi8ozsoca0inlcr4fcvkl';
export const API_SERVER = '//api.frankerfacez.com';

export const WS_CLUSTERS = {
	Production: [
		['wss://catbag.frankerfacez.com/', 0.25],
		['wss://andknuckles.frankerfacez.com/', 1],
		['wss://tuturu.frankerfacez.com/', 1],
		['wss://lilz.frankerfacez.com/', 1]
	],

	Development: [
		['wss://127.0.0.1:8003/', 1]
	]
}

export const IS_OSX = navigator.platform ? navigator.platform.indexOf('Mac') !== -1 : /OS X/.test(navigator.userAgent);
export const IS_WIN = navigator.platform ? navigator.platform.indexOf('Win') !== -1 : /Windows/.test(navigator.userAgent);
export const IS_WEBKIT = navigator.userAgent.indexOf('AppleWebKit/') !== -1 && navigator.userAgent.indexOf('Edge/') === -1;

export const WEBKIT_CSS = IS_WEBKIT ? '-webkit-' : '';