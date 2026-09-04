'use strict';

// ============================================================================
// Chat Hooks
//
// Ties FFZ's shared chat module to Kick's chat: registers the tokenizer for
// Kick's emote markup, keeps the settings context pointed at the channel
// being watched, and provides the site chat API the shared code expects.
// Line rendering lives in line.ts.
//
// FFZ's channel emotes are tied to Twitch channels, and FFZ's backend does
// not know Kick channels. So a Kick channel shows the emotes of the Twitch
// channel with the same name, unless kick-rooms.json (served beside the
// client) points it at a different Twitch login or at nothing. The FFZ
// room for that Twitch channel is held for as long as its chat is on
// screen, and messages are tokenized against it.
// ============================================================================

import Module, {type GenericModule} from 'utilities/module';
import {ColorAdjuster} from 'utilities/color';
import {DEBUG, CLIENT_SERVER} from 'utilities/constants';
import {fetchJSON, has} from 'utilities/object';
import {getBuster} from 'utilities/time';

import type SettingsManager from 'src/settings';
import type TranslationManager from 'src/i18n';
import type SharedChat from 'src/modules/chat';
import type Overrides from 'src/modules/chat/overrides';
import type Room from 'src/modules/chat/room';
import type CSSTweaks from 'utilities/css-tweaks';

import Line from './line';
import Input from './input';
import Completion from './completion';
import EmoteMenu from './emote_menu';
import {KickEmotes} from './tokenizer';

import ROOMS_URL from '../kick-rooms.json';
import type {KickChatEvents, KickSelf, KickUser} from '../types';


// Twitch logins: lowercase letters, digits and underscores.
const TWITCH_LOGIN = /^[a-z0-9_]{1,25}$/;

// The colors Twitch gives users who haven't picked one, chosen from the
// first and last characters of the login.
const TWITCH_DEFAULT_COLORS = [
	'#FF0000', '#0000FF', '#008000', '#B22222', '#FF7F50',
	'#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E',
	'#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'
];

export function getTwitchDefaultColor(login: string | null | undefined) {
	if ( ! login )
		return null;

	const n = login.charCodeAt(0) + login.charCodeAt(login.length - 1);
	return TWITCH_DEFAULT_COLORS[n % TWITCH_DEFAULT_COLORS.length];
}

/** kick-rooms.json: Kick slug to Twitch login, or null for no room. */
type RoomMappings = Record<string, string | null>;


export default class Chat extends Module<'site.chat', KickChatEvents> {

	// Dependencies
	settings: SettingsManager = null as any;
	i18n: TranslationManager = null as any;
	chat: SharedChat = null as any;
	overrides: Overrides = null as any;
	css_tweaks: CSSTweaks = null as any;

	line: Line = null as any;
	input: Input = null as any;
	completion: Completion = null as any;
	emote_menu: EmoteMenu = null as any;

	// State
	/** The slug of the channel whose chat is on screen. */
	channel: string | null;
	channel_id: string | null;

	/** Adjusts username colors for readability against the chat background. */
	colors: ColorAdjuster;
	/** Adjusts highlight backgrounds for readability against the text. */
	inverse_colors: ColorAdjuster;

	/** The FFZ room standing in for the channel. */
	room: Room | null;
	room_login: string | null;
	mappings: RoomMappings | null;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');
		this.inject('i18n');

		this.inject('chat');
		this.inject('chat.overrides');
		this.inject('site.css_tweaks');

		// Registered rather than injected so they are enabled from here,
		// after the tokenizer is in place, instead of as prerequisites of
		// this module.
		this.register('line', Line, true);
		this.register('input', Input, true);
		this.register('completion', Completion, true);
		this.register('emote_menu', EmoteMenu, true);

		this.should_enable = true;

		this.channel = null;
		this.channel_id = null;

		// Per the Chat > Appearance > Colors settings.
		this.colors = new ColorAdjuster('#0e0e10', 1, 4.5);
		this.inverse_colors = new ColorAdjuster('#dad8de', 1, 4.5);

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

		this.settings.add('kick.chat.my-color', {
			default: '',
			ui: {
				path: 'Chat > Appearance >> Usernames',
				title: 'My Name Color',
				description: 'Show your own name in chat in this color. Only you see it; the color everyone else sees is set in Kick\'s profile settings. Adjusted for readability like every other name.',
				component: 'setting-color-box'
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
		this.chat.context.on('changed:chat.filtering.mention-color', this.updateMentionColor, this);
		this.chat.context.on('changed:chat.filtering.highlight-mentions', this.recolorLines, this);
		this.settings.getChanges('kick.chat.username-colors', this.recolorLines, this);
		this.settings.getChanges('kick.chat.my-color', this.recolorLines, this);
		this.settings.getChanges('kick.chat.timestamps', this.recolorLines, this);
		this.updateColors();

		return Promise.all([
			this.line.enable(),
			Promise.resolve(this.input.enable()).then(() => Promise.all([
				this.completion.enable(),
				this.emote_menu.enable()
			]))
		]).then(() => undefined);
	}

	onDisable() {
		this.chat.removeTokenizer(KickEmotes);
		this.setRoom(null);
		this.updateContext(null, null);
		return Promise.all([
			this.line.disable(),
			this.completion.disable(),
			this.emote_menu.disable(),
			this.input.disable()
		]).then(() => undefined);
	}


	// ========================================================================
	// Username Colors
	// ========================================================================

	updateColors() {
		const mode = this.chat.context.get('chat.adjustment-mode'),
			contrast = this.chat.context.get('chat.adjustment-contrast');

		for(const c of [this.colors, this.inverse_colors]) {
			c.mode = mode;
			c.contrast = contrast;
		}

		this.updateMentionColor();
		this.recolorLines();
	}

	// The custom highlight color for mentions, as a variable the
	// chat-mention-bg tweak reads (see appearance.ts).
	updateMentionColor() {
		const raw = this.chat.context.get('chat.filtering.mention-color'),
			color = raw ? this.inverse_colors.process(raw) : null;

		if ( color )
			this.css_tweaks.setVariable('chat-mention-color', color);
		else
			this.css_tweaks.deleteVariable('chat-mention-color');
	}

	recolorLines() {
		this.line.rerenderLines();
	}

	// The color to show a user's name in: the viewer's own pick for their
	// own name, else an FFZ override if there is one, otherwise Kick's or
	// a Twitch-style color per the setting. All adjusted for readability.
	getUserColor(user: KickUser | null | undefined, self: KickSelf | null) {
		if ( ! user )
			return null;

		let color: string | null = null;
		if ( self && user.displayName && self.displayName && user.displayName.toLowerCase() === self.displayName.toLowerCase() )
			color = this.settings.get('kick.chat.my-color') || null;

		if ( ! color && user.id )
			color = this.overrides.getColor(user.id);

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
	updateContext(slug: string | null | undefined, channel_id: string | number | null | undefined) {
		const new_slug = slug || null,
			new_id = channel_id != null ? `${channel_id}` : null;

		if ( new_slug === this.channel && new_id === this.channel_id )
			return;

		const changed = new_slug !== this.channel;

		this.channel = new_slug;
		this.channel_id = new_id;

		this.settings.updateContext({
			channel: new_slug ?? undefined,
			channelID: new_id ?? undefined
		});

		if ( changed )
			this.updateRoom();
	}


	// ========================================================================
	// FFZ Room
	// ========================================================================

	async loadMappings() {
		let data: RoomMappings | null = null;
		try {
			// In development the bundler serves the file and gives its URL.
			data = await fetchJSON<RoomMappings>(DEBUG
				? ROOMS_URL as unknown as string
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

		let login: string | null = slug;
		if ( has(this.mappings, slug) )
			login = this.mappings[slug];

		if ( typeof login !== 'string' )
			return null;

		login = login.toLowerCase();
		return TWITCH_LOGIN.test(login) ? login : null;
	}

	updateRoom() {
		// A channel without a Twitch namesake still gets a room of its own,
		// so the sets other sources attach to the channel (7TV's) have
		// somewhere to live. FFZ's API has nothing under that name.
		const placeholder = this.channel ? `kick:${this.channel}` : null;
		this.setRoom(this.getRoomLogin() || placeholder);
	}

	setRoom(login: string | null) {
		if ( login === this.room_login )
			return;

		if ( this.room ) {
			this.room.unref(this);
			this.room = null;
		}

		this.room_login = login;

		if ( login ) {
			this.room = this.chat.getRoom(null, login);
			this.room!.ref(this);
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
