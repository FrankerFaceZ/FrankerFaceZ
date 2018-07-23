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

		this.BitsButton = this.fine.define(
			'bits-button',
			n => n.renderButton && n.toggleShowTutorial
		);
	}

	onEnable() {
		this.settings.on(':changed:chat.bits.show', this.BitsButton.forceUpdate, this.BitsButton);

		this.BitsButton.ready(cls => {
			const t = this,
				old_render = cls.prototype.render;

			cls.prototype.render = function() {
				if ( ! t.settings.get('chat.bits.show') )
					return null;

				return old_render.call(this);
			}

			this.BitsButton.forceUpdate();
		})
	}
}