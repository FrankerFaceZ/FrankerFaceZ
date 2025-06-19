'use strict';

// ============================================================================
// Emote Handling and Default Provider
// ============================================================================

import Module, { buildAddonProxy } from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';

import {get, has, timeout, SourcedSet, make_enum_flags, makeAddonIdChecker, deep_copy} from 'utilities/object';
import {NEW_API, IS_OSX, EmoteTypes, TWITCH_GLOBAL_SETS, TWITCH_POINTS_SETS, TWITCH_PRIME_SETS, DEBUG} from 'utilities/constants';

import GET_EMOTE from './emote_info.gql';
import GET_EMOTE_SET from './emote_set_info.gql';

const HoverRAF = Symbol('FFZ:Hover:RAF');
const HoverState = Symbol('FFZ:Hover:State');

const MOD_KEY = IS_OSX ? 'metaKey' : 'ctrlKey';

const Flags = make_enum_flags(
	'Hidden',
	'FlipX',
	'FlipY',
	'GrowX',
	'Slide',
	'Appear',
	'Leave',
	'Rotate',
	'Rotate90',
	'Greyscale',
	'Sepia',
	'Rainbow',
	'HyperRed',
	'Shake',
	'Cursed',
	'Jam',
	'Bounce',
	'NoSpace'
);

export const MODIFIER_FLAGS = Flags;

export const MODIFIER_KEYS = Object.values(MODIFIER_FLAGS).filter(x => typeof x === 'number');

const APPEAR_FRAMES = [
	[0, -18, 0, 0],
	[19.99, -18, 0, 0],
	[20, -18, 0.1, 0],
	[25, -16, 0.2, 0.6],
	[30, -14, 0.3, -4],
	[35, -12, 0.4, 0.6],
	[40, -10, 0.5, -4],
	[45, -8, 0.6, 2],
	[50, -6, 0.7, -3],
	[55, -4, 0.8, 2],
	[60, -2, 0.9, -3],
	[65, 0, 1, 0],
	[100, 0, 1, 0]
];

const LEAVE_FRAMES = [
	[0, 0, 1, 0],
	[39.99, 0, 1, 0],
	[40, 0, -.9, .9, -3],
	[45, -2, -.8, .8, 2],
	[50, -4, -.7, .7, -3],
	[55, -6, -.6, .6, 2],
	[60, -8, -.5, .5, -4],
	[65, -10, -.4, .4, .6],
	[70, -12, -.3, .3, -4],
	[75, -14, -.2, .2, .6],
	[80, -16, -.1, .1, 0],
	[85, -18, -0.01, 0, 0],
	[100, -18, 0, 0, 0]
];


function appearLeaveToKeyframes(source, multi = 1, offset = 0, has_var = false) {
	const out = [];

	for(const line of source) {
		const pct = (line[0] * multi) + offset;

		let vr, tx, scale, ty;
		vr = has_var ? `var(--ffz-effect-transforms) ` : '';
		tx = line[1] === 0 ? '' : `translateX(${line[1]}px) `;

		if ( line.length === 4 ) {
			scale = `scale(${line[2]})`;
			ty = line[3] === 0 ? '' : ` translateY(${line[3]}px)`;

		} else {
			const sx = line[2],
				sy = line[3];

			scale = `scale(${sx}, ${sy})`;

			ty = line[4] === 0 ? '' : ` translateY(${line[4]}px)`;
		}

		out.push(`\t${pct}% { transform:${vr}${tx}${scale}${ty}; }`);
	}

	return out.join('\n');
}



const EFFECT_STYLES = [
	{
		setting: 'FlipX',
		flags: Flags.FlipX,
		title: 'Flip Horizontal',
		transform: 'scaleX(-1)'
	},
	{
		setting: 'FlipY',
		flags: Flags.FlipY,
		title: 'Flip Vertical',
		transform: 'scaleY(-1)'
	},
	{
		setting: 'ShrinkX',
		flags: Flags.ShrinkX,
		title: 'Squish Horizontal'
	},
	{
		setting: 'GrowX',
		flags: Flags.GrowX,
		title: 'Stretch Horizontal'
	},
	{
		setting: 'Slide',
		flags: Flags.Slide,
		//not_flags: Flags.Rotate,
		title: 'Slide Animation',
		as_background: true,
		animation: 'ffz-effect-slide var(--ffz-speed-x) linear infinite',
		raw: `@keyframes ffz-effect-slide {
0% { background-position-x: 0; }
100% { background-position-x: calc(-1 * var(--ffz-width)); }
}`
	},
	{
		setting: 'Appear',
		flags: Flags.Appear,
		not_flags: Flags.Leave,
		title: 'Appear Animation',
		animation: 'ffz-effect-appear 3s infinite linear',
		animationTransform: 'ffz-effect-appear-transform 3s linear infinite',
		raw: `@keyframes ffz-effect-appear {
${appearLeaveToKeyframes(APPEAR_FRAMES)}
}
@keyframes ffz-effect-appear-transform {
${appearLeaveToKeyframes(APPEAR_FRAMES, 1, 0, true)}
}`
	},
	{
		setting: 'Leave',
		flags: Flags.Leave,
		not_flags: Flags.Appear,
		title: 'Leave Animation',
		animation: 'ffz-effect-leave 3s infinite linear',
		animationTransform: 'ffz-effect-leave-transform 3s infinite linear',
		raw: `@keyframes ffz-effect-leave {
${appearLeaveToKeyframes(LEAVE_FRAMES)}
}
@keyframes ffz-effect-leave-transform {
${appearLeaveToKeyframes(LEAVE_FRAMES, 1, 0, true)}
}`
	},
	{
		setting: [
			'Appear',
			'Leave'
		],
		flags: Flags.Appear | Flags.Leave,
		animation: 'ffz-effect-in-out 6s infinite linear',
		animationTransform: 'ffz-effect-in-out-transform 6s linear infinite',
		raw: `@keyframes ffz-effect-in-out {
${appearLeaveToKeyframes(APPEAR_FRAMES, 0.5, 0)}
${appearLeaveToKeyframes(LEAVE_FRAMES, 0.5, 50)}
}
@keyframes ffz-effect-in-out-transform {
${appearLeaveToKeyframes(APPEAR_FRAMES, 0.5, 0, true)}
${appearLeaveToKeyframes(LEAVE_FRAMES, 0.5, 50, true)}
}`
	},
	{
		setting: 'Rotate',
		flags: Flags.Rotate,
		not_flags: Flags.Slide,
		title: 'Rotate Animation',
		no_wide: true,
		animation: 'ffz-effect-rotate 1.5s infinite linear',
		animationTransform: 'ffz-effect-rotate-transform 1.5s infinite linear',
		raw: `@keyframes ffz-effect-rotate {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}
@keyframes ffz-effect-rotate-transform {
0% { transform: var(--ffz-effect-transforms) rotate(0deg); }
100% { transform: var(--ffz-effect-transforms) rotate(360deg); }
}`
	},
	/*{
		setting: [
			'Slide',
			'Rotate'
		],
		flags: Flags.Rotate | Flags.Slide,
		// Sync up the speed for slide and rotate if both are applied.
		animation: 'ffz-effect-slide calc(1.5 * var(--ffz-speed-x)) linear infinite'
	},
	{
		setting: 'Greyscale',
		flags: Flags.Greyscale,
		filter: 'grayscale(1)'
	},
	{
		setting: 'Sepia',
		flags: Flags.Sepia,
		filter: 'sepia(1)'
	},*/
	{
		setting: 'Rainbow',
		flags: Flags.Rainbow,
		title: 'Rainbow Animation',
		animation: 'ffz-effect-rainbow 2s linear infinite',
		animationFilter: 'ffz-effect-rainbow-filter 2s linear infinite',
		raw: `@keyframes ffz-effect-rainbow {
	0% { filter: hue-rotate(0deg) }
	100% { filter: hue-rotate(360deg) }
}
@keyframes ffz-effect-rainbow-filter {
	0% { filter: var(--ffz-effect-filters) hue-rotate(0deg) }
	100% { filter: var(--ffz-effect-filters) hue-rotate(360deg) }
}`
	},
	{
		setting: 'HyperRed',
		flags: Flags.HyperRed,
		title: 'Hyper Red',
		filter: 'brightness(0.2) sepia(1) brightness(2.2) contrast(3) saturate(8)'
	},
	{
		setting: 'Shake',
		flags: Flags.Shake,
		title: 'Hyper Shake Animation',
		animation: 'ffz-effect-shake 0.1s linear infinite',
		animationTransform: 'ffz-effect-shake-transform 0.1s linear infinite',
		raw: `@keyframes ffz-effect-shake-transform {
	0% { transform: var(--ffz-effect-transforms) translate(1px, 1px); }
	10% { transform: var(--ffz-effect-transforms) translate(-1px, -2px); }
	20% { transform: var(--ffz-effect-transforms) translate(-3px, 0px); }
	30% { transform: var(--ffz-effect-transforms) translate(3px, 2px); }
	40% { transform: var(--ffz-effect-transforms) translate(1px, -1px); }
	50% { transform: var(--ffz-effect-transforms) translate(-1px, 2px); }
	60% { transform: var(--ffz-effect-transforms) translate(-3px, 1px); }
	70% { transform: var(--ffz-effect-transforms) translate(3px, 1px); }
	80% { transform: var(--ffz-effect-transforms) translate(-1px, -1px); }
	90% { transform: var(--ffz-effect-transforms) translate(1px, 2px); }
	100% { transform: var(--ffz-effect-transforms) translate(1px, -2px); }
}
@keyframes ffz-effect-shake {
	0% { transform: translate(1px, 1px); }
	10% { transform: translate(-1px, -2px); }
	20% { transform: translate(-3px, 0px); }
	30% { transform: translate(3px, 2px); }
	40% { transform: translate(1px, -1px); }
	50% { transform: translate(-1px, 2px); }
	60% { transform: translate(-3px, 1px); }
	70% { transform: translate(3px, 1px); }
	80% { transform: translate(-1px, -1px); }
	90% { transform: translate(1px, 2px); }
	100% { transform: translate(1px, -2px); }
}`
	},
	{
		setting: 'Photocopy',
		flags: Flags.Cursed,
		title: 'Cursed',
		filter: 'grayscale(1) brightness(0.7) contrast(2.5)'
	},
	{
		setting: 'Jam',
		flags: Flags.Jam,
		title: 'Jam Animation',
		animation: 'ffz-effect-jam 0.6s linear infinite',
		animationTransform: 'ffz-effect-jam-transform 0.6s linear infinite',
		raw: `@keyframes ffz-effect-jam {
	0% { transform: translate(-2px, -2px) rotate(-6deg); }
	10% { transform: translate(-1.5px, -2px) rotate(-8deg); }
	20% { transform: translate(1px, -1.5px) rotate(-8deg); }
	30% { transform: translate(3px, 2.5px) rotate(-6deg); }
	40% { transform: translate(3px, 4px) rotate(-2deg); }
	50% { transform: translate(2px, 4px) rotate(3deg); }
	60% { transform: translate(1px, 4px) rotate(3deg); }
	70% { transform: translate(-0.5px, 3px) rotate(2deg); }
	80% { transform: translate(-1.25px, 1px) rotate(0deg); }
	90% { transform: translate(-1.75px, -0.5px) rotate(-2deg); }
	100% { transform: translate(-2px, -2px) rotate(-5deg); }
}
@keyframes ffz-effect-jam-transform {
	0% { transform: var(--ffz-effect-transforms) translate(-2px, -2px) rotate(-6deg); }
	10% { transform: var(--ffz-effect-transforms) translate(-1.5px, -2px) rotate(-8deg); }
	20% { transform: var(--ffz-effect-transforms) translate(1px, -1.5px) rotate(-8deg); }
	30% { transform: var(--ffz-effect-transforms) translate(3px, 2.5px) rotate(-6deg); }
	40% { transform: var(--ffz-effect-transforms) translate(3px, 4px) rotate(-2deg); }
	50% { transform: var(--ffz-effect-transforms) translate(2px, 4px) rotate(3deg); }
	60% { transform: var(--ffz-effect-transforms) translate(1px, 4px) rotate(3deg); }
	70% { transform: var(--ffz-effect-transforms) translate(-0.5px, 3px) rotate(2deg); }
	80% { transform: var(--ffz-effect-transforms) translate(-1.25px, 1px) rotate(0deg); }
	90% { transform: var(--ffz-effect-transforms) translate(-1.75px, -0.5px) rotate(-2deg); }
	100% { transform: var(--ffz-effect-transforms) translate(-2px, -2px) rotate(-5deg); }
}`
	},
	{
		setting: 'Bounce',
		flags: Flags.Bounce,
		animation: 'ffz-effect-bounce 0.5s linear infinite',
		animationTransform: 'ffz-effect-bounce-transform 0.5s linear infinite',
		transformOrigin: 'bottom center',
		raw: `@keyframes ffz-effect-bounce {
	0% { transform: scale(0.8, 1); }
	10% { transform: scale(0.9, 0.8); }
	20% { transform: scale(1, 0.4); }
	25% { transform: scale(1.2, 0.3); }
	25.001% { transform: scale(-1.2, 0.3); }
	30% { transform: scale(-1, 0.4); }
	40% { transform: scale(-0.9, 0.8); }
	50% { transform: scale(-0.8, 1); }
	60% { transform: scale(-0.9, 0.8); }
	70% { transform: scale(-1, 0.4); }
	75% { transform: scale(-1.2, 0.3); }
	75.001% { transform: scale(1.2, 0.3); }
	80% { transform: scale(1, 0.4); }
	90% { transform: scale(0.9, 0.8); }
	100% { transform: scale(0.8, 1); }
}
@keyframes ffz-effect-bounce-transform {
	0% { transform: scale(0.8, 1) var(--ffz-effect-transforms); }
	10% { transform: scale(0.9, 0.8) var(--ffz-effect-transforms); }
	20% { transform: scale(1, 0.4) var(--ffz-effect-transforms); }
	25% { transform: scale(1.2, 0.3) var(--ffz-effect-transforms); }
	25.001% { transform: scale(-1.2, 0.3) var(--ffz-effect-transforms); }
	30% { transform: scale(-1, 0.4) var(--ffz-effect-transforms); }
	40% { transform: scale(-0.9, 0.8) var(--ffz-effect-transforms); }
	50% { transform: scale(-0.8, 1) var(--ffz-effect-transforms); }
	60% { transform: scale(-0.9, 0.8) var(--ffz-effect-transforms); }
	70% { transform: scale(-1, 0.4) var(--ffz-effect-transforms); }
	75% { transform: scale(-1.2, 0.3) var(--ffz-effect-transforms); }
	75.001% { transform: scale(1.2, 0.3) var(--ffz-effect-transforms); }
	80% { transform: scale(1, 0.4) var(--ffz-effect-transforms); }
	90% { transform: scale(0.9, 0.8) var(--ffz-effect-transforms); }
	100% { transform: scale(0.8, 1) var(--ffz-effect-transforms); }
}`
	},
	{
		setting: [
			'Bounce',
			'FlipY'
		],
		flags: Flags.Bounce | Flags.FlipY,
		transform: 'translateY(100%)',
	},
];


function generateBaseFilterCss() {
	const out = [
		`.modified-emote[data-effects] > .chat-line__message--emote {
	--ffz-effect-filters: none;
	--ffz-effect-transforms: initial;
	--ffz-effect-animations: initial;
}`
	];

	//for(const [key, val] of Object.entries(MODIFIER_FLAG_CSS)) {
	for(const val of EFFECT_STYLES) {
		if ( val.raw )
			out.push(val.raw);
	}

	return out.join('\n');
}


const MODIFIERS = {
	59847: {
		modifier_offset: '0 15px 15px 0',
		modifier: true
	},

	70852: {
		modifier: true,
		modifier_offset: '0 5px 20px 0',
		extra_width: 5,
		shrink_to_fit: true
	},

	70854: {
		modifier: true,
		modifier_offset: '30px 0 0'
	},

	147049: {
		modifier: true,
		modifier_offset: '4px 1px 0 3px'
	},

	147011: {
		modifier: true,
		modifier_offset: '0'
	},

	70864: {
		modifier: true,
		modifier_offset: '0'
	},

	147038: {
		modifier: true,
		modifier_offset: '0'
	}
};


export default class Emotes extends Module {
	constructor(...args) {
		super(...args);

		this.EmoteTypes = EmoteTypes;
		this.ModifierFlags = MODIFIER_FLAGS;

		this.filters = {};
		this.__filters = [];

		this.inject('i18n');
		this.inject('settings');
		this.inject('experiments');
		this.inject('staging');
		this.inject('load_tracker');

		this.twitch_inventory_sets = new Set; //(EXTRA_INVENTORY);
		this.__twitch_emote_to_set = {};
		this.__twitch_set_to_channel = {};
		this.__twitch_emote_to_artist = {};

		// Bulk data structure for collections applied to a lot of users.
		// This lets us avoid allocating lots of individual user
		// objects when we don't need to do so.
		this.bulk = new Map;

		this.effects_enabled = {};
		this.pending_effects = new Set();
		this.applyEffects = this.applyEffects.bind(this);

		this.sub_sets = new SourcedSet;
		this.default_sets = new SourcedSet;
		this.global_sets = new SourcedSet;

		this.providers = new Map;

		this.setProvider('ffz', {
			name: 'FrankerFaceZ',
			font_icon: 'ffz-i-zreknarf',
			//icon: 'https://cdn.frankerfacez.com/badge/4/4/solid'
		});

		/*this.providers.set('ffz-featured', {
			menu_name: 'Featured',
			menu_i18n_key: 'emote-menu.featured',
			sort_key: 75
		});*/

		this.emote_sets = {};
		this._set_refs = {};
		this._set_timers = {};

		this.settings.add('chat.emotes.source-priorities', {
			default: null,
			ui: {
				path: 'Chat > Emote Priorities',
				component: 'emote-priorities',
				data: () => deep_copy(this.providers)
			}
		});

		this.settings.add('chat.emotes.enabled', {
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

		this.settings.add('chat.emotes.2x', {
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

		this.settings.add('chat.emotes.limit-size', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Emotes',
				title: 'Limit Native Emote Size',
				description: 'Sometimes, really obnoxiously large emotes slip through the cracks and wind up on Twitch. This limits the size of Twitch emotes to mitigate the issue.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emotes.allow-gigantify', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Emotes',
				title: 'Allow "Gigantify an Emote" Power-Up',
				description: 'How big is too big? Giant? Disable this and the emotes will be displayed normally.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.fix-bad-emotes', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Emotes',
				title: 'Fix Bad Twitch Global Emotes',
				description: 'Clean up the images for bad Twitch global emotes, removing white borders and solid backgrounds.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.click-emotes', {
			default: true,

			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Open emote information pages by Shift-Clicking them.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.sub-emotes', {
			default: true,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Open Twitch subscription pages by Shift-Clicking emotes when relevant.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-dialogs', {
			default: true,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Open emote information cards for Twitch emotes by clicking them.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.effects.enable', {
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

			this.settings.add(`chat.effects.${val.setting}`, setting);
		}

		// Because this may be used elsewhere.
		this.handleClick = this.handleClick.bind(this);
		this.animHover = this.animHover.bind(this);
		this.animLeave = this.animLeave.bind(this);
	}


	getAddonProxy(addon_id, addon, module) {
		if ( ! addon_id )
			return this;

		const is_dev = DEBUG || addon?.dev,
			id_checker = makeAddonIdChecker(addon_id);

		const overrides = {},
			warnings = {};

		overrides.addFilter = filter => {
			if ( filter )
				filter.__source = addon_id;

			return this.addFilter(filter);
		}

		overrides.setProvider = (provider, data) => {
			if ( is_dev && ! id_checker.test(provider) )
				module.log.warn('[DEV-CHECK] Call to emotes.setProvider did not include addon ID in provider:', provider);

			if ( data )
				data.__source = addon_id;

			return this.setProvider(provider, data);
		}

		overrides.addDefaultSet = (provider, set_id, data) => {
			if ( is_dev && ! id_checker.test(provider) )
				module.log.warn('[DEV-CHECK] Call to emotes.addDefaultSet did not include addon ID in provider:', provider);

			if ( ! this.providers.has(provider) ) {
				this.inferProvider(provider, addon_id);
				if ( is_dev )
					module.log.warn('[DEV-CHECK] Call to emotes.addDefaultSet for provider that has not been registered with emotes.setProvider:', provider);
			}

			if ( data ) {
				if ( is_dev && ! id_checker.test(set_id) )
					module.log.warn('[DEV-CHECK] Call to emotes.addDefaultSet loaded set data but did not include addon ID in set ID:', set_id);

				data.__source = addon_id;
			}

			return this.addDefaultSet(provider, set_id, data);
		}

		overrides.addSubSet = (provider, set_id, data) => {
			if ( is_dev && ! id_checker.test(provider) )
				module.log.warn('[DEV-CHECK] Call to emotes.addSubSet did not include addon ID in provider:', provider);

			if ( ! this.providers.has(provider) ) {
				this.inferProvider(provider, addon_id);
				if ( is_dev )
					module.log.warn('[DEV-CHECK] Call to emotes.addSubSet for provider that has not been registered with emotes.setProvider:', provider);
			}

			if ( data ) {
				if ( is_dev && ! id_checker.test(set_id) )
					module.log.warn('[DEV-CHECK] Call to emotes.addSubSet loaded set data but did not include addon ID in set ID:', set_id);

				data.__source = addon_id;
			}

			return this.addSubSet(provider, set_id, data);
		}

		overrides.loadSetData = (set_id, data, ...args) => {
			if ( is_dev && ! id_checker.test(set_id) )
				module.log.warn('[DEV-CHECK] Call to emotes.loadSetData did not include addon ID in set ID:', set_id);

			if ( data )
				data.__source = addon_id;

			return this.loadSetData(set_id, data, ...args);
		}

		if ( is_dev ) {
			overrides.removeFilter = filter => {
				let type;
				if ( typeof filter === 'string' ) type = filter;
				else type = filter.type;

				const existing = this.filters[type];
				if ( existing && existing.__source !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned emote filter with emotes.removeFilter:', type, ' owner:', existing.__source ?? 'ffz');

				return this.removeFilter(filter);
			}

			overrides.removeDefaultSet = (provider, ...args) => {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to emotes.removeDefaultSet did not include addon ID in provider:', provider);

				return this.removeDefaultSet(provider, ...args);
			}

			overrides.removeSubSet = (provider, ...args) => {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to emotes.removeSubSet did not include addon ID in provider:', provider);

				return this.removeSubSet(provider, ...args);
			}

			warnings.style = true;
			warnings.effect_style = true;
			warnings.emote_sets = true;
			warnings.loadSetUserIds = warnings.loadSetUsers = 'This method is meant for internal use.';
		}

		return buildAddonProxy(module, this, 'emotes', overrides, warnings);
	}


	onEnable() {
		this.style = new ManagedStyle('emotes');
		this.effect_style = new ManagedStyle('effects');

		// Generate the base filter CSS.
		this.base_effect_css = generateBaseFilterCss();

		this.parent.context.getChanges('chat.emotes.source-priorities', this.updatePriorities, this);

		this.parent.context.on('changed:chat.effects.enable', this.updateEffects, this);
		for(const input of EFFECT_STYLES)
			if ( input.setting && ! Array.isArray(input.setting) )
				this.parent.context.on(`changed:chat.effects.${input.setting}`, this.updateEffects, this);

		this.updateEffects();

		// Fix numeric Twitch favorite IDs.
		const favs = this.getFavorites('twitch');
		let changed = false;
		for(let i=0; i < favs.length; i++) {
			if ( typeof favs[i] === 'number' ) {
				changed = true;
				favs[i] = `${favs[i]}`;
			}
		}

		if ( changed )
			this.setFavorites('twitch', favs);

		if ( Object.keys(this.emote_sets).length ) {
			this.log.info('Generating CSS for existing emote sets.');
			for(const set_id in this.emote_sets)
				if ( has(this.emote_sets, set_id) ) {
					const emote_set = this.emote_sets[set_id];
					if ( emote_set && (emote_set.pending_css || emote_set.css) ) {
						this.style.set(`es--${set_id}`, (emote_set.pending_css || '') + (emote_set.css || ''));
						emote_set.pending_css = null;
					}
				}
		}

		this.on('pubsub:command:follow_sets', this.updateFollowSets, this);

		this.on('pubsub:command:add_emote', msg => {
			const set_id = msg.set_id,
				emote = msg.emote,

				emote_set = this.emote_sets[set_id];

			if ( ! emote_set )
				return;

			const has_old = !! emote_set.emotes?.[emote.id] || !! emote_set.disabled_emotes?.[emote.id];
			const processed = this.addEmoteToSet(set_id, emote);

			this.maybeNotifyChange(
				has_old ? 'modified' : 'added',
				set_id,
				processed
			);
		});

		this.on('pubsub:command:remove_emote', msg => {
			const set_id = msg.set_id,
				emote_id = msg.emote_id;

			if ( ! this.emote_sets[set_id] )
				return;

			// If removing it returns nothing, there was no
			// emote to remove with that ID.
			const removed = this.removeEmoteFromSet(set_id, emote_id);
			if ( ! removed )
				return;

			this.maybeNotifyChange(
				'removed',
				set_id,
				removed
			);
		});

		this.on('chat:reload-data', flags => {
			if ( ! flags || flags.emotes )
				this.loadGlobalSets();
		});

		this.on('addon:fully-unload', addon_id => {
			let removed = 0;
			for(const [key, set] of Object.entries(this.emote_sets)) {
				if ( set?.__source === addon_id ) {
					removed++;
					this.loadSetData(key, null, true);
				}
			}

			for(const [key, def] of Object.entries(this.filters)) {
				if ( def?.__source === addon_id ) {
					removed++;
					this.removeFilter(key);
				}
			}

			for(const [key, data] of this.providers.entries()) {
				if ( data?.__source === addon_id ) {
					removed++;
					this.setProvider(key, null);
				}
			}

			if ( removed ) {
				this.log.debug(`Cleaned up ${removed} entries when unloading addon:`, addon_id);
				// TODO: Debounced retokenize all chat messages.
			}
		})

		this.loadGlobalSets();
	}


	// ========================================================================
	// Providers
	// ========================================================================

	updatePriorities(priorities) {
		const l = priorities?.length;

		if (! l || l <= 0)
			this.sourceSortFn = null;
		else
			this.sourceSortFn = (first, second) => {
				if (first.startsWith('ffz-'))
					first = 'ffz';
				if (second.startsWith('ffz-'))
					second = 'ffz';

				let first_priority = priorities.indexOf(first),
					second_priority = priorities.indexOf(second);

				if (first_priority === -1) first_priority = l;
				if (second_priority === -1) second_priority = l;

				return first_priority - second_priority;
			};

		// Update all existing sourced sets now.
		this.default_sets.setSortFunction(this.sourceSortFn);

		this.emit(':update-priorities', this.sourceSortFn);
	}

	inferProvider(provider, addon_id) {
		if ( this.providers.has(provider) )
			return;

		const data = this.resolve('addons')?.getAddon(addon_id);
		if ( data )
			this.setProvider(provider, {
				name: data.name,
				i18n_key: data.name_i18n,
				icon: data.icon,
				description: provider,
				__source: addon_id
			});
	}

	setProvider(provider, data) {
		if ( ! data )
			this.providers.delete(provider);
		else {
			data.id = provider;
			this.providers.set(provider, data);
		}
	}


	// ========================================================================
	// Emote Filtering
	// ========================================================================

	addFilter(filter, should_update = true) {
		const type = filter.type;
		if ( has(this.filters, type) ) {
			this.log.warn(`Tried adding emote filter of type '${type}' when one was already present.`);
			return;
		}

		this.filters[type] = filter;
		if ( filter.priority == null )
			filter.priotiy = 0;

		this.__filters.push(filter);
		this.__filters.sort((a, b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});

		if ( should_update )
			this.updateFiltered();
	}

	removeFilter(filter, should_update = true) {
		let type;
		if ( typeof filter === 'string' ) type = filter;
		else type = filter.type;

		filter = this.filters[type];
		if ( ! filter )
			return null;

		delete this.filters[type];

		const idx = this.__filters.indexOf(filter);
		if ( idx !== -1 ) {
			this.__filters.splice(idx, 1);
			if ( should_update )
				this.updateFiltered();
		}

		return filter;
	}

	shouldFilterEmote(emote, set, set_id) {
		for(const filter of this.__filters)
			if ( filter.test(emote, set, set_id) )
				return true;

		return false;
	}

	updateFiltered() {
		// Iterate over every emote set, updating filtered emotes.
		for(const set of Object.values(this.emote_sets)) {

			const emotes = {},
				filtered = {};

			let count = 0,
				fcount = 0,
				changed = false;

			for(const em of Object.values(set.emotes)) {
				if ( ! this.shouldFilterEmote(em, set, set.id) ) {
					emotes[em.id] = em;
					count++;

				} else {
					filtered[em.id] = em;
					fcount++;
					changed = true;
				}
			}

			for(const em of Object.values(set.disabled_emotes)) {
				if ( this.shouldFilterEmote(em, set, set.id)) {
					filtered[em.id] = em;
					fcount++;

				} else {
					emotes[em.id] = em;
					count++;
					changed = true;
				}
			}

			if ( ! changed )
				continue;

			// Save the changes.
			this.log.info(`Filtered emote set #${set.id}: ${set.title} (total: ${count+fcount}, old: ${set.disabled_count}, new: ${fcount})`);

			set.emotes = emotes;
			set.count = count;
			set.disabled_emotes = filtered;
			set.disabled_count = fcount;

			// Update the CSS for the set.
			const css = [];
			for(const em of Object.values(emotes)) {
				const emote_css = this.generateEmoteCSS(em);
				if ( emote_css?.length )
					css.push(emote_css);
			}

			if ( this.style && (css.length || set.css) )
				this.style.set(`es--${set.id}`, css.join('') + (set.css || ''));
			else if ( css.length )
				set.pending_css = css.join('');

			// And emit an event because this emote set changed.
			this.emit(':loaded', set.id, set);
		}

		// TODO: Summary, maybe? Or update chat? Who knows?
	}


	// ========================================================================
	// Chat Notices
	// ========================================================================

	maybeNotifyChange(action, set_id, emote) {
		if ( ! this._pending_notifications )
			this._pending_notifications = [];

		this._pending_notifications.push({action, set_id, emote});

		if ( ! this._pending_timer )
			this._pending_timer = setTimeout(() => this._handleNotifyChange(), 1000);
	}

	_handleNotifyChange() {
		clearTimeout(this._pending_timer);
		this._pending_timer = null;

		const notices = this._pending_notifications;
		this._pending_notifications = null;

		// Make sure we are equipped to send notices.
		const chat = this.resolve('site.chat');
		if ( ! chat?.addNotice )
			return;

		// Get the current user.
		const me = this.resolve('site').getUser();
		if ( ! me?.id )
			return;

		// Get the current channel.
		const room_id = this.parent.context.get('context.channelID'),
			room_login = this.parent.context.get('context.channel');

		// And now get the current user's available emote sets.
		const sets = this.getSetIDs(me.id, me.login, room_id, room_login);
		const set_changes = {};

		// Build a data structure for reducing the needed number of notices.
		for(const notice of notices) {
			// Make sure the set ID is a string.
			const set_id = `${notice.set_id}`,
				action = notice.action;

			if ( sets.includes(set_id) ) {
				const changes = set_changes[set_id] = set_changes[set_id] || {},
					list = changes[action] = changes[action] || [];

				// Deduplicate while we're at it.
				if ( list.find(em => em.id === notice.emote.id) )
					continue;

				list.push(notice.emote);
			}
		}

		// Iterate over everything, sending chat notices.
		for(const [set_id, notices] of Object.entries(set_changes)) {
			const emote_set = this.emote_sets[set_id];
			if ( ! emote_set )
				continue;

			for(const [action, emotes] of Object.entries(notices)) {
				const emote_list = emotes
					.map(emote => emote.name)
					.join(', ');

				let msg;
				if ( action === 'added' )
					msg = this.i18n.t('emote-updates.added', 'The {count, plural, one {emote {emotes} has} other {emotes {emotes} have}} been added to {set}.', {
						count: emotes.length,
						emotes: emote_list,
						set: emote_set.title
					});

				else if ( action === 'modified' )
					msg = this.i18n.t('emote-updates.modified', 'The {count, plural, one {emote {emotes} has} other {emotes {emotes} have}} been updated in {set}.', {
						count: emotes.length,
						emotes: emote_list,
						set: emote_set.title
					});

				else if ( action === 'removed' )
					msg = this.i18n.t('emote-updates.removed', 'The {count, plural, one {emote {emotes} has} other {emotes {emotes} have}} been removed from {set}.', {
						count: emotes.length,
						emotes: emote_list,
						set: emote_set.title
					});

				if ( msg )
					chat.addNotice('*', {
						icon: 'ffz-i-zreknarf',
						message: msg
					}); // `[FFZ] ${msg}`);
			}
		}
	}


	// ========================================================================
	// Load Modifier Effects
	// ========================================================================

	ensureEffect(flags) {
		if ( ! this.effect_style.has(`${flags}`) ) {
			this.pending_effects.add(flags);
			if ( ! this._effect_timer )
				this._effect_timer = requestAnimationFrame(this.applyEffects);
		}
	}

	applyEffects() {
		this._effect_timer = null;
		const effects = this.pending_effects;
		this.pending_effects = new Set;

		for(const flags of effects) {
			const result = this.generateFilterCss(flags);
			this.effect_style.set(`${flags}`, result ?? '');
		}
	}

	generateFilterCss(flags) {
		if ( ! this.parent.context.get('chat.effects.enable') )
			return null;

		let filter, transformOrigin, transform, animation, animations = [];

		for(const input of this.activeEffectStyles) {
			if ( (flags & input.flags) !== input.flags )
				continue;

			if ( input.not_flags && (flags & input.not_flags) === input.not_flags )
				continue;

			if ( input.animation )
				animations.push(input);

			if ( input.filter )
				filter = filter
					? `${filter} ${input.filter}`
					: input.filter;

			if ( input.transformOrigin )
				transformOrigin = input.transformOrigin;

			if ( input.transform )
				transform = transform
					? `${transform} ${input.transform}`
					: input.transform;
		}

		if ( animations.length )
			for(const input of animations) {
				if ( filter && input.animationFilter )
					animation = animation
						? `${animation}, ${input.animationFilter}`
						: input.animationFilter;
				else if ( transform && input.animationTransform )
					animation = animation
						? `${animation}, ${input.animationTransform}`
						: input.animationTransform;
				else
					animation = animation
						? `${animation}, ${input.animation}`
						: input.animation;
			}

		if ( ! filter && ! transform && ! animation )
			return null;

		return `.modified-emote[data-effects="${flags}"] > .chat-line__message--emote {${filter ? `
	--ffz-effect-filters: ${filter};
	filter: var(--ffz-effect-filters);` : ''}${transformOrigin ? `
	transform-origin: ${transformOrigin};` : ''}${transform ? `
	--ffz-effect-transforms: ${transform};
	transform: var(--ffz-effect-transforms);` : ''}${animation ? `
	--ffz-effect-animations: ${animation};
	animation: var(--ffz-effect-animations);` : ''}
}`;
	}

	updateEffects() {
		// TODO: Smarter logic so it does less work.
		const enabled = this.parent.context.get('chat.effects.enable');

		this.effects_enabled = {};
		this.activeEffectStyles = [];

		this.activeAsBackgroundMask = 0;
		this.activeNoWideMask = 0;

		for(const input of EFFECT_STYLES) {
			if ( input.setting && ! Array.isArray(input.setting) )
				this.effects_enabled[input.setting] = this.parent.context.get(`chat.effects.${input.setting}`);
		}

		for(const input of EFFECT_STYLES) {
			let enabled = true;
			if ( Array.isArray(input.setting) ) {
				for(const setting of input.setting)
					if ( ! this.effects_enabled[setting] ) {
						enabled = false;
						break;
					}

			} else if ( input.setting )
				enabled = this.effects_enabled[input.setting];

			if ( enabled ) {
				this.activeEffectStyles.push(input);

				if ( input.as_background )
					this.activeAsBackgroundMask = this.activeAsBackgroundMask | input.flags;
				if ( input.no_wide )
					this.activeNoWideMask = this.activeNoWideMask | input.flags;
			}
		}

		this.effect_style.clear();
		if ( ! enabled || ! this.activeEffectStyles.length )
			return;

		this.effect_style.set('base', this.base_effect_css);
		this.emit(':update-effects');
	}


	// ========================================================================
	// Featured Sets
	// ========================================================================

	updateFollowSets(data) {
		for(const room_login in data)
			if ( has(data, room_login) ) {
				const room = this.parent.getRoom(null, room_login, true);
				if ( ! room || room.destroyed )
					continue;

				const new_sets = data[room_login] || [],
					emote_sets = room.emote_sets,
					providers = emote_sets && emote_sets._sources;

				if ( providers && providers.has('ffz-featured') )
					for(const item of providers.get('ffz-featured')) {
						const idx = new_sets.indexOf(item);
						if ( idx === -1 )
							room.removeSet('ffz-featured', item);
						else
							new_sets.splice(idx, 1);
					}

				for(const set_id of new_sets) {
					room.addSet('ffz-featured', set_id);

					if ( ! this.emote_sets[set_id] )
						this.loadSet(set_id);
				}
			}
	}


	// ========================================================================
	// Hidden Checking
	// ========================================================================

	toggleHidden(source, id, value = null) {
		const key = `hidden-emotes.${source}`,
			p = this.settings.provider,
			hidden = p.get(key, []),

			idx = hidden.indexOf(id);

		if ( value === null )
			value = idx === -1;

		if ( value && idx === -1 )
			hidden.push(id);
		else if ( ! value && idx !== -1 )
			hidden.splice(idx, 1);
		else
			return;

		if ( hidden.length )
			p.set(key, hidden);
		else
			p.delete(key);

		this.emit(':change-hidden', source, id, value);
	}

	isHidden(source, id) {
		return this.getHidden(source).includes(id);
	}

	getHidden(source) {
		return this.settings.provider.get(`hidden-emotes.${source}`) || [];
	}

	setHidden(source, list) {
		const key = `hidden-emotes.${source}`;
		if ( ! Array.isArray(list) || ! list.length )
			this.settings.provider.delete(key);
		else
			this.settings.provider.set(key, list);
	}


	// ========================================================================
	// Animation Hover
	// ========================================================================

	animHover(event) { // eslint-disable-line class-methods-use-this
		const target = event.currentTarget;
		if ( target[HoverState] )
			return;

		if ( target[HoverRAF] )
			cancelAnimationFrame(target[HoverRAF]);

		target[HoverRAF] = requestAnimationFrame(() => {
			target[HoverRAF] = null;
			if ( target[HoverState] )
				return;

			if ( ! target.matches(':hover') )
				return;

			target[HoverState] = true;
			const emotes = target.querySelectorAll('.ffz-hover-emote');
			for(const em of emotes) {
				const ds = em.dataset;
				if ( ds.normalSrc && ds.hoverSrc ) {
					em.src = ds.hoverSrc;
					if (em.srcset)
						em.srcset = ds.hoverSrcSet;
				}
			}
		});
	}


	animLeave(event) { // eslint-disable-line class-methods-use-this
		const target = event.currentTarget;
		if ( ! target[HoverState] )
			return;

		if ( target[HoverRAF] )
			cancelAnimationFrame(target[HoverRAF]);

		target[HoverRAF] = requestAnimationFrame(() => {
			target[HoverRAF] = null;
			if ( ! target[HoverState] )
				return;

			if ( target.matches(':hover') )
				return;

			target[HoverState] = false;
			const emotes = target.querySelectorAll('.ffz-hover-emote');
			for(const em of emotes) {
				const ds = em.dataset;
				if ( ds.normalSrc ) {
					em.src = ds.normalSrc;
					if (em.srcset)
						em.srcset = ds.normalSrcSet;
				}
			}
		});
	}


	// ========================================================================
	// Favorite Checking
	// ========================================================================

	toggleFavorite(source, id, value = null) {
		const key = `favorite-emotes.${source}`,
			p = this.settings.provider,
			favorites = p.get(key) || [],

			idx = favorites.indexOf(id);

		if ( value === null )
			value = idx === -1;

		if ( value && idx === -1 )
			favorites.push(id);
		else if ( ! value && idx !== -1 )
			favorites.splice(idx, 1);
		else
			return value;

		if ( favorites.length )
			p.set(key, favorites);
		else
			p.delete(key);

		this.emit(':change-favorite', source, id, value);
		return value;
	}

	isFavorite(source, id) {
		const favorites = this.settings.provider.get(`favorite-emotes.${source}`);
		return favorites && favorites.includes(id);
	}

	getFavorites(source) {
		return this.settings.provider.get(`favorite-emotes.${source}`) || [];
	}

	setFavorites(source, favs) {
		const key = `favorite-emotes.${source}`;
		if ( ! Array.isArray(favs) || ! favs.length )
			this.settings.provider.delete(key);
		else
			this.settings.provider.set(key, favs);
	}

	handleClick(event, favorite_only = false) {
		const target = event.target,
			ds = target && target.dataset;

		/*const modified = target.closest('.modified-emote');
		if ( modified && modified !== target )
			return;*/

		if ( ! ds )
			return;

		const provider = ds.provider,
			click_emote = this.parent.context.get('chat.click-emotes'),
			click_sub = this.parent.context.get('chat.sub-emotes');

		if ( event.shiftKey && (click_emote || click_sub) ) {
			let url;

			if ( provider === 'twitch' ) {
				url = null; // = `https://twitchemotes.com/emotes/${ds.id}`;

				if ( click_sub ) {
					const apollo = this.resolve('site.apollo');
					if ( apollo ) {
						apollo.client.query({
							query: GET_EMOTE,
							variables: {
								id: ds.id
							}
						}).then(result => {
							const prod = get('data.emote.subscriptionProduct', result);
							if ( prod && prod.state === 'ACTIVE' && prod.owner && prod.owner.login )
								url = `https://www.twitch.tv/subs/${prod.owner.login}`;
							else if ( ! click_emote )
								return false;

							if ( url ) {
								const win = window.open();
								if ( win ) {
									win.opener = null;
									win.location = url;
								}
							}
						});

						return true;
					}
				}

			} else if ( provider === 'ffz' ) {
				const emote_set = this.emote_sets[ds.set],
					emote = emote_set && (emote_set.emotes[ds.id] || emote_set.disabled_emotes?.[ds.id]);

				if ( ! emote )
					return;

				if ( emote.click_url )
					url = emote.click_url;

				else if ( ! emote_set.source )
					url = `https://www.frankerfacez.com/emoticons/${emote.id}`;
			}

			if ( ! click_emote )
				return false;

			if ( url ) {
				const win = window.open();
				if ( win ) {
					win.opener = null;
					win.location = url;
				}
			}

			return true;
		}

		if ( event[MOD_KEY] ) {
			// Favoriting Emotes
			let source, id;

			if ( provider === 'twitch' ) {
				source = 'twitch';
				id = ds.id;

			} else if ( provider === 'ffz' ) {
				const emote_set = this.emote_sets[ds.set],
					emote = emote_set && (emote_set.emotes[ds.id] || emote_set.disabled_emotes?.[ds.id]);

				if ( ! emote )
					return;

				source = emote_set.source || 'ffz';
				id = emote.id;

			} else if ( provider === 'emoji' ) {
				source = 'emoji';
				id = ds.code;

			} else
				return;

			this.toggleFavorite(source, id);
			const tt = target._ffz_tooltip;
			if ( tt && tt.visible ) {
				tt.hide();
				setTimeout(() => document.contains(target) && tt.show(), 0);
			}

			return true;
		}

		if ( favorite_only )
			return false;

		let modifiers;
		try {
			modifiers = JSON.parse(ds.modifierInfo);
		} catch(err) {
			/* no-op */
		}

		const evt = this.makeEvent({
			provider,
			id: ds.id,
			set: ds.set,
			code: ds.code,
			variant: ds.variant,
			name: ds.name || target.alt,
			modifiers,
			source: event
		});

		this.emit('chat.emotes:click', evt);
		if ( evt.defaultPrevented )
			return true;

		if ( provider === 'twitch' && this.parent.context.get('chat.emote-dialogs') ) {
			const fine = this.resolve('site.fine');
			if ( ! fine )
				return;

			const line = fine.searchParent(target, n => n.props && n.props.message),
				opener = fine.searchParent(target, n => n.onShowEmoteCard, 500);

			if ( ! line || ! opener )
				return;

			const rect = target.getBoundingClientRect();

			opener.onShowEmoteCard({
				channelID: line.props.channelID || '',
				channelLogin: line.props.channelLogin || '',
				emoteID: ds.id,
				emoteCode: target.alt,
				sourceID: 'chat',
				referrerID: '',
				initialTopOffset: rect.bottom,
				initialBottomOffset: rect.top
			});

			return true;
		}
	}


	// ========================================================================
	// Access
	// ========================================================================

	getTargetEmote() {
		this.target_emote = null;

		const me = this.resolve('site').getUser(),
			Input = me ? this.resolve('site.chat.input') : null,
			entered = Input ? Input.getInput() : null;

		const menu = this.resolve('site.chat.emote_menu')?.MenuWrapper?.first,
			emote_sets = menu?.getAllSets?.(),
			emotes = emote_sets
				? emote_sets.map(x => x.emotes).flat().filter(x => ! x.effects && ! x.locked)
				: null;

		if ( entered && emotes ) {
			// Okay this is gonna be oof.
			const name_map = {};
			for(let i = 0; i < emotes.length; i++)
				if ( ! name_map[emotes[i].name] )
					name_map[emotes[i].name] = i;

			const words = entered.split(' ');
			let i = words.length;
			while(i--) {
				const word = words[i];
				if ( name_map[word] != null )
					return emotes[name_map[word]];
			}
		}

		// Random emote
		if ( emotes && emotes.length ) {
			const idx = Math.floor(Math.random() * emotes.length),
				emote = emotes[idx];

			this.target_emote = emote;
			return emote;
		}

		// Return LaterSooner
		return this.target_emote = {
			provider: 'ffz',
			set_id: 3,
			id: 149346,
			name: 'LaterSooner',
			src: 'https://cdn.frankerfacez.com/emote/149346/1',
			srcSet: 'https://cdn.frankerfacez.com/emote/149346/1 1x, https://cdn.frankerfacez.com/emote/149346/2 2x, https://cdn.frankerfacez.com/emote/149346/4 4x',
			width: 25,
			height: 32
		}
	}


	getSetIDs(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			room_user = room && room.getUser(user_id, user_login, true),
			user = this.parent.getUser(user_id, user_login, true);

		let out = (user?.emote_sets ? user.emote_sets._cache : []).concat(
			room_user?.emote_sets ? room_user.emote_sets._cache : [],
			room?.emote_sets ? room.emote_sets._cache : [],
			this.default_sets._cache
		);

		if ( this.bulk.size ) {
			const str_user = String(user_id);
			for(const [set_id, users] of this.bulk) {
				if ( users?._cache.has(str_user) )
					out.push(set_id);
			}
		}

		// Shared Chats
		if ( room?.shared_chats?.size > 0 )
			for(const shared_id of room.shared_chats) {
				const shared_room = this.parent.getRoom(shared_id, null, true),
					shared_user = shared_room && shared_room.getUser(user_id, user_login, true);

				if ( shared_user?.emote_sets?._cache )
					out = out.concat(shared_user.emote_sets._cache);

				if ( shared_room?.emote_sets?._cache )
					out = out.concat(shared_room.emote_sets._cache);
			}

		return out;
	}

	getSets(user_id, user_login, room_id, room_login) {
		return this.getSetIDs(user_id, user_login, room_id, room_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	_withSources(out, seen, emote_sets, room_id = null) { // eslint-disable-line class-methods-use-this
		if ( ! emote_sets?._sources )
			return;

		for(const [provider, data] of emote_sets._sources)
			for(const item of data)
				if ( ! seen.has(item) ) {
					out.push([item, provider, room_id]);
					seen.add(item);
				}

		return out;
	}

	getRoomSetIDsWithSources(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			room_user = room && room.getUser(user_id, user_login, true);

		if ( ! room )
			return [];

		const out = [], seen = new Set;

		this._withSources(out, seen, room.emote_sets, room.id);
		if ( room_user )
			this._withSources(out, seen, room_user.emote_sets, room.id);

		// Shared Chats
		if ( room?.shared_chats?.size > 0 )
			for(const shared_id of room.shared_chats) {
				const shared_room = this.parent.getRoom(shared_id, null, true),
					shared_user = shared_room && shared_room.getUser(user_id, user_login, true);

				if ( shared_user )
					this._withSources(out, seen, shared_user.emote_sets, shared_id);

				if ( shared_room )
					this._withSources(out, seen, shared_room.emote_sets, shared_id);
			}

		return out;
	}

	getRoomSetsWithSources(user_id, user_login, room_id, room_login) {
		return this.getRoomSetIDsWithSources(user_id, user_login, room_id, room_login)
			.map(([set_id, source, r_id]) => [this.emote_sets[set_id], source, r_id]);
	}

	getRoomSetIDs(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			room_user = room && room.getUser(user_id, user_login, true);

		let out;

		if ( ! room )
			out = [];

		else if ( ! room_user?.emote_sets )
			out = room.emote_sets ? room.emote_sets._cache : [];

		else if ( ! room.emote_sets )
			out = room_user.emote_sets._cache;

		else
			out = room_user.emote_sets._cache.concat(room.emote_sets._cache);

		// Shared Chats
		if ( room?.shared_chats?.size > 0 )
			for(const shared_id of room.shared_chats) {
				const shared_room = this.parent.getRoom(shared_id, null, true),
					shared_user = shared_room && shared_room.getUser(user_id, user_login, true);

				if ( shared_user?.emote_sets?._cache )
					out = out.concat(shared_user.emote_sets._cache);

				if ( shared_room?.emote_sets?._cache )
					out = out.concat(shared_room.emote_sets._cache);
			}

		return out;
	}

	getRoomSets(user_id, user_login, room_id, room_login) {
		return this.getRoomSetIDs(user_id, user_login, room_id, room_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	getGlobalSetIDsWithSources(user_id, user_login) {
		const user = this.parent.getUser(user_id, user_login, true),
			out = [], seen = new Set;

		this._withSources(out, seen, this.default_sets);
		if ( user )
			this._withSources(out, seen, user.emote_sets);

		if ( this.bulk.size ) {
			const str_user = String(user_id);
			for(const [set_id, users] of this.bulk) {
				if ( ! seen.has(set_id) && users?._cache.has(str_user) ) {
					for(const [provider, data] of users._sources) {
						if ( data && data.includes(str_user) ) {
							out.push([set_id, provider, null]);
							break;
						}
					}
				}
			}
		}

		return out;
	}

	getGlobalSetsWithSources(user_id, user_login) {
		return this.getGlobalSetIDsWithSources(user_id, user_login)
			.map(([set_id, source]) => [this.emote_sets[set_id], source, null]);
	}


	getSubSetIDsWithSources() {
		const out = [], seen = new Set;

		this._withSources(out, seen, this.sub_sets);

		return out;
	}

	getSubSetsWithSources() {
		return this.getSubSetIDsWithSources()
			.map(([set_id, source]) => [this.emote_sets[set_id], source, null]);
	}


	getGlobalSetIDs(user_id, user_login) {
		const user = this.parent.getUser(user_id, user_login, true);

		const out = (user?.emote_sets ? user.emote_sets._cache : []).concat(
			this.default_sets._cache
		);

		if ( this.bulk.size ) {
			const str_user = String(user_id);
			for(const [set_id, users] of this.bulk) {
				if ( users?._cache.has(str_user) )
					out.push(set_id);
			}
		}

		return out;

	}

	getGlobalSets(user_id, user_login) {
		return this.getGlobalSetIDs(user_id, user_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	getEmotes(user_id, user_login, room_id, room_login) {
		const emotes = {};
		for(const emote_set of this.getSets(user_id, user_login, room_id, room_login))
			if ( emote_set && emote_set.emotes )
				for(const emote of Object.values(emote_set.emotes) )
					if ( emote && ! has(emotes, emote.name) )
						emotes[emote.name] = emote;

		return emotes;
	}

	// ========================================================================
	// Bulk Management
	// ========================================================================

	setBulk(source, set_id, entries) {
		let set = this.bulk.get(set_id);
		if ( ! set )
			this.bulk.set(set_id, set = new SourcedSet(true));

		const size = set._cache.size;
		set.set(source, entries);
		const new_size = set._cache.size;

		if ( ! size && new_size )
			this.refSet(set_id);
	}

	deleteBulk(source, set_id) {
		const set = this.bulk.get(set_id);
		if ( ! set )
			return;

		const size = set._cache.size;
		set.delete(source);
		const new_size = set._cache.size;

		if ( size && ! new_size )
			this.unrefSet(set_id);
	}

	extendBulk(source, set_id, entries) {
		let set = this.bulk.get(set_id);
		if ( ! set )
			this.bulk.set(set_id, set = new SourcedSet(true));

		if ( ! Array.isArray(entries) )
			entries = [entries];

		const size = set._cache.size;
		set.extend(source, ...entries);
		const new_size = set._cache.size;

		if ( ! size && new_size )
			this.refSet(set_id);
	}

	// ========================================================================
	// Emote Set Ref Counting
	// ========================================================================

	addDefaultSet(provider, set_id, data) {
		if ( typeof set_id === 'number' )
			set_id = `${set_id}`;

		let changed = false, added = false;
		if ( ! this.default_sets.sourceIncludes(provider, set_id) ) {
			changed = ! this.default_sets.includes(set_id);
			this.default_sets.push(provider, set_id);
			added = true;
		}

		if ( data )
			this.loadSetData(set_id, data);

		if ( changed ) {
			this.refSet(set_id);
			this.emit(':update-default-sets', provider, set_id, true);
		}

		return added;
	}

	removeDefaultSet(provider, set_id) {
		if ( ! set_id ) {
			const sets = this.default_sets.get(provider);
			if ( sets )
				for(const set_id of Array.from(sets))
					this.removeDefaultSet(provider, set_id);
			return;
		}

		if ( typeof set_id === 'number' )
			set_id = `${set_id}`;

		if ( this.default_sets.sourceIncludes(provider, set_id) ) {
			this.default_sets.remove(provider, set_id);
			if ( ! this.default_sets.includes(set_id) ) {
				this.unrefSet(set_id);
				this.emit(':update-default-sets', provider, set_id, false);
			}

			return true;
		}

		return false;
	}

	addSubSet(provider, set_id, data) {
		if ( typeof set_id === 'number' )
			set_id = `${set_id}`;

		let changed = false, added = false;
		if ( ! this.sub_sets.sourceIncludes(provider, set_id) ) {
			changed = ! this.sub_sets.includes(set_id);
			this.sub_sets.push(provider, set_id);
			added = true;
		}

		if ( data )
			this.loadSetData(set_id, data);

		if ( changed ) {
			this.refSet(set_id);
			this.emit(':update-sub-sets', provider, set_id, true);
		}

		return added;
	}

	removeSubSet(provider, set_id) {
		if ( typeof set_id === 'number' )
			set_id = `${set_id}`;

		if ( this.sub_sets.sourceIncludes(provider, set_id) ) {
			this.sub_sets.remove(provider, set_id);
			if ( ! this.sub_sets.includes(set_id) ) {
				this.unrefSet(set_id);
				this.emit(':update-sub-sets', provider, set_id, false);
			}

			return true;
		}

		return false;
	}

	refSet(set_id) {
		this._set_refs[set_id] = (this._set_refs[set_id] || 0) + 1;
		if ( this._set_timers[set_id] ) {
			clearTimeout(this._set_timers[set_id]);
			this._set_timers[set_id] = null;
		}
	}

	unrefSet(set_id) {
		const c = this._set_refs[set_id] = (this._set_refs[set_id] || 1) - 1;
		if ( c <= 0 && ! this._set_timers[set_id] )
			this._set_timers[set_id] = setTimeout(() => this.unloadSet(set_id), 5000);
	}


	// ========================================================================
	// Emote Set Loading
	// ========================================================================

	async loadGlobalSets(tries = 0) {
		this.load_tracker.schedule('chat-data', 'ffz-global');

		let response, data;

		if ( this.experiments.getAssignment('api_load') && tries < 1 )
			try {
				fetch(`${NEW_API}/v1/set/global`).catch(() => {});
			} catch(err) { /* do nothing */ }

		try {
			response = await fetch(`${this.staging.api}/v1/set/global/ids`)
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.loadGlobalSets(tries), 500 * tries);

			this.log.error('Error loading global emote sets.', err);
			this.load_tracker.notify('chat-data', 'ffz-global', false);
			return false;
		}

		if ( ! response.ok ) {
			this.load_tracker.notify('chat-data', 'ffz-global', false);
			return false;
		}

		try {
			data = await response.json();
		} catch(err) {
			this.log.error('Error parsing global emote data.', err);
			this.load_tracker.notify('chat-data', 'ffz-global', false);
			return false;
		}

		const sets = data.sets || {};

		// Remove existing global sets, in case we have any.
		this.removeDefaultSet('ffz-global');

		for(const set_id of data.default_sets)
			this.addDefaultSet('ffz-global', set_id);

		for(const set_id in sets)
			if ( has(sets, set_id) ) {
				const id = sets[set_id]?.id;
				this.loadSetData(set_id, sets[set_id]);
				if ( id && ! data.default_sets.includes(id) )
					this.addSubSet('ffz-global', set_id);
			}

		if ( data.user_ids )
			this.loadSetUserIds(data.user_ids);
		else if ( data.users )
			this.loadSetUsers(data.users);

		this.load_tracker.notify('chat-data', 'ffz-global');
		return true;
	}


	async loadSet(set_id, suppress_log = false, tries = 0) {
		const load_key = `ffz-${set_id}`;
		this.load_tracker.schedule('chat-data', load_key);
		let response, data;

		if ( this.experiments.getAssignment('api_load') )
			try {
				fetch(`${NEW_API}/v1/set/${set_id}`).catch(() => {});
			} catch(err) { /* do nothing */ }

		try {
			response = await fetch(`${this.staging.api}/v1/set/${set_id}${this.staging.active ? '/ids' : ''}`)
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.loadGlobalSets(tries), 500 * tries);

			this.log.error(`Error loading data for set "${set_id}".`, err);
			this.load_tracker.notify('chat-data', load_key, false);
			return false;
		}

		if ( ! response.ok ) {
			this.load_tracker.notify('chat-data', load_key, false);
			return false;
		}

		try {
			data = await response.json();
		} catch(err) {
			this.log.error(`Error parsing data for set "${set_id}".`, err);
			this.load_tracker.notify('chat-data', load_key, false);
			return false;
		}

		const set = data.set;
		if ( set )
			this.loadSetData(set.id, set, suppress_log);

		if ( data.user_ids )
			this.loadSetUserIds(data.user_ids);
		else if ( data.users )
			this.loadSetUsers(data.users);

		this.load_tracker.notify('chat-data', load_key, true);
		return true;
	}


	loadSetUserIds(data, suppress_log = false) {
		for(const set_id in data)
			if ( has(data, set_id) ) {
				const emote_set = this.emote_sets[set_id],
					users = data[set_id];

				this.setBulk('ffz-global', set_id, users.map(x => String(x)));
				if ( ! suppress_log )
					this.log.info(`Added "${emote_set ? emote_set.title : set_id}" emote set to ${users.length} users.`);
			}
	}


	loadSetUsers(data, suppress_log = false) {
		for(const set_id in data)
			if ( has(data, set_id) ) {
				const emote_set = this.emote_sets[set_id],
					users = data[set_id];

				for(const login of users)
					this.parent.getUser(undefined, login)
						.addSet('ffz-global', set_id);

				if ( ! suppress_log )
					this.log.info(`Added "${emote_set ? emote_set.title : set_id}" emote set to ${users.length} users.`);
			}
	}


	processEmote(emote, set_id) {
		if ( ! emote.id || ! emote.name || ! emote.urls )
			return null;

		emote.set_id = set_id;
		emote.src = emote.urls[1];
		emote.srcSet = `${emote.urls[1]} 1x`;
		if ( emote.urls[2] )
			emote.srcSet += `, ${emote.urls[2]} 2x`;
		if ( emote.urls[4] )
			emote.srcSet += `, ${emote.urls[4]} 4x`;

		if ( emote.urls[2] ) {
			emote.can_big = true;
			emote.src2 = emote.urls[2];
			emote.srcSet2 = `${emote.urls[2]} 1x`;
			if ( emote.urls[4] )
				emote.srcSet2 += `, ${emote.urls[4]} 2x`;
		}

		if ( emote.animated?.[1] ) {
			emote.animSrc = emote.animated[1];
			emote.animSrcSet = `${emote.animated[1]} 1x`;
			if ( emote.animated[2] ) {
				emote.animSrcSet += `, ${emote.animated[2]} 2x`;
				emote.animSrc2 = emote.animated[2];
				emote.animSrcSet2 = `${emote.animated[2]} 1x`;

				if ( emote.animated[4] ) {
					emote.animSrcSet += `, ${emote.animated[4]} 4x`;
					emote.animSrcSet2 += `, ${emote.animated[4]} 2x`;
				}
			}
		}

		// Check to see if this emote applies any effects with as_background.
		/*let as_background = false;
		if ( emote.modifier_flags ) {
			for(const input of EFFECT_STYLES)
				if ( (emote.modifier_flags & input.flags) === input.flags ) {
					if ( input.as_background ) {
						as_background = true;
						break;
					}
				}
		}*/

		emote.token = {
			type: 'emote',
			id: emote.id,
			set: set_id,
			provider: 'ffz',
			src: emote.src,
			srcSet: emote.srcSet,
			can_big: !! emote.urls[2],
			src2: emote.src2,
			srcSet2: emote.srcSet2,
			animSrc: emote.animSrc,
			animSrcSet: emote.animSrcSet,
			animSrc2: emote.animSrc2,
			animSrcSet2: emote.animSrcSet2,
			masked: !! emote.mask,
			mod: emote.modifier,
			mod_prefix: emote.modifier_prefix,
			mod_hidden: (emote.modifier_flags & 1) === 1,
			text: emote.hidden ? '???' : emote.name,
			length: emote.name.length,
			height: emote.height,
			width: emote.width,
			source_modifier_flags: emote.modifier_flags ?? 0,
			//effect_bg: as_background
		};

		if ( has(MODIFIERS, emote.id) )
			Object.assign(emote, MODIFIERS[emote.id]);

		return emote;
	}


	addEmoteToSet(set_id, emote) {
		const set = this.emote_sets[set_id];
		if ( ! set )
			throw new Error(`Invalid emote set "${set_id}"`);

		const processed = this.processEmote(emote, set_id);
		if ( ! processed )
			throw new Error('Invalid emote data object.');

		const is_disabled = this.shouldFilterEmote(processed, set, set_id);

		// Possible logic paths:
		// 1. No old emote. New emote accepted.
		// 2. No old emote. New emote disabled.
		// 3. Old emote. New emote accepted.
		// 4. Old emote. New emote disabled.
		// 5. Old emote disabled. New emote accepted.
		// 6. Old emote disabled. New emote disabled.

		// Are we removing a disabled emote?
		const removed = set.disabled_emotes[processed.id];
		if ( removed ) {
			delete set.disabled_emotes[processed.id];
			set.disabled_count--;
		}

		// Are we removing an existing emote?
		const old_emote = set.emotes[processed.id],
			old_css = old_emote && this.generateEmoteCSS(old_emote);

		// Store the emote.
		if ( is_disabled ) {
			set.disabled_emotes[processed.id] = processed;
			set.disabled_count++;

			// If there was an old emote, we need to decrement
			// the use count and remove it from the emote list.
			if ( old_emote ) {
				const new_emotes = {};
				let count = 0;

				for(const em of Object.values(set.emotes)) {
					if ( em.id == processed.id )
						continue;

					new_emotes[em.id] = em;
					count++;
				}

				set.emotes = new_emotes;
				set.count = count;

			} else {
				// If there was no old emote, then we can stop now.
				return processed;
			}

		} else {
			// Not disabled. This is a live emote.
			set.emotes[processed.id] = processed;

			// If there was no old emote, update the set count.
			if ( ! old_emote )
				set.count++;
		}

		// Now we need to update the CSS. If we had old emote CSS, then we
		// will need to totally rebuild the CSS.
		const style_key = `es--${set_id}`;

		// Rebuild the full CSS if we have an old emote.
		if ( old_css && old_css.length ) {
			const css = [];
			for(const em of Object.values(set.emotes)) {
				const emote_css = this.generateEmoteCSS(em);
				if ( emote_css && emote_css.length )
					css.push(emote_css);
			}

			if ( this.style && (css.length || set.css) )
				this.style.set(style_key, css.join('') + (set.css || ''));
			else if ( css.length )
				set.pending_css = css.join('');

		} else if ( ! is_disabled ) {
			// If there wasn't an old emote, only add our CSS if the emote
			// isn't disabled.
			const emote_css = this.generateEmoteCSS(processed);
			if ( emote_css && emote_css.length ) {
				if ( this.style )
					this.style.set(style_key, (this.style.get(style_key) || '') + emote_css);
				else
					set.pending_css = (set.pending_css || '') + emote_css;
			}
		}

		// Send a loaded event because this emote set changed.
		this.emit(':loaded', set_id, set);

		// Return the processed emote object.
		return processed;
	}


	removeEmoteFromSet(set_id, emote_id) {
		const set = this.emote_sets[set_id];
		if ( ! set )
			throw new Error(`Invalid emote set "${set_id}"`);

		if ( emote_id && emote_id.id )
			emote_id = emote_id.id;

		// If the emote was present but disabled, just return it
		// without having to do most of our logic.
		const removed = set.disabled_emotes?.[emote_id];
		if ( removed ) {
			set.disabled_count--;
			delete set.disabled_emotes[emote_id];
			return removed;
		}

		const emote = set.emotes[emote_id];
		if ( ! emote )
			return;

		const emote_css = this.generateEmoteCSS(emote);
		const css = (emote_css && emote_css.length) ? [] : null;

		// Rebuild the emotes object to avoid gaps.
		const new_emotes = {};
		let count = 0;

		for(const em of Object.values(set.emotes)) {
			if ( em.id == emote_id )
				continue;

			new_emotes[em.id] = em;
			count++;

			if ( css != null) {
				const em_css = this.generateEmoteCSS(em);
				if ( em_css && em_css.length )
					css.push(em_css);
			}
		}

		set.emotes = new_emotes;
		set.count = count;

		if ( css != null ) {
			const style_key = `es--${set_id}`;
			if ( this.style && (css.length || set.css) )
				this.style.set(style_key, css.join('') + (set.css || ''));
			else if ( css.length )
				set.pending_css = css.join('');
		}

		// Send a loaded event because this emote set changed.
		this.emit(':loaded', set_id, set);

		// Return the removed emote.
		return emote;
	}


	loadSetData(set_id, data, suppress_log = false) {
		const old_set = this.emote_sets[set_id];
		if ( ! data ) {
			if ( old_set ) {
				if ( this.style )
					this.style.delete(`es--${set_id}`);
				this.emote_sets[set_id] = null;
			}

			return;
		}

		this.emote_sets[set_id] = data;

		let count = 0,
			fcount = 0;
		const ems = data.emotes || data.emoticons,
			new_ems = data.emotes = {},
			filtered = data.disabled_emotes = {},
			css = [];

		data.id = set_id;
		data.emoticons = undefined;

		const bad_emotes = [];

		for(const emote of ems) {
			const processed = this.processEmote(emote, set_id);
			if ( ! processed ) {
				bad_emotes.push(emote);
				continue;
			}

			if ( this.shouldFilterEmote(processed, data, set_id) ) {
				filtered[processed.id] = processed;
				fcount++;
				continue;
			}

			const emote_css = this.generateEmoteCSS(processed);
			if ( emote_css )
				css.push(emote_css);

			count++;
			new_ems[processed.id] = processed;
		}

		if ( bad_emotes.length )
			this.log.warn(`Bad Emote Data for Set #${set_id}`, bad_emotes);

		data.count = count;
		data.disabled_count = fcount;

		if ( this.style && (css.length || data.css) )
			this.style.set(`es--${set_id}`, css.join('') + (data.css || ''));
		else if ( css.length )
			data.pending_css = css.join('');

		if ( ! suppress_log )
			this.log.info(`Loaded emote set #${set_id}: ${data.title} (${count} emotes, ${fcount} filtered)`);

		this.emit(':loaded', set_id, data);

		// Don't let people endlessly load unused sets.
		const refs = this._set_refs[set_id] || 0;
		if ( refs <= 0 && ! this._set_timers[set_id] )
			this._set_timers[set_id] = setTimeout(() => this.unloadSet(set_id), 5000);
	}


	unloadSet(set_id, force = false, suppress_log = false) {
		const old_set = this.emote_sets[set_id],
			count = this._set_refs[set_id] || 0;

		if ( ! old_set )
			return;

		if ( count > 0 ) {
			if ( ! force )
				return this.log.warn(`Attempted to unload emote set #${set_id} with ${count} users.`);
			this.log.warn(`Unloading emote set ${set_id} with ${count} users.`);
		}

		if ( ! suppress_log )
			this.log.info(`Unloaded emote set #${set_id}: ${old_set.title}`);

		if ( this._set_timers[set_id] ) {
			clearTimeout(this._set_timers[set_id]);
			this._set_timers[set_id] = null;
		}

		this.emit(':unloaded', set_id, old_set);
		this.emote_sets[set_id] = null;
	}


	// ========================================================================
	// Emote CSS
	// ========================================================================

	generateEmoteCSS(emote) { // eslint-disable-line class-methods-use-this
		if ( ! emote.mask && ! emote.margins && ( ! emote.modifier || ( ! emote.modifier_offset && ! emote.extra_width && ! emote.shrink_to_fit ) ) && ! emote.css )
			return '';

		let output = '';
		if ( emote.modifier && (emote.modifier_offset || emote.margins || emote.extra_width || emote.shrink_to_fit) ) {
			let margins = emote.modifier_offset || emote.margins || '0';
			margins = margins.split(/\s+/).map(x => parseInt(x, 10));
			if ( margins.length === 3 )
				margins.push(margins[1]);

			const l = margins.length,
				m_top = margins[0 % l],
				m_right = margins[1 % l],
				m_bottom = margins[2 % l],
				m_left = margins[3 % l];

			output = `.modified-emote span .ffz-emote[data-id="${emote.id}"] {
	padding: ${m_top}px ${m_right}px ${m_bottom}px ${m_left}px;
	${emote.shrink_to_fit ? `max-width: calc(100% - ${40 - m_left - m_right - (emote.extra_width||0)}px);` : ''}
	margin: 0 !important;
}`;
		}

		if ( emote.modifier && emote.mask?.[1] ) {
			output = `${output || ''  }.modified-emote[data-modifiers~="${emote.id}"] > .chat-line__message--emote {
	-webkit-mask-image: url("${emote.mask[1]}");
	-webkit-mask-position: center center;
}`
		}

		return `${output}.ffz-emote[data-id="${emote.id}"] {
	${(emote.margins && ! emote.modifier) ? `margin: ${emote.margins} !important;` : ''}
	${emote.css||''}
}`;
	}


	// ========================================================================
	// Twitch Data Lookup
	// ========================================================================

	setTwitchEmoteSet(emote_id, set_id) {
		if ( typeof emote_id === 'number' ) {
			if ( isNaN(emote_id) || ! isFinite(emote_id) )
				return;
			emote_id = `${emote_id}`;
		}

		if ( typeof set_id === 'number' ) {
			if ( isNaN(set_id) || ! isFinite(set_id) )
				return;
			set_id = `${set_id}`;
		}

		this.__twitch_emote_to_set[emote_id] = set_id;
	}

	setTwitchSetChannel(set_id, channel) {
		if ( typeof set_id === 'number' ) {
			if ( isNaN(set_id) || ! isFinite(set_id) )
				return;

			set_id = `${set_id}`;
		}

		this.__twitch_set_to_channel[set_id] = channel;
	}

	_getTwitchEmoteSet(emote_id, need_artist = false) {
		const tes = this.__twitch_emote_to_set,
			tsc = this.__twitch_set_to_channel,
			tsa = this.__twitch_emote_to_artist;

		if ( typeof emote_id === 'number' ) {
			if ( isNaN(emote_id) || ! isFinite(emote_id) )
				return Promise.resolve(null);

			emote_id = `${emote_id}`;
		}

		if ( has(tes, emote_id) && (! need_artist || has(tsa, emote_id)) ) {
			const val = tes[emote_id];
			if ( Array.isArray(val) )
				return new Promise(s => val.push(s));
			else
				return Promise.resolve(val);
		}

		const apollo = this.resolve('site.apollo');
		if ( ! apollo?.client )
			return Promise.resolve(null);

		return new Promise(s => {
			const promises = [s];
			tes[emote_id] = promises;

			timeout(apollo.client.query({
				query: GET_EMOTE,
				variables: {
					id: `${emote_id}`
				}
			}), 2000).then(data => {
				const emote = data?.data?.emote;
				let set_id = null;

				if ( emote ) {
					set_id = emote.setID;

					if ( emote.id && ! has(tsa, emote.id) ) {
						tsa[emote.id] = emote.artist;
					}

					if ( set_id && ! has(tsc, set_id) ) {
						const type = determineEmoteType(emote);

						tsc[set_id] = {
							id: set_id,
							type,
							owner: emote?.subscriptionProduct?.owner || emote?.owner
						};
					}
				}

				tes[emote_id] = set_id;
				for(const fn of promises)
					fn(set_id);

			}).catch(() => {
				tes[emote_id] = null;
				for(const fn of promises)
					fn(null);
			});
		});
	}

	getTwitchEmoteSet(emote_id, callback) {
		const promise = this._getTwitchEmoteSet(emote_id);
		if ( callback )
			promise.then(callback);
		else
			return promise;
	}

	_getTwitchEmoteArtist(emote_id) {
		const tsa = this.__twitch_emote_to_artist;

		if ( has(tsa, emote_id) )
			return Promise.resolve(tsa[emote_id]);

		return this._getTwitchEmoteSet(emote_id, true)
			.then(() => tsa[emote_id])
			.catch(() => {
				tsa[emote_id] = null;
				return null;
			});
	}

	getTwitchEmoteArtist(emote_id, callback) {
		const promise = this._getTwitchEmoteArtist(emote_id);
		if ( callback )
			promise.then(callback);
		else
			return promise;
	}


	_getTwitchSetChannel(set_id) {
		const tsc = this.__twitch_set_to_channel;

		if ( typeof set_id === 'number' ) {
			if ( isNaN(set_id) || ! isFinite(set_id) )
				return Promise.resolve(null);

			set_id = `${set_id}`;
		}

		if ( has(tsc, set_id) ) {
			const val = tsc[set_id];
			if ( Array.isArray(val) )
				return new Promise(s => val.push(s));
			else
				return Promise.resolve(val);
		}

		const apollo = this.resolve('site.apollo');
		if ( ! apollo?.client )
			return Promise.resolve(null);

		return new Promise(s => {
			const promises = [s];
			tsc[set_id] = promises;

			timeout(apollo.client.query({
				query: GET_EMOTE_SET,
				variables: {
					id: `${set_id}`
				}
			}), 2000).then(data => {
				const set = data?.data?.emoteSet;
				let result = null;

				if ( set ) {
					result = {
						id: set_id,
						type: determineSetType(set),
						owner: set.owner ? {
							id: set.owner.id,
							login: set.owner.login,
							displayName: set.owner.displayName
						} : null
					};
				}

				tsc[set_id] = result;
				for(const fn of promises)
					fn(result);

			}).catch(() => {
				tsc[set_id] = null;
				for(const fn of promises)
					fn(null);
			});
		});
	}


	getTwitchSetChannel(set_id, callback) {
		const promise = this._getTwitchSetChannel(set_id);
		if ( callback )
			promise.then(callback);
		else
			return promise;
	}
}


function determineEmoteType(emote) {
	const product = emote.subscriptionProduct;
	if ( product ) {
		if ( product.id == 12658 )
			return EmoteTypes.Prime;
		else if ( product.id == 324 )
			return EmoteTypes.Turbo;

		// TODO: Care about Overwatch League

		const owner = product.owner;
		if ( owner ) {
			if ( owner.id == 139075904 || product.state === 'INACTIVE' )
				return EmoteTypes.LimitedTime;

			return EmoteTypes.Subscription;
		}
	}

	if ( emote.setID == 300238151 )
		return EmoteTypes.ChannelPoints;

	if ( emote.setID == 300374282 )
		return EmoteTypes.TwoFactor;

	const id = parseInt(emote.setID, 10);
	if ( ! isNaN(id) && isFinite(id) && id >= 5e8 )
		return EmoteTypes.BitsTier;

	return EmoteTypes.Global;
}


function determineSetType(set) {
	const id = /^\d+$/.test(set.id) ? parseInt(set.id, 10) : null;

	if ( id && TWITCH_GLOBAL_SETS.includes(id) )
		return EmoteTypes.Global;

	if ( id && TWITCH_POINTS_SETS.includes(id) )
		return EmoteTypes.ChannelPoints;

	if ( id && TWITCH_PRIME_SETS.includes(id) )
		return EmoteTypes.Prime;

	if ( id == 300374282 )
		return EmoteTypes.TwoFactor;

	const owner = set.owner;
	if ( owner ) {
		if ( owner.id == 139075904 )
			return EmoteTypes.LimitedTime;

		let product;
		if ( Array.isArray(owner.subscriptionProducts) )
			for(const prod of owner.subscriptionProducts)
				if ( set.id == prod.emoteSetID ) {
					product = prod;
					break;
				}

		if ( product ) {
			if ( product.id == 12658 )
				return EmoteTypes.Prime;
			else if ( product.id == 324 )
				return EmoteTypes.Turbo;
			else if ( product.state === 'INACTIVE' )
				return EmoteTypes.LimitedTime;
		}

		return EmoteTypes.Subscription;
	}

	if ( id >= 5e8 )
		return EmoteTypes.BitsTier;

	return EmoteTypes.Global;
}
