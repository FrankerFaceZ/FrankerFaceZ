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

export const WORD_SEPARATORS = '[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]';

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


export const RERENDER_SETTINGS = [
	'chat.name-format',
	'chat.me-style',
	'chat.rituals.show',
	'chat.subs.show',
	'chat.subs.compact',
	'chat.actions.inline',
	'chat.actions.hover',
	'chat.timestamp-format',
	'chat.points.allow-highlight',
	'chat.filtering.display-deleted',
	'chat.filtering.display-mod-action',
	'chat.replies.style',
	'chat.bits.cheer-notice',
	'chat.filtering.hidden-tokens'
];

export const UPDATE_BADGE_SETTINGS = [
	'chat.badges.style',
	'chat.badges.hidden',
	'chat.badges.custom-mod',
	'chat.badges.custom-vip',
];

export const UPDATE_TOKEN_SETTINGS = [
	'chat.emotes.enabled',
	'chat.emotes.2x',
	'chat.emotes.animated',
	'chat.emoji.style',
	'chat.emoji.replace-joiner',
	'chat.bits.stack',
	'chat.rich.enabled',
	'chat.rich.want-mid',
	'chat.rich.hide-tokens',
	'chat.rich.all-links',
	'chat.rich.minimum-level',
	'chat.filtering.process-own',
	'chat.filtering.mention-priority',
	'chat.filtering.debug',
	'chat.fix-bad-emotes',
	'__filter:highlight-terms',
	'__filter:highlight-users',
	'__filter:highlight-badges',
	'__filter:block-terms',
	'__filter:block-users',
	'__filter:block-badges'
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
export const TWITCH_EMOTE_V2 = '//static-cdn.jtvnw.net/emoticons/v2';

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
	'TwoFactor',
	'Follower'
);