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
import {ColorAdjuster} from 'utilities/color';
import {DEBUG, CLIENT_SERVER} from 'utilities/constants';
import {fetchJSON, has} from 'utilities/object';
import {getBuster} from 'utilities/time';

import Line from './line';
import {KickEmotes} from './tokenizer';

import ROOMS_URL from '../kick-rooms.json';


// Twitch logins: lowercase letters, digits and underscores.
const TWITCH_LOGIN = /^[a-z0-9_]{1,25}$/;

// The colors Twitch gives users who haven't picked one, chosen from the
// first and last characters of the login.
const TWITCH_DEFAULT_COLORS = [
	'#FF0000', '#0000FF', '#008000', '#B22222', '#FF7F50',
	'#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E',
	'#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'
];

export function getTwitchDefaultColor(login) {
	if ( ! login )
		return null;

	const n = login.charCodeAt(0) + login.charCodeAt(login.length - 1);
	return TWITCH_DEFAULT_COLORS[n % TWITCH_DEFAULT_COLORS.length];
}


export default class Chat extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.inject('chat');
		this.inject('chat.overrides');

		// Registered rather than injected so it is enabled from here, after
		// the tokenizer is in place, instead of as a prerequisite of this
		// module.
		this.register('line', Line, true);

		this.should_enable = true;

		this.channel = null;
		this.channel_id = null;

		// Adjusts username colors for readability against the chat
		// background, per the Chat > Appearance > Colors settings.
		this.colors = new ColorAdjuster('#0e0e10', 1, 4.5);

		this.settings.add('kick.chat.username-colors', {
			default: 1,
			ui: {
				path: 'Chat > Appearance >> Usernames',
				title: 'Username Colors',
				description: 'Kick lets users pick from a set of bright colors. Twitch-style colors are picked from the username instead, the way Twitch colors users who haven\'t chosen one. Both are adjusted for readability per the Colors section.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Kick\'s'},
					{value: 1, title: 'Twitch-style'}
				]
			}
		});

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

		this.chat.context.on('changed:chat.adjustment-mode', this.updateColors, this);
		this.chat.context.on('changed:chat.adjustment-contrast', this.updateColors, this);
		this.settings.getChanges('kick.chat.username-colors', this.recolorLines, this);
		this.updateColors();

		return this.line.enable();
	}

	onDisable() {
		this.chat.removeTokenizer(KickEmotes);
		this.setRoom(null);
		this.updateContext(null, null);
		return this.line.disable();
	}


	// ========================================================================
	// Username Colors
	// ========================================================================

	updateColors() {
		const c = this.colors;
		c.mode = this.chat.context.get('chat.adjustment-mode');
		c.contrast = this.chat.context.get('chat.adjustment-contrast');
		this.recolorLines();
	}

	recolorLines() {
		this.line.rerenderLines();
	}

	// The color to show a user's name in: an FFZ override if there is one,
	// otherwise Kick's or a Twitch-style color per the setting, adjusted
	// for readability.
	getUserColor(user) {
		if ( ! user )
			return null;

		let color = this.overrides.getColor(user.id);
		if ( ! color )
			color = this.settings.get('kick.chat.username-colors') === 1
				? getTwitchDefaultColor(user.login || user.displayName)
				: user.color;

		if ( ! color )
			return null;

		return this.colors.process(color);
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
	addNotice() {  
		return false;
	}

	sendMessage() {  
		return null;
	}
}
