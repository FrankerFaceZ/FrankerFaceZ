'use strict';

// ============================================================================
// Profile Filters for Settings
// ============================================================================

import {glob_to_regex, escape_regex} from 'utilities/object';
import {createTester} from 'utilities/filtering';
import { DEBUG } from 'utilities/constants';

let safety = null;

function loadSafety(cb) {
	import(/* webpackChunkName: 'regex' */ 'safe-regex').then(thing => {
		safety = thing.default;
		if ( cb )
			cb();
	})
}


// Logical Components

export const Invert = {
	createTest(config, rule_types, rebuild) {
		return createTester(config, rule_types, true, false, rebuild)
	},

	maxRules: 1,
	childRules: true,

	tall: true,
	title: 'Invert',
	i18n: 'settings.filter.invert',

	default: () => [],
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/nested.vue')
};

export const Or = {
	createTest(config, rule_types, rebuild) {
		return createTester(config, rule_types, false, true, rebuild);
	},

	childRules: true,

	tall: true,
	title: 'Or',
	i18n: 'settings.filter.or',

	default: () => [],
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/nested.vue')
};

export const If = {
	createTest(config, rule_types, rebuild) {
		const cond = createTester(config[0], rule_types, false, false, rebuild),
			if_true = createTester(config[1], rule_types, false, false, rebuild),
			if_false = createTester(config[2], rule_types, false, false, rebuild);

		return ctx => cond(ctx) ? if_true(ctx) : if_false(ctx)
	},

	childRules: true,
	tall: true,
	title: 'If',
	i18n: 'settings.filter.if',

	default: () => [[], [], []],
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/if.vue')
};

export const Constant = {
	createTest(config) {
		if ( config )
			return () => true;
		return () => false;
	},

	title: 'True or False',
	i18n: 'settings.filter.true_false',

	default: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
}


// Context Stuff

function parseTime(time) {
	if ( typeof time !== 'string' || ! time.length )
		return null;

	const idx = time.indexOf(':');
	if ( idx === -1 )
		return null;

	let hours, minutes;
	try {
		hours = parseInt(time.slice(0, idx), 10);
		minutes = parseInt(time.slice(idx + 1), 10);

	} catch(err) {
		return null;
	}

	return hours * 60 + minutes;
}

export const Time = {
	_captured: new Set,

	createTest(config) {
		const start = parseTime(config[0]),
			end = parseTime(config[1]);

		if ( start == null || end == null )
			return () => false;

		if ( start <= end )
			return () => {
				Time._captured.add(start);
				Time._captured.add(end + 1);

				const d = new Date,
					v = d.getHours() * 60 + d.getMinutes();

				return v >= start && v <= end;
			}

		return () => {
			Time._captured.add(start + 1);
			Time._captured.add(end);

			const d = new Date,
				v = d.getHours() * 60 + d.getMinutes();

			return v >= start || v <= end;
		}
	},

	captured: () => {
		const out = Array.from(Time._captured);
		Time._captured = new Set;
		out.sort((a, b) => a - b);
		return out;
	},

	title: 'Time of Day',
	i18n: 'settings.filter.time',

	default: () => ['08:00', '18:00'],

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/time.vue')
}

export const TheaterMode = {
	createTest(config) {
		return ctx => ctx.ui && ctx.ui.theatreModeEnabled === config;
	},

	title: 'Theater Mode',
	i18n: 'settings.filter.theater',

	default: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const Moderator = {
	createTest(config) {
		return ctx => ctx.moderator === config;
	},

	title: 'Is Moderator',
	i18n: 'settings.filter.moderator',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const Debug = {
	createTest(config) {
		return () => DEBUG === config;
	},

	title: 'Is Developer Mode',
	i18n: 'settings.filter.dev',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const AddonDebug = {
	createTest(config) {
		return ctx => ctx.addonDev == config
	},

	title: 'Is Addon Developer Mode',
	i18n: 'settings.filter.addon-dev',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
}

export const SquadMode = {
	createTest(config) {
		return ctx => ctx.ui && ctx.ui.squadModeEnabled === config;
	},

	title: 'Squad Mode',
	i18n: 'settings.filter.squad',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const NativeDarkTheme = {
	createTest(config) {
		const val = config ? 1 : 0;
		return ctx => ctx.ui && ctx.ui.theme === val;
	},

	title: 'Dark Theme',
	i18n: 'settings.filter.native-dark',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const Page = {
	createTest(config = {}) {
		const name = config.route,
			parts = [];

		if ( Object.keys(config.values).length ) {
			const ffz = window.FrankerFaceZ?.get(),
				router = ffz && ffz.resolve('site.router');

			if ( router ) {
				const route = router.getRoute(name);
				if ( ! route || ! route.parts )
					return () => false;

				let i = 1;
				for(const part of route.parts) {
					if ( typeof part === 'object' ) {
						const val = config.values[part.name];
						if ( val && val.length )
							parts.push([i, val.toLowerCase()]);

						i++;
					}
				}

			} else
				return () => false;
		}

		return ctx => {
			if ( ! ctx.route || ! ctx.route_data || ctx.route.name !== name )
				return false;

			for(const [index, value] of parts) {
				let thing = ctx.route_data[index];
				if ( typeof thing === 'string' )
					thing = thing.toLowerCase();

				if ( thing !== value )
					return false;
			}

			return true;
		}
	},

	tall: true,
	title: 'Current Page',
	i18n: 'settings.filter.page',

	default: () => ({
		route: 'front-page',
		values: {}
	}),
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/page.vue')
};

export const Channel = {
	createTest(config = {}) {
		const login =  config.login,
			id = config.id;

		return ctx => ctx.channelID === id || (ctx.channelID == null && ctx.channelLogin === login);
	},

	title: 'Current Channel',
	i18n: 'settings.filter.channel',

	default: () => ({
		login: null,
		id: null
	}),
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/channel.vue')
};

export const Category = {
	createTest(config = {}) {
		const name = config.name,
			id = config.id;

		if ( ! id || ! name )
			return () => false;

		return ctx => ctx.categoryID === id || (ctx.categoryID == null && ctx.category === name);
	},

	title: 'Current Category',
	i18n: 'settings.filter.category',

	default: () => ({
		name: null,
		id: null
	}),

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/category.vue')
}

export const Title = {
	createTest(config = {}, _, reload) {
		const mode = config.mode;
		let title = config.title,
			need_safety = true;

		if ( ! title || ! mode )
			return () => false;

		if ( mode === 'text' ) {
			title = escape_regex(title);
			need_safety = false;
		} else if ( mode === 'glob' )
			title = glob_to_regex(title);
		else if ( mode !== 'raw' )
			return () => false;

		if ( need_safety ) {
			if ( ! safety )
				loadSafety(reload);

			if ( ! safety || ! safety(title) )
				return () => false;
		}

		let regex;
		try {
			regex = new RegExp(title, `g${config.sensitive ? '' : 'i'}`);
		} catch(err) {
			return () => false;
		}

		return ctx => {
			regex.lastIndex = 0;
			return ctx.title && regex.test(ctx.title);
		}
	},

	title: 'Current Title',
	i18n: 'settings.filter.title',

	default: () => ({
		title: '',
		mode: 'text',
		sensitive: false
	}),

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/title.vue')
};