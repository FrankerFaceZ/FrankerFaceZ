'use strict';

// ============================================================================
// Sub Button
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import {createElement} from 'utilities/dom';
import type SettingsManager from 'src/settings';
import type TranslationManager from 'src/i18n';
import type Fine from 'utilities/compat/fine';
import type { FineWrapper } from 'utilities/compat/fine';
import type { ReactStateNode } from 'root/src/utilities/compat/react-types';

declare module 'utilities/types' {
	interface ModuleMap {
		'site.sub_button': SubButton;
	}
	interface SettingsTypeMap {
		'layout.swap-sidebars': unknown;
		'sub-button.prime-notice': boolean;
	}
}

type SubButtonNode = ReactStateNode<{
	data?: {
		user?: {
			self?: {
				canPrimeSubscribe: boolean;
				subscriptionBenefit: unknown;
			}
		}
	}
}> & {
	handleSubMenuAction: any;
	openSubModal: any;
};

export default class SubButton extends Module {

	// Dependencies
	i18n: TranslationManager = null as any;
	fine: Fine = null as any;
	settings: SettingsManager = null as any;

	// Stuff
	SubButton: FineWrapper<SubButtonNode>;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

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
			n =>
				(n as SubButtonNode).handleSubMenuAction &&
				(n as SubButtonNode).openSubModal,
			['user', 'user-home', 'user-video', 'user-clip', 'video', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following']
		);
	}

	onEnable() {
		this.settings.on(':changed:layout.swap-sidebars', () =>
			this.SubButton.forceUpdate());

		this.SubButton.ready((cls, instances) => {
			for(const inst of instances)
				this.updateSubButton(inst);
		});

		this.SubButton.on('mount', this.updateSubButton, this);
		this.SubButton.on('update', this.updateSubButton, this);
	}


	updateSubButton(inst: SubButtonNode) {
		const container = this.fine.getChildNode<HTMLElement>(inst),
			btn = container?.querySelector('button[data-a-target="subscribe-button"]');
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
