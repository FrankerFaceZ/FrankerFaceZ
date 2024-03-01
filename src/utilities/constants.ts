declare global {
	let __extension__: string | undefined;
}

/** Whether or not FrankerFaceZ was loaded from a development server. */
export const DEBUG = localStorage.ffzDebugMode === 'true' && document.body.classList.contains('ffz-dev');

/** Whether or not FrankerFaceZ was loaded as a packed web extension. */
export const EXTENSION = !!__extension__;

/** The base URL of the FrankerFaceZ CDN. */
export const SERVER = DEBUG ? 'https://localhost:8000' : 'https://cdn.frankerfacez.com';

let path = `${SERVER}/script`;

if ( EXTENSION ) {
	path = __webpack_public_path__;
	if ( path.endsWith('/') )
		path = path.slice(0, path.length - 1);
}

/** Either the base URL of the FrankerFaceZ CDN or, if FFZ was loaded as a packed web extension, the base URL of the web extension's web accessible files. */
export const SERVER_OR_EXT = path;

/** The base URL of the FrankerFaceZ API. */
export const API_SERVER = 'https://api.frankerfacez.com';

/** The base URL of the FrankerFaceZ staging API. */
export const STAGING_API = 'https://api-staging.frankerfacez.com';

/** The base URL of the FrankerFaceZ staging CDN. */
export const STAGING_CDN = 'https://cdn-staging.frankerfacez.com';

/** The base URL of the FrankerFaceZ testing API used for load testing. */
export const NEW_API = 'https://api2.frankerfacez.com';

/** The base URL provided to Sentry integrations for automatic error reporting. */
export const SENTRY_ID = 'https://74b46b3894114f399d51949c6d237489@sentry.frankerfacez.com/2';

export const WORD_SEPARATORS = '[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]';

/**
 * A map of default Twitch emotes with non-standard sizes, so they can be displayed
 * more accurately in certain situations.
 */
export const WEIRD_EMOTE_SIZES: Record<string, [width: number, height: number]> = {
	15: [21,27],
	16: [22,27],
	17: [20,27],
	18: [20,27],
	22: [19,27],
	25: [25,28],
	26: [20,27],
	28: [39,27],
	30: [29,27],
	32: [21,27],
	33: [25,32],
	34: [21,28],
	36: [36,30],
	40: [21,27],
	41: [19,27],
	46: [24,24],
	47: [24,24],
	50: [18,27],
	52: [32,32],
	65: [40,30],
	66: [20,27],
	69: [41,28],
	73: [21,30],
	74: [24,30],
	86: [36,30],
	87: [24,30],
	92: [23,30],
	244: [24,30],
	354: [20,30],
	357: [28,30],
	360: [22,30],
	483: [20,18],
	484: [20,22],
	485: [27,18],
	486: [21,32],
	487: [15,32],
	488: [29,24],
	489: [20,18],
	490: [20,18],
	491: [20,18],
	492: [20,18],
	493: [20,18],
	494: [20,18],
	495: [20,18],
	496: [20,18],
	497: [20,18],
	498: [20,18],
	499: [20,18],
	500: [20,18],
	501: [20,18],
	1896: [20,30],
	1898: [26,28],
	1899: [22,30],
	1900: [33,30],
	1901: [24,28],
	1902: [27,29],
	1904: [24,30],
	1906: [24,30]
};

/** A list of hotkey combinations that are not valid for one reason or another. */
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

/** A list of setting keys that, when changed, cause chat messages to re-render. */
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
	'chat.filtering.hidden-tokens',
	'chat.hype.message-style',
	'chat.filtering.show-reasons'
] as const;

/**
 * A list of setting keys that, when changed, cause chat messages to first clear
 * their badge caches and then re-render.
 */
export const UPDATE_BADGE_SETTINGS = [
	'chat.badges.style',
	'chat.badges.hidden',
	'chat.badges.custom-mod',
	'chat.badges.custom-vip',
] as const;

/**
 * A list of setting keys that, when changed, cause chat messages to first clear
 * their cached token lists and then re-render.
 */
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
] as const;

/**
 * A list of keycodes for specific keys, for use with
 * {@link KeyboardEvent} events.
 */
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
} as const;

/** The base URL for Twitch emote images. */
export const TWITCH_EMOTE_V2 = '//static-cdn.jtvnw.net/emoticons/v2';

/**
 * A map of regex-style Twitch emote codes into normal,
 * human-readable strings for display in UI.
 */
export const KNOWN_CODES: Record<string, string> = {
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

/** The base URL for replacement images used for specific Twitch emotes. */
export const REPLACEMENT_BASE = `${SERVER}/static/replacements/`;

/** A map of specific Twitch emotes that should use replacement images. */
export const REPLACEMENTS: Record<string, string> = {
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

/**
 * A map of WebSocket servers for the original FrankerFaceZ socket
 * system. @deprecated
 */
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
		['ws://127.0.0.1:7999/', 1]
	]
}


export const LINK_DATA_HOSTS = {
	socket: {
		title: 'Socket Cluster (Deprecated)',
		value: 'special:socket'
	},
	localhost: {
		title: 'Local Dev Server (Port 8002)',
		value: 'https://localhost:8002',
		has_sse: true
	},
	'localhost-cf': {
		title: 'Local Dev Worker (Wrangler, Port 8787)',
		value: 'https://localhost:8787'
	},
	test: {
		title: 'API Test Server',
		value: 'https://api-test.frankerfacez.com/v2/link'
	},
	'test-cf': {
		title: 'Cloudflare Test Worker',
		value: 'https://link-service.workers.frankerfacez.com'
	},
	Production: {
		title: 'Production',
		value: 'https://api.frankerfacez.com/v2/link'
	}
};


export const PUBSUB_CLUSTERS = {
	Production: `https://pubsub.frankerfacez.com`,
	Staging: `https://pubsub-staging-alt.frankerfacez.com`,
	EMQXTest: 'emqx-test',
	Development: `https://stendec.dev/ps/`
}

export const EMQX_SERVERS = [
	//'catbag.frankerfacez.com',
	//'pubsub-staging.frankerfacez.com',
	'ayaya.frankerfacez.com',
	'champ.frankerfacez.com',
	'lilz.frankerfacez.com',
	'pog.frankerfacez.com',
	'yoohoo.frankerfacez.com',
	'andknuckles.frankerfacez.com'
];


/** Whether or not we're running on macOS */
export const IS_OSX = navigator.platform ? navigator.platform.indexOf('Mac') !== -1 : /OS X/.test(navigator.userAgent);

/** Whether or not we're running on Windows */
export const IS_WIN = navigator.platform ? navigator.platform.indexOf('Win') !== -1 : /Windows/.test(navigator.userAgent);

/** Whether or not we're running on a Webkit-based browser. */
export const IS_WEBKIT = navigator.userAgent.indexOf('AppleWebKit/') !== -1 && navigator.userAgent.indexOf('Edge/') === -1;

/** Whether or not we're running on a Firefox-based browser. */
export const IS_FIREFOX = (navigator.userAgent.indexOf('Firefox/') !== -1);

/**
 * A -webkit- CSS prefix, if we're running on a Webkit-based browser.
 * Hopefully we don't need this anymore.
 * @deprecated
 */
export const WEBKIT_CSS = IS_WEBKIT ? '-webkit-' : '';

/** A list of Twitch emote sets that are globally available. */
export const TWITCH_GLOBAL_SETS = [0, 33, 42] as const;

/** A list of Twitch emote sets that are for emotes unlocked with channel points. */
export const TWITCH_POINTS_SETS = [300238151] as const;

/** A list of Twitch emote sets that are for Twitch Prime subscribers. */
export const TWITCH_PRIME_SETS = [457, 793, 19151, 19194] as const;

/** An enum of all possible Twitch emote types. */
export enum EmoteTypes {
	/** What kind of weird emote are you dragging in here */
	Unknown,
	/** Emotes unlocked via Twitch Prime */
	Prime,
	/** Emotes unlocked via Twitch Turbo */
	Turbo,
	/** Emotes unlocked via arbitrary condition, permanently available. */
	LimitedTime,
	/** Emotes unlocked via channel points. */
	ChannelPoints,
	/** Emote no longer available. */
	Unavailable,
	/** Emote unlocked via subscription to channel. */
	Subscription,
	/** Emote permanently unlocked via cheering in channel. */
	BitsTier,
	/** Globally available emote. */
	Global,
	/** Emote unlocked via enabling two-factor authentication. */
	TwoFactor,
	/** Emote unlocked via following a channel. */
	Follower
};


export const RESOLVERS_REQUIRE_TOS = {
	'YouTube': {
		label: 'You must agree to the YouTube Terms of Service to view this embed.',
		i18n_key: 'embed.warn.youtube',

		i18n_links: 'embed.warn.youtube.links',
		links: `To view YouTube embeds, you must agree to YouTube's Terms of Service:
* [Terms of Service](https://www.youtube.com/t/terms)
* [Privacy Policy](https://policies.google.com/privacy)`,

		i18n_accept: 'embed.warn.youtube.agree',
		accept: 'Yes, I accept the YouTube Terms of Service.'
	},

} as Record<string, any>;
