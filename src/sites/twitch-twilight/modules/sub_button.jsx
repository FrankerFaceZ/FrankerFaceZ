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
			['user', 'user-video', 'user-clip', 'video', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following']
		);
	}

	onEnable() {
		this.SubButton.ready((cls, instances) => {
			for(const inst of instances)
				this.updateSubButton(inst);
		});

		this.SubButton.on('mount', this.updateSubButton, this);
		this.SubButton.on('update', this.updateSubButton, this);
	}


	updateSubButton(inst) {
		const container = this.fine.getChildNode(inst),
			btn = container && container.querySelector('button.tw-button--dropmenu');
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

		} else if ( ! should_show && icon )
			icon.remove();
	}
}