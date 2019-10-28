'use strict';

// ============================================================================
// Logviewer Integration
// ============================================================================

import {once} from 'utilities/object';
import Module from 'utilities/module';

import LVSocketClient from './socket';

export default class Logviewer extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site');
		this.inject('socket');
		this.inject('viewer_cards');

		this.inject('lv_socket', LVSocketClient);
	}


	get token() {
		const token = this._token;
		if ( token && token.token && token.expires > ((Date.now() / 1000) + 300) )
			return token.token;

		return null;
	}


	onEnable() {
		this.viewer_cards.addTab('logs', {
			visible: true,
			label: 'Chat History',

			component: () => import(/* webpackChunkName: 'viewer-cards' */ './tab-logs.vue')
		});

		this.on('viewer_cards:open', this.onCardOpen);
		this.on('viewer_cards:close', this.onCardClose);
		this.on('viewer_cards:load', this.onCardLoad);
	}



	onCardOpen() {
		// We're going to need a token soon, so make sure we have one.
		this.getToken();
	}


	onCardLoad(card) {
		this.log.info('card:load', card);

		if ( ! card.channel || ! card.user )
			return;

		card.lv_topic = `logs-${card.channel.login}-${card.user.login}`;
		this.lv_socket.subscribe(card, card.lv_topic);
	}


	onCardClose(card) {
		this.log.info('card:close', card);

		if ( card.lv_topic ) {
			this.lv_socket.unsubscribe(card, card.lv_topic);
			card.lv_topic = null;
		}
	}


	async getToken() {
		const user = this.site.getUser(),
			token = this._token,
			now = Date.now() / 1000;

		if ( ! user || ! user.login )
			return null;

		if ( token && token.token && token.expires > (now + 300) )
			return token.token;

		const new_token = this._token = await this.socket.call('get_logviewer_token');
		if ( new_token ) {
			this.lv_socket.maybeSendToken();
			return new_token.token;
		}
	}
}


Logviewer.getToken = once(Logviewer.getToken);