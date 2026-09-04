'use strict';

// ============================================================================
// 7TV Emotes
//
// 7TV's global set and each channel's own set, loaded into FFZ's emote
// system so they tokenize, render and get tooltips and cards like any
// other set. 7TV keys Kick channels by the broadcaster's Kick user id,
// which Kick's channel API gives for a slug. The channel set is attached
// to the FFZ room standing in for the channel (see chat/index.ts) while
// its chat is on screen. Zero-width emotes become FFZ modifiers.
// ============================================================================

import Module, {type GenericModule} from 'utilities/module';
import {fetchJSON} from 'utilities/object';

import type SettingsManager from 'src/settings';
import type SharedChat from 'src/modules/chat';
import type Emotes from 'src/modules/chat/emotes';
import type Room from 'src/modules/chat/room';

import type KickSite from './index';


const API = 'https://7tv.io/v3';
const ICON = 'https://7tv.app/favicon.ico';
const GLOBAL_SET = 'seventv-global';

// 7TV's ActiveEmoteFlags.ZeroWidth
const ZERO_WIDTH = 1;


// What 7TV's API returns.

type SevenTVFile = {
	name: string;
	width: number;
	height: number;
};

type SevenTVEmoteData = {
	animated?: boolean;
	host?: {
		url: string;
		files: SevenTVFile[];
	};
	owner?: {
		username?: string;
		display_name?: string;
	};
};

/** An entry in a set: the name and flags in use, plus the emote's data. */
type SevenTVSetEntry = SevenTVEmoteData & {
	id: string;
	name: string;
	flags?: number;
	data?: SevenTVEmoteData;
};

type SevenTVSet = {
	id?: string;
	emotes?: SevenTVSetEntry[];
};

type SevenTVKickUser = {
	username?: string;
	display_name?: string;
	emote_set?: SevenTVSet;
};

type KickChannel = {
	user_id?: number | string;
};


// What FFZ's emote system takes.

type EmoteURLs = Record<number, string>;

type FFZEmote = {
	id: string;
	name: string;
	width: number;
	height: number;
	urls: EmoteURLs;
	animated?: EmoteURLs;
	click_url: string;
	owner: {display_name?: string; name?: string} | null;
	modifier?: boolean;
	modifier_offset?: string;
};

type FFZEmoteSet = {
	id: string;
	title: string;
	source: string;
	icon: string;
	emotes: FFZEmote[];
};


export default class SevenTV extends Module<'site.seven_tv'> {

	// Dependencies
	settings: SettingsManager = null as any;
	chat: SharedChat = null as any;
	emotes: Emotes = null as any;

	/** The site module this belongs to. */
	private get site() {
		return this.parent as unknown as KickSite;
	}

	// State
	/** Kick user ids by channel slug. */
	user_ids: Map<string, string | number>;

	/** The room holding the current channel's set, and that set's id. */
	room: Room | null;
	room_set: string | null;

	private _channel_token: number;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');
		this.inject('chat');
		this.inject('chat.emotes');

		this.should_enable = true;

		this.user_ids = new Map;

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
		this.unloadSets();
		this.emotes.setProvider('7tv', null);
	}

	updateEnabled(enabled: boolean) {
		if ( enabled ) {
			this.loadGlobal();
			this.updateChannel();
		} else
			this.unloadSets();
	}

	unloadSets() {
		this.emotes.removeDefaultSet('7tv', GLOBAL_SET);
		this.detachChannel();
	}


	// ========================================================================
	// Sets
	// ========================================================================

	async loadGlobal() {
		if ( this.emotes.default_sets.sourceIncludes('7tv', GLOBAL_SET) )
			return;

		const data = await fetchJSON<SevenTVSet>(`${API}/emote-sets/global`);
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

		const site_chat = this.site.chat,
			room = site_chat?.room,
			slug = site_chat?.channel;

		if ( ! room || ! slug || ! this.settings.get('kick.emotes.7tv') )
			return;

		const token = this._channel_token,
			user_id = await this.getUserId(slug);

		if ( token !== this._channel_token || ! user_id )
			return;

		const data = await fetchJSON<SevenTVKickUser>(`${API}/users/kick/${user_id}`);
		if ( token !== this._channel_token || ! data )
			return;

		const set = data.emote_set;
		if ( ! set?.emotes?.length )
			return;

		const set_id = `seventv-kick-${user_id}`,
			name = data.display_name || data.username || slug;

		this.room = room;
		this.room_set = set_id;
		room.addSet('7tv', set_id, this.convertSet(set, set_id, `Channel: ${name}`));
	}

	async getUserId(slug: string) {
		const cached = this.user_ids.get(slug);
		if ( cached != null )
			return cached;

		// Kick's own API, same-origin on kick.com.
		const data = await fetchJSON<KickChannel>(`/api/v2/channels/${encodeURIComponent(slug)}`),
			id = data?.user_id ?? null;

		if ( id != null )
			this.user_ids.set(slug, id);

		return id;
	}


	// ========================================================================
	// Conversion
	// ========================================================================

	convertSet(set: SevenTVSet, set_id: string, title: string): FFZEmoteSet {
		const emotes: FFZEmote[] = [];
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
	convertEmote(entry: SevenTVSetEntry | null | undefined): FFZEmote | null {
		if ( ! entry?.id || ! entry.name )
			return null;

		const data = entry.data || entry,
			host = data.host;

		if ( ! host?.url || ! Array.isArray(host.files) )
			return null;

		const base = host.url.startsWith('//') ? `https:${host.url}` : host.url,
			sizes: Record<string, SevenTVFile> = {};

		for(const file of host.files) {
			const match = /^(\d)x\.webp$/.exec(file.name);
			if ( match )
				sizes[match[1]] = file;
		}

		if ( ! sizes[1] )
			return null;

		const urls: EmoteURLs = {1: `${base}/1x.webp`};
		if ( sizes[2] )
			urls[2] = `${base}/2x.webp`;
		if ( sizes[4] )
			urls[4] = `${base}/4x.webp`;

		const emote: FFZEmote = {
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

		if ( ((entry.flags ?? 0) & ZERO_WIDTH) === ZERO_WIDTH ) {
			emote.modifier = true;
			emote.modifier_offset = '0';
		}

		return emote;
	}
}
