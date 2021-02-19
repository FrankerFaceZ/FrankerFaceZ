'use strict';

// ============================================================================
// Menu Module
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';
import {Color} from 'utilities/color';

//import THEME_CSS from 'site/styles/theme.scss';
import NORMALIZER_CSS_URL from 'site/styles/color_normalizer.scss';

const BAD_ROUTES = ['product', 'prime', 'turbo'];

const COLORS = [
	-0.62, -0.578, -0.539, -0.469, -0.4, -0.32, -0.21, -0.098, // 1-8
	0, // 9
	0.08, 0.151, 0.212, 0.271, 0.31, 0.351 // 10-15
];


const ACCENT_COLORS = {
	//dark: {'c':{'accent': 9,'background-accent':8,'background-accent-alt':7,'background-accent-alt-2':6,'background-button':7,'background-button-active':7,'background-button-focus':8,'background-button-hover':8,'background-button-primary-active':7,'background-button-primary-default':9,'background-button-primary-hover':8,'background-graph':2,'background-graph-fill':8,'background-input-checkbox-checked':9,'background-input-checked':8,'background-interactable-active':9,'background-interactable-selected':9,'background-interactable-hover':8,'background-progress-countdown-status':9,'background-progress-status':9,'background-range-fill':9,'background-subscriber-stream-tag-active':4,'background-subscriber-stream-tag-default':4,'background-subscriber-stream-tag-hover':3,'background-toggle-checked':9,/*'background-tooltip':1,*/'background-top-nav':6,'border-brand':9,'border-button':7,'border-button-active':8,'border-button-focus':9,'border-button-hover':8,'border-input-checkbox-checked':9,'border-input-checkbox-focus':9,'border-input-focus':9,'border-interactable-selected':10,'border-subscriber-stream-tag':5,'border-tab-active':11,'border-tab-focus':11,'border-tab-hover':11,'border-toggle-focus':7,'border-toggle-hover':7,'border-whisper-incoming':10,'fill-brand':9,'text-button-text':10,'text-button-text-focus':'o1','text-button-text-hover':'o1','text-link':10,'text-link-active':10,'text-link-focus':10,'text-link-hover':10,'text-link-visited':10,'text-overlay-link-active':13,'text-overlay-link-focus':13,'text-overlay-link-hover':13,'text-tab-active':11,'background-chat':1,'background-chat-alt':3,'background-chat-header':2,'background-modal':3,'text-button-text-active':'o2'/*,'text-tooltip':1*/},'s':{'button-active':[8,'0 0 6px 0',''],'button-focus':[8,'0 0 6px 0',''],'input-focus':[8,'0 0 10px -2px',''],'interactable-focus':[8,'0 0 6px 0',''],'tab-focus':[11,'0 4px 6px -4px',''],'input':[5,'inset 0 0 0 1px','']}},
	//light: {'c':{'accent': 9,'background-accent':8,'background-accent-alt':7,'background-accent-alt-2':6,'background-button':7,'background-button-active':7,'background-button-focus':8,'background-button-hover':8,'background-button-primary-active':7,'background-button-primary-default':9,'background-button-primary-hover':8,'background-graph':15,'background-graph-fill':9,'background-input-checkbox-checked':9,'background-input-checked':8,'background-interactable-active':9,'background-interactable-selected':9,'background-interactable-hover':8,'background-progress-countdown-status':8,'background-progress-status':8,'background-range-fill':9,'background-subscriber-stream-tag-active':13,'background-subscriber-stream-tag-default':13,'background-subscriber-stream-tag-hover':14,'background-toggle-checked':9,/*'background-tooltip':1,*/'background-top-nav':7,'border-brand':9,'border-button':7,'border-button-active':8,'border-button-focus':9,'border-button-hover':8,'border-input-checkbox-checked':9,'border-input-checkbox-focus':9,'border-input-focus':9,'border-interactable-selected':9,'border-subscriber-stream-tag':10,'border-tab-active':8,'border-tab-focus':8,'border-tab-hover':8,'border-toggle-focus':8,'border-toggle-hover':8,'border-whisper-incoming':10,'fill-brand':9,'text-button-text':8,'text-button-text-focus':'o1','text-button-text-hover':'o1','text-link':8,'text-link-active':9,'text-link-focus':9,'text-link-hover':9,'text-link-visited':9,'text-overlay-link-active':13,'text-overlay-link-focus':13,'text-overlay-link-hover':13,'text-tab-active':8},'s':{'button-active':[8,'0 0 6px 0',''],'button-focus':[8,'0 0 6px 0',''],'input-focus':[10,'0 0 10px -2px',''],'interactable-focus':[8,'0 0 6px 1px',''],'tab-focus':[8,'0 4px 6px -4px','']}},
	//dark: {'c':{'background-accent':8,'background-accent-alt':7,'background-accent-alt-2':6,'background-button':7,'background-button-active':7,'background-button-focus':8,'background-button-hover':8,'background-button-primary-active':7,'background-button-primary-default':9,'background-button-primary-hover':8,'background-graph':2,'background-graph-fill':8,'background-input-checkbox-checked':9,'background-input-checked':8,'background-interactable-selected':9,'background-progress-countdown-status':9,'background-progress-status':9,'background-range-fill':9,'background-subscriber-stream-tag-active':4,'background-subscriber-stream-tag-default':4,'background-subscriber-stream-tag-hover':3,'background-toggle-checked':9,'background-top-nav':6,'border-brand':9,'border-button':7,'border-button-active':8,'border-button-focus':9,'border-button-hover':8,'border-input-checkbox-checked':9,'border-input-checkbox-focus':9,'border-input-focus':9,'border-interactable-selected':10,'border-subscriber-stream-tag':5,'border-tab-active':11,'border-tab-focus':11,'border-tab-hover':11,'border-toggle-focus':7,'border-toggle-hover':7,'border-whisper-incoming':10,'fill-brand':9,'text-button-text':10,'text-button-text-focus':'o1','text-button-text-hover':'o1','text-link':10,'text-link-active':10,'text-link-focus':10,'text-link-hover':10,'text-link-visited':10,'text-overlay-link-active':13,'text-overlay-link-focus':13,'text-overlay-link-hover':13,'text-tab-active':11,'background-chat':1,'background-chat-alt':3,'background-chat-header':2,'background-modal':3,'text-button-text-active':'o2'},'s':{'button-active':[8,'0 0 6px 0',''],'button-focus':[8,'0 0 6px 0',''],'input-focus':[8,'0 0 10px -2px',''],'interactable-focus':[8,'0 0 6px 0',''],'tab-focus':[11,'0 4px 6px -4px',''],'input':[5,'inset 0 0 0 1px','']}},
	//light: {'c':{'background-accent':8,'background-accent-alt':7,'background-accent-alt-2':6,'background-button':7,'background-button-active':7,'background-button-focus':8,'background-button-hover':8,'background-button-primary-active':7,'background-button-primary-default':9,'background-button-primary-hover':8,'background-graph':15,'background-graph-fill':9,'background-input-checkbox-checked':9,'background-input-checked':8,'background-interactable-selected':9,'background-progress-countdown-status':8,'background-progress-status':8,'background-range-fill':9,'background-subscriber-stream-tag-active':13,'background-subscriber-stream-tag-default':13,'background-subscriber-stream-tag-hover':14,'background-toggle-checked':9,'background-top-nav':7,'border-brand':9,'border-button':7,'border-button-active':8,'border-button-focus':9,'border-button-hover':8,'border-input-checkbox-checked':9,'border-input-checkbox-focus':9,'border-input-focus':9,'border-interactable-selected':9,'border-subscriber-stream-tag':10,'border-tab-active':8,'border-tab-focus':8,'border-tab-hover':8,'border-toggle-focus':8,'border-toggle-hover':8,'border-whisper-incoming':10,'fill-brand':9,'text-button-text':8,'text-button-text-focus':'o1','text-button-text-hover':'o1','text-link':8,'text-link-active':9,'text-link-focus':9,'text-link-hover':9,'text-link-visited':9,'text-overlay-link-active':13,'text-overlay-link-focus':13,'text-overlay-link-hover':13,'text-tab-active':8},'s':{'button-active':[8,'0 0 6px 0',''],'button-focus':[8,'0 0 6px 0',''],'input-focus':[10,'0 0 10px -2px',''],'interactable-focus':[8,'0 0 6px 1px',''],'tab-focus':[8,'0 4px 6px -4px','']}},
	dark: {'c':{'background-accent':8,'background-accent-alt':7,'background-accent-alt-2':6,'background-button':7,'background-button-active':7,'background-button-focus':8,'background-button-hover':8,'background-button-primary-active':7,'background-button-primary-default':9,'background-button-primary-hover':8,'background-chat':1,'background-chat-alt':3,'background-chat-header':2,'background-graph':2,'background-graph-fill':8,'background-input-checkbox-checked':10,'background-input-checked':8,'background-interactable-selected':9,'background-modal':3,'background-progress-countdown-status':9,'background-progress-status':9,'background-range-fill':10,'background-subscriber-stream-tag-active':4,'background-subscriber-stream-tag-default':4,'background-subscriber-stream-tag-hover':3,'background-toggle-checked':9,'background-top-nav':6,'border-brand':9,'border-button':7,'border-button-active':8,'border-button-focus':9,'border-button-hover':8,'border-input-checkbox-checked':10,'border-input-checkbox-focus':10,'border-input-focus':10,'border-interactable-selected':10,'border-range-handle':10,'border-subscriber-stream-tag':5,'border-tab-active':11,'border-tab-focus':11,'border-tab-hover':11,'border-toggle-checked':10,'border-toggle-focus':10,'border-whisper-incoming':10,'fill-brand':9,'text-button-text-active':'o2','text-link':10,'text-link-active':10,'text-link-focus':10,'text-link-hover':10,'text-link-visited':10,'text-overlay-link-active':13,'text-overlay-link-focus':13,'text-overlay-link-hover':13,'text-tab-active':11,'text-toggle-checked-icon':10,'text-tooltip':1,'text-button-text':10},'s':{'button-active':[8,' 0 0 6px 0',''],'button-focus':[8,' 0 0 6px 0',''],'input':[5,' inset 0 0 0 1px',''],'input-focus':[8,' 0 0 10px -2px',''],'interactable-focus':[8,' 0 0 6px 0',''],'tab-focus':[11,' 0 4px 6px -4px','']}},
	light: {'c':{'background-accent':8,'background-accent-alt':7,'background-accent-alt-2':6,'background-button':7,'background-button-active':7,'background-button-focus':8,'background-button-hover':8,'background-button-primary-active':7,'background-button-primary-default':9,'background-button-primary-hover':8,'background-chat':1,'background-chat-alt':3,'background-chat-header':2,'background-graph':15,'background-graph-fill':9,'background-input-checkbox-checked':9,'background-input-checked':8,'background-interactable-selected':9,'background-modal':3,'background-progress-countdown-status':8,'background-progress-status':8,'background-range-fill':9,'background-subscriber-stream-tag-active':13,'background-subscriber-stream-tag-default':13,'background-subscriber-stream-tag-hover':14,'background-toggle-checked':9,'background-top-nav':7,'border-brand':9,'border-button':7,'border-button-active':8,'border-button-focus':9,'border-button-hover':8,'border-input-checkbox-checked':9,'border-input-checkbox-focus':9,'border-input-focus':9,'border-interactable-selected':9,'border-range-handle':9,'border-subscriber-stream-tag':10,'border-tab-active':8,'border-tab-focus':8,'border-tab-hover':8,'border-toggle-checked':9,'border-toggle-focus':9,'border-whisper-incoming':10,'fill-brand':9,'text-button-text-active':'o2','text-link':8,'text-link-active':9,'text-link-focus':9,'text-link-hover':9,'text-link-visited':9,'text-overlay-link-active':13,'text-overlay-link-focus':13,'text-overlay-link-hover':13,'text-tab-active':8,'text-toggle-checked-icon':9,'text-tooltip':1,'text-button-text':8,'background-tooltip':1,'text-button-text-focus':'o1','text-button-text-hover':'o1'},'s':{'button-active':[8,' 0 0 6px 0',''],'button-focus':[8,' 0 0 6px 0',''],'input':[5,' inset 0 0 0 1px',''],'input-focus':[10,' 0 0 10px -2px',''],'interactable-focus':[8,' 0 0 6px 1px',''],'tab-focus':[8,' 0 4px 6px -4px','']}},
	accent_dark: {'c':{'accent-hover':10,'accent':9,'accent-primary-1':1,'accent-primary-2':5,'accent-primary-3':6,'accent-primary-4':7,'accent-primary-5':8},'s':{}},
	accent_light: {'c':{'accent-hover':10,'accent':9,'accent-primary-1':1,'accent-primary-2':5,'accent-primary-3':6,'accent-primary-4':7,'accent-primary-5':8},'s':{}}
};


export default class ThemeEngine extends Module {
	constructor(...args) {
		super(...args);
		this.inject('settings');

		this.inject('site');
		this.inject('site.fine');
		this.inject('site.css_tweaks');
		this.inject('site.router');

		this.should_enable = true;

		// Font

		this.settings.add('theme.font.size', {
			default: 13,
			process(ctx, val) {
				if ( typeof val !== 'number' )
					try {
						val = parseFloat(val);
					} catch(err) { val = null; }

				if ( ! val || val < 1 || isNaN(val) || ! isFinite(val) || val > 25 )
					val = 13;

				return val;
			},
			ui: {
				path: 'Appearance > Theme >> Fonts @{"sort": 2}',
				title: 'Font Size',
				description: '**Minimum:** `1`, **Maximum:** `25`, *Old Default:* `12`\n\nHow large should normal text be, in pixels. This may be affected by your browser\'s zoom and font settings.',
				component: 'setting-text-box',
				type: 'number'
			},
			changed: () => this.updateFont()
		});


		// Colors

		this.settings.add('theme.color.background', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Colors @{"sort": 0, "description": "This is a quick preview of a new system coming soon to FrankerFaceZ. Expect heavy changes here, including separate Basic and Advanced modes, and better color selection."}',
				title: 'Background',
				description: 'Try `#0E0C13` for something close to the old dark theme, or `#0E0E0E` for a nice dark gray. Transparent colors not allowed.',
				component: 'setting-color-box',
				sort: 0,
				alpha: false
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.color.text', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Colors',
				title: 'Text',
				description: 'If not set, this will automatically be set to white or black based on the brightness of the background.',
				component: 'setting-color-box',
				sort: 1
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.color.accent', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Colors',
				title: 'Accent',
				description: 'The accent color is used for buttons, links, etc.',
				component: 'setting-color-box',
				alpha: false,
				sort: 2
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.color.tooltip.background', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Colors',
				title: 'Tooltip Background',
				description: 'If not set, the tooltip settings will be automatically adjusted based on the brightness of the background.',
				component: 'setting-color-box',
				alpha: true,
				sort: 10
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.color.tooltip.text', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Colors',
				title: 'Tooltip Text',
				component: 'setting-color-box',
				sort: 11
			},
			changed: () => this.updateCSS()
		});


		this.settings.add('theme.color.chat-background', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Chat Colors @{"sort":1}',
				title: 'Background',
				component: 'setting-color-box',
				sort: 0,
				alpha: false
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.color.chat-text', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Chat Colors',
				title: 'Text',
				description: 'If not set, this will automatically be set to white or black based on the brightness of the background.',
				component: 'setting-color-box',
				sort: 1
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.color.chat-accent', {
			default: '',
			ui: {
				path: 'Appearance > Theme >> Chat Colors',
				title: 'Accent',
				description: 'The accent color is used for buttons, links, etc.',
				component: 'setting-color-box',
				alpha: false,
				sort: 2
			},
			changed: () => this.updateCSS()
		});


		/*this.settings.add('theme.dark', {
			requires: ['theme.is-dark'],
			default: false,
			process(ctx, val) {
				return ctx.get('theme.is-dark') ? val : false
			},

			ui: {
				path: 'Appearance @{"description": "Personalize the appearance of Twitch. Change the color scheme and fonts and tune the layout to optimize your experience."} > Theme >> Legacy',
				title: 'Gray (no Purple)',
				description: `*Requires Dark Theme to be Enabled.*

This setting will be going away very soon, as the new theme system matures.
The CSS loaded by this setting is far too heavy and can cause performance issues.`,
				component: 'setting-check-box'
			},

			changed: val => this.updateSetting(val)
		});*/

		this.settings.add('theme.can-dark', {
			requires: ['context.route.name'],
			process(ctx) {
				return ! BAD_ROUTES.includes(ctx.get('context.route.name'))
			}
		});

		this.settings.add('theme.is-dark', {
			requires: ['context.force-dark', 'theme.can-dark', 'context.ui.theme', 'context.ui.theatreModeEnabled', 'context.route.name', 'context.location.search'],
			process(ctx) {
				const force = ctx.get('context.force-theme');
				if ( force != null )
					return force;

				if ( ctx.get('context.route.name') === 'embed-chat' )
					return (ctx.get('context.location.search')||'').includes('dark');

				return ctx.get('context.ui.theatreModeEnabled') || (ctx.get('theme.can-dark') && ctx.get('context.ui.theme') === 1);
			},
			changed: () => this.updateCSS()
		});

		this.settings.add('theme.tooltips-dark', {
			requires: ['theme.is-dark'],
			process(ctx) {
				return ! ctx.get('theme.is-dark')
			}
		});

		this._style = null;
		this._normalizer = null;
	}

	/*updateOldCSS() {
		const dark = this.settings.get('theme.is-dark'),
			gray = this.settings.get('theme.dark');

		//document.body.classList.toggle('tw-root--theme-dark', dark);
		document.body.classList.toggle('tw-root--theme-ffz', gray);

		this.css_tweaks.setVariable('border-color', dark ? (gray ? '#2a2a2a'  : '#2c2541') : '#dad8de');
	}*/

	updateFont() {
		let size = this.settings.get('theme.font.size');
		if ( typeof size === 'string' && /^[0-9.]+$/.test(size) )
			size = parseFloat(size);
		else if ( typeof size !== 'number' )
			size = null;

		if ( ! size || isNaN(size) || ! isFinite(size) || size < 1 || size === 13 ) {
			this.css_tweaks.delete('font-size');
			return;
		}

		size = size / 10;

		this.css_tweaks.set('font-size', `html body {
	--font-size-1: ${(54/13) * size}rem;
	--font-size-2: ${(36/13) * size}rem;
	--font-size-3: ${(24/13) * size}rem;
	--font-size-4: ${(18/13) * size}rem;
	--font-size-5: ${(14/13) * size}rem;
	--font-size-6: ${size}rem;
	--font-size-7: ${(12/13) * size}rem;
	--font-size-8: ${(12/13) * size}rem;
	--font-size-base: ${size}rem;
}
`);
	}

	updateCSS() {
		//this.updateOldCSS();

		this.css_tweaks.setVariable('border-color', 'var(--color-border-base)');

		if ( ! this.settings.get('theme.can-dark') ) {
			this.toggleNormalizer(false);
			this.toggleAccentNormal(true);
			this.css_tweaks.delete('colors');
			return;
		}

		let dark = this.settings.get('theme.is-dark');
		const bits = [], accent_bits = [];

		const background = Color.RGBA.fromCSS(this.settings.get('theme.color.background'));
		if ( background ) {
			background.a = 1;
			bits.push(`--color-background-body: ${background.toCSS()};`);

			const hsla = background.toHSLA(),
				luma = hsla.l;
			dark = luma < 0.5;

			// Make sure the Twitch theme is set correctly.
			try {
				const store = this.resolve('site').store,
					theme = store.getState().ui.theme,
					wanted_theme = dark ? 1 : 0;

				if( theme !== wanted_theme )
					store.dispatch({
						type: 'core.ui.THEME_CHANGED',
						theme: wanted_theme
					});
			} catch(err) {
				this.log.warning('Unable to automatically set the Twitch Dark Theme state.', err);
			}

			bits.push(`--color-background-input-focus: ${background.toCSS()};`);
			bits.push(`--color-background-base: ${hsla._l(luma + (dark ? .05 : -.05)).toCSS()};`);
			bits.push(`--color-background-alt: ${hsla._l(luma + (dark ? .1 : -.1)).toCSS()};`);
			bits.push(`--color-background-alt-2: ${hsla._l(luma + (dark ? .15 : -.15)).toCSS()};`);
		}

		let text = Color.RGBA.fromCSS(this.settings.get('theme.color.text'));
		if ( ! text && background ) {
			text = Color.RGBA.fromCSS(dark ? '#FFF' : '#000');
		}

		if ( text ) {
			bits.push(`--color-text-base: ${text.toCSS()};`);
			bits.push(`--color-text-input: ${text.toCSS()};`);

			const hsla = text.toHSLA(),
				alpha = hsla.a;

			bits.push(`--color-text-label: ${text.toCSS()};`);
			bits.push(`--color-text-label-optional: ${hsla._a(alpha - 0.4).toCSS()};`);

			bits.push(`--color-text-alt: ${hsla._a(alpha - 0.2).toCSS()};`);
			bits.push(`--color-text-alt-2: ${hsla._a(alpha - 0.4).toCSS()};`);
		}

		// Accent
		const accent = Color.RGBA.fromCSS(this.settings.get('theme.color.accent'));
		this.toggleAccentNormal(! accent);
		if ( accent ) {
			accent.a = 1;

			const hsla = accent.toHSLA(),
				luma = hsla.l;

			const colors = COLORS.map(x => {
				if ( x === 0 )
					return accent.toCSS();

				return hsla._l(luma + x).toCSS()
			});

			for(let i=0; i < colors.length; i++) {
				bits.push(`--ffz-color-accent-${i+1}:${colors[i]};`);
			}

			let source = dark ? ACCENT_COLORS.dark : ACCENT_COLORS.light;

			for(const [key,val] of Object.entries(source.c)) {
				if ( typeof val !== 'number' )
					continue;

				bits.push(`--color-${key}:${colors[val-1]};`);
			}

			source = dark ? ACCENT_COLORS.accent_dark : ACCENT_COLORS.accent_light;

			for(const [key,val] of Object.entries(source.c)) {
				if ( typeof val !== 'number' )
					continue;

				accent_bits.push(`--color-${key}:${colors[val-1]} !important;`);
			}
		}

		// Tooltips
		let tooltip_bg = Color.RGBA.fromCSS(this.settings.get('theme.color.tooltip.background')),
			tooltip_dark;
		if ( ! tooltip_bg && background )
			tooltip_bg = Color.RGBA.fromCSS(dark ? '#FFF' : '#000');

		if ( tooltip_bg ) {
			bits.push(`--color-background-tooltip: ${tooltip_bg.toCSS()};`);

			const hsla = tooltip_bg.toHSLA(),
				luma = hsla.l;

			tooltip_dark = luma < 0.5;
		} else
			tooltip_dark = ! dark;

		let tooltip_text = Color.RGBA.fromCSS(this.settings.get('theme.color.tooltip.text'));
		const has_tt_text = tooltip_text || tooltip_bg;
		if ( ! tooltip_text )
			tooltip_text = Color.RGBA.fromCSS(tooltip_dark ? '#FFF' : '#000');

		if ( tooltip_text ) {
			if ( has_tt_text )
				bits.push(`--color-text-tooltip: ${tooltip_text.toCSS()};`);

			const hsla = tooltip_text.toHSLA(),
				alpha = hsla.a;

			bits.push(`--color-text-tooltip-alt: ${hsla._a(alpha - 0.2).toCSS()};`);
			bits.push(`--color-text-tooltip-alt-2: ${hsla._a(alpha - 0.4).toCSS()};`);
		}


		// Chat
		const chat_bits = [],
			chat_background = Color.RGBA.fromCSS(this.settings.get('theme.color.chat-background'));
		let chat_dark = dark;
		if ( chat_background ) {
			chat_background.a = 1;
			chat_bits.push(`--color-background-body: ${chat_background.toCSS()};`);

			const hsla = chat_background.toHSLA(),
				luma = hsla.l;
			chat_dark = luma < 0.5;

			chat_bits.push(`--color-background-input-focus: ${chat_background.toCSS()};`);
			chat_bits.push(`--color-background-base: ${hsla._l(luma + (chat_dark ? .05 : -.05)).toCSS()};`);
			chat_bits.push(`--color-background-alt: ${hsla._l(luma + (chat_dark ? .1 : -.1)).toCSS()};`);
			chat_bits.push(`--color-background-alt-2: ${hsla._l(luma + (chat_dark ? .15 : -.15)).toCSS()};`);
		}

		let chat_text = Color.RGBA.fromCSS(this.settings.get('theme.color.chat-text'));
		if ( ! chat_text && chat_background ) {
			chat_text = Color.RGBA.fromCSS(chat_dark ? '#FFF' : '#000');
		}

		if ( chat_text ) {
			chat_bits.push(`--color-text-base: ${chat_text.toCSS()};`);
			chat_bits.push(`--color-text-input: ${chat_text.toCSS()};`);

			const hsla = chat_text.toHSLA(),
				alpha = hsla.a;

			chat_bits.push(`--color-text-label: ${chat_text.toCSS()};`);
			chat_bits.push(`--color-text-label-optional: ${hsla._a(alpha - 0.4).toCSS()};`);

			chat_bits.push(`--color-text-alt: ${hsla._a(alpha - 0.2).toCSS()};`);
			chat_bits.push(`--color-text-alt-2: ${hsla._a(alpha - 0.4).toCSS()};`);
		}

		// Accent
		const chat_accent = Color.RGBA.fromCSS(this.settings.get('theme.color.chat-accent')),
			chat_accent_bits = [];
		//this.toggleAccentNormal(! accent);
		if ( chat_accent ) {
			chat_accent.a = 1;

			const hsla = chat_accent.toHSLA(),
				luma = hsla.l;

			const colors = COLORS.map(x => {
				if ( x === 0 )
					return chat_accent.toCSS();

				return hsla._l(luma + x).toCSS()
			});

			for(let i=0; i < colors.length; i++) {
				chat_bits.push(`--ffz-color-accent-${i+1}:${colors[i]};`);
			}

			let source = chat_dark ? ACCENT_COLORS.dark : ACCENT_COLORS.light;

			for(const [key,val] of Object.entries(source.c)) {
				if ( typeof val !== 'number' )
					continue;

				chat_bits.push(`--color-${key}:${colors[val-1]};`);
			}

			source = chat_dark ? ACCENT_COLORS.accent_dark : ACCENT_COLORS.accent_light;

			for(const [key,val] of Object.entries(source.c)) {
				if ( typeof val !== 'number' )
					continue;

				chat_accent_bits.push(`--color-${key}:${colors[val-1]} !important;`);
			}
		}

		if ( chat_bits.length )
			this.css_tweaks.set('chat-colors', `.chat-shell {${chat_bits.join('\n')}}.chat-shell .tw-accent-region{${chat_accent_bits.join('\n')}}`);
		else
			this.css_tweaks.delete('chat-colors');

		this.toggleNormalizer(chat_bits.length || bits.length);

		if ( bits.length )
			this.css_tweaks.set('colors', `body {${bits.join('\n')}}.channel-info-content .tw-accent-region,.channel-info-content .gocjHQ{${accent_bits.join('\n')}}`);
		else
			this.css_tweaks.delete('colors');
	}

	toggleAccentNormal(enable) {
		if ( enable ) {
			const bits = [];
			for(let i=0; i < 15; i++)
				bits.push(`--ffz-color-accent-${i+1}:var(--color-twitch-purple-${i+1});`);

			this.css_tweaks.set('accent-normal', `body {${bits.join('\n')}}`);
		} else
			this.css_tweaks.delete('accent-normal');
	}

	toggleNormalizer(enable) {
		if ( ! this._normalizer ) {
			if ( ! enable )
				return;

			this._normalizer = createElement('link', {
				rel: 'stylesheet',
				type: 'text/css',
				href: NORMALIZER_CSS_URL
			});
		} else if ( ! enable ) {
			this._normalizer.remove();
			return;
		}

		if ( ! document.head.contains(this._normalizer) )
			document.head.appendChild(this._normalizer)
	}

	/*toggleStyle(enable) {
		if ( ! this._style ) {
			if ( ! enable )
				return;

			this._style = createElement('link', {
				rel: 'stylesheet',
				type: 'text/css',
				href: THEME_CSS
			});

		} else if ( ! enable ) {
			this._style.remove();
			return;
		}

		document.head.appendChild(this._style);
	}

	updateSetting(enable) {
		this.toggleStyle(enable);
		this.updateCSS();
	}*/

	onEnable() {
		//this.updateSetting(this.settings.get('theme.dark'));
		this.updateCSS();
		this.updateFont();
	}
}