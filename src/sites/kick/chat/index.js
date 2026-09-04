'use strict';

// ============================================================================
// Chat Hooks
//
// Ties FFZ's shared chat module to Kick's chat: registers the tokenizer for
// Kick's emote markup, keeps the settings context pointed at the channel
// being watched, and provides the site chat API the shared code expects.
// Line rendering lives in line.js.
//
// FFZ's channel emotes are tied to Twitch channels, and FFZ's backend does
// not know Kick channels. So a Kick channel shows the emotes of the Twitch
// channel with the same name, unless kick-rooms.json (served beside the
// client) points it at a different Twitch login or at nothing. The FFZ
// room for that Twitch channel is held for as long as its chat is on
// screen, and messages are tokenized against it.
// ============================================================================

import Module from 'utilities/module';
import {DEBUG, CLIENT_SERVER} from 'utilities/constants';
import {fetchJSON, has} from 'utilities/object';
import {getBuster} from 'utilities/time';

import Line from './line';
import {KickEmotes} from './tokenizer';

import ROOMS_URL from '../kick-rooms.json';


// Twitch logins: lowercase letters, digits and underscores.
const TWITCH_LOGIN = /^[a-z0-9_]{1,25}$/;


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

		this.room = null;
		this.room_login = null;
		this.mappings = null;

		this.settings.add('kick.emotes.channel-source', {
			default: 1,
			ui: {
				path: 'Chat > Emotes >> Kick',
				title: 'Channel Emotes',
				description: 'FrankerFaceZ channel emotes belong to Twitch channels. On Kick, show a channel the emotes of the Twitch channel with the same name. Individual channels can be pointed at a different Twitch channel, or at none, in the `kick-rooms.json` served beside the client.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'From the Twitch channel with the same name'}
				]
			},
			changed: () => this.updateRoom()
		});
	}

	onEnable() {
		this.chat.addTokenizer(KickEmotes);
		this.loadMappings();
		return this.line.enable();
	}

	onDisable() {
		this.chat.removeTokenizer(KickEmotes);
		this.setRoom(null);
		this.updateContext(null, null);
		return this.line.disable();
	}


	// ========================================================================
	// Channel
	// ========================================================================

	// The channel whose chat is on screen, as seen in the messages
	// themselves. Settings profiles can be scoped to it.
	updateContext(slug, channel_id) {
		slug = slug || null;
		channel_id = channel_id != null ? `${channel_id}` : null;

		if ( slug === this.channel && channel_id === this.channel_id )
			return;

		const changed = slug !== this.channel;

		this.channel = slug;
		this.channel_id = channel_id;

		this.settings.updateContext({
			channel: slug,
			channelID: channel_id
		});

		if ( changed )
			this.updateRoom();
	}


	// ========================================================================
	// FFZ Room
	// ========================================================================

	async loadMappings() {
		let data = null;
		try {
			data = await fetchJSON(DEBUG
				? ROOMS_URL
				: `${CLIENT_SERVER}/script/kick-rooms.json?_=${getBuster()}`
			);
		} catch(err) {
			this.log.warn('Unable to load Kick room mappings.', err);
		}

		this.mappings = (data && typeof data === 'object') ? data : {};
		this.updateRoom();
	}

	// The Twitch login whose FFZ room stands in for the current channel,
	// or null for none.
	getRoomLogin() {
		const slug = this.channel;
		if ( ! slug || ! this.mappings || ! this.settings.get('kick.emotes.channel-source') )
			return null;

		let login = slug;
		if ( has(this.mappings, slug) )
			login = this.mappings[slug];

		if ( typeof login !== 'string' )
			return null;

		login = login.toLowerCase();
		return TWITCH_LOGIN.test(login) ? login : null;
	}

	updateRoom() {
		this.setRoom(this.getRoomLogin());
	}

	setRoom(login) {
		if ( login === this.room_login )
			return;

		if ( this.room ) {
			this.room.unref(this);
			this.room = null;
		}

		this.room_login = login;

		if ( login ) {
			this.room = this.chat.getRoom(null, login);
			this.room.ref(this);
		}

		this.emit(':room-changed', this.room);
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
