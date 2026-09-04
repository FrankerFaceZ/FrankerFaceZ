'use strict';

// ============================================================================
// 7TV Emotes
//
// 7TV's global set and each channel's own set, loaded into FFZ's emote
// system so they tokenize, render and get tooltips and cards like any
// other set. 7TV keys Kick channels by the broadcaster's Kick user id,
// which Kick's channel API gives for a slug. The channel set is attached
// to the FFZ room standing in for the channel (see chat/index.js) while
// its chat is on screen. Zero-width emotes become FFZ modifiers.
// ============================================================================

import Module from 'utilities/module';
import {fetchJSON} from 'utilities/object';


const API = 'https://7tv.io/v3';
const ICON = 'https://7tv.app/favicon.ico';
const GLOBAL_SET = 'seventv-global';

// 7TV's ActiveEmoteFlags.ZeroWidth
const ZERO_WIDTH = 1;


export default class SevenTV extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('chat');
		this.inject('chat.emotes');

		this.should_enable = true;

		// Kick user ids by channel slug.
		this.user_ids = new Map;

		// The room holding the current channel's set, and that set's id.
		this.room = null;
		this.room_set = null;
		this._channel_token = 0;

		this.settings.add('kick.emotes.7tv', {
			default: true,
			ui: {
				path: 'Chat > Emotes >> 7TV',
				title: 'Show 7TV emotes.',
				description: '7TV\'s global set and the channel\'s own 7TV set. Zero-width emotes stack on the emote before them.',
				component: 'setting-check-box'
			}
		});
	}

	onEnable() {
		this.emotes.setProvider('7tv', {
			name: '7TV',
			icon: ICON,
			description: '7TV'
		});

		this.on('site.chat:room-changed', this.updateChannel, this);
		this.settings.getChanges('kick.emotes.7tv', this.updateEnabled, this);
	}

	onDisable() {
		this.off('site.chat:room-changed', this.updateChannel, this);
		this.unload();
		this.emotes.setProvider('7tv', null);
	}

	updateEnabled(enabled) {
		if ( enabled ) {
			this.loadGlobal();
			this.updateChannel();
		} else
			this.unload();
	}

	unload() {
		this.emotes.removeDefaultSet('7tv', GLOBAL_SET);
		this.detachChannel();
	}


	// ========================================================================
	// Sets
	// ========================================================================

	async loadGlobal() {
		if ( this.emotes.default_sets.sourceIncludes('7tv', GLOBAL_SET) )
			return;

		const data = await fetchJSON(`${API}/emote-sets/global`);
		if ( ! data || ! this.enabled || ! this.settings.get('kick.emotes.7tv') )
			return;

		this.emotes.addDefaultSet('7tv', GLOBAL_SET, this.convertSet(data, GLOBAL_SET, 'Global Emotes'));
	}

	detachChannel() {
		if ( this.room && this.room_set )
			this.room.removeSet('7tv', this.room_set);

		this.room = null;
		this.room_set = null;
		this._channel_token++;
	}

	// The site chat module holds a room for the channel on screen; the
	// channel's 7TV set goes on it.
	async updateChannel() {
		this.detachChannel();

		const site_chat = this.parent.chat,
			room = site_chat?.room,
			slug = site_chat?.channel;

		if ( ! room || ! slug || ! this.settings.get('kick.emotes.7tv') )
			return;

		const token = this._channel_token,
			user_id = await this.getUserId(slug);

		if ( token !== this._channel_token || ! user_id )
			return;

		const data = await fetchJSON(`${API}/users/kick/${user_id}`);
		if ( token !== this._channel_token )
			return;

		const set = data?.emote_set;
		if ( ! set?.emotes?.length )
			return;

		const set_id = `seventv-kick-${user_id}`,
			name = data.display_name || data.username || slug;

		this.room = room;
		this.room_set = set_id;
		room.addSet('7tv', set_id, this.convertSet(set, set_id, `Channel: ${name}`));
	}

	async getUserId(slug) {
		if ( this.user_ids.has(slug) )
			return this.user_ids.get(slug);

		// Kick's own API, same-origin on kick.com.
		const data = await fetchJSON(`/api/v2/channels/${encodeURIComponent(slug)}`),
			id = data?.user_id ?? null;

		if ( id != null )
			this.user_ids.set(slug, id);

		return id;
	}


	// ========================================================================
	// Conversion
	// ========================================================================

	convertSet(set, set_id, title) {
		const emotes = [];
		for(const entry of set.emotes || []) {
			const emote = this.convertEmote(entry);
			if ( emote )
				emotes.push(emote);
		}

		return {
			id: set_id,
			title,
			source: '7TV',
			icon: ICON,
			emotes
		};
	}

	// A 7TV set entry (name and flags as used in the set, with the emote's
	// own data) into FFZ's emote shape.
	convertEmote(entry) {
		const data = entry?.data || entry,
			host = data?.host;

		if ( ! entry?.id || ! entry.name || ! host?.url || ! Array.isArray(host.files) )
			return null;

		const base = host.url.startsWith('//') ? `https:${host.url}` : host.url,
			sizes = {};

		for(const file of host.files) {
			const match = /^(\d)x\.webp$/.exec(file.name);
			if ( match )
				sizes[match[1]] = file;
		}

		if ( ! sizes[1] )
			return null;

		const urls = {1: `${base}/1x.webp`};
		if ( sizes[2] )
			urls[2] = `${base}/2x.webp`;
		if ( sizes[4] )
			urls[4] = `${base}/4x.webp`;

		const emote = {
			id: entry.id,
			name: entry.name,
			width: sizes[1].width,
			height: sizes[1].height,
			urls,
			click_url: `https://7tv.app/emotes/${entry.id}`,
			owner: data.owner ? {
				display_name: data.owner.display_name || data.owner.username,
				name: data.owner.username
			} : null
		};

		// 7TV serves one image per size, animated when the emote is.
		if ( data.animated )
			emote.animated = urls;

		if ( (entry.flags & ZERO_WIDTH) === ZERO_WIDTH ) {
			emote.modifier = true;
			emote.modifier_offset = '0';
		}

		return emote;
	}
}
