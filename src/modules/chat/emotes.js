'use strict';

// ============================================================================
// Emote Handling and Default Provider
// ============================================================================

import Module from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {has, timeout, SourcedSet} from 'utilities/object';
import {CLIENT_ID, NEW_API, API_SERVER, IS_OSX} from 'utilities/constants';

const MOD_KEY = IS_OSX ? 'metaKey' : 'ctrlKey';

const EXTRA_INVENTORY = [33563];

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
		this.inject('settings');
		this.inject('experiments');

		this.twitch_inventory_sets = new Set(EXTRA_INVENTORY);
		this.__twitch_emote_to_set = new Map;
		this.__twitch_set_to_channel = new Map;

		this.default_sets = new SourcedSet;
		this.global_sets = new SourcedSet;

		this.providers = new Map;

		this.providers.set('featured', {
			name: 'Featured',
			i18n_key: 'emote-menu.featured',
			sort_key: 75
		})

		this.emote_sets = {};
		this._set_refs = {};
		this._set_timers = {};

		this.settings.add('chat.fix-bad-emotes', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Emotes',
				title: 'Fix Bad Twitch Global Emotes',
				description: 'Clean up the images for bad Twitch global emotes, removing white borders and solid backgrounds.',
				component: 'setting-check-box'
			}
		});


		// Because this may be used elsewhere.
		this.handleClick = this.handleClick.bind(this);
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

		this.socket.on(':command:follow_sets', this.updateFollowSets, this);

		this.loadGlobalSets();
		this.loadTwitchInventory();
	}


	// ========================================================================
	// Featured Sets
	// ========================================================================

	updateFollowSets(data) {
		for(const room_login in data)
			if ( has(data, room_login) ) {
				const room = this.parent.getRoom(null, room_login, true);
				if ( ! room || room.destroyed )
					continue;

				const new_sets = data[room_login] || [],
					emote_sets = room.emote_sets,
					providers = emote_sets && emote_sets._sources;

				if ( providers && providers.has('featured') )
					for(const item of providers.get('featured')) {
						const idx = new_sets.indexOf(item);
						if ( idx === -1 )
							room.removeSet('featured', item);
						else
							new_sets.splice(idx, 1);
					}

				for(const set_id of new_sets) {
					room.addSet('featured', set_id);

					if ( ! this.emote_sets[set_id] )
						this.loadSet(set_id);
				}
			}
	}


	// ========================================================================
	// Favorite Checking
	// ========================================================================

	toggleFavorite(source, id, value = null) {
		const key = `favorite-emotes.${source}`,
			p = this.settings.provider,
			favorites = p.get(key) || [],

			idx = favorites.indexOf(id);

		if ( value === null )
			value = idx === -1;

		if ( value && idx === -1 )
			favorites.push(id);
		else if ( ! value && idx !== -1 )
			favorites.splice(idx, 1);
		else
			return;

		if ( favorites.length )
			p.set(key, favorites);
		else
			p.delete(key);

		this.emit(':change-favorite', source, id, value);
	}

	isFavorite(source, id) {
		const favorites = this.settings.provider.get(`favorite-emotes.${source}`);
		return favorites && favorites.includes(id);
	}

	getFavorites(source) {
		return this.settings.provider.get(`favorite-emotes.${source}`) || [];
	}


	handleClick(event) {
		const target = event.target,
			ds = target && target.dataset;

		if ( ! ds )
			return;

		const provider = ds.provider;

		if ( event.shiftKey && this.parent.context.get('chat.click-emotes') ) {
			let url;

			if ( provider === 'twitch' )
				url = `https://twitchemotes.com/emotes/${ds.id}`;

			else if ( provider === 'ffz' ) {
				const emote_set = this.emote_sets[ds.set],
					emote = emote_set && emote_set.emotes[ds.id];

				if ( ! emote )
					return;

				if ( emote.click_url )
					url = emote.click_url;

				else if ( ! emote_set.source )
					url = `https://www.frankerfacez.com/emoticons/${emote.id}`;
			}

			if ( url ) {
				const win = window.open();
				win.opener = null;
				win.location = url;
			}

			return true;
		}

		if ( event[MOD_KEY] ) {
			// Favoriting Emotes
			let source, id;

			if ( provider === 'twitch' ) {
				source = 'twitch';
				id = parseInt(ds.id, 10);

			} else if ( provider === 'ffz' ) {
				const emote_set = this.emote_sets[ds.set],
					emote = emote_set && emote_set.emotes[ds.id];

				if ( ! emote )
					return;

				source = emote_set.source || 'ffz';
				id = emote.id;

			} else if ( provider === 'emoji' ) {
				source = 'emoji';
				id = ds.code;

			} else
				return;

			this.toggleFavorite(source, id);
			const tt = target._ffz_tooltip$0;
			if ( tt && tt.visible ) {
				tt.hide();
				setTimeout(() => document.contains(target) && tt.show(), 0);
			}

			return true;
		}
	}


	// ========================================================================
	// Access
	// ========================================================================

	getSetIDs(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			room_user = room && room.getUser(user_id, user_login, true),
			user = this.parent.getUser(user_id, user_login, true);

		return (user ? user.emote_sets._cache : []).concat(
			room_user ? room_user.emote_sets._cache : [],
			room ? room.emote_sets._cache : [],
			this.default_sets._cache
		);
	}

	getSets(user_id, user_login, room_id, room_login) {
		return this.getSetIDs(user_id, user_login, room_id, room_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	_withSources(out, seen, emote_sets) { // eslint-disable-line class-methods-use-this
		if ( ! emote_sets._sources )
			return;

		for(const [provider, data] of emote_sets._sources)
			for(const item of data)
				if ( ! seen.has(item) ) {
					out.push([item, provider]);
					seen.add(item);
				}

		return out;
	}

	getRoomSetIDsWithSources(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			room_user = room && room.getUser(user_id, user_login, true);

		if ( ! room )
			return [];

		const out = [], seen = new Set;

		this._withSources(out, seen, room.emote_sets);
		if ( room_user )
			this._withSources(out, seen, room_user);

		return out;
	}

	getRoomSetsWithSources(user_id, user_login, room_id, room_login) {
		return this.getRoomSetIDsWithSources(user_id, user_login, room_id, room_login)
			.map(([set_id, source]) => [this.emote_sets[set_id], source]);
	}

	getRoomSetIDs(user_id, user_login, room_id, room_login) {
		const room = this.parent.getRoom(room_id, room_login, true),
			room_user = room && room.getUser(user_id, user_login, true);

		if ( ! room )
			return [];

		if ( ! room_user )
			return room.emote_sets._cache;

		return room_user.emote_sets._cache.concat(room.emote_sets._cache);
	}

	getRoomSets(user_id, user_login, room_id, room_login) {
		return this.getRoomSetIDs(user_id, user_login, room_id, room_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	getGlobalSetIDsWithSources(user_id, user_login) {
		const user = this.parent.getUser(user_id, user_login, true),
			out = [], seen = new Set;

		this._withSources(out, seen, this.default_sets);
		if ( user )
			this._withSources(out, seen, user.emote_sets);

		return out;
	}

	getGlobalSetsWithSources(user_id, user_login) {
		return this.getGlobalSetIDsWithSources(user_id, user_login)
			.map(([set_id, source]) => [this.emote_sets[set_id], source]);
	}

	getGlobalSetIDs(user_id, user_login) {
		const user = this.parent.getUser(user_id, user_login, true);
		if ( ! user )
			return this.default_sets._cache;

		return user.emote_sets._cache.concat(this.default_sets._cache);
	}

	getGlobalSets(user_id, user_login) {
		return this.getGlobalSetIDs(user_id, user_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	getEmotes(user_id, user_login, room_id, room_login) {
		const emotes = {};
		for(const emote_set of this.getSets(user_id, user_login, room_id, room_login))
			if ( emote_set && emote_set.emotes )
				for(const emote of Object.values(emote_set.emotes) )
					if ( emote && ! has(emotes, emote.name) )
						emotes[emote.name] = emote;

		return emotes;
	}

	// ========================================================================
	// Emote Set Ref Counting
	// ========================================================================

	addDefaultSet(provider, set_id, data) {
		let changed = false;
		if ( ! this.default_sets.sourceIncludes(provider, set_id) ) {
			this.default_sets.push(provider, set_id);
			this.refSet(set_id);
			changed = true;
		}

		if ( data )
			this.loadSetData(set_id, data);

		if ( changed )
			this.emit(':update-default-sets', provider, set_id, true);
	}

	removeDefaultSet(provider, set_id) {
		let changed = false;
		if ( this.default_sets.sourceIncludes(provider, set_id) ) {
			this.default_sets.remove(provider, set_id);
			this.unrefSet(set_id);
			changed = true;
		}

		if ( changed )
			this.emit(':update-default-sets', provider, set_id, false);
	}

	refSet(set_id) {
		this._set_refs[set_id] = (this._set_refs[set_id] || 0) + 1;
		if ( this._set_timers[set_id] ) {
			clearTimeout(this._set_timers[set_id]);
			this._set_timers[set_id] = null;
		}

	}

	unrefSet(set_id) {
		const c = this._set_refs[set_id] = (this._set_refs[set_id] || 1) - 1;
		if ( c <= 0 && ! this._set_timers[set_id] )
			this._set_timers[set_id] = setTimeout(() => this.unloadSet(set_id), 5000);
	}


	// ========================================================================
	// Emote Set Loading
	// ========================================================================

	async loadGlobalSets(tries = 0) {
		let response, data;

		if ( this.experiments.getAssignment('api_load') )
			try {
				fetch(`${NEW_API}/v1/set/global`).catch(() => {});
			} catch(err) { /* do nothing */ }

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

		for(const set_id of data.default_sets)
			this.addDefaultSet('ffz-global', set_id);

		for(const set_id in sets)
			if ( has(sets, set_id) )
				this.loadSetData(set_id, sets[set_id]);

		if ( data.users )
			this.loadSetUsers(data.users);

		return true;
	}


	async loadSet(set_id, suppress_log = false, tries = 0) {
		let response, data;

		if ( this.experiments.getAssignment('api_load') )
			try {
				fetch(`${NEW_API}/v1/set/${set_id}`).catch(() => {});
			} catch(err) { /* do nothing */ }

		try {
			response = await fetch(`${API_SERVER}/v1/set/${set_id}`)
		} catch(err) {
			tries++;
			if ( tries < 10 )
				return setTimeout(() => this.loadGlobalSets(tries), 500 * tries);

			this.log.error(`Error loading data for set "${set_id}".`, err);
			return false;
		}

		if ( ! response.ok )
			return false;

		try {
			data = await response.json();
		} catch(err) {
			this.log.error(`Error parsing data for set "${set_id}".`, err);
			return false;
		}

		const set = data.set;
		if ( set )
			this.loadSetData(set.id, set, suppress_log);

		if ( data.users )
			this.loadSetUsers(data.users);

		return true;
	}


	loadSetUsers(data, suppress_log = false) {
		for(const set_id in data)
			if ( has(data, set_id) ) {
				const emote_set = this.emote_sets[set_id],
					users = data[set_id];

				for(const login of users)
					this.parent.getUser(undefined, login)
						.addSet('ffz-global', set_id);

				if ( ! suppress_log )
					this.log.info(`Added "${emote_set ? emote_set.title : set_id}" emote set to ${users.length} users.`);
			}
	}


	loadSetData(set_id, data, suppress_log = false) {
		const old_set = this.emote_sets[set_id];
		if ( ! data ) {
			if ( old_set )
				this.emote_sets[set_id] = null;

			return;
		}

		this.emote_sets[set_id] = data;

		let count = 0;
		const ems = data.emotes || data.emoticons,
			new_ems = data.emotes = {},
			css = [];

		data.id = set_id;
		data.emoticons = undefined;

		const bad_emotes = [];

		for(const emote of ems) {
			if ( ! emote.id || ! emote.name || ! emote.urls ) {
				bad_emotes.push(emote);
				continue;
			}

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

		if ( bad_emotes.length )
			this.log.warn(`Bad Emote Data for Set #${set_id}`, bad_emotes);

		data.count = count;

		if ( this.style && (css.length || data.css) )
			this.style.set(`es--${set_id}`, css.join('') + (data.css || ''));
		else if ( css.length )
			data.pending_css = css.join('');

		if ( ! suppress_log )
			this.log.info(`Loaded emote set #${set_id}: ${data.title} (${count} emotes)`);

		this.emit(':loaded', set_id, data);
	}


	unloadSet(set_id, force = false, suppress_log = false) {
		const old_set = this.emote_sets[set_id],
			count = this._set_refs[set_id] || 0;

		if ( ! old_set )
			return;

		if ( count > 0 ) {
			if ( ! force )
				return this.log.warn(`Attempted to unload emote set #${set_id} with ${count} users.`);
			this.log.warn(`Unloading emote set ${set_id} with ${count} users.`);
		}

		if ( ! suppress_log )
			this.log.info(`Unloaded emote set #${set_id}: ${old_set.title}`);

		this.emit(':unloaded', set_id, old_set);
		this.emote_sets[set_id] = null;
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
			margins = margins.split(/[\s\n]+/).map(x => parseInt(x, 10));
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

		const sets = this.twitch_inventory_sets = new Set(EXTRA_INVENTORY);
		for(const set in data.emoticon_sets)
			if ( has(data.emoticon_sets, set) )
				sets.add(parseInt(set, 10));

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