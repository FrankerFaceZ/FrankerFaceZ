'use strict';

// ============================================================================
// Profile Filters for Settings
// ============================================================================

import {createTester} from 'utilities/filtering';

// Logical Components

export const Invert = {
	createTest(config, rule_types) {
		return createTester(config, rule_types, true)
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
	createTest(config, rule_types) {
		return createTester(config, rule_types, false, true);
	},

	childRules: true,

	tall: true,
	title: 'Or',
	i18n: 'settings.filter.or',

	default: () => [],
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/nested.vue')
};


// Context Stuff

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
			const ffz = FrankerFaceZ.get(),
				router = ffz && ffz.resolve('site.router');

			if ( router ) {
				const route = router.getRoute(name);
				if ( ! route || ! route.parts )
					return () => false;

				let i = 1;
				for(const part of route.parts) {
					if ( typeof part === 'object' ) {
						if ( config.values[part.name] != null )
							parts.push([i, config.values[part.name]]);

						i++;
					}
				}

			} else
				return () => false;
		}

		return ctx => {
			if ( ! ctx.route || ! ctx.route_data || ctx.route.name !== name )
				return false;

			for(const [index, value] of parts)
				if ( ctx.route_data[index] !== value )
					return false;

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