'use strict';

export const DEBUG = localStorage.ffzDebugMode === 'true' && document.body.classList.contains('ffz-dev');
export const SERVER = DEBUG ? '//localhost:8000' : 'https://cdn.frankerfacez.com';

export const CLIENT_ID = 'a3bc9znoz6vi8ozsoca0inlcr4fcvkl';
export const API_SERVER = '//api.frankerfacez.com';

export const TWITCH_EMOTE_BASE = '//static-cdn.jtvnw.net/emoticons/v1/';

export const KNOWN_CODES = {
	'#-?[\\\\/]': '#-/',
	':-?(?:7|L)': ':-7',
	'\\&lt\\;\\]': '<]',
	'\\:-?(S|s)': ':-S',
	'\\:-?\\\\': ':-\\',
	'\\:\\&gt\\;': ':>',
	'B-?\\)': 'B-)',
	'\\:-?[z|Z|\\|]': ':-Z',
	'\\:-?\\)': ':-)',
	'\\:-?\\(': ':-(',
	'\\:-?(p|P)': ':-P',
	'\\;-?(p|P)': ';-P',
	'\\&lt\\;3': '<3',
	'\\:-?[\\\\/]': ':-/',
	'\\;-?\\)': ';-)',
	'R-?\\)': 'R-)',
	'[oO](_|\\.)[oO]': 'O.o',
	'[o|O](_|\\.)[o|O]': 'O.o',
	'\\:-?D': ':-D',
	'\\:-?(o|O)': ':-O',
	'\\&gt\\;\\(': '>(',
	'Gr(a|e)yFace': 'GrayFace'
};

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