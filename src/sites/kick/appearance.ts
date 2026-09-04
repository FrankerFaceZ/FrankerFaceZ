'use strict';

// ============================================================================
// Appearance
//
// Looks for Kick: a Twitch-like palette, a toned-down accent, chat density
// and hiding parts of Kick's layout. All of it is CSS. The palette and
// accent override the design tokens Kick's own styles are built on (see
// css_tweaks/), chat density sets the variables Kick's chat already reads,
// and the hides are element rules (see the site module). Each is a setting
// under Appearance or Chat in the control center. Badges have their own
// module (badges.ts).
// ============================================================================

import Module, {type GenericModule} from 'utilities/module';

import type SettingsManager from 'src/settings';
import type CSSTweaks from 'utilities/css-tweaks';
import type {SettingsKeys, SettingType} from 'src/settings/types';


export default class Appearance extends Module<'site.appearance'> {

	// Dependencies
	settings: SettingsManager = null as any;
	css_tweaks: CSSTweaks = null as any;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');
		this.inject('site.css_tweaks');

		this.should_enable = true;

		// ------------------------------------------------------------------
		// Theme
		// ------------------------------------------------------------------

		this.settings.add('kick.theme.palette', {
			default: 1,
			ui: {
				path: 'Appearance > Theme >> Colors',
				title: 'Background Palette',
				description: 'The greys Kick\'s pages are drawn with. Twitch\'s palette is darker and less blue.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Kick\'s Own'},
					{value: 1, title: 'Twitch-like Dark'}
				]
			}
		});

		this.settings.add('kick.theme.darker-accent', {
			default: true,
			ui: {
				path: 'Appearance > Theme >> Colors',
				title: 'Tone down Kick\'s green a little.',
				component: 'setting-check-box'
			}
		});

		// ------------------------------------------------------------------
		// Layout
		// ------------------------------------------------------------------

		this.settings.add('kick.layout.hide-recommended', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Sidebar',
				title: 'Hide recommended channels.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.layout.compact-header', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Channel',
				title: 'Compact channel header.',
				description: 'A smaller avatar, pill-shaped buttons and tighter spacing, closer to Twitch\'s.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.layout.hide-gift-subs', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Channel',
				title: 'Hide the Gift Subs button.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.layout.hide-kicks', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Top Bar',
				title: 'Hide the Kicks balance.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.layout.hide-chat-banners', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Chat',
				title: 'Hide the banners above chat.',
				description: 'The leaderboard, predictions, polls, drops and pinned messages Kick stacks above the messages.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.layout.hide-new-messages', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Chat',
				title: 'Hide the "New messages" divider.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.layout.hide-quick-emotes', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Chat',
				title: 'Hide the row of emotes above the chat box.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.layout.hide-chat-stats', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Chat',
				title: 'Hide the viewer count and Kicks below the chat box.',
				component: 'setting-check-box'
			}
		});

		// ------------------------------------------------------------------
		// Chat
		// ------------------------------------------------------------------

		this.settings.add('kick.chat.font-size', {
			default: 13,
			ui: {
				path: 'Chat > Appearance >> General',
				title: 'Font Size',
				description: 'How large chat text should be, in pixels. Twitch uses 13; Kick\'s default is 14. Set to 0 to use Kick\'s own chat setting instead.',
				component: 'setting-text-box',
				process: 'to_int',
				bounds: [0]
			}
		});

		this.settings.add('kick.chat.message-spacing', {
			default: 2,
			ui: {
				path: 'Chat > Appearance >> General',
				title: 'Message Spacing',
				description: 'Space above and below each message, in pixels. Kick\'s default is 4. Set to -1 to use Kick\'s own chat setting instead.',
				component: 'setting-text-box',
				process: 'to_int',
				bounds: [-1]
			}
		});

		this.settings.add('kick.chat.lines.alternate', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Display lines with alternating background colors.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.chat.input-style', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> General',
				title: 'Twitch-style chat box.',
				description: 'A thin border and a lifted background instead of Kick\'s outline and white focus ring.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.chat.mod-actions', {
			default: 0,
			ui: {
				path: 'Chat > Behavior >> Moderation',
				title: 'Mod Actions',
				description: 'Kick\'s own ban, timeout and delete buttons at the start of each line, for moderators.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Kick\'s Setting'},
					{value: 1, title: 'Always Shown'},
					{value: 3, title: 'Shown on Hover'},
					{value: 2, title: 'Hidden'}
				]
			}
		});

		this.settings.add('kick.chat.mod-actions.style', {
			default: 1,
			ui: {
				path: 'Chat > Behavior >> Moderation',
				title: 'Mod Action Style',
				description: 'Twitch-style draws them small and grey, lit when hovered, the way Twitch draws its mod icons.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Kick\'s Own'},
					{value: 1, title: 'Twitch-style'}
				]
			}
		});

		this.settings.add('kick.chat.timestamps', {
			default: 1,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Timestamps',
				description: 'FrankerFaceZ timestamps use the format chosen below.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Kick\'s Setting'},
					{value: 1, title: 'Shown, FrankerFaceZ Format'},
					{value: 2, title: 'Hidden'}
				]
			}
		});
	}

	onEnable() {
		const tweaks = this.css_tweaks,
			hide = <K extends SettingsKeys>(key: K, rule: string) =>
				this.settings.getChanges(key, (val: SettingType<K>) => tweaks.toggleHide(rule, !! val));

		this.settings.getChanges('kick.theme.palette', val =>
			tweaks.toggle('palette', val === 1));

		this.settings.getChanges('kick.theme.darker-accent', val =>
			tweaks.toggle('accent', val));

		hide('kick.layout.hide-recommended', 'sidebar-recommended');
		hide('kick.layout.hide-gift-subs', 'gift-subs');
		hide('kick.layout.hide-kicks', 'kicks-balance');

		this.settings.getChanges('kick.layout.compact-header', val =>
			tweaks.toggle('compact-header', val));

		this.settings.getChanges('kick.chat.input-style', val =>
			tweaks.toggle('chat-input', val));

		this.settings.getChanges('kick.chat.mod-actions', val => {
			if ( val === 1 || val === 3 )
				tweaks.set('chat-mod-actions', 'html{--chatroom-mod-actions-display:inline-flex !important}');
			else if ( val === 2 )
				tweaks.set('chat-mod-actions', 'html{--chatroom-mod-actions-display:none !important}');
			else
				tweaks.delete('chat-mod-actions');

			tweaks.toggle('mod-actions-hover', val === 3);
		});

		this.settings.getChanges('kick.chat.mod-actions.style', val =>
			tweaks.toggle('mod-actions-compact', val === 1));
		hide('kick.layout.hide-chat-banners', 'chat-banners');
		hide('kick.layout.hide-new-messages', 'chat-divider');
		hide('kick.layout.hide-quick-emotes', 'quick-emotes');
		hide('kick.layout.hide-chat-stats', 'chat-stats');

		// Kick sets these variables inline on the root element from its own
		// chat settings; an !important rule on the root outranks that.
		this.settings.getChanges('kick.chat.font-size', val => {
			if ( val > 0 )
				tweaks.set('chat-font', `html{--chatroom-font-size:${val}px !important}`);
			else
				tweaks.delete('chat-font');
		});

		this.settings.getChanges('kick.chat.message-spacing', val => {
			if ( val >= 0 )
				tweaks.set('chat-spacing', `html{--chatroom-message-spacing:${val}px !important}`);
			else
				tweaks.delete('chat-spacing');
		});

		this.settings.getChanges('kick.chat.timestamps', val => {
			if ( val === 1 )
				tweaks.set('chat-timestamps', 'html{--chatroom-timestamps-display:inline-block !important}');
			else if ( val === 2 )
				tweaks.set('chat-timestamps', 'html{--chatroom-timestamps-display:none !important}');
			else
				tweaks.delete('chat-timestamps');
		});

		this.settings.getChanges('kick.chat.lines.alternate', val =>
			tweaks.toggle('chat-rows', val));

		this.settings.getChanges('chat.filtering.highlight-mentions', val =>
			tweaks.toggle('chat-mention-bg', val));
	}
}
