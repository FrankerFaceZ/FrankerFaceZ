'use strict';

// ============================================================================
// Layout Overrides for Twitch Twilight
// ============================================================================

import Module from 'utilities/module';

const PORTRAIT_ROUTES = ['user', 'video', 'user-video', 'user-clip', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following'];

export default class Layout extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.css_tweaks');

		this.RightColumn = this.fine.define(
			'tw-rightcolumn',
			n => n.hideOnBreakpoint && n.onTheatreMouseMove
		);

		this.settings.add('layout.portrait', {
			default: false,
			ui: {
				path: 'Appearance > Layout >> Channel',
				title: 'Enable Portrait Mode',
				description: 'In Portrait Mode, chat will be displayed beneath the player when the window is taller than it is wide.',
				component: 'setting-check-box'
			}
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
		})

		this.settings.add('layout.use-portrait', {
			requires: ['layout.portrait', 'layout.portrait-threshold', 'context.route.name', 'context.size'],
			process(ctx) {
				const size = ctx.get('context.size');
				if ( ! size || ! ctx.get('layout.portrait') || ! PORTRAIT_ROUTES.includes(ctx.get('context.route.name')) )
					return false;

				const ratio = size.width / size.height;
				return ratio <= ctx.get('layout.portrait-threshold');
			},
			changed: val => {
				this.css_tweaks.toggle('portrait', val);
				this.updatePortraitMode();
			}
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
			requires: ['context.new_channel', 'context.hosting', 'context.ui.theatreModeEnabled', 'player.theatre.no-whispers', 'whispers.show', 'layout.minimal-navigation'],
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
	}

	onEnable() {
		this.css_tweaks.toggle('portrait', this.settings.get('layout.use-portrait'));
		this.css_tweaks.setVariable('portrait-extra-width', `${this.settings.get('layout.portrait-extra-width')}rem`);
		this.css_tweaks.setVariable('portrait-extra-height', `${this.settings.get('layout.portrait-extra-height')}rem`);

		const t = this;
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
		});
	}

	updatePortraitMode() {
		for(const inst of this.RightColumn.instances)
			inst.hideOnBreakpoint();
	}
}