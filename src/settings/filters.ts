'use strict';

// ============================================================================
// Profile Filters for Settings
// ============================================================================

import {glob_to_regex, escape_regex, matchScreen, ScreenOptions} from 'utilities/object';
import {FilterData, FilterType, createTester} from 'utilities/filtering';
import { DEBUG } from 'utilities/constants';
import type { ContextData } from './types';
import type { ScreenDetails } from 'root/types/getScreenDetails';
import SettingsManager from '.';

let safety: ((input: string | RegExp) => boolean) | null = null;

function loadSafety(callback?: () => void) {
	import(/* webpackChunkName: 'regex' */ 'safe-regex').then(thing => {
		safety = thing.default;
		if ( callback )
			callback();
	})
}

const NeverMatch = () => false;


// Logical Components

export const Invert: FilterType<FilterData[], ContextData> = {
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

export const And: FilterType<FilterData[], ContextData> = {
	createTest(config, rule_types, rebuild) {
		return createTester(config, rule_types, false, false, rebuild);
	},

	childRules: true,

	tall: true,
	title: 'And',
	i18n: 'settings.filter.and',

	default: () => [],
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/nested.vue')
};

export const Or: FilterType<FilterData[], ContextData> = {
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

type IfData = [
	condition: FilterData[],
	if_true: FilterData[],
	if_else: FilterData[]
];

export const If: FilterType<IfData, ContextData> = {
	createTest(config, rule_types, rebuild) {
		const cond = createTester(config[0], rule_types as any, false, false, rebuild),
			if_true = createTester(config[1], rule_types as any, false, false, rebuild),
			if_false = createTester(config[2], rule_types as any, false, false, rebuild);

		return ctx => cond(ctx) ? if_true(ctx) : if_false(ctx)
	},

	childRules: true,
	tall: true,
	title: 'If',
	i18n: 'settings.filter.if',

	default: () => [[], [], []],
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/if.vue')
};

export const Constant: FilterType<boolean, ContextData> = {
	createTest(config) {
		if ( config )
			return () => true;
		return NeverMatch;
	},

	title: 'True or False',
	i18n: 'settings.filter.true_false',

	default: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};


// Context Stuff

function parseTime(time: string) {
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

type TimeFilter = FilterType<[start: string, end: string], ContextData> & {
	_captured: Set<number>;
	captured: () => number[];
};

export const Time: TimeFilter = {
	_captured: new Set,

	createTest(config) {
		const start = parseTime(config[0]),
			end = parseTime(config[1]);

		if ( start == null || end == null )
			return NeverMatch;

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

export const TheaterMode: FilterType<boolean, ContextData> = {
	createTest(config) {
		return ctx => {
			if ( ctx.fullscreen )
				return config === false;
			return ctx.ui?.theatreModeEnabled === config;
		}
	},

	title: 'Theater Mode',
	i18n: 'settings.filter.theater',

	default: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const Fullscreen: FilterType<boolean, ContextData> = {
	createTest(config) {
		return ctx => ctx.fullscreen === config;
	},

	title: 'Fullscreen',
	i18n: 'settings.filter.fullscreen',

	default: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const Moderator: FilterType<boolean, ContextData> = {
	createTest(config) {
		return ctx => ctx.moderator === config;
	},

	title: 'Is Moderator',
	i18n: 'settings.filter.moderator',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const Debug: FilterType<boolean, ContextData> = {
	createTest(config) {
		return () => DEBUG === config;
	},

	title: 'Is Developer Mode',
	i18n: 'settings.filter.dev',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const AddonDebug: FilterType<boolean, ContextData> = {
	createTest(config) {
		return ctx => ctx.addonDev == config
	},

	title: 'Is Addon Developer Mode',
	i18n: 'settings.filter.addon-dev',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
}

export const SquadMode: FilterType<boolean, ContextData> = {
	createTest(config) {
		return ctx => ctx.ui?.squadModeEnabled === config;
	},

	title: 'Squad Mode',
	i18n: 'settings.filter.squad',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

export const NativeDarkTheme: FilterType<boolean, ContextData> = {
	createTest(config) {
		const val = config ? 1 : 0;
		return ctx => ctx.ui?.theme === val;
	},

	title: 'Dark Theme',
	i18n: 'settings.filter.native-dark',

	default: true,
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/basic-toggle.vue')
};

// TODO: Add typing.
type PageData = {
	route: string;
	values: Record<string, string>;
};

export const Page: FilterType<PageData, ContextData> = {
	createTest(config) {
		if ( ! config )
			return NeverMatch;

		const name = config.route,
			parts: [index: number, value: string][] = [];

		if ( Object.keys(config.values).length ) {
			const ffz = window.FrankerFaceZ?.get(),
				router = ffz && ffz.resolve('site.router') as any;

			if ( ! router )
				return NeverMatch;

			const route = router.getRoute(name);
			if ( ! route || ! route.parts )
				return NeverMatch;

			let i = 1;
			for(const part of route.parts) {
				if ( typeof part === 'object' ) {
					const val = config.values[part.name];
					if ( val && val.length )
						parts.push([i, val.toLowerCase()]);

					i++;
				}
			}
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

type ChannelData = {
	login: string | null;
	id: string | null;
};

export const Channel: FilterType<ChannelData, ContextData> = {
	createTest(config) {
		const login =  config?.login,
			id = config?.id;

		if ( ! id && ! login )
			return NeverMatch;

		else if ( ! id )
			return ctx => ctx.channel === login;

		else if ( ! login )
			return ctx => ctx.channelID === id;

		return ctx =>
			ctx.channelID === id ||
			(ctx.channelID == null && ctx.channel === login);
	},

	title: 'Current Channel',
	i18n: 'settings.filter.channel',

	default: () => ({
		login: null,
		id: null
	}),
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/channel.vue')
};

type CategoryData = {
	name: string | null;
	id: string | null;
}

export const Category: FilterType<CategoryData, ContextData> = {
	createTest(config) {
		const name = config?.name,
			id = config?.id;

		if ( ! id && ! name )
			return NeverMatch;

		else if ( ! id )
			return ctx => ctx.category === name;

		else if ( ! name )
			return ctx => ctx.categoryID === id;

		return ctx =>
			ctx.categoryID === id ||
			(ctx.categoryID == null && ctx.category === name);
	},

	title: 'Current Category',
	i18n: 'settings.filter.category',

	default: () => ({
		name: null,
		id: null
	}),

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/category.vue')
}

type TitleData = {
	title: string;
	mode: 'text' | 'glob' | 'raw' | 'regex';
	sensitive: boolean;
};

export const Title: FilterType<TitleData, ContextData> = {
	createTest(config, _, reload) {
		const mode = config?.mode;
		let title = config?.title,
			need_safety = true;

		if ( ! title || ! mode )
			return NeverMatch;

		if ( mode === 'text' ) {
			title = escape_regex(title);
			need_safety = false;
		} else if ( mode === 'glob' )
			title = glob_to_regex(title);
		else if ( mode !== 'raw' )
			return NeverMatch;

		if ( need_safety ) {
			if ( ! safety )
				loadSafety(reload);

			if ( ! safety || ! safety(title) )
				return NeverMatch;
		}

		let regex: RegExp;
		try {
			regex = new RegExp(title, `g${config.sensitive ? '' : 'i'}`);
		} catch(err) {
			return NeverMatch;
		}

		return ctx => {
			regex.lastIndex = 0;
			return ctx.title ? regex.test(ctx.title): false;
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

// Monitor Stuff

type MonitorType = FilterType<ScreenOptions, ContextData> & {
	_used: boolean;
	details?: ScreenDetails | null | false;

	used: () => boolean;

};

export let Monitor: MonitorType = null as any;

if ( window.getScreenDetails ) {

	Monitor = {
		_used: false,
		details: undefined,

		used: () => {
			const out = Monitor._used;
			Monitor._used = false;
			return out;
		},

		createTest(config, _, reload) {
			if ( ! config?.label )
				return NeverMatch;

			Monitor._used = true;
			if ( reload && Monitor.details === undefined ) {
				const FFZ = window.FrankerFaceZ ?? ((window as any).FFZBridge as any),
					ffz = FFZ?.get(),
					settings = ffz?.resolve('settings');
				if ( settings )
					settings.createMonitorUpdate().then(() => {
						reload();
					});
			}

			return () => {
				Monitor._used = true;
				const details = Monitor.details;
				if ( ! details )
					return false;

				const sorted = details.screens,
					matched = matchScreen(sorted, config);

				return matched === details.currentScreen;
			};
		},

		default: () => ({
			label: null
		}),

		title: 'Current Monitor',
		i18n: 'settings.filter.monitor',

		editor: () => import(/* webpackChunkName: 'main-menu' */ './components/monitor.vue')
	};

}
