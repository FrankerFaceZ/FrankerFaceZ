'use strict';

// ============================================================================
// Sub Button
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';

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
			n => n.reportSubMenuAction && n.isUserDataReady
		);
	}

	onEnable() {
		this.SubButton.ready(() => this.SubButton.forceUpdate());

		this.SubButton.on('mount', this.updateSubButton, this);
		this.SubButton.on('update', this.updateSubButton, this);
	}


	updateSubButton(inst) {
		const container = this.fine.getChildNode(inst),
			btn = container && container.querySelector('button[data-test-selector="subscribe-button__dropdown"]');
		if ( ! btn )
			return;

		const props = inst.props,
			data = props.data && props.data.user,
			self = data && data.self,
			should_show = this.settings.get('sub-button.prime-notice') && self && self.canPrimeSubscribe && ! self.subscriptionBenefit,

			icon = btn.querySelector('.ffz--can-prime');

		if ( should_show && ! icon ) {
			btn.insertBefore(
				e('span', 'tw-button__icon tw-button__icon--left ffz--can-prime',
					e('figure', {
						className: 'ffz-i-crown ffz-tooltip',
						'data-tooltip-type': 'html',
						'data-title': this.i18n.t('sub-button.prime', 'Your free channel sub with Prime is available.')
					})
				),
				btn.firstElementChild
			);

		} else if ( ! should_show && icon )
			icon.remove();
	}
}