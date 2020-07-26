'use strict';

// ============================================================================
// Sub Button
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';

export default class SubButton extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('settings');
		this.inject('site.fine');

		this.settings.add('sub-button.prime-notice', {
			default: true,

			ui: {
				path: 'Channel > Metadata >> Subscription',
				title: 'Show Prime Reminder',
				description: 'Display a crown on subscription buttons when your free channel sub with Prime is available.',
				component: 'setting-check-box'
			},

			changed: () => this.SubButton.forceUpdate()
		});

		this.SubButton = this.fine.define(
			'sub-button',
			n => n.handleSubMenuAction && n.isUserDataReady,
			['user', 'user-home', 'user-video', 'user-clip', 'video', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following']
		);
	}

	onEnable() {
		this.settings.on(':changed:layout.swap-sidebars', () => this.SubButton.forceUpdate())

		this.SubButton.ready((cls, instances) => {
			const t = this,
				old_render = cls.prototype.render;

			cls.prototype.render = function() {
				try {
					const old_direction = this.props.balloonDirection;
					if ( old_direction !== undefined ) {
						const should_be_left = t.settings.get('layout.swap-sidebars'),
							is_left = old_direction.includes('--left');

						if ( should_be_left && ! is_left )
							this.props.balloonDirection = old_direction.replace('--right', '--left');
						else if ( ! should_be_left && is_left )
							this.props.balloonDirection = old_direction.replace('--left', '--right');
					}
				} catch(err) { /* no-op */ }

				return old_render.call(this);
			}

			for(const inst of instances)
				this.updateSubButton(inst);

			this.SubButton.forceUpdate();
		});

		this.SubButton.on('mount', this.updateSubButton, this);
		this.SubButton.on('update', this.updateSubButton, this);
	}


	updateSubButton(inst) {
		const container = this.fine.getChildNode(inst),
			btn = container && container.querySelector('button[data-a-target="subscribe-button"]');
		if ( ! btn )
			return;

		const props = inst.props,
			data = props.data && props.data.user,
			self = data && data.self,
			should_show = this.settings.get('sub-button.prime-notice') && self && self.canPrimeSubscribe && ! self.subscriptionBenefit,

			icon = btn.querySelector('.ffz--can-prime');

		if ( should_show && ! icon ) {
			btn.insertBefore(<span class="tw-button__icon tw-button__icon--left ffz--can-prime">
				<figure
					class="ffz-i-crown ffz-tooltip"
					data-title={this.i18n.t('sub-button.prime', 'Your free channel sub with Prime is available.')}
				/>
			</span>, btn.firstElementChild);

			btn.appendChild(<span class="ffz--post-prime" />);

		} else if ( ! should_show && icon ) {
			icon.remove();
			const post = btn.querySelector('.ffz--post-prime');
			if ( post )
				post.remove();
		}
	}
}