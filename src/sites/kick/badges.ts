'use strict';

// ============================================================================
// Badges
//
// Settings for Kick's own badges: which ones show, and how they're drawn.
// Kick renders each badge as an element tagged with its type, so hiding
// and styling are CSS on those tags. The visibility page reuses FFZ's
// badge-visibility component, listing the types FFZ knows about plus any
// seen in chat, with previews lifted from badges on screen.
// ============================================================================

import Module, {type GenericModule} from 'utilities/module';

import type SettingsManager from 'src/settings';
import type CSSTweaks from 'utilities/css-tweaks';

import {getRowProps} from './chat/line';


// Kick's badge types, in the order Kick sorts them, with the names Kick
// uses. Types seen in chat that aren't listed are added as they appear.
const KNOWN_BADGES: [type: string, name: string][] = [
	['broadcaster', 'Broadcaster'],
	['staff', 'Staff'],
	['moderator', 'Moderator'],
	['vip', 'VIP'],
	['og', 'OG'],
	['founder', 'Founder'],
	['subscriber', 'Subscriber'],
	['sub_gifter', 'Sub Gifter'],
	['verified', 'Verified'],
	['sidekick', 'Sidekick']
];

const BADGE_TYPE = /^[a-z0-9_-]+$/;

const BADGE = '#chatroom-messages [data-testid^="identity-badge-"]';

const STYLES: Record<number, string> = {
	1: `${BADGE} img{border-radius:0.2em !important}`,
	2: `${BADGE} img{border-radius:50% !important}`,
	3: `${BADGE}{opacity:0.5}`,
	4: `${BADGE}{opacity:0.5;transition:opacity .15s} #chatroom-messages [data-index]:hover [data-testid^="identity-badge-"]{opacity:1}`
};

/** A badge as the badge-visibility settings component lists it. */
type SettingsBadge = {
	id: string;
	name: string;
	color: string;
	styleImage?: string;
};


export default class Badges extends Module<'site.badges'> {

	// Dependencies
	settings: SettingsManager = null as any;
	css_tweaks: CSSTweaks = null as any;

	// State
	/** Badge names by type. */
	names: Map<string, string>;
	/** Preview image URLs by type, lifted from badges on screen. */
	previews: Map<string, string>;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');
		this.inject('site.css_tweaks');

		this.should_enable = true;

		this.names = new Map(KNOWN_BADGES);
		this.previews = new Map;

		this.settings.add('kick.chat.badges.hidden', {
			default: {},
			type: 'object_merge',
			ui: {
				path: 'Chat > Badges >> Visibility',
				title: 'Visibility',
				component: 'badge-visibility',
				getBadges: () => this.getSettingsBadges()
			}
		});

		this.settings.add('kick.chat.badges.style', {
			default: 0,
			ui: {
				path: 'Chat > Badges >> Appearance',
				title: 'Style',
				description: 'Rounded and Circular shape subscriber badges; Kick\'s icon badges keep their shape.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Kick\'s Own'},
					{value: 1, title: 'Rounded'},
					{value: 2, title: 'Circular'},
					{value: 3, title: 'Transparent'},
					{value: 4, title: 'Transparent (Reveal on Hover)'}
				]
			}
		});

		this.settings.add('kick.chat.badges.size', {
			default: 1,
			ui: {
				path: 'Chat > Badges >> Appearance',
				title: 'Size',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Kick\'s Own'},
					{value: 1, title: 'Small'}
				]
			}
		});
	}

	onEnable() {
		this.settings.getChanges('kick.chat.badges.hidden', this.updateHidden, this);

		this.settings.getChanges('kick.chat.badges.style', val => {
			if ( STYLES[val] )
				this.css_tweaks.set('badges-style', STYLES[val]);
			else
				this.css_tweaks.delete('badges-style');
		});

		this.settings.getChanges('kick.chat.badges.size', val =>
			this.css_tweaks.toggle('badges-small', val === 1));
	}


	// ========================================================================
	// Hiding
	// ========================================================================

	// Hidden badges are keyed "kick.<type>"; "m-kick" is the whole set.
	updateHidden(hidden: Record<string, boolean> | null | undefined) {
		hidden = hidden || {};

		let css: string | null = null;
		if ( hidden['m-kick'] )
			css = `${BADGE}{display:none !important}`;
		else {
			const selectors: string[] = [];
			for(const [key, value] of Object.entries(hidden)) {
				const type = key.startsWith('kick.') ? key.slice(5) : null;
				if ( value && type && BADGE_TYPE.test(type) )
					selectors.push(`#chatroom-messages [data-testid="identity-badge-${type}"]`);
			}

			if ( selectors.length )
				css = `${selectors.join(',')}{display:none !important}`;
		}

		if ( css )
			this.css_tweaks.set('badges-hidden', css);
		else
			this.css_tweaks.delete('badges-hidden');
	}


	// ========================================================================
	// The Settings Page
	// ========================================================================

	// Learn badge names from the messages on screen and previews from the
	// badges Kick has drawn for them.
	scan() {
		for(const row of document.querySelectorAll<HTMLElement>('#chatroom-messages [data-index]')) {
			const badges = getRowProps(row)?.chatEntry?.data?.sender?.identity?.badges;
			if ( Array.isArray(badges) )
				for(const badge of badges)
					if ( badge?.type && BADGE_TYPE.test(badge.type) && ! this.names.has(badge.type) )
						this.names.set(badge.type, badge.text || badge.type);
		}

		for(const el of document.querySelectorAll<HTMLElement>(BADGE)) {
			const type = (el.dataset.testid ?? '').slice('identity-badge-'.length);
			if ( ! BADGE_TYPE.test(type) || this.previews.has(type) )
				continue;

			const img = el.querySelector('img'),
				svg = el.querySelector('svg');

			let url = img?.src;
			if ( ! url && svg )
				url = `data:image/svg+xml;utf8,${encodeURIComponent(svg.outerHTML)}`;

			if ( url )
				this.previews.set(type, url);
		}
	}

	getSettingsBadges() {
		this.scan();

		const badges: SettingsBadge[] = [];
		for(const [type, name] of this.names) {
			const preview = this.previews.get(type);
			badges.push({
				id: `kick.${type}`,
				name,
				color: 'transparent',
				styleImage: preview ? `url("${preview}")` : undefined
			});
		}

		return [
			{title: 'Kick', id: 'm-kick', badges}
		];
	}
}
