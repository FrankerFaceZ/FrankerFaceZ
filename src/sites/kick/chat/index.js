'use strict';

// ============================================================================
// Chat Hooks
//
// Ties FFZ's shared chat module to Kick's chat: registers the tokenizer for
// Kick's emote markup, keeps the settings context pointed at the channel
// being watched, and provides the site chat API the shared code expects.
// Line rendering lives in line.js.
// ============================================================================

import Module from 'utilities/module';

import Line from './line';
import {KickEmotes} from './tokenizer';


export default class Chat extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.inject('chat');

		// Registered rather than injected so it is enabled from here, after
		// the tokenizer is in place, instead of as a prerequisite of this
		// module.
		this.register('line', Line, true);

		this.should_enable = true;

		this.channel = null;
		this.channel_id = null;
	}

	onEnable() {
		this.chat.addTokenizer(KickEmotes);
		return this.line.enable();
	}

	onDisable() {
		this.chat.removeTokenizer(KickEmotes);
		this.updateContext(null, null);
		return this.line.disable();
	}


	// The channel whose chat is on screen, as seen in the messages
	// themselves. Settings profiles can be scoped to it.
	updateContext(slug, channel_id) {
		slug = slug || null;
		channel_id = channel_id != null ? `${channel_id}` : null;

		if ( slug === this.channel && channel_id === this.channel_id )
			return;

		this.channel = slug;
		this.channel_id = channel_id;

		this.settings.updateContext({
			channel: slug,
			channelID: channel_id
		});
	}


	// ========================================================================
	// API Compliance
	// ========================================================================

	// Notices in chat and sending messages aren't wired up on Kick yet.
	addNotice() { // eslint-disable-line class-methods-use-this
		return false;
	}

	sendMessage() { // eslint-disable-line class-methods-use-this
		return null;
	}
}
