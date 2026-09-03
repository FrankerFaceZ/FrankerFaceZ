'use strict';

// ============================================================================
// Emote Settings
// Settings definitions registered from the module constructor. `emotes` is
// the module instance; every callback uses it where it used to use `this`.
// ============================================================================

import {deep_copy} from 'utilities/object';
import {EFFECT_STYLES} from './emote_effects';


export function defineSettings(emotes) {

	emotes.settings.add('chat.emotes.source-priorities', {
		default: null,
		ui: {
			path: 'Chat > Emote Priorities',
			component: 'emote-priorities',
			data: () => deep_copy(emotes.providers)
		}
	});

	emotes.settings.add('chat.emotes.enabled', {
		default: 2,
		ui: {
			path: 'Chat > Appearance >> Emotes',
			title: 'Display Emotes',
			sort: -100,
			force_seen: true,
			description: 'If you do not wish to see emotes, you can disable them here.',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Disabled'},
				{value: 1, title: 'Twitch Only'},
				{value: 2, title: 'Enabled'}
			]
		}
	});

	emotes.settings.add('chat.emotes.2x', {
		default: 0,
		process(ctx, val) {
			if ( val === true ) return 1;
			else if ( val === false ) return 0;
			return val;
		},
		ui: {
			path: 'Chat > Appearance >> Emotes',
			title: 'Larger Emotes',
			description: 'This setting will make emotes appear twice as large in chat. It\'s good for use with larger fonts or just if you really like emotes.',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Disabled'},
				{value: 1, title: 'Emotes'},
				{value: 2, title: 'Emotes and Emoji'}
			]
		}
	});

	emotes.settings.add('chat.emotes.limit-size', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Emotes',
			title: 'Limit Native Emote Size',
			description: 'Sometimes, really obnoxiously large emotes slip through the cracks and wind up on Twitch. This limits the size of Twitch emotes to mitigate the issue.',
			component: 'setting-check-box'
		}
	});

	emotes.settings.add('chat.emotes.allow-gigantify', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Emotes',
			title: 'Allow "Gigantify an Emote" Power-Up',
			description: 'How big is too big? Giant? Disable this and the emotes will be displayed normally.',
			component: 'setting-check-box'
		}
	});

	emotes.settings.add('chat.fix-bad-emotes', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Emotes',
			title: 'Fix Bad Twitch Global Emotes',
			description: 'Clean up the images for bad Twitch global emotes, removing white borders and solid backgrounds.',
			component: 'setting-check-box'
		}
	});

	emotes.settings.add('chat.click-emotes', {
		default: true,

		ui: {
			path: 'Chat > Behavior >> General',
			title: 'Open emote information pages by Shift-Clicking them.',
			component: 'setting-check-box'
		}
	});

	emotes.settings.add('chat.sub-emotes', {
		default: true,
		ui: {
			path: 'Chat > Behavior >> General',
			title: 'Open Twitch subscription pages by Shift-Clicking emotes when relevant.',
			component: 'setting-check-box'
		}
	});

	emotes.settings.add('chat.emote-dialogs', {
		default: true,
		ui: {
			path: 'Chat > Behavior >> General',
			title: 'Open emote information cards for Twitch emotes by clicking them.',
			component: 'setting-check-box'
		}
	});

	emotes.settings.add('chat.effects.enable', {
		default: true,
		ui: {
			path: 'Chat > Emote Effects >> General',
			title: 'Enable the use of emote effects.',
			description: 'Emote Effects are special effects that can be applied to some emotes using special modifiers.',
			component: 'setting-check-box'
		}
	});

	for(const val of EFFECT_STYLES) {
		if ( ! val.setting || Array.isArray(val.setting) )
			continue;

		const setting = {
			default: val.animation
				? null
				: true,
			ui: {
				path: 'Chat > Emote Effects >> Specific Effect @{"description": "**Note:** Animated effects are, by default, only enabled when [Animated Emotes](~chat.appearance.emotes) are enabled."}',
				title: `Enable the effect "${val.title ?? val.setting}".`,
				component: 'setting-check-box',
				force_seen: true
			}
		};

		if ( val.animation ) {
			setting.default = null;
			setting.requires = ['chat.emotes.animated'];
			setting.process = function(ctx, val) {
				if ( val == null )
					return ctx.get('chat.emotes.animated') === 1;
				return val;
			};
		}

		emotes.settings.add(`chat.effects.${val.setting}`, setting);
	}

}
