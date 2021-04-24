'use strict';

import {make_enum} from 'utilities/object';


export const DEBUG = localStorage.ffzDebugMode === 'true' && document.body.classList.contains('ffz-dev');
export const SERVER = DEBUG ? '//localhost:8000' : 'https://cdn.frankerfacez.com';

export const CLIENT_ID = 'a3bc9znoz6vi8ozsoca0inlcr4fcvkl';
export const API_SERVER = '//api.frankerfacez.com';
export const NEW_API = '//api2.frankerfacez.com';

//export const SENTRY_ID = 'https://1c3b56f127254d3ba1bd1d6ad8805eee@sentry.io/1186960';
//export const SENTRY_ID = 'https://07ded545d3224ca59825daee02dc7745@catbag.frankerfacez.com:444/2';
export const SENTRY_ID = 'https://74b46b3894114f399d51949c6d237489@sentry.frankerfacez.com/2';


export const LV_SERVER = 'https://cbenni.com/api';
export const LV_SOCKET_SERVER = 'wss://cbenni.com/socket.io/';


export const BAD_HOTKEYS = [
	'f',
	'space',
	'k',
	'shift+up',
	'shift+down',
	'esc',
	'm',
	'?',
	'alt+t',
	'alt+x'
];


export const KEYS = {
	Tab: 9,
	Enter: 13,
	Shift: 16,
	Control: 17,
	Alt: 18,
	Escape: 27,
	Space: 32,
	PageUp: 33,
	PageDown: 34,
	End: 35,
	Home: 36,
	ArrowLeft: 37,
	ArrowUp: 38,
	ArrowRight: 39,
	ArrowDown: 40,
	Meta: 91,
	Context: 93
};


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

export const REPLACEMENT_BASE = `${SERVER}/static/replacements/`;

export const REPLACEMENTS = {
	15: '15-JKanStyle.png',
	16: '16-OptimizePrime.png',
	17: '17-StoneLightning.png',
	18: '18-TheRinger.png',
	//19: '19-PazPazowitz.png',
	//20: '20-EagleEye.png',
	//21: '21-CougarHunt.png',
	22: '22-RedCoat.png',
	26: '26-JonCarnage.png',
	//27: '27-PicoMause.png',
	30: '30-BCWarrior.png',
	33: '33-DansGame.png',
	36: '36-PJSalt.png'
};


export const WS_CLUSTERS = {
	Production: [
		['wss://catbag.frankerfacez.com/', 0.25],
		['wss://andknuckles.frankerfacez.com/', 0.8],
		['wss://tuturu.frankerfacez.com/', 0.7],
		['wss://lilz.frankerfacez.com/', 1],
		['wss://yoohoo.frankerfacez.com/', 1],
		['wss://pog.frankerfacez.com/', 1],
		['wss://ayaya.frankerfacez.com/', 1],
		['wss://champ.frankerfacez.com/', 1]
	],

	Development: [
		['wss://127.0.0.1:8003/', 1]
	]
}

export const IS_OSX = navigator.platform ? navigator.platform.indexOf('Mac') !== -1 : /OS X/.test(navigator.userAgent);
export const IS_WIN = navigator.platform ? navigator.platform.indexOf('Win') !== -1 : /Windows/.test(navigator.userAgent);
export const IS_WEBKIT = navigator.userAgent.indexOf('AppleWebKit/') !== -1 && navigator.userAgent.indexOf('Edge/') === -1;
export const IS_FIREFOX = (navigator.userAgent.indexOf('Firefox/') !== -1) || (window.InstallTrigger !== undefined);

export const WEBKIT_CSS = IS_WEBKIT ? '-webkit-' : '';


export const TWITCH_GLOBAL_SETS = [0, 33, 42];
export const TWITCH_POINTS_SETS = [300238151];
export const TWITCH_PRIME_SETS = [457, 793, 19151, 19194];

export const EmoteTypes = make_enum(
	'Unknown',
	'Prime',
	'Turbo',
	'LimitedTime',
	'ChannelPoints',
	'Unavailable',
	'Subscription',
	'BitsTier',
	'Global',
	'TwoFactor'
);