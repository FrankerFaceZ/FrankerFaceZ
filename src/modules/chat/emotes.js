'use strict';

// ============================================================================
// Emote Handling and Default Provider
// ============================================================================

import Module from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {has, timeout, SourcedSet} from 'utilities/object';
import {CLIENT_ID, API_SERVER} from 'utilities/constants';


const MODIFIERS = {
	59847: {
		modifier_offset: '0 15px 15px 0',
		modifier: true
	},

	70852: {
		modifier: true,
		modifier_offset: '0 5px 20px 0',
		extra_width: 5,
		shrink_to_fit: true
	},

	70854: {
		modifier: true,
		modifier_offset: '30px 0 0'
	},

	147049: {
		modifier: true,
		modifier_offset: '4px 1px 0 3px'
	},

	147011: {
		modifier: true,
		modifier_offset: '0'
	},

	70864: {
		modifier: true,
		modifier_offset: '0'
	},

	147038: {
		modifier: true,
		modifier_offset: '0'
	}
};



export default class Emotes extends Module {
	constructor(...args) {
		super(...args);

		this.inject('socket');

		this.twitch_inventory_sets = [];
		this.__twitch_emote_to_set = new Map;
		this.__twitch_set_to_channel = new Map;

		this.default_sets = new SourcedSet;
		this.global_sets = new SourcedSet;

		this.emote_sets = {};
	}

	onEnable() {
		// Just in case there's a weird load order going on.
		this.on('site:enabled', this.loadTwitchInventory);

		this.style = new ManagedStyle('emotes');

		if ( Object.keys(this.emote_sets).length ) {
			this.log.info('Generating CSS for existing emote sets.');
			for(const set_id in this.emote_sets)
				if ( has(this.emote_sets, set_id) ) {
					const emote_set = this.emote_sets[set_id];
					if ( emote_set && emote_set.pending_css ) {
						this.style.set(`es--${set_id}`, emote_set.pending_css + (emote_set.css || ''));
						emote_set.pending_css = null;
					}
				}
		}

		this.loadGlobalSets();
		this.loadEmojiData();
		this.loadTwitchInventory();
	}


	// ========================================================================
	// Access
	// ========================================================================

	getSetIDs(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			user = this.parent.getUser(user_id, user_login, true);

		return (user ? user.emote_sets._cache : []).concat(
			room ? room.emote_sets._cache : [],
			this.default_sets._cache
		);
	}

	getSets(user_id, user_login, room_id, room_login) {
		return this.getSetIDs(user_id, user_login, room_id, room_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	// ========================================================================
	// FFZ Emote Sets
	// ========================================================================

	async loadGlobalSets(tries = 0) {
		let response, data;
		try {
			response = await fetch(`${API_SERVER}/v1/set/global`)
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.loadGlobalSets(tries), 500 * tries);

			this.log.error('Error loading global emote sets.', err);
			return false;
		}

		if ( ! response.ok )
			return false;

		try {
			data = await response.json();
		} catch(err) {
			this.log.error('Error parsing global emote data.', err);
			return false;
		}

		const sets = data.sets || {};

		this.default_sets.extend('ffz-global', ...data.default_sets);

		for(const set_id in sets)
			if ( has(sets, set_id) ) {
				this.global_sets.push('ffz-global', set_id);
				this.loadSetData(set_id, sets[set_id]);
			}

		if ( data.users )
			this.loadSetUsers(data.users);
	}


	loadSetUsers(data) {
		for(const set_id in data)
			if ( has(data, set_id) ) {
				const emote_set = this.emote_sets[set_id],
					users = data[set_id];

				for(const login of users) {
					const user = this.parent.getUser(undefined, login),
						sets = user.emote_sets;

					sets.push('ffz-global', set_id);
				}

				this.log.info(`Added "${emote_set ? emote_set.title : set_id}" emote set to ${users.length} users.`);
			}
	}


	loadSetData(set_id, data) {
		const old_set = this.emote_sets[set_id];
		if ( ! data ) {
			if ( old_set )
				this.emote_sets[set_id] = null;

			return;
		}

		this.emote_sets[set_id] = data;

		data.users = old_set ? old_set.users : 0;

		let count = 0;
		const ems = data.emotes || data.emoticons,
			new_ems = data.emotes = {},
			css = [];

		data.emoticons = undefined;

		for(const emote of ems) {
			emote.set_id = set_id;
			emote.srcSet = `${emote.urls[1]} 1x`;
			if ( emote.urls[2] )
				emote.srcSet += `, ${emote.urls[2]} 2x`;
			if ( emote.urls[4] )
				emote.srcSet += `, ${emote.urls[4]} 4x`;

			emote.token = {
				type: 'emote',
				id: emote.id,
				set: set_id,
				provider: 'ffz',
				src: emote.urls[1],
				srcSet: emote.srcSet,
				text: emote.hidden ? '???' : emote.name,
				length: emote.name.length
			};

			if ( has(MODIFIERS, emote.id) )
				Object.assign(emote, MODIFIERS[emote.id]);

			const emote_css = this.generateEmoteCSS(emote);
			if ( emote_css )
				css.push(emote_css);

			count++;
			new_ems[emote.id] = emote;
		}

		data.count = count;

		if ( this.style && (css.length || data.css) )
			this.style.set(`es--${set_id}`, css.join('') + (data.css || ''));
		else if ( css.length )
			data.pending_css = css.join('');

		this.log.info(`Updated emotes for set #${set_id}: ${data.title}`);
		this.emit(':loaded', set_id, data);
	}


	// ========================================================================
	// Emote CSS
	// ========================================================================

	generateEmoteCSS(emote) { // eslint-disable-line class-methods-use-this
		if ( ! emote.margins && ( ! emote.modifier || ( ! emote.modifier_offset && ! emote.extra_width && ! emote.shrink_to_fit ) ) && ! emote.css )
			return '';

		let output = '';
		if ( emote.modifier && (emote.modifier_offset || emote.margins || emote.extra_width || emote.shrink_to_fit) ) {
			let margins = emote.modifier_offset || emote.margins || '0';
			margins = margins.split(/\s+/).map(x => parseInt(x, 10));
			if ( margins.length === 3 )
				margins.push(margins[1]);

			const l = margins.length,
				m_top = margins[0 % l],
				m_right = margins[1 % l],
				m_bottom = margins[2 % l],
				m_left = margins[3 % l];

			output = `.modified-emote span .ffz-emote[data-id="${emote.id}"] {
	padding: ${m_top}px ${m_right}px ${m_bottom}px ${m_left}px;
	${emote.shrink_to_fit ? `max-width: calc(100% - ${40 - m_left - m_right - (emote.extra_width||0)}px);` : ''}
	margin: 0 !important;
}`;
		}

		return `${output}.ffz-emote[data-id="${emote.id}"] {
	${(emote.margins && ! emote.modifier) ? `margin: ${emote.margins} !important;` : ''}
	${emote.css||''}
}`;
	}


	// ========================================================================
	// Emoji
	// ========================================================================

	loadEmojiData() {
		this.log.debug('Unimplemented: loadEmojiData');
	}


	// ========================================================================
	// Twitch Data Lookup
	// ========================================================================

	async loadTwitchInventory() {
		const user = this.resolve('site').getUser();
		if ( ! user )
			return;

		let data;
		try {
			data = await fetch('https://api.twitch.tv/v5/inventory/emoticons', {
				headers: {
					'Client-ID': CLIENT_ID,
					'Authorization': `OAuth ${user.authToken}`
				}
			}).then(r => {
				if ( r.ok )
					return r.json();

				throw r.status;
			});

		} catch(err) {
			this.log.error('Error loading Twitch inventory.', err);
			return;
		}



		this.twitch_inventory_sets = data.emoticon_sets ? Object.keys(data.emoticon_sets) : [];
		this.log.info('Twitch Inventory Sets:', this.twitch_inventory_sets);
	}


	getTwitchEmoteSet(emote_id, callback) {
		const tes = this.__twitch_emote_to_set;

		if ( isNaN(emote_id) || ! isFinite(emote_id) )
			return null;

		if ( tes.has(emote_id) )
			return tes.get(emote_id);

		tes.set(emote_id, null);
		timeout(this.socket.call('get_emote', emote_id), 1000).then(data => {
			const set_id = data['s_id'];
			tes.set(emote_id, set_id);
			this.__twitch_set_to_channel.set(set_id, data);

			if ( callback )
				callback(data['s_id']);

		}).catch(() => tes.delete(emote_id));
	}


	getTwitchSetChannel(set_id, callback) {
		const tes = this.__twitch_set_to_channel;
		if ( isNaN(set_id) || ! isFinite(set_id) )
			return null;

		if ( tes.has(set_id) )
			return tes.get(set_id);

		tes.set(set_id, null);
		timeout(this.socket.call('get_emote_set', set_id), 1000).then(data => {
			tes.set(set_id, data);
			if ( callback )
				callback(data);

		}).catch(() => tes.delete(set_id));
	}
}