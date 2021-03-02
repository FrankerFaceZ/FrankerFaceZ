'use strict';

import { IS_FIREFOX } from 'src/utilities/constants';
// ============================================================================
// Layout Overrides for Twitch Twilight
// ============================================================================

import Module from 'utilities/module';
import {debounce, has} from 'utilities/object';

const PORTRAIT_ROUTES = ['user', 'video', 'user-video', 'user-clip', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following'];
const MINIMAL_ROUTES = ['popout', 'embed-chat', 'dash-chat'];

export default class Layout extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.css_tweaks');
		this.inject('site.elemental');

		/*this.TopNav = this.fine.define(
			'top-nav',
			n => n.computeStyles && n.navigationLinkSize
		);*/

		/*this.RightColumn = this.fine.define(
			'tw-rightcolumn',
			n => n.hideOnBreakpoint && n.handleToggleVisibility
		);*/

		this.ResizeDetector = this.fine.define(
			'resize-detector',
			n => n.maybeDebounceOnScroll && n.setGrowDivRef && n.props.onResize
		);

		this.SideBar = this.elemental.define(
			'sidebar',
			'.side-bar-contents',
			null,
			{childNodes: true, subtree: true}, 1
		);

		/*this.SideBarChannels = this.fine.define(
			'nav-cards',
			t => t.getCardSlideInContent && t.props && has(t.props, 'tooltipContent')
		);*/

		this.settings.add('clips.layout.big', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Clips',
				title: 'Allow the player to get larger on `clips.twitch.tv` pages.',
				description: 'This only affects windows at least 1,200 pixels wide and attempts to make the player and chat replay as large as possible.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('layout.portrait', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Channel',
				title: 'Enable Portrait Mode',
				description: 'In Portrait Mode, chat will be displayed beneath the player when the window is taller than it is wide.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('layout.portrait-invert', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Channel',
				title: 'When in portrait mode, place chat at the top.',
				component: 'setting-check-box'
			},
			changed: val => document.body.classList.toggle('ffz--portrait-invert', val)
		});

		this.settings.add('layout.portrait-threshold', {
			default: 1.25,
			ui: {
				path: 'Appearance > Layout >> Channel',
				title: 'Portrait Mode Threshold',
				description: 'This is the Width to Height ratio at which point Portrait Mode will begin to activate.',
				component: 'setting-text-box',
				process(val) {
					val = parseFloat(val, 10)
					if ( isNaN(val) || ! isFinite(val) || val <= 0 )
						return 1.25;

					return val;
				}
			}
		});

		this.settings.add('layout.portrait-min-chat', {
			default: false,
			requires: ['layout.use-portrait'],
			process(ctx, val) {
				if ( ! ctx.get('layout.use-portrait') )
					return false;

				return val;
			},
			ui: {
				path: 'Appearance > Layout >> Channel',
				title: 'Use compact chat in Portrait Mode.',
				description: 'When enabled, this minimizes the chat header and places the chat input box in line with the chat buttons in order to present a more compact chat able to display more lines with limited vertical space.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('portrait-chat', val)
		})

		this.settings.add('layout.use-portrait', {
			requires: ['layout.portrait', 'layout.portrait-threshold', 'context.route.name', 'context.size', 'context.isWatchParty'],
			process(ctx) {
				if ( ctx.get('context.isWatchParty') )
					return false;

				const size = ctx.get('context.size');
				if ( ! size || ! ctx.get('layout.portrait') || ! PORTRAIT_ROUTES.includes(ctx.get('context.route.name')) )
					return false;

				const ratio = size.width / size.height;
				return ratio <= ctx.get('layout.portrait-threshold');
			},
			changed: () => this.updatePortraitMode()
		});

		this.settings.add('layout.inject-portrait', {
			requires: ['layout.use-portrait', 'context.ui.rightColumnExpanded'],
			process(ctx) {
				return ctx.get('layout.use-portrait') && ctx.get('context.ui.rightColumnExpanded');
			},
			changed: val => this.css_tweaks.toggle('portrait', val)
		});

		this.settings.add('layout.use-portrait-swapped', {
			requires: ['layout.inject-portrait', 'layout.swap-sidebars'],
			process(ctx) {
				return ctx.get('layout.inject-portrait') && ctx.get('layout.swap-sidebars')
			},
			changed: val => this.css_tweaks.toggle('portrait-swapped', val)
		});

		this.settings.add('layout.use-portrait-meta', {
			requires: ['layout.inject-portrait', 'player.theatre.metadata'],
			process(ctx) {
				return ctx.get('layout.inject-portrait') && ctx.get('player.theatre.metadata')
			},
			changed: val => this.css_tweaks.toggle('portrait-metadata', val)
		});

		this.settings.add('layout.use-portrait-meta-top', {
			requires: ['layout.use-portrait-meta', 'layout.portrait-invert'],
			process(ctx) {
				return ctx.get('layout.use-portrait-meta') && ! ctx.get('layout.portrait-invert')
			},
			changed: val => this.css_tweaks.toggle('portrait-metadata-top', val)
		});

		this.settings.add('layout.show-portrait-chat', {
			requires: ['layout.use-portrait', 'layout.portrait-extra-height', 'layout.portrait-extra-width'],
			process() {
				// TODO: Calculate this based on the expected player height.
				return true;
			},
			changed: () => this.updatePortraitMode()
		});

		this.settings.add('layout.portrait-extra-height', {
			requires: ['context.new_channel', 'context.squad_bar', 'context.hosting', 'context.ui.theatreModeEnabled', 'player.theatre.no-whispers', 'whispers.show', 'layout.minimal-navigation'],
			process(ctx) {
				let height = 0;
				if ( ctx.get('context.ui.theatreModeEnabled') ) {
					if ( ctx.get('layout.minimal-navigation') )
						height += 1;

					if ( ctx.get('whispers.show') && ! ctx.get('player.theatre.no-whispers') )
						height += 4;

				} else {
					height = ctx.get('layout.minimal-navigation') ? 1 : 5;
					if ( ctx.get('whispers.show') )
						height += 4;

					if ( ctx.get('context.squad_bar') )
						height += 6;

					height += ctx.get('context.new_channel') ? 1 : 5;

					if ( ctx.get('context.hosting') )
						height += 4;
				}

				return height;
			},

			changed: val => this.css_tweaks.setVariable('portrait-extra-height', `${val}rem`)
		})

		this.settings.add('layout.portrait-extra-width', {
			require: ['layout.side-nav.show', 'context.ui.theatreModeEnabled', 'context.ui.sideNavExpanded'],
			process(ctx) {
				if ( ! ctx.get('layout.side-nav.show') || ctx.get('context.ui.theatreModeEnabled') )
					return 0;

				return ctx.get('context.ui.sideNavExpanded') ? 24 : 5
			},

			changed: val => this.css_tweaks.setVariable('portrait-extra-width', `${val}rem`)
		});

		this.settings.add('layout.is-minimal', {
			require: ['context.route.name'],
			process(ctx) {
				return MINIMAL_ROUTES.includes(ctx.get('context.route.name'));
			}
		});
	}

	onEnable() {
		document.body.classList.toggle('ffz--portrait-invert', this.settings.get('layout.portrait-invert'));

		this.on(':update-nav', this.updateNavLinks, this);
		this.on(':resize', this.handleResize, this);

		this.css_tweaks.toggle('portrait-chat', this.settings.get('layout.portrait-min-chat'));
		this.css_tweaks.toggle('portrait', this.settings.get('layout.inject-portrait'));
		this.css_tweaks.toggle('portrait-swapped', this.settings.get('layout.use-portrait-swapped'));
		this.css_tweaks.toggle('portrait-metadata', this.settings.get('layout.use-portrait-meta'));
		this.css_tweaks.toggle('portrait-metadata-top', this.settings.get('layout.use-portrait-meta-top'));
		this.css_tweaks.setVariable('portrait-extra-width', `${this.settings.get('layout.portrait-extra-width')}rem`);
		this.css_tweaks.setVariable('portrait-extra-height', `${this.settings.get('layout.portrait-extra-height')}rem`);

		this.on('site.directory:update-cards', () => {
			this.SideBar.each(el => this._updateSidebar(el));
			//for(const inst of this.SideBarChannels.instances)
			//	this.updateCardClass(inst);
		});

		this.ResizeDetector.ready(() => {
			if ( this._needs_resize ) {
				this._needs_resize = false;
				this.handleResize();
			}
		});

		this.SideBar.on('mount', this.updateSidebar, this);
		this.SideBar.on('mutate', this.updateSidebar, this);
		this.SideBar.each(el => this.updateSidebar(el));

		/*this.SideBarChannels.ready((cls, instances) => {
			for(const inst of instances)
				this.updateCardClass(inst);
		});

		this.SideBarChannels.on('mount', this.updateCardClass, this);
		this.SideBarChannels.on('update', this.updateCardClass, this);*/

		/*const t = this;
		this.RightColumn.ready((cls, instances) => {
			cls.prototype.ffzHideOnBreakpoint = function() {
				try {
					if ( ! this.containerRef )
						return;

					if ( ! t.settings.get('layout.use-portrait') )
						return this.oldHideOnBreakpoint ? this.oldHideOnBreakpoint() : null;

					const should_show = t.settings.get('layout.show-portrait-chat'),
						is_showing = this.props.rightColumnExpandedByBreakpoint;

					if ( should_show && ! is_showing ) {
						this.containerRef.style.display = '';
						this.props.expandRightColumnFromBreakpoint();

					} else if ( ! should_show && is_showing ) {
						this.containerRef.style.display = 'none';
						this.props.collapseRightColumnFromBreakpoint();
					}
				} catch(err) {
					if ( this.oldHideOnBreakpoint )
						this.oldHideOnBreakpoint();

					t.log.capture(err);
				}
			}

			cls.prototype.ffzInstall = function() {
				if ( this.oldHideOnBreakpoint )
					return;

				this.oldHideOnBreakpoint = this.hideOnBreakpoint;
				this.hideOnBreakpoint = () => this.ffzHideOnBreakpoint();
			}

			for(const inst of instances) {
				window.removeEventListener('resize', inst.hideOnBreakpoint);
				inst.ffzInstall();
				window.addEventListener('resize', inst.hideOnBreakpoint);
				inst.hideOnBreakpoint();
			}
		});*/
	}

	handleResize() {
		if ( this._resize_timer )
			return;

		this._resize_timer = setTimeout(() => this._handleResize(), IS_FIREFOX ? 500 : 100);
	}

	_handleResize() {
		clearTimeout(this._resize_timer);
		this._resize_timer = null;

		if ( ! this.ResizeDetector.instances.size )
			this._needs_resize = true;
		else {
			for(const inst of this.ResizeDetector.instances) {
				inst?.onScroll?.();
				//inst?.props?.onResize?.();
			}

			this.emit('site.player:fix-player');
		}
	}

	get is_minimal() {
		return this.settings.get('layout.is-minimal')
	}

	updateSidebar(el) {
		if ( ! el )
			return;

		if ( ! el._ffz_update )
			el._ffz_update = debounce(() => requestAnimationFrame(() => this._updateSidebar(el)), 1000, 2);

		el._ffz_update();
	}

	_updateSidebar(el) {
		if ( ! el )
			return;

		const cards = el.querySelectorAll('.side-nav-card'),
			blocked_games = this.settings.provider.get('directory.game.blocked-games', []);

		for(const card of cards) {
			const react = this.fine.getReactInstance(card),
				props = react?.return?.return?.memoizedProps,
				stream = props?.metadataRight?.props?.stream,
				rerun = stream?.type === 'rerun' ?? false,
				game = stream?.game?.displayName,
				offline = props?.offline ?? false;

			card.classList.toggle('ffz--side-nav-card-rerun', rerun);
			card.classList.toggle('ffz--side-nav-card-offline', offline);
			card.classList.toggle('tw-hide', game ? blocked_games.includes(game) : false);
		}
	}

	/*updateCardClass(inst) {
		const node = this.fine.getChildNode(inst);

		if ( node ) {
			node.classList.toggle('ffz--side-nav-card-rerun',
				inst.props?.tooltipContent?.props?.streamType === 'rerun'
			);
			node.classList.toggle('ffz--side-nav-card-offline',
				inst.props?.offline === true
			);

			const game = inst.props?.tooltipContent?.props?.gameName || inst.props?.metadataLeft?.props?.activity?.stream?.game?.name || inst.props?.metadataLeft;
			node.classList.toggle('tw-hide', this.settings.provider.get('directory.game.blocked-games', []).includes(game));
		}
	}*/

	updateNavLinks() {

	}

	updatePortraitMode() {

	}
}