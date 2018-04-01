'use strict';

// ============================================================================
// Translation UI
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';

export default class TranslationUI extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('site');
		this.inject('vue');

		//this.should_enable = true;

		this._dialog = null;
		this._visible = true;
	}

	async onLoad() {
		this.vue.component(
			(await import(/* webpackChunkName: "translation-ui" */ './components.js')).default
		);
	}

	async onEnable(event) {
		await this.site.awaitElement('.twilight-root');
		this.ps = this.site.web_munch.getModule('ps');
	}

	onDisable() {
		if ( this._visible ) {
			this.toggleVisible();
			this._visible = true;
		}
	}

}