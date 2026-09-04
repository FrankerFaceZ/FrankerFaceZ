'use strict';

// ============================================================================
// Appearance
//
// Looks for Kick: a Twitch-like palette, a toned-down accent, and hiding
// parts of Kick's layout. All of it is CSS. The palette and accent override
// the design tokens Kick's own styles are built on (see css_tweaks/), and
// the layout tweaks hide elements by selector (see the rules in the site
// module). Each is a setting under Appearance in the control center.
// ============================================================================

import Module from 'utilities/module';


export default class Appearance extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('site.css_tweaks');

		this.should_enable = true;

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

		this.settings.add('kick.layout.hide-recommended', {
			default: true,
			ui: {
				path: 'Appearance > Layout >> Sidebar',
				title: 'Hide recommended channels.',
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
	}

	onEnable() {
		this.settings.getChanges('kick.theme.palette', val =>
			this.css_tweaks.toggle('palette', val === 1));

		this.settings.getChanges('kick.theme.darker-accent', val =>
			this.css_tweaks.toggle('accent', val));

		this.settings.getChanges('kick.layout.hide-recommended', val =>
			this.css_tweaks.toggleHide('sidebar-recommended', val));

		this.settings.getChanges('kick.layout.hide-chat-banners', val =>
			this.css_tweaks.toggleHide('chat-banners', val));

		this.settings.getChanges('kick.layout.hide-new-messages', val =>
			this.css_tweaks.toggleHide('chat-divider', val));
	}
}
