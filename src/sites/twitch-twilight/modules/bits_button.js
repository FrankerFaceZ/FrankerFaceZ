'use strict';

// ============================================================================
// Bits Button
// ============================================================================

import Module from 'utilities/module';


export default class BitsButton extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');

		this.settings.add('layout.display-bits-button', {
			requires: ['chat.bits.show'],
			default: null,
			process(ctx, val) {
				if ( val != null )
					return val;

				return ctx.get('chat.bits.show')
			},

			ui: {
				path: 'Appearance > Layout >> Top Navigation',
				title: 'Show the Get Bits button.',
				description: 'By default, this inherits its value from [Chat > Bits and Cheering > Display Bits](~chat.bits_and_cheering)',
				component: 'setting-check-box'
			},

			changed: () => this.BitsButton.forceUpdate()
		});

		this.BitsButton = this.fine.define(
			'bits-button',
			n => n.toggleBalloon && n.toggleShowTutorial
		);
	}

	onEnable() {
		this.BitsButton.ready(cls => {
			const t = this,
				old_render = cls.prototype.render;

			cls.prototype.render = function() {
				if ( ! t.settings.get('layout.display-bits-button') )
					return null;

				return old_render.call(this);
			}

			this.BitsButton.forceUpdate();
		})
	}
}