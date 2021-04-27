'use strict';

// ============================================================================
// Emote Handling and Default Provider
// ============================================================================

import Module from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {get, has, timeout, SourcedSet} from 'utilities/object';
import {NEW_API, API_SERVER, IS_OSX, EmoteTypes, TWITCH_GLOBAL_SETS, TWITCH_POINTS_SETS, TWITCH_PRIME_SETS} from 'utilities/constants';

import GET_EMOTE from './emote_info.gql';
import GET_EMOTE_SET from './emote_set_info.gql';

const HoverRAF = Symbol('FFZ:Hover:RAF');
const HoverState = Symbol('FFZ:Hover:State');

const MOD_KEY = IS_OSX ? 'metaKey' : 'ctrlKey';

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

		this.EmoteTypes = EmoteTypes;

		this.inject('settings');
		this.inject('experiments');

		this.twitch_inventory_sets = new Set; //(EXTRA_INVENTORY);
		this.__twitch_emote_to_set = {};
		this.__twitch_set_to_channel = {};

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

		this.settings.add('chat.emotes.enabled', {
			default: 2,
			ui: {
				path: 'Chat > Appearance >> Emotes',
				title: 'Display Emotes',
				sort: -100,
				force_seen: true,
				description: 'If you do not wish to see emotes, you can disable them here.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Twitch Only'},
					{value: 2, title: 'Enabled'}
				]
			}
		});

		this.settings.add('chat.emotes.2x', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Emotes',
				title: 'Larger Emotes',
				description: 'This setting will make emotes appear twice as large in chat. It\'s good for use with larger fonts or just if you really like emotes.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.fix-bad-emotes', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Emotes',
				title: 'Fix Bad Twitch Global Emotes',
				description: 'Clean up the images for bad Twitch global emotes, removing white borders and solid backgrounds.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.click-emotes', {
			default: true,

			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Open emote information pages by Shift-Clicking them.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.sub-emotes', {
			default: true,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Open Twitch subscription pages by Shift-Clicking emotes when relevant.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-dialogs', {
			default: true,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Open emote information cards for Twitch emotes by clicking them.',
				component: 'setting-check-box'
			}
		});

		// Because this may be used elsewhere.
		this.handleClick = this.handleClick.bind(this);
		this.animHover = this.animHover.bind(this);
		this.animLeave = this.animLeave.bind(this);
	}

	onEnable() {
		this.style = new ManagedStyle('emotes');

		// Fix numeric Twitch favorite IDs.
		const favs = this.getFavorites('twitch');
		let changed = false;
		for(let i=0; i < favs.length; i++) {
			if ( typeof favs[i] === 'number' ) {
				changed = true;
				favs[i] = `${favs[i]}`;
			}
		}

		if ( changed )
			this.setFavorites('twitch', favs);

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

		this.on('socket:command:follow_sets', this.updateFollowSets, this);

		this.loadGlobalSets();
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
	// Hidden Checking
	// ========================================================================

	toggleHidden(source, id, value = null) {
		const key = `hidden-emotes.${source}`,
			p = this.settings.provider,
			hidden = p.get(key, []),

			idx = hidden.indexOf(id);

		if ( value === null )
			value = idx === -1;

		if ( value && idx === -1 )
			hidden.push(id);
		else if ( ! value && idx !== -1 )
			hidden.splice(idx, 1);
		else
			return;

		if ( hidden.length )
			p.set(key, hidden);
		else
			p.delete(key);

		this.emit(':change-hidden', source, id, value);
	}

	isHidden(source, id) {
		return this.getHidden(source).includes(id);
	}

	getHidden(source) {
		return this.settings.provider.get(`hidden-emotes.${source}`) || [];
	}

	setHidden(source, list) {
		const key = `hidden-emotes.${source}`;
		if ( ! Array.isArray(list) || ! list.length )
			this.settings.provider.delete(key);
		else
			this.settings.provider.set(key, list);
	}


	// ========================================================================
	// Animation Hover
	// ========================================================================

	animHover(event) { // eslint-disable-line class-methods-use-this
		const target = event.currentTarget;
		if ( target[HoverState] )
			return;

		if ( target[HoverRAF] )
			cancelAnimationFrame(target[HoverRAF]);

		target[HoverRAF] = requestAnimationFrame(() => {
			target[HoverRAF] = null;
			if ( target[HoverState] )
				return;

			if ( ! target.matches(':hover') )
				return;

			target[HoverState] = true;
			const emotes = target.querySelectorAll('.ffz-hover-emote');
			for(const em of emotes) {
				const ds = em.dataset;
				if ( ds.normalSrc && ds.hoverSrc ) {
					em.src = ds.hoverSrc;
					em.srcset = ds.hoverSrcSet;
				}
			}
		});
	}


	animLeave(event) { // eslint-disable-line class-methods-use-this
		const target = event.currentTarget;
		if ( ! target[HoverState] )
			return;

		if ( target[HoverRAF] )
			cancelAnimationFrame(target[HoverRAF]);

		target[HoverRAF] = requestAnimationFrame(() => {
			target[HoverRAF] = null;
			if ( ! target[HoverState] )
				return;

			if ( target.matches(':hover') )
				return;

			target[HoverState] = false;
			const emotes = target.querySelectorAll('.ffz-hover-emote');
			for(const em of emotes) {
				const ds = em.dataset;
				if ( ds.normalSrc ) {
					em.src = ds.normalSrc;
					em.srcset = ds.normalSrcSet;
				}
			}
		});
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

	setFavorites(source, favs) {
		const key = `favorite-emotes.${source}`;
		if ( ! Array.isArray(favs) || ! favs.length )
			this.settings.provider.delete(key);
		else
			this.settings.provider.set(key, favs);
	}


	handleClick(event) {
		const target = event.target,
			ds = target && target.dataset;

		if ( ! ds )
			return;

		const provider = ds.provider,
			click_emote = this.parent.context.get('chat.click-emotes'),
			click_sub = this.parent.context.get('chat.sub-emotes');

		if ( event.shiftKey && (click_emote || click_sub) ) {
			let url;

			if ( provider === 'twitch' ) {
				url = `https://twitchemotes.com/emotes/${ds.id}`;

				if ( click_sub ) {
					const apollo = this.resolve('site.apollo');
					if ( apollo ) {
						apollo.client.query({
							query: GET_EMOTE,
							variables: {
								id: ds.id
							}
						}).then(result => {
							const prod = get('data.emote.subscriptionProduct', result);
							if ( prod && prod.state === 'ACTIVE' && prod.owner && prod.owner.login )
								url = `https://www.twitch.tv/subs/${prod.owner.login}`;
							else if ( ! click_emote )
								return false;

							if ( url ) {
								const win = window.open();
								if ( win ) {
									win.opener = null;
									win.location = url;
								}
							}
						});

						return true;
					}
				}

			} else if ( provider === 'ffz' ) {
				const emote_set = this.emote_sets[ds.set],
					emote = emote_set && emote_set.emotes[ds.id];

				if ( ! emote )
					return;

				if ( emote.click_url )
					url = emote.click_url;

				else if ( ! emote_set.source )
					url = `https://www.frankerfacez.com/emoticons/${emote.id}`;
			}

			if ( ! click_emote )
				return false;

			if ( url ) {
				const win = window.open();
				if ( win ) {
					win.opener = null;
					win.location = url;
				}
			}

			return true;
		}

		if ( event[MOD_KEY] ) {
			// Favoriting Emotes
			let source, id;

			if ( provider === 'twitch' ) {
				source = 'twitch';
				id = ds.id;

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
			const tt = target._ffz_tooltip;
			if ( tt && tt.visible ) {
				tt.hide();
				setTimeout(() => document.contains(target) && tt.show(), 0);
			}

			return true;
		}

		if ( provider === 'twitch' && this.parent.context.get('chat.emote-dialogs') ) {
			const fine = this.resolve('site.fine');
			if ( ! fine )
				return;

			const line = fine.searchParent(target, n => n.props && n.props.message),
				opener = fine.searchParent(target, n => n.onShowEmoteCard, 200);

			if ( ! line || ! opener )
				return;

			opener.onShowEmoteCard({
				channelID: line.props.channelID || '',
				channelLogin: line.props.channelLogin || '',
				emoteID: ds.id,
				emoteCode: target.alt,
				sourceID: 'chat',
				referrerID: '',
				initialTopOffset: target.getBoundingClientRect().bottom
			});

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

		return (user?.emote_sets ? user.emote_sets._cache : []).concat(
			room_user?.emote_sets ? room_user.emote_sets._cache : [],
			room?.emote_sets ? room.emote_sets._cache : [],
			this.default_sets._cache
		);
	}

	getSets(user_id, user_login, room_id, room_login) {
		return this.getSetIDs(user_id, user_login, room_id, room_login)
			.map(set_id => this.emote_sets[set_id]);
	}

	_withSources(out, seen, emote_sets) { // eslint-disable-line class-methods-use-this
		if ( ! emote_sets?._sources )
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

		if ( ! room_user?.emote_sets )
			return room.emote_sets ? room.emote_sets._cache : [];

		else if ( ! room.emote_sets )
			return room_user.emote_sets._cache;

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
		if ( ! user?.emote_sets )
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

		if ( this.experiments.getAssignment('api_load') && tries < 1 )
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
			emote.src = emote.urls[1];
			emote.srcSet = `${emote.urls[1]} 1x`;
			if ( emote.urls[2] )
				emote.srcSet += `, ${emote.urls[2]} 2x`;
			if ( emote.urls[4] )
				emote.srcSet += `, ${emote.urls[4]} 4x`;

			if ( emote.urls[2] ) {
				emote.can_big = true;
				emote.src2 = emote.urls[2];
				emote.srcSet2 = `${emote.urls[2]} 1x`;
				if ( emote.urls[4] )
					emote.srcSet2 += `, ${emote.urls[4]} 2x`;
			}

			if ( emote.animated?.[1] ) {
				emote.animSrc = emote.animated[1];
				emote.animSrcSet = `${emote.animated[1]} 1x`;
				if ( emote.animated[2] ) {
					emote.animSrcSet += `, ${emote.animated[2]} 2x`;
					emote.animSrc2 = emote.animated[2];
					emote.animSrcSet2 = `${emote.animated[2]} 1x`;

					if ( emote.animated[4] ) {
						emote.animSrcSet += `, ${emote.animated[4]} 4x`;
						emote.animSrcSet2 += `, ${emote.animated[4]} 2x`;
					}
				}
			}

			emote.token = {
				type: 'emote',
				id: emote.id,
				set: set_id,
				provider: 'ffz',
				src: emote.src,
				srcSet: emote.srcSet,
				can_big: !! emote.urls[2],
				src2: emote.src2,
				srcSet2: emote.srcSet2,
				animSrc: emote.animSrc,
				animSrcSet: emote.animSrcSet,
				animSrc2: emote.animSrc2,
				animSrcSet2: emote.animSrcSet2,
				text: emote.hidden ? '???' : emote.name,
				length: emote.name.length,
				height: emote.height
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
	// Twitch Data Lookup
	// ========================================================================

	setTwitchEmoteSet(emote_id, set_id) {
		if ( typeof emote_id === 'number' ) {
			if ( isNaN(emote_id) || ! isFinite(emote_id) )
				return;
			emote_id = `${emote_id}`;
		}

		if ( typeof set_id === 'number' ) {
			if ( isNaN(set_id) || ! isFinite(set_id) )
				return;
			set_id = `${set_id}`;
		}

		this.__twitch_emote_to_set[emote_id] = set_id;
	}

	setTwitchSetChannel(set_id, channel) {
		if ( typeof set_id === 'number' ) {
			if ( isNaN(set_id) || ! isFinite(set_id) )
				return;

			set_id = `${set_id}`;
		}

		this.__twitch_set_to_channel[set_id] = channel;
	}

	_getTwitchEmoteSet(emote_id) {
		const tes = this.__twitch_emote_to_set,
			tsc = this.__twitch_set_to_channel;

		if ( typeof emote_id === 'number' ) {
			if ( isNaN(emote_id) || ! isFinite(emote_id) )
				return Promise.resolve(null);

			emote_id = `${emote_id}`;
		}

		if ( has(tes, emote_id) ) {
			const val = tes[emote_id];
			if ( Array.isArray(val) )
				return new Promise(s => val.push(s));
			else
				return Promise.resolve(val);
		}

		const apollo = this.resolve('site.apollo');
		if ( ! apollo?.client )
			return Promise.resolve(null);

		return new Promise(s => {
			const promises = [s];
			tes[emote_id] = promises;

			timeout(apollo.client.query({
				query: GET_EMOTE,
				variables: {
					id: `${emote_id}`
				}
			}), 2000).then(data => {
				const emote = data?.data?.emote;
				let set_id = null;

				if ( emote ) {
					set_id = emote.setID;

					if ( set_id && ! has(tsc, set_id) ) {
						const type = determineEmoteType(emote);

						tsc[set_id] = {
							id: set_id,
							type,
							owner: emote?.subscriptionProduct?.owner || emote?.owner
						};
					}
				}

				tes[emote_id] = set_id;
				for(const fn of promises)
					fn(set_id);

			}).catch(() => {
				tes[emote_id] = null;
				for(const fn of promises)
					fn(null);
			});
		});
	}

	getTwitchEmoteSet(emote_id, callback) {
		const promise = this._getTwitchEmoteSet(emote_id);
		if ( callback )
			promise.then(callback);
		else
			return promise;
	}


	_getTwitchSetChannel(set_id) {
		const tsc = this.__twitch_set_to_channel;

		if ( typeof set_id === 'number' ) {
			if ( isNaN(set_id) || ! isFinite(set_id) )
				return Promise.resolve(null);

			set_id = `${set_id}`;
		}

		if ( has(tsc, set_id) ) {
			const val = tsc[set_id];
			if ( Array.isArray(val) )
				return new Promise(s => val.push(s));
			else
				return Promise.resolve(val);
		}

		const apollo = this.resolve('site.apollo');
		if ( ! apollo?.client )
			return Promise.resolve(null);

		return new Promise(s => {
			const promises = [s];
			tsc[set_id] = promises;

			timeout(apollo.client.query({
				query: GET_EMOTE_SET,
				variables: {
					id: `${set_id}`
				}
			}), 2000).then(data => {
				const set = data?.data?.emoteSet;
				let result = null;

				if ( set ) {
					result = {
						id: set_id,
						type: determineSetType(set),
						owner: set.owner ? {
							id: set.owner.id,
							login: set.owner.login,
							displayName: set.owner.displayName
						} : null
					};
				}

				tsc[set_id] = result;
				for(const fn of promises)
					fn(result);

			}).catch(() => {
				tsc[set_id] = null;
				for(const fn of promises)
					fn(null);
			});
		});
	}


	getTwitchSetChannel(set_id, callback) {
		const promise = this._getTwitchSetChannel(set_id);
		if ( callback )
			promise.then(callback);
		else
			return promise;
	}
}


function determineEmoteType(emote) {
	const product = emote.subscriptionProduct;
	if ( product ) {
		if ( product.id == 12658 )
			return EmoteTypes.Prime;
		else if ( product.id == 324 )
			return EmoteTypes.Turbo;

		// TODO: Care about Overwatch League

		const owner = product.owner;
		if ( owner ) {
			if ( owner.id == 139075904 || product.state === 'INACTIVE' )
				return EmoteTypes.LimitedTime;

			return EmoteTypes.Subscription;
		}
	}

	if ( emote.setID == 300238151 )
		return EmoteTypes.ChannelPoints;

	if ( emote.setID == 300374282 )
		return EmoteTypes.TwoFactor;

	const id = parseInt(emote.setID, 10);
	if ( ! isNaN(id) && isFinite(id) && id >= 5e8 )
		return EmoteTypes.BitsTier;

	return EmoteTypes.Global;
}


function determineSetType(set) {
	const id = parseInt(set.id, 10);

	if ( TWITCH_GLOBAL_SETS.includes(id) )
		return EmoteTypes.Global;

	if ( TWITCH_POINTS_SETS.includes(id) )
		return EmoteTypes.ChannelPoints;

	if ( TWITCH_PRIME_SETS.includes(id) )
		return EmoteTypes.Prime;

	if ( id == 300374282 )
		return EmoteTypes.TwoFactor;

	const owner = set.owner;
	if ( owner ) {
		if ( owner.id == 139075904 )
			return EmoteTypes.LimitedTime;

		let product;
		if ( Array.isArray(owner.subscriptionProducts) )
			for(const prod of owner.subscriptionProducts)
				if ( set.id == prod.emoteSetID ) {
					product = prod;
					break;
				}

		if ( product ) {
			if ( product.id == 12658 )
				return EmoteTypes.Prime;
			else if ( product.id == 324 )
				return EmoteTypes.Turbo;
			else if ( product.state === 'INACTIVE' )
				return EmoteTypes.LimitedTime;
		}

		return EmoteTypes.Subscription;
	}

	if ( id >= 5e8 )
		return EmoteTypes.BitsTier;

	return EmoteTypes.Global;
}