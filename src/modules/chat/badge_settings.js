'use strict';

// ============================================================================
// Badge Settings
// Settings definitions registered from the module constructor. `badges` is
// the module instance; every callback uses it where it used to use `this`.
// ============================================================================

import {IS_FIREFOX} from 'utilities/constants';


export function defineSettings(badges) {

	if ( IS_FIREFOX )
		badges.settings.add('chat.badges.media-queries', {
			default: true,
			ui: {
				path: 'Chat > Badges >> tabs ~> Appearance',
				title: 'Use @media queries to support High-DPI Badge images in Mozilla Firefox.',
				description: 'This is required to see high-DPI badges on Firefox because Firefox still has yet to support `image-set()` after more than five years. It may be less reliable.',
				component: 'setting-check-box'
			}
		});

	badges.settings.add('chat.badges.unify-bot-badge', {
		default: 2,
		ui: {
			path: 'Chat > Badges > tabs ~> Appearance',
			title: 'Unified Bot Badge',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Disabled'},
				{value: 1, title: 'FFZ-Style Badge'},
				{value: 2, title: 'Twitch-Style Badge'}
			]
		}
	});

	badges.settings.add('chat.badges.version', {
		default: 2,
		ui: {
			path: 'Chat > Badges >> tabs ~> Appearance',
			title: 'Version',
			component: 'setting-select-box',
			data: [
				{value: 1, title: '1 (Pre December 2019)'},
				{value: 2, title: '2 (Current)'}
			]
		}
	});

	badges.settings.add('chat.badges.clickable', {
		default: 2,
		process(ctx, val) {
			if (val === true)
				return 2;
			else if (val === false)
				return 0;
			return val;
		},
		ui: {
			path: 'Chat > Badges >> Behavior',
			title: 'Allow clicking badges.',
			description: 'Certain badges, such as Prime Gaming, act as links when this is enabled.',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Disabled'},
				{value: 1, title: 'Legacy (Open URLs)'},
				{value: 2, title: 'Open Badge Card'}
			]
		}
	});

	badges.settings.add('chat.badges.fix-colors', {
		default: true,
		ui: {
			path: 'Chat > Badges >> tabs ~> Appearance',
			title: 'Adjust badge colors for visibility.',
			description: 'Ensures that badges are visible against the current background.\n\n**Note:** Only affects badges with custom rendering. Subscriber badges, bit badges, etc. are not affected.',
			component: 'setting-check-box'
		}
	});

	badges.settings.add('chat.badges.hidden', {
		default: {},
		type: 'object_merge',
		ui: {
			path: 'Chat > Badges >> tabs ~> Visibility',
			title: 'Visibility',
			component: 'badge-visibility',
			getBadges: cb => badges.getSettingsBadges(true, cb)
		}
	});

	badges.settings.add('chat.badges.custom-mod', {
		default: true,
		ui: {
			path: 'Chat > Badges >> tabs ~> Appearance',
			title: 'Use custom moderator badges where available.',
			component: 'setting-check-box'
		}
	});

	badges.settings.add('chat.badges.custom-vip', {
		default: true,
		ui: {
			path: 'Chat > Badges >> tabs ~> Appearance',
			title: 'Use custom VIP badges where available.',
			component: 'setting-check-box'
		}
	});

	badges.settings.add('chat.badges.style', {
		default: 1,
		ui: {
			path: 'Chat > Badges >> tabs ~> Appearance',
			title: 'Style',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Square'},
				{value: 1, title: 'Rounded'},
				{value: 2, title: 'Circular'},
				{value: 3, title: 'Circular (Color Only)'},
				{value: 4, title: 'Circular (Color Only, Small)'},
				{value: 5, title: 'Transparent'},
				{value: 6, title: 'Transparent (Colored)'}
			]
		}
	});

}
