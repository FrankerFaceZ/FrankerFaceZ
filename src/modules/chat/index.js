'use strict';

// ============================================================================
// Chat
// ============================================================================

import dayjs from 'dayjs';

import { DEBUG, LINK_DATA_HOSTS, RESOLVERS_REQUIRE_TOS } from 'utilities/constants';
import Module, { buildAddonProxy } from 'utilities/module';
import {createElement, ManagedStyle} from 'utilities/dom';
import {timeout, has, split_chars, makeAddonIdChecker, SourcedSet, getTwitchEmoteURL} from 'utilities/object';

import Badges from './badges';
import Emotes from './emotes';
import Emoji from './emoji';
import Overrides from './overrides';

import Room from './room';
import User from './user';
import * as TOKENIZERS from './tokenizers';
import * as RICH_PROVIDERS from './rich_providers';
import * as LINK_PROVIDERS from './link_providers';

import Actions from './actions/actions';
import { defineSettings } from './settings';


const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';
const EMOTE_CHARS = /[ .,!]/;

export default class Chat extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('i18n');
		this.inject('tooltips');
		this.inject('experiments');
		this.inject('staging');
		this.inject('load_tracker');

		this.inject(Badges);
		this.inject(Emotes);
		this.inject(Emoji);
		this.inject(Actions);
		this.inject('overrides', Overrides);

		this._link_info = {};

		// Bind for JSX stuff
		this.clickToReveal = this.clickToReveal.bind(this);
		this.handleLinkClick = this.handleLinkClick.bind(this);
		this.handleMentionClick = this.handleMentionClick.bind(this);
		this.handleReplyClick = this.handleReplyClick.bind(this);

		this.style = new ManagedStyle;

		this.context = this.settings.context({});

		this.CommandPrefixes = new SourcedSet(true);
		this.CommandPrefixes.set('ffz', ['/', '!']);

		this.rooms = {};
		this.users = {};

		this.room_ids = {};
		this.user_ids = {};

		this.tokenizers = {};
		this.__tokenizers = [];

		this.rich_providers = {};
		this.__rich_providers = [];

		this.link_providers = {};
		this.__link_providers = [];

		this._hl_reasons = {};
		this.addHighlightReason('mention', 'Mentioned', 'Mention');
		this.addHighlightReason('user', 'Highlight User', 'User');
		this.addHighlightReason('badge', 'Highlight Badge', 'Badge');
		this.addHighlightReason('term', 'Highlight Term', 'Term');

		// ========================================================================
		// Settings
		// ========================================================================

		defineSettings(this);
		this.context.on('changed:theme.is-dark', () => {
			for(const room of this.iterateRooms())
				room.buildBitsCSS();
		});

		this.context.on('changed:chat.bits.animated', () => {
			for(const room of this.iterateRooms())
				room.buildBitsCSS();
		});

		this.context.on('changed:chat.filtering.need-colors', async val => {
			if ( val )
				await this.createColorCache();
			else
				this.color_cache = null;

			this.emit(':update-line-tokens');
		});

		this.context.on('changed:chat.filtering.all-mentions', () => this.emit(':update-line-tokens'));
		this.context.on('changed:chat.filtering.color-mentions', () => this.emit(':update-line-tokens'));
	}


	async createColorCache() {
		const LRUCache = await require(/* webpackChunkName: 'utils' */ 'mnemonist/lru-cache');
		this.color_cache = new LRUCache(150);
	}


	generateLog() {
		const out = ['chat settings', '-------------------------------------------------------------------------------'];
		for(const [key, value] of this.context.__cache.entries())
			out.push(`${key}: ${JSON.stringify(value)}`);

		return out.join('\n');
	}


	getAddonProxy(addon_id, addon, module) {
		if ( ! addon_id )
			return this;

		const is_dev = DEBUG || addon?.dev,
			id_checker = makeAddonIdChecker(addon_id);

		const overrides = {},
			warnings = {};

		const user_proxy = buildAddonProxy(module, null, 'getUser()', {
			addBadge: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().addBadge() did not include addon ID in provider:', provider);

				return this.addBadge(provider, ...args);
			} : undefined,

			removeBadge: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().removeBadge() did not include addon ID in provider:', provider);

				return this.removeBadge(provider, ...args);
			} : undefined,

			addSet(provider, set_id, data) {
				if ( is_dev && ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().addSet() did not include addon ID in provider:', provider);

				if ( ! this.manager.emotes.providers.has(provider) ) {
					this.manager.emotes.inferProvider(provider, addon_id);
					if ( is_dev )
						module.log.warn('[DEV-CHECK] Call to getUser().addSet() for provider that has not been registered with emotes.setProvider:', provider);
				}

				if ( data ) {
					if ( is_dev && ! id_checker.test(set_id) )
						module.log.warn('[DEV-CHECK] Call to getUser().addSet() loaded set data but did not include addon ID in set ID:', set_id);
					data.__source = addon_id;
				}

				return this.addSet(provider, set_id, data);
			},

			removeAllSets: is_dev ? function(provider) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().removeAllSets() did not include addon ID in provider:', provider);

				return this.removeAllSets(provider);
			} : undefined,

			removeSet: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().removeSet() did not include addon ID in provider:', provider);

				return this.removeSet(provider, ...args);
			} : undefined

		}, is_dev ? {
			badges: 'Please use addBadge(), getBadge(), or removeBadge()',
			emote_sets: 'Please use addSet(), removeSet(), or removeAllSets()',
			room: true
		} : null, true);

		const room_proxy = buildAddonProxy(module, null, 'getRoom()', {
			getUser(...args) {
				const result = this.getUser(...args);
				if ( result )
					return new Proxy(result, user_proxy);
			},

			addSet(provider, set_id, data) {
				if ( is_dev && ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getRoom().addSet() did not include addon ID in provider:', provider);

				if ( ! this.manager.emotes.providers.has(provider) ) {
					this.manager.emotes.inferProvider(provider, addon_id);
					if ( is_dev )
						module.log.warn('[DEV-CHECK] Call to getRoom().addSet() for provider that has not been registered with emotes.setProvider:', provider);
				}

				if ( data ) {
					if ( is_dev && ! id_checker.test(set_id) )
						module.log.warn('[DEV-CHECK] Call to getRoom().addSet() loaded set data but did not include addon ID in set ID:', set_id);
					data.__source = addon_id;
				}

				return this.addSet(provider, set_id, data);
			},

			removeAllSets: is_dev ? function(provider) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getRoom().removeAllSets() did not include addon ID in provider:', provider);

				return this.removeAllSets(provider);
			} : undefined,

			removeSet: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getRoom().removeSet() did not include addon ID in provider:', provider);

				return this.removeSet(provider, ...args);
			} : undefined

		}, {
			badges: true,
			load_data: true,
			emote_sets: 'Please use addSet(), removeSet(), or removeAllSets()',
			refs: 'Please use ref() or unref()',
			style: true,
			users: 'Please use getUser()',
			user_ids: 'Please use getUser()'
		}, true);

		overrides.iterateUsers = function*() {
			for(const user of this.iterateUsers())
				yield new Proxy(user, user_proxy);
		}

		overrides.iterateRooms = function*() {
			for(const room of this.iterateRooms())
				yield new Proxy(room, room_proxy);
		}

		overrides.iterateAllRoomsAndUsers = function*() {
			for(const thing of this.iterateAllRoomsAndUsers())
				yield new Proxy(thing, (thing instanceof Room)
					? room_proxy
					: user_proxy
				);
		}

		overrides.addTabCommandPrefix = (prefix, provider = null) => {
			if ( provider == null )
				provider = addon_id;
			if ( is_dev && provider !== addon_id )
				module.log.warn('[DEV-CHECK] Used addTabCommandPrefix with incorrect provider.');

			return this.addTabCommandPrefix(prefix, provider);
		}

		overrides.removeTabCommandPrefix = (prefix, provider = null) => {
			if ( provider == null )
				provider = addon_id;
			if ( is_dev && provider !== addon_id )
				module.log.warn('[DEV-CHECK] Used removeTabCommandPrefix with incorrect provider.');

			return this.removeTabCommandPrefix(prefix, provider);
		}

		overrides.addTokenizer = tokenizer => {
			if ( tokenizer )
				tokenizer.__source = addon_id;

			return this.addTokenizer(tokenizer);
		}

		overrides.addLinkProvider = provider => {
			if ( provider )
				provider.__source = addon_id;

			return this.addLinkProvider(provider);
		}

		overrides.addRichProvider = provider => {
			if ( provider )
				provider.__source = addon_id;

			return this.addRichProvider(provider);
		}

		if ( is_dev ) {
			overrides.getUser = (...args) => {
				let result = this.getUser(...args);
				if ( result )
					return new Proxy(result, user_proxy);
			}

			overrides.getRoom = (...args) => {
				let result = this.getRoom(...args);
				if ( result )
					return new Proxy(result, room_proxy);
			}

			overrides.removeTokenizer = tokenizer => {
				let type;
				if ( typeof tokenizer === 'string' )
					type = tokenizer;
				else
					type = tokenizer.type;

				const existing = this.tokenizers[type];
				if ( existing && existing.__source !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned tokenizer with chat.removeTokenizer:', type, ' owner:', existing.__source ?? 'ffz');

				return this.removeTokenizer(tokenizer);
			}

			overrides.removeLinkProvider = provider => {
				let type;
				if ( typeof provider === 'string' )
					type = provider;
				else
					type = provider.type;

				const existing = this.link_providers[type];
				if ( existing && existing.__source !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned link provider with chat.removeLinkProvider:', type, ' owner:', existing.__source ?? 'ffz');

				return this.removeLinkProvider(provider);
			}

			overrides.removeRichProvider = provider => {
				let type;
				if ( typeof provider === 'string' )
					type = provider;
				else
					type = provider.type;

				const existing = this.link_providers[type];
				if ( existing && existing.__source !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned rich provider with chat.removeRichProvider:', type, ' owner:', existing.__source ?? 'ffz');

				return this.removeRichProvider(provider);
			}
		}

		return buildAddonProxy(module, this, 'chat', overrides, warnings);
	}



	onEnable() {
		this.socket = this.resolve('socket');
		this.pubsub = this.resolve('pubsub');

		this.settings.provider.on('changed', this.onProviderChange, this);

		this.on('site.subpump:pubsub-message', this.onPubSub, this);
		this.on('chat.emotes:update-priorities', fn => {
			for(const thing of this.iterateAllRoomsAndUsers()) {
				if (thing.emote_sets)
					thing.emote_sets.setSortFunction(fn);
			}
		});

		if ( this.context.get('chat.filtering.need-colors') )
			this.createColorCache().then(() => this.emit(':update-line-tokens'));

		for(const key in TOKENIZERS)
			if ( has(TOKENIZERS, key) )
				this.addTokenizer(TOKENIZERS[key]);

		for(const key in RICH_PROVIDERS)
			if ( has(RICH_PROVIDERS, key) )
				this.addRichProvider(RICH_PROVIDERS[key]);

		for(const key in LINK_PROVIDERS)
			if ( has(LINK_PROVIDERS, key) )
				this.addLinkProvider(LINK_PROVIDERS[key]);

		this.on('chat:reload-data', flags => {
			for(const room of this.iterateRooms())
				room.load_data();
		});

		this.on('chat:get-tab-commands', event => {
			event.commands.push({
				name: 'ffz:reload',
				description: this.i18n.t('chat.command.reload', 'Reload FFZ and add-on chat data (emotes, badges, etc.)'),
				permissionLevel: 0,
				ffz_group: 'FrankerFaceZ'
			});
		});

		this.triggered_reload = false;

		this.on('chat:ffz-command:reload', event => {
			if ( this.triggered_reload )
				return;

			const sc = this.resolve('site.chat');
			if ( sc?.addNotice )
				sc.addNotice('*', this.i18n.t('chat.command.reload.starting', 'FFZ is reloading data...'));

			this.triggered_reload = true;
			this.emit('chat:reload-data');
		});

		this.on('load_tracker:complete:chat-data', (list) => {
			if ( this.triggered_reload ) {
				const sc = this.resolve('site.chat');
				if ( sc?.addNotice )
					sc.addNotice('*', this.i18n.t('chat.command.reload.done', 'FFZ has finished reloading data. (Sources: {list})', {list: list.join(', ')}));
			}

			this.triggered_reload = false;
		});

		this.on('addon:fully-unload', addon_id => {
			let removed = 0;
			for(const [key, def] of Object.entries(this.link_providers)) {
				if ( def?.__source === addon_id ) {
					removed++;
					this.removeLinkProvider(key);
				}
			}

			for(const [key, def] of Object.entries(this.rich_providers)) {
				if ( def?.__source === addon_id ) {
					removed++;
					this.removeRichProvider(key);
				}
			}

			for(const [key, def] of Object.entries(this.tokenizers)) {
				if ( def?.__source === addon_id ) {
					removed++;
					this.removeTokenizer(key);
				}
			}

			this.CommandPrefixes.delete(addon_id);

			for(const item of this.iterateAllRoomsAndUsers())
				removed += item._unloadAddon(addon_id) ?? 0;

			// If we removed things, retokenize all chat messages.
			// TODO: Debounce this.
			if ( removed ) {
				this.log.debug(`Cleaned up ${removed} entries when unloading addon:`, addon_id);
				this.emit(':update-line-tokens');
			}
		});
	}


	onPubSub(event) {
		if ( event.prefix === 'stream-chat-room-v1' && event.message.type === 'chat_rich_embed' ) {
			const data = event.message.data,
				url = data.request_url,

				providers = this.__link_providers;

			// Don't re-cache.
			if ( this._link_info[url] )
				return;

			for(const provider of providers) {
				const match = provider.test.call(this, url);
				if ( match ) {
					const processed = provider.receive ? provider.receive.call(this, match, data) : data;
					let result = provider.process.call(this, match, processed);

					if ( !(result instanceof Promise) )
						result = Promise.resolve(result);

					result.then(value => {
						// If something is already running, don't override it.
						let info = this._link_info[url];
						if ( info )
							return;

						// Save the value.
						this._link_info[url] = [true, Date.now() + 120000, value];
					});

					return;
				}
			}
		}
	}


	getUser(id, login, no_create, no_login, error = false) {
		let user;
		if ( id && typeof id === 'number' )
			id = `${id}`;

		if ( id && this.user_ids[id] )
			user = this.user_ids[id];

		else if ( login && this.users[login] && ! no_login )
			user = this.users[login];

		if ( user && user.destroyed )
			user = null;

		if ( ! user ) {
			if ( no_create )
				return null;
			else
				user = new User(this, null, id, login);
		}

		if ( id && id !== user.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes.
			if ( user.id ) {
				this.log.warn(`Data mismatch for user #${id} -- Stored ID: ${user.id} -- Login: ${login} -- Stored Login: ${user.login}`);
				if ( error )
					throw new Error('id mismatch');

				// Remove the old reference if we're going with this.
				if ( this.user_ids[user.id] === user )
					this.user_ids[user.id] = null;
			}

			// Otherwise, we're just here to set the ID.
			user._id = id;
			this.user_ids[id] = user;
		}

		if ( login ) {
			const other = this.users[login];
			if ( other ) {
				if ( other !== user && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.users[login] = user;
					else {
						user.merge(other);
						other.destroy(true);
					}
				}
			} else
				this.users[login] = user;
		}

		return user;
	}


	getRoom(id, login, no_create, no_login, error = false) {
		let room;
		if ( id && typeof id === 'number' )
			id = `${id}`;

		if ( id && this.room_ids[id] )
			room = this.room_ids[id];

		else if ( login && this.rooms[login] && ! no_login )
			room = this.rooms[login];

		if ( room && room.destroyed )
			room = null;

		if ( ! room ) {
			if ( no_create )
				return null;
			else
				room = new Room(this, id, login);
		}

		if ( id && id !== room.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes. Or React not being atomic.
			if ( room.id ) {
				this.log.warn(`Data mismatch for room #${id} -- Stored ID: ${room.id} -- Login: ${login} -- Stored Login: ${room.login}`);
				if ( error )
					throw new Error('id mismatch');

				// Remove the old reference if we're going with this.
				if ( this.room_ids[room.id] === room )
					this.room_ids[room.id] = null;
			}

			// Otherwise, we're just here to set the ID.
			room._id = id;
			this.room_ids[id] = room;
		}

		if ( login ) {
			const other = this.rooms[login];
			if ( other ) {
				if ( other !== room && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.rooms[login] = room;
					else {
						room.merge(other);
						other.destroy(true);
					}
				}

			} else
				this.rooms[login] = room;
		}

		return room;
	}


	*iterateAllRoomsAndUsers() {
		for(const room of this.iterateRooms()) {
			yield room;
			for(const user of room.iterateUsers())
				yield user;
		}

		for(const user of this.iterateUsers())
			yield user;
	}


	*iterateUsers() {
		const visited = new Set;

		for(const user of Object.values(this.user_ids)) {
			if ( user && ! user.destroyed ) {
				visited.add(user);
				yield user;
			}
		}

		for(const user of Object.values(this.users)) {
			if ( user && ! user.destroyed )
				yield user;
		}
	}


	*iterateRooms() {
		const visited = new Set;

		for(const room of Object.values(this.room_ids)) {
			if ( room && ! room.destroyed ) {
				visited.add(room);
				yield room;
			}
		}

		for(const room of Object.values(this.rooms)) {
			if ( room && ! room.destroyed && ! visited.has(room) )
				yield room;
		}
	}


	iterateMessages(include_chat = true, include_whisper = true, include_video = true) {
		const messages = [];
		this.emit('chat:get-messages', include_chat, include_whisper, include_video, messages);
		this.emit('chat:get-messages-late', include_chat, include_whisper, include_video, messages);
		return messages;
	}


	handleLinkClick(event) {
		if ( event.ctrlKey || event.shiftKey )
			return;

		const target = event.currentTarget,
			ds = target?.dataset;

		if ( ! ds )
			return;

		const evt = this.makeEvent({
			url: ds.url ?? target.href,
			source: event
		});

		this.emit('chat:click-link', evt);
		if ( evt.defaultPrevented ) {
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
	}


	handleReplyClick(event) {
		const target = event.target,
			fine = this.resolve('site.fine');

		if ( ! target || ! fine )
			return;

		const chat = fine.searchParent(target, n => n.props && n.props.reply && n.setOPCardTray);
		if ( chat )
			chat.setOPCardTray(chat.props.reply);
	}


	handleMentionClick(event) {
		if ( ! this.context.get('chat.filtering.clickable-mentions') )
			return;

		const target = event.target,
			ds = target && target.dataset;

		if ( ! ds || ! ds.login )
			return;

		const fine = this.resolve('site.fine');
		if ( ! fine )
			return;

		const chat = fine.searchParent(target, n => n.props && n.props.onUsernameClick);
		if ( ! chat )
			return;

		chat.props.onUsernameClick(
			ds.login,
			undefined, undefined,
			event.currentTarget.getBoundingClientRect().bottom
		);
	}


	clickToReveal(event) {
		const target = event.target;
		if ( target ) {
			if ( target._ffz_visible )
				target.textContent = '×××';
			else if ( ! this.context.get('chat.filtering.click-to-reveal') )
				return;
			else if ( target.dataset )
				target.textContent = target.dataset.text;

			target._ffz_visible = ! target._ffz_visible;
		}
	}


	standardizeWhisper(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		if ( msg._ffz_message )
			return msg._ffz_message;

		const emotes = {},
			is_action = msg.content.startsWith('/me '),
			offset = is_action ? 4 : 0,

			out = msg._ffz_message = {
				id: msg.id,
				user: {...msg.from}, // Apollo seals this~
				message: msg.content.slice(offset),
				is_action,
				ffz_emotes: emotes,
				timestamp: msg.sentAt && msg.sentAt.getTime(),
				deleted: false,
				toJSON: () => null
			};

		out.user.color = out.user.chatColor;

		if ( Array.isArray(msg.emotes) && msg.emotes.length )
			for(const emote of msg.emotes) {
				const id = emote.emoteID,
					em = emotes[id] = emotes[id] || [];

				em.push({
					startIndex: emote.from - offset,
					endIndex: emote.to - offset
				});
			}

		return out;
	}


	getUserLevel(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg || ! msg.user )
			return 0;

		if ( msg.user.login === msg.roomLogin || (msg.badges && msg.badges.broadcaster) )
			return 5;

		if ( ! msg.badges )
			return 0;

		if ( msg.badges.lead_moderator )
			return 4;

		if ( msg.badges.moderator )
			return 3;

		if ( msg.badges.vip )
			return 2;

		if ( msg.badges.subscriber )
			return 1;

		return 0;
	}


	tokenizeReply(reply) {
		if ( ! reply )
			return null;

		const out = [
			{
				type: 'reply',
				text: reply.parentDisplayName,
				color: (this.context.get('chat.filtering.color-mentions') && this.color_cache)
					? this.color_cache.get(reply.parentUserLogin)
					: null,
				recipient: reply.parentUserLogin
			},
			{
				type: 'text',
				text: ' '
			}
		];

		out.toJSON = () => null;
		return out;
	}


	applyHighlight(msg, priority, color, reason, use_null_color = false) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		const is_null = msg.mention_priority == null,
			matched = is_null || priority >= msg.mention_priority,
			higher = is_null || priority > msg.mention_priority;

		if ( msg.filters )
			msg.filters.push(`${reason}(${priority})${matched && color === false ? ':remove' : color ? `:${color}` : ''}`);

		if ( matched ) {
			msg.mention_priority = priority;

			if ( color === false ) {
				if ( higher ) {
					msg.mentioned = false;
					msg.clear_priority = priority;
					msg.mention_color = msg.highlights = null;
				}

				return;
			}

			msg.mentioned = true;
			if ( ! msg.highlights )
				msg.highlights = new Set;
		}

		if ( msg.mentioned && (msg.clear_priority == null || priority >= msg.clear_priority) ) {
			msg.highlights.add(reason);
			if ( (color || use_null_color) && (higher || ! msg.mention_color) )
				msg.mention_color = color;
		}
	}


	standardizeMessage(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		msg.ffz_standardized = true;

		// Standardize User
		if ( msg.sender && ! msg.user )
			msg.user = msg.sender;

		if ( msg.from && ! msg.user )
			msg.user = msg.from;

		let user = msg.user;
		if ( ! user )
			user = msg.user = {};

		const ext = msg.extension || {};

		user.color = user.color || user.chatColor || ext.chatColor || null;
		user.type = user.type || user.userType || null;
		user.id = user.id || user.userID || null;
		user.login = user.login || user.userLogin || null;
		user.displayName = user.displayName || user.userDisplayName || user.login || ext.displayName;
		user.isIntl = user.login && user.displayName && user.displayName.trim().toLowerCase() !== user.login;

		if ( this.color_cache && user.color )
			this.color_cache.set(user.login, user.color);

		// gif support
		if ( Array.isArray(msg.messageParts) && msg.messageParts.length === 1 ) {
			const part = msg.messageParts[0],
				content = part && (part.ffz_content ?? part.content);

			if ( content && content.id && content.url && content.title != null )
				msg.ffz_gif = {
					id: content.id,
					url: content.url,
					title: content.title
				};
		}

		// Standardize Message Content
		if ( ! msg.message && msg.messageParts )
			this.detokenizeMessage(msg);

		if ( msg.content && ! msg.message ) {
			if ( msg.content.fragments )
				this.detokenizeContent(msg);
			else
				msg.message = msg.content.text;
		}

		// Standardize Emotes
		if ( ! msg.ffz_emotes )
			this.standardizeEmotes(msg);

		// Standardize Badges
		if ( ! msg.badges && user.displayBadges ) {
			const b = msg.badges = {};
			for(const item of user.displayBadges)
				b[item.setID] = item.version;
		}

		if ( ! msg.badges && ext.displayBadges ) {
			const b = msg.badges = {};
			for(const item of ext.displayBadges)
				b[item.setID] = item.version;
		}

		// Validate User Type
		if ( user.type == null && msg.badges && msg.badges.moderator )
			user.type = 'mod';

		// Standardize Timestamp
		if ( ! msg.timestamp && msg.sentAt )
			msg.timestamp = new Date(msg.sentAt).getTime();

		// Standardize Deletion
		if ( msg.deletedAt !== undefined )
			msg.deleted = !!msg.deletedAt;

		// Addon Badges
		msg.ffz_badges = msg.sourceRoomID
			? this.badges.getBadges(user.id, user.login, msg.sourceRoomID, null)
			: this.badges.getBadges(user.id, user.login, msg.roomID, msg.roomLogin);

		return msg;
	}


	standardizeEmotes(msg) { // eslint-disable-line class-methods-use-this
		if ( msg.emotes && msg.message ) {
			const emotes = {},
				chars = split_chars(msg.message);

			let offset = 0;
			if ( msg.message && msg.messageBody && msg.message !== msg.messageBody )
				offset = chars.length - split_chars(msg.messageBody).length;

			for(const key in msg.emotes)
				if ( has(msg.emotes, key) ) {
					const raw_emote = msg.emotes[key];
					if ( Array.isArray(raw_emote) )
						return msg.ffz_emotes = msg.emotes;

					const em = emotes[raw_emote.id] = emotes[raw_emote.id] || [];
					let idx = raw_emote.startIndex + 1 + offset;
					while(idx < chars.length) {
						if ( EMOTE_CHARS.test(chars[idx]) )
							break;

						idx++;
					}

					em.push({
						startIndex: raw_emote.startIndex + offset,
						endIndex: idx - 1
					});
				}

			msg.ffz_emotes = emotes;
			return;
		}

		if ( msg.messageParts )
			this.detokenizeMessage(msg, true);

		else if ( msg.content && msg.content.fragments )
			this.detokenizeContent(msg, true);
	}


	detokenizeContent(msg, emotes_only = false) { // eslint-disable-line class-methods-use-this
		const out = [],
			parts = msg.content.fragments,
			l = parts.length,
			emotes = {};

		let idx = 0, ret, first = true;

		for(let i=0; i < l; i++) {
			const part = parts[i],
				content = part.content,
				ct = content && content.__typename;

			ret = part.text;

			if ( ct === 'Emote' ) {
				const id = content.emoteID,
					em = emotes[id] = emotes[id] || [];

				em.push({startIndex: idx, endIndex: idx + ret.length - 1});
			}

			if ( ret && ret.length ) {
				if ( first && ret.startsWith('/me ') ) {
					msg.is_action = true;
					ret = ret.slice(4);
				}

				idx += split_chars(ret).length;
				out.push(ret);
			}

			first = false;
		}

		if ( ! emotes_only )
			msg.message = out.join('');

		msg.ffz_emotes = emotes;
		return msg;
	}


	detokenizeMessage(msg, emotes_only = false) { // eslint-disable-line class-methods-use-this
		const out = [],
			parts = msg.messageParts,
			l = parts.length,
			emotes = {};

		let idx = 0, ret, last_type = null, bits = 0;

		for(let i=0; i < l; i++) {
			const part = parts[i],
				content = part.ffz_content ?? part.content;

			if ( ! content )
				continue;

			if ( typeof content === 'string' )
				ret = content;

			else if ( content.recipient )
				ret = `@${content.recipient}`;

			else if ( content.url )
				ret = content.url;

			else if ( content.cheerAmount ) {
				bits += content.cheerAmount;
				ret = `${content.alt}${content.cheerAmount}`;

			} else if ( content.images ) {
				const url = (content.images.themed ? content.images.dark : content.images.sources);
				let id = content.emoteID;
				if ( ! id ) {
					const match = url && (
						/\/emoticons\/v1\/(\d+)\/[\d.]+$/.exec(url['1x']) ||
						/\/emoticons\/v2\/(\d+)\//.exec(url['1x'])
					);
					id = match && match[1];
				}

				ret = content.alt;

				if ( id ) {
					const em = emotes[id] = emotes[id] || [],
						offset = last_type > 0 ? 1 : 0;

					em.push({startIndex: idx + offset, endIndex: idx + ret.length - 1});
				}

				if ( last_type > 0 )
					ret = ` ${ret}`;

			} else
				continue;

			if ( ret ) {
				idx += split_chars(ret).length;
				last_type = part.type;
				out.push(ret)
			}
		}

		if ( ! emotes_only )
			msg.message = out.join('');

		msg.bits = bits;
		msg.ffz_emotes = emotes;
		return msg;
	}


	/**
	 * Format a user block. This uses our use "chat.name-format" style.
	 *
	 * @param {Object} user The user object we're rendering.
	 * @param {Function} e createElement method, either from React or utilities/dom.
	 * @returns {Array} Array of rendered elements.
	 */
	formatUser(user, e) {
		const setting = this.context.get('chat.name-format');
		const name = setting === 2 && user.isIntl ? user.login : (user.displayName || user.login);

		const out = [e('span', {
			className: 'chat-author__display-name'
		}, name)];

		if ( setting === 0 && user.isIntl )
			out.push(e('span', {
				className: 'chat-author__intl-login'
			}, ` (${user.login})`));

		return out;
	}


	formatTime(time) {
		if (!( time instanceof Date ))
			time = new Date(time);

		const fmt = this.context.get('chat.timestamp-format'),
			d = dayjs(time);

		try {
			return d.locale(this.i18n.locale).format(fmt);
		} catch(err) {
			// If the locale isn't loaded, this can fail.
			return d.format(fmt);
		}
	}


	addHighlightReason(key, data, label) {
		if ( typeof key === 'object' && key.key ) {
			data = key;
			key = data.key;

		} else if ( typeof data === 'string' )
			data = {title: data};

		if ( typeof label === 'string' && label.length > 0 )
			data.label = label;

		data.value = data.key = key;
		if ( ! data.i18n_key )
			data.i18n_key = `hl-reason.${key}`;

		if ( data.label && ! data.i18n_label )
			data.i18n_label = `${data.i18n_key}.label`;

		if ( this._hl_reasons[key] )
			throw new Error(`Highlight Reason already exists with key ${key}`);

		this._hl_reasons[key] = data;
	}

	getHighlightReason(key) {
		return this._hl_reasons[key] ?? null;
	}

	getHighlightReasons() {
		return Object.values(this._hl_reasons);
	}

	addTabCommandPrefix(prefix, source = 'ffz') {
		if ( ! Array.isArray(prefix) )
			prefix = [prefix];

		for(const item of prefix) {
			if ( typeof item !== 'string' || item.length !== 1 )
				throw new Error('Invalid command prefix. Must be string of length 1.');

			this.CommandPrefixes.push(source, item);
		}
	}

	removeTabCommandPrefix(prefix, source = 'ffz') {
		if ( ! Array.isArray(prefix) )
			prefix = [prefix];

		for(const item of prefix)
			this.CommandPrefixes.remove(source, item);
	}

	addTokenizer(tokenizer) {
		const type = tokenizer.type;
		if ( has(this.tokenizers, type) ) {
			this.log.warn(`Tried adding tokenizer of type '${type}' when one was already present.`);
			return;
		}

		this.tokenizers[type] = tokenizer;
		if ( tokenizer.priority == null )
			tokenizer.priority = 0;

		if ( tokenizer.tooltip ) {
			const tt = tokenizer.tooltip;
			const tk = this.tooltips.types[type] = tt.bind(this);

			for(const i of ['interactive', 'delayShow', 'delayHide', 'onShow', 'onHide'])
				tk[i] = typeof tt[i] === 'function' ? tt[i].bind(this) : tt[i];
		}

		this.__tokenizers.push(tokenizer);
		this.__tokenizers.sort((a, b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});
	}

	removeTokenizer(tokenizer) {
		let type;
		if ( typeof tokenizer === 'string' ) type = tokenizer;
		else type = tokenizer.type;

		tokenizer = this.tokenizers[type];
		if ( ! tokenizer )
			return null;

		delete this.tokenizers[type];

		if ( tokenizer.tooltip )
			delete this.tooltips.types[type];

		const idx = this.__tokenizers.indexOf(tokenizer);
		if ( idx !== -1 )
			this.__tokenizers.splice(idx, 1);

		return tokenizer;
	}

	addLinkProvider(provider) {
		const type = provider.type;
		if ( has(this.link_providers, type) ) {
			this.log.warn(`Tried adding link provider of type '${type}' when one was already present.`);
			return;
		}

		this.link_providers[type] = provider;
		if ( provider.priority == null )
			provider.priority = 0;

		this.__link_providers.push(provider);
		this.__link_providers.sort((a,b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});
	}

	removeLinkProvider(provider) {
		let type;
		if ( typeof provider === 'string' ) type = provider;
		else type = provider.type;

		provider = this.link_providers[type];
		if ( ! provider )
			return null;

		delete this.link_providers[type];

		const idx = this.__link_providers.indexOf(provider);
		if ( idx !== -1 )
			this.__link_providers.splice(idx, 1);

		return provider;
	}

	addRichProvider(provider) {
		const type = provider.type;
		if ( has(this.rich_providers, type) ) {
			this.log.warn(`Tried adding rich provider of type '${type}' when one was already present.`);
			return;
		}

		this.rich_providers[type] = provider;
		if ( provider.priority == null )
			provider.priority = 0;

		this.__rich_providers.push(provider);
		this.__rich_providers.sort((a,b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});
	}

	removeRichProvider(provider) {
		let type;
		if ( typeof provider === 'string' ) type = provider;
		else type = provider.type;

		provider = this.rich_providers[type];
		if ( ! provider )
			return null;

		delete this.rich_providers[type];

		const idx = this.__rich_providers.indexOf(provider);
		if ( idx !== -1 )
			this.__rich_providers.splice(idx, 1);

		return provider;
	}


	tokenizeString(message, msg, user, haltable = false) {
		let tokens = [{type: 'text', text: message}];

		for(const tokenizer of this.__tokenizers) {
			if ( ! tokenizer.process )
				continue;

			const new_tokens = tokenizer.process.call(this, tokens, msg, user, haltable);
			if ( new_tokens )
				tokens = new_tokens;

			if ( haltable && msg.ffz_halt_tokens ) {
				msg.ffz_halt_tokens = undefined;
				break;
			}
		}

		return tokens;
	}


	pluckLastEmote(tokens) {
		if ( ! Array.isArray(tokens) )
			return;

		let i = tokens.length;
		while(i--) {
			const token = tokens[i];
			if (token.type === 'emote' && token.provider !== 'emoji') {
				if ( this.context.get('chat.emotes.allow-gigantify') ) {
					token.gigantify = true;
					token.hidden = true;
					return token;
				} else {
					if (token.gigantify)
						token.hidden = false;
					return null;
				}
			} else if (token.hidden)
				continue;
		}
	}


	pluckRichContent(tokens, msg) { // eslint-disable-line class-methods-use-this
		if ( ! this.context.get('chat.rich.enabled') || this.context.get('chat.rich.minimum-level') > this.getUserLevel(msg) )
			return;

		if ( ! Array.isArray(tokens) )
			return;

		const providers = this.__rich_providers;

		const want_mid = this.context.get('chat.rich.want-mid');

		for(const token of tokens) {
			if ( token.allow_rich ?? true )
				for(const provider of providers)
					if ( provider.test.call(this, token, msg) ) {
						token.hidden = provider.can_hide_token && (this.context.get('chat.rich.hide-tokens') || provider.hide_token);
						return provider.process.call(this, token, want_mid);
					}
		}
	}


	tokenizeMessage(msg, user, haltable = false) {
		if ( msg.content && ! msg.message )
			msg.message = msg.content.text;

		if ( msg.sender && ! msg.user )
			msg.user = msg.sender;

		if ( ! msg.message )
			return [];

		let tokens = [{type: 'text', text: msg.message}];

		for(const tokenizer of this.__tokenizers) {
			if ( ! tokenizer.process )
				continue;

			const new_tokens = tokenizer.process.call(this, tokens, msg, user, haltable);
			if ( new_tokens )
				tokens = new_tokens;

			if ( haltable && msg.ffz_halt_tokens ) {
				msg.ffz_halt_tokens = undefined;
				break;
			}
		}

		tokens = tokens || [];
		tokens.toJSON = () => null

		return tokens;
	}


	renderGiantEmote(token, e) {
		if ( ! e )
			e = createElement;

		const animated = token.anim === 1,
			hover_animated = token.anim === 2;

		let src, hoverSrc, height;
		if (token.provider === 'twitch') {
			src = getTwitchEmoteURL(token.id, 4, animated, true);
			if (hover_animated)
				hoverSrc = getTwitchEmoteURL(token.id, 4, true, true);
			height = 112;

		} else if (token.provider === 'ffz') {
			const emote_set = this.emotes.emote_sets[token.set],
				emote = emote_set?.emotes?.[token.id];

			if ( emote ) {
				let urls = (animated ? emote.animated : null) ?? emote.urls;
				let pair = getBiggestImage(urls);
				if (! pair )
					return null;

				src = pair[0];
				height = emote.height * pair[1];

				if (hover_animated && emote.animated) {
					pair = getBiggestImage(emote.animated);
					if (pair)
						hoverSrc = pair[0];
				}
			}

		} else
			src = null;

		if ( ! src )
			return null;

		return e('img', {
			className: `chat-image chat-line__message--emote ffz--pointer-events ffz-tooltip${hoverSrc ? ' ffz-hover-emote' : ''}${token.provider === 'twitch' ? ' twitch-emote' : token.provider === 'ffz' ? ' ffz-emote' : token.provider === 'emoji' ? ' ffz-emoji' : ''}`,
			src,
			height: `${height}px`,
			alt: token.text,
			'data-normal-src': src,
			'data-hover-src': hoverSrc,
			'data-tooltip-type': 'emote',
			'data-provider': token.provider,
			'data-id': token.id,
			'data-set': token.set,
			'data-code': token.code,
			'data-variant': token.variant,
			onClick: this.emotes.handleClick
		});
	}


	renderTokens(tokens, e, reply) {
		if ( ! e )
			e = createElement;

		const out = [],
			tokenizers = this.tokenizers,
			l = tokens.length;

		const hidden = this.context.get('chat.filtering.hidden-tokens');

		for(let i=0; i < l; i++) {
			const token = tokens[i],
				type = token.type,
				tk = tokenizers[type];

			if ( token.hidden || hidden.has(type) )
				continue;

			let res;

			// If we have a reply, skip the initial mention.
			if ( reply && i === 0 && type === 'mention' && token.recipient && token.recipient === reply.parentUserLogin )
				continue;

			if ( type === 'text' )
				res = e('span', {
					className: 'text-fragment',
					'data-a-target': 'chat-message-text'
				}, token.text);

			else if ( tk )
				res = tk.render.call(this, token, e, reply);

			else
				res = e('em', {
					className: 'ffz-unknown-token ffz-tooltip',
					'data-tooltip-type': 'json',
					'data-data': JSON.stringify(token, null, 2)
				}, `[unknown token: ${type}]`)

			if ( res )
				out.push(res);
		}

		return out;
	}


	// ====
	// Twitch Crap
	// ====

	clearLinkCache(url) {
		if ( url ) {
			const info = this._link_info[url];
			if ( ! info[0] ) {
				for(const pair of info[2])
					pair[1]();
			}

			this._link_info[url] = null;
			this.emit(':update-link-resolver', url);
			return;
		}

		const old = this._link_info;
		this._link_info = {};

		for(const info of Object.values(old)) {
			if ( ! info[0] ) {
				for(const pair of info[2])
					pair[1]();
			}
		}

		this.emit(':update-link-resolver');
	}


	get_link_info(url, no_promises, refresh = false) {
		let info = this._link_info[url];
		const expires = info && info[1];

		if ( (info && info[0] && refresh) || (expires && Date.now() > expires) )
			info = this._link_info[url] = null;

		if ( info && info[0] ) {
			const out = this.handleLinkToS(info[2]);
			return no_promises ? out : Promise.resolve(out);
		}

		if ( no_promises )
			return null;

		else if ( info )
			return new Promise((resolve, reject) => info[2].push([resolve, reject]))

		return new Promise((resolve, reject) => {
			info = this._link_info[url] = [false, null, [[resolve, reject]]];

			const handle = (success, data) => {
				data = this.fixLinkInfo(data);

				const callbacks = ! info[0] && info[2];
				info[0] = true;
				info[1] = Date.now() + 120000;
				info[2] = success ? data : null;

				data = this.handleLinkToS(data);

				if ( callbacks )
					for(const cbs of callbacks)
						cbs[success ? 0 : 1](data);
			}

			// Try using a link provider.
			for(const lp of this.__link_providers) {
				const match = lp.test.call(this, url);
				if ( match ) {
					timeout(lp.process.call(this, match), 15000)
						.then(data => handle(true, data))
						.catch(err => handle(false, err));
					return;
				}
			}

			let provider = this.settings.get('debug.link-resolver.source').value;
			if ( provider === 'special:socket' && ! this.socket )
				provider = LINK_DATA_HOSTS.test.value;

			if ( provider === 'special:socket' ) {
				timeout(this.socket.call('get_link', url), 15000)
					.then(data => handle(true, data))
					.catch(err => handle(false, err));
			} else {
				timeout(fetch(`${provider}?url=${encodeURIComponent(url)}`).then(r => r.json()), 15000)
					.then(data => handle(true, data))
					.catch(err => handle(false, err));
			}
		});
	}


	handleLinkToS(data) {
		if ( ! Array.isArray(data?.urls) )
			return data;

		// Check for YouTube
		const agreed = this.settings.provider.get('agreed-tos', []),
			rejected = this.settings.provider.get('declined-tos', []);

		const resolvers = new Set(data.urls.map(x => x.resolver).filter(x => x));
		for(const [key, info] of Object.entries(RESOLVERS_REQUIRE_TOS)) {
			if ( resolvers.has(key) && ! agreed.includes(key) ) {
				const declined = rejected.includes(key);

				return {
					...data,
					url: null,
					short: [
						{
							type: 'box',
							content: [
								info.i18n_key
									? {type: 'i18n', key: info.i18n_key, phrase: info.label}
									: info.label,
								declined ? null : ' ',
								declined ? null : {
									type: 'conditional',
									tooltip: false,
									content: {
										type: 'i18n',
										key: 'embed.tos-open-settings',
										phrase: '{link} to open your settings.',
										content: {
											link: {
												type: 'open_settings',
												item: 'chat.tooltips',
												content: {
													type: 'i18n',
													key: 'embed.tos-open-settings.click',
													phrase: 'Click here'
												}
											}
										}
									},
									alternative: {
										type: 'i18n',
										key: 'embed.tos-settings',
										phrase: 'Open the FFZ Control Center and navigate to Chat > Tooltips to agree.'
									}
								}
							]
						},
					],
					mid: null,
					full: null
				}
			}
		}

		return data;
	}


	agreeToTerms(service) {
		const agreed = this.settings.provider.get('agreed-tos', []);
		if ( agreed.includes(service) )
			return;

		this.settings.provider.set('agreed-tos', [...agreed, service]);
		this.emit(':update-link-resolver');
	}


	declineTerms(service) {
		const declined = this.settings.provider.get('declined-tos', []);
		if ( declined.includes(service) )
			return;

		this.settings.provider.set('declined-tos', [...declined, service]);
		this.emit(':update-link-resolver');
	}

	hasAgreedToTerms(service) {
		const agreed = this.settings.provider.get('agreed-tos');
		return agreed ? agreed.includes(service) : false;
	}

	hasDeclinedTerms(service) {
		const declined = this.settings.provider.get('declined-tos');
		return declined ? declined.includes(service) : false;
	}


	onProviderChange(key, value) {
		if ( key !== 'agreed-tos' && key !== 'declined-tos' )
			return;

		this.emit(':update-link-resolver');
	}


	fixLinkInfo(data) {
		if ( ! data )
			return data;

		if ( data.error && data.message )
			data.error = data.message;

		if ( data.error )
			data = {
				v: 5,
				title: this.i18n.t('card.error', 'An error occurred.'),
				description: data.error,
				short: {
					type: 'header',
					image: {type: 'image', url: ERROR_IMAGE},
					title: {type: 'i18n', key: 'card.error', phrase: 'An error occurred.'},
					subtitle: data.error
				},
				unsafe: data.unsafe,
				urls: data.urls
			}

		if ( data.v < 5 && ! data.short && ! data.full && (data.title || data.desc_1 || data.desc_2) ) {
			const image = data.preview || data.image;

			data = {
				v: 5,
				short: {
					type: 'header',
					image: image ? {
						type: 'image',
						url: image,
						sfw: data.image_safe ?? false,
					} : null,
					title: data.title,
					subtitle: data.desc_1,
					extra: data.desc_2
				}
			}
		}

		return data;
	}
}


function getBiggestImage(urls) {
	if (urls?.[4] )
		return [urls[4], 4];
	if (urls?.[3] )
		return [urls[3], 3];
	if (urls?.[2] )
		return [urls[2], 2];
	if (urls?.[1] )
		return [urls[1], 1];
	return null;
}
