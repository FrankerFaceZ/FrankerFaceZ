'use strict';

// ============================================================================
// Chat
// ============================================================================

import Module from 'utilities/module';
import {createElement, ManagedStyle} from 'utilities/dom';
import {timeout, has, glob_to_regex, escape_regex, split_chars} from 'utilities/object';

import Badges from './badges';
import Emotes from './emotes';
import Emoji from './emoji';

import Room from './room';
import User from './user';
import * as TOKENIZERS from './tokenizers';
import * as RICH_PROVIDERS from './rich_providers';

import Actions from './actions';


export default class Chat extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('i18n');
		this.inject('tooltips');
		this.inject('socket');
		this.inject('experiments');

		this.inject(Badges);
		this.inject(Emotes);
		this.inject(Emoji);
		this.inject(Actions);

		this._link_info = {};

		this.style = new ManagedStyle;

		this.context = this.settings.context({});

		this.rooms = {};
		this.users = {};

		this.room_ids = {};
		this.user_ids = {};

		this.tokenizers = {};
		this.__tokenizers = [];

		this.rich_providers = {};
		this.__rich_providers = [];


		// ========================================================================
		// Settings
		// ========================================================================

		this.settings.add('chat.rich.enabled', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Rich Content',
				title: 'Display rich content in chat.',
				description: 'This displays rich content blocks for things like linked clips and videos.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.rich.hide-tokens', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Rich Content',
				title: 'Hide matching links for rich content.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.scrollback-length', {
			default: 150,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Scrollback Length',
				description: 'Keep up to this many lines in chat. Setting this too high will create lag.',
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val < 1 )
						val = 150;

					return val;
				}
			}
		});


		this.settings.add('chat.filtering.show-deleted', {
			default: false,
			ui: {
				path: 'Chat > Filtering >> Appearance',
				title: 'Always display deleted messages.',
				description: 'Deleted messages will be faded and displayed with a line through the message text.',
				component: 'setting-check-box'
			}
		});


		this.settings.add('chat.filtering.highlight-basic-terms', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Chat > Filtering >> Highlight Terms',
				component: 'basic-terms',
				colored: true
			}
		});


		this.settings.add('chat.filtering.highlight-basic-terms--color-regex', {
			requires: ['chat.filtering.highlight-basic-terms'],
			process(ctx) {
				const val = ctx.get('chat.filtering.highlight-basic-terms');
				if ( ! val || ! val.length )
					return null;

				const colors = new Map;

				for(const item of val) {
					const c = item.c || null,
						t = item.t;

					let v = item.v, word = true;

					if ( t === 'glob' )
						v = glob_to_regex(v);

					else if ( t === 'raw' )
						word = false;

					else if ( t !== 'regex' )
						v = escape_regex(v);

					if ( ! v || ! v.length )
						continue;

					try {
						new RegExp(v);
					} catch(err) {
						continue;
					}

					if ( colors.has(c) )
						colors.get(c)[word ? 0 : 1].push(v);
					else {
						const vals = [[],[]];
						colors.set(c, vals);
						vals[word ? 0 : 1].push(v);
					}
				}

				for(const [key, list] of colors) {
					if ( list[0].length )
						list[1].push(`\\b(?:${list[0].join('|')})\\b`);

					colors.set(key, new RegExp(list[1].join('|'), 'gi'));
				}

				return colors;
			}
		});


		this.settings.add('chat.filtering.highlight-basic-blocked', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Chat > Filtering >> Blocked Terms',
				component: 'basic-terms'
			}
		});


		this.settings.add('chat.filtering.highlight-basic-blocked--regex', {
			requires: ['chat.filtering.highlight-basic-blocked'],
			process(ctx) {
				const val = ctx.get('chat.filtering.highlight-basic-blocked');
				if ( ! val || ! val.length )
					return null;

				const out = [[], []];

				for(const item of val) {
					const t = item.t;
					let v = item.v, word = true;

					if ( t === 'glob' )
						v = glob_to_regex(v);

					else if ( t === 'raw' )
						word = false;

					else if ( t !== 'regex' )
						v = escape_regex(v);

					if ( ! v || ! v.length )
						continue;

					out[word ? 0 : 1].push(v);
				}

				if ( out[0].length )
					out[1].push(`\\b(?:${out[0].join('|')})\\b`);

				if ( ! out[1].length )
					return;

				return new RegExp(out[1].join('|'), 'gi');
			}
		});


		this.settings.add('chat.filtering.highlight-mentions', {
			default: false,
			ui: {
				path: 'Chat > Filtering >> Appearance',
				title: 'Highlight messages that mention you.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.highlight-tokens', {
			default: false,
			ui: {
				path: 'Chat > Filtering >> Appearance',
				title: 'Highlight matched words in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.images', {
			default: true,
			ui: {
				path: 'Chat > Tooltips >> General @{"sort": -1}',
				title: 'Display images in tooltips.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.badge-images', {
			default: true,
			requires: ['tooltip.images'],
			process(ctx, val) {
				return ctx.get('tooltip.images') ? val : false
			},

			ui: {
				path: 'Chat > Tooltips >> Badges',
				title: 'Display large images of badges.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.emote-sources', {
			default: true,
			ui: {
				path: 'Chat > Tooltips >> Emotes',
				title: 'Display known sources.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.emote-images', {
			default: true,
			requires: ['tooltip.images'],
			process(ctx, val) {
				return ctx.get('tooltip.images') ? val : false
			},

			ui: {
				path: 'Chat > Tooltips >> Emotes',
				title: 'Display large images of emotes.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.rich-links', {
			default: true,
			ui: {
				sort: -1,
				path: 'Chat > Tooltips >> Links',
				title: 'Display rich tooltips for links.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.link-interaction', {
			default: true,
			ui: {
				path: 'Chat > Tooltips >> Links',
				title: 'Allow interaction with supported link tooltips.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.link-images', {
			default: true,
			requires: ['tooltip.images'],
			process(ctx, val) {
				return ctx.get('tooltip.images') ? val : false
			},

			ui: {
				path: 'Chat > Tooltips >> Links',
				title: 'Display images for links.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.link-nsfw-images', {
			default: false,
			ui: {
				path: 'Chat > Tooltips >> Links',
				title: 'Display potentially NSFW images.',
				description: 'When enabled, FrankerFaceZ will include images that are tagged as unsafe or that are not rated.',
				component: 'setting-check-box'
			}
		});


		this.settings.add('chat.adjustment-mode', {
			default: 1,
			ui: {
				path: 'Chat > Appearance >> Colors',
				title: 'Adjustment',
				description: 'Alter user colors to ensure that they remain readable.',

				component: 'setting-select-box',

				data: [
					{value: -1, title: 'No Color'},
					{value: 0, title: 'Unchanged'},
					{value: 1, title: 'HSL Luma'},
					{value: 2, title: 'Luv Luma'},
					{value: 3, title: 'HSL Loop (BTTV-Like)'},
					{value: 4, title: 'RGB Loop (Deprecated)'}
				]
			}
		});

		this.settings.add('chat.adjustment-contrast', {
			default: 4.5,
			ui: {
				path: 'Chat > Appearance >> Colors',
				title: 'Minimum Contrast',
				description: 'Set the minimum contrast ratio used by Luma adjustments when determining readability.',

				component: 'setting-text-box',

				process(val) {
					return parseFloat(val)
				}
			}
		});

		this.settings.add('chat.bits.stack', {
			default: 0,
			ui: {
				path: 'Chat > Bits and Cheering >> Appearance',
				title: 'Cheer Stacking',
				description: 'Collect all the cheers in a message into a single cheer at the start of the message.',
				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Grouped by Type'},
					{value: 2, title: 'All in One'}
				]
			}
		});

		this.settings.add('chat.bits.animated', {
			default: true,

			ui: {
				path: 'Chat > Bits and Cheering >> Appearance',
				title: 'Display animated cheers.',
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

		this.context.on('changed:theme.is-dark', () => {
			for(const room of this.iterateRooms())
				room.buildBitsCSS();
		});

		this.context.on('changed:chat.bits.animated', () => {
			for(const room of this.iterateRooms())
				room.buildBitsCSS();
		});
	}


	onEnable() {
		for(const key in TOKENIZERS)
			if ( has(TOKENIZERS, key) )
				this.addTokenizer(TOKENIZERS[key]);

		for(const key in RICH_PROVIDERS)
			if ( has(RICH_PROVIDERS, key) )
				this.addRichProvider(RICH_PROVIDERS[key]);
	}


	getUser(id, login, no_create, no_login, error = false) {
		let user;
		if ( id && typeof id === 'number' )
			id = `${id}`;

		if ( this.user_ids[id] )
			user = this.user_ids[id];

		else if ( this.users[login] && ! no_login )
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
				if ( other !== this && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.users[login] = user;
					else {
						// TODO: Merge Logic~~
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

		if ( this.room_ids[id] )
			room = this.room_ids[id];

		else if ( this.rooms[login] && ! no_login )
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
				if ( other !== this && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.rooms[login] = room;
					else {
						// TODO: Merge Logic~~
					}
				}

			} else
				this.rooms[login] = room;
		}

		return room;
	}


	*iterateRooms() {
		const visited = new Set;

		for(const id in this.room_ids)
			if ( has(this.room_ids, id) ) {
				const room = this.room_ids[id];
				if ( room ) {
					visited.add(room);
					yield room;
				}
			}

		for(const login in this.rooms)
			if ( has(this.rooms, login) ) {
				const room = this.rooms[login];
				if ( room && ! visited.has(room) )
					yield room;
			}
	}


	standardizeMessage(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		// Standardize User
		if ( msg.sender && ! msg.user )
			msg.user = msg.sender;

		let user = msg.user;
		if ( ! user )
			user = msg.user = {};

		user.color = user.color || user.chatColor || null;
		user.type = user.type || user.userType || null;
		user.id = user.id || user.userID || null;
		user.login = user.login || user.userLogin || null;
		user.displayName = user.displayName || user.userDisplayName || user.login;
		user.isIntl = user.login && user.displayName && user.displayName.trim().toLowerCase() !== user.login;

		// Standardize Message Content
		if ( ! msg.message && msg.messageParts )
			this.detokenizeMessage(msg);

		if ( msg.content && ! msg.message ) {
			if ( msg.content.fragments )
				this.detokenizeContent(msg);
			else
				msg.message = msg.content.text;
		}

		// Standardize Badges
		if ( ! msg.badges && user.displayBadges ) {
			const b = msg.badges = {};
			for(const item of msg.user.displayBadges)
				b[item.setID] = item.version;
		}

		// Standardize Timestamp
		if ( ! msg.timestamp && msg.sentAt )
			msg.timestamp = new Date(msg.sentAt).getTime();

		// Standardize Deletion
		if ( msg.deletedAt !== undefined )
			msg.deleted = !!msg.deletedAt;

		return msg;
	}


	detokenizeContent(msg) { // eslint-disable-line class-methods-use-this
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
		}

		msg.message = out.join('');
		msg.emotes = emotes;
		return msg;
	}


	detokenizeMessage(msg) { // eslint-disable-line class-methods-use-this
		const out = [],
			parts = msg.messageParts,
			l = parts.length,
			emotes = {};

		let idx = 0, ret, last_type = null;

		for(let i=0; i < l; i++) {
			const part = parts[i],
				content = part.content;

			if ( ! content )
				continue;

			if ( typeof content === 'string' )
				ret = content;

			else if ( content.recipient )
				ret = `@${content.recipient}`;

			else if ( content.url )
				ret = content.url;

			else if ( content.cheerAmount )
				ret = `${content.alt}${content.cheerAmount}`;

			else if ( content.images ) {
				const url = (content.images.themed ? content.images.dark : content.images.sources),
					match = url && /\/emoticons\/v1\/(\d+)\/[\d.]+$/.exec(url['1x']),
					id = match && match[1];

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
				idx += ret.length;
				last_type = part.type;
				out.push(ret)
			}
		}

		msg.message = out.join('');
		msg.emotes = emotes;
		return msg;
	}


	formatTime(time) { // eslint-disable-line class-methods-use-this
		if (!( time instanceof Date ))
			time = new Date(time);

		let hours = time.getHours();

		const minutes = time.getMinutes(); //,
		//	seconds = time.getSeconds(),
		//	fmt = this.settings.get('chat.timestamp-format');

		if ( hours > 12 )
			hours -= 12;
		else if ( hours === 0 )
			hours = 12;

		return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`; //:${seconds < 10 ? '0' : ''}${seconds}`;
	}


	addTokenizer(tokenizer) {
		const type = tokenizer.type;
		this.tokenizers[type] = tokenizer;
		if ( tokenizer.priority == null )
			tokenizer.priority = 0;

		if ( tokenizer.tooltip ) {
			const tt = tokenizer.tooltip;
			const tk = this.tooltips.types[type] = tt.bind(this);

			for(const i of ['interactive', 'delayShow', 'delayHide'])
				tk[i] = typeof tt[i] === 'function' ? tt[i].bind(this) : tt[i];
		}

		this.__tokenizers.push(tokenizer);
		this.__tokenizers.sort((a, b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});
	}


	addRichProvider(provider) {
		const type = provider.type;
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


	tokenizeString(message, msg) {
		let tokens = [{type: 'text', text: message}];

		for(const tokenizer of this.__tokenizers)
			tokens = tokenizer.process.call(this, tokens, msg);

		return tokens;
	}


	pluckRichContent(tokens) { // eslint-disable-line class-methods-use-this
		if ( ! this.context.get('chat.rich.enabled') )
			return;

		const providers = this.__rich_providers;

		for(const token of tokens) {
			for(const provider of providers)
				if ( provider.test.call(this, token) ) {
					token.hidden = this.context.get('chat.rich.hide-tokens') && provider.hide_token;
					return provider.process.call(this, token);
				}
		}
	}


	tokenizeMessage(msg, user) {
		if ( msg.content && ! msg.message )
			msg.message = msg.content.text;

		if ( msg.sender && ! msg.user )
			msg.user = msg.sender;

		if ( ! msg.message )
			return [];

		let tokens = [{type: 'text', text: msg.message}];
		if ( ! tokens[0].text )
			return tokens;

		for(const tokenizer of this.__tokenizers)
			tokens = tokenizer.process.call(this, tokens, msg, user);

		return tokens;
	}


	renderTokens(tokens, e) {
		if ( ! e )
			e = createElement;

		const out = [],
			tokenizers = this.tokenizers,
			l = tokens.length;

		for(let i=0; i < l; i++) {
			const token = tokens[i],
				type = token.type,
				tk = tokenizers[type];

			if ( token.hidden )
				continue;

			let res;

			if ( type === 'text' )
				res = e('span', {
					'data-a-target': 'chat-message-text'
				}, token.text);

			else if ( tk )
				res = tk.render.call(this, token, e);

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

	get_link_info(url, no_promises) {
		let info = this._link_info[url];
		const expires = info && info[1];

		if ( expires && Date.now() > expires )
			info = this._link_info[url] = null;

		if ( info && info[0] )
			return no_promises ? info[2] : Promise.resolve(info[2]);

		if ( no_promises )
			return null;

		else if ( info )
			return new Promise((resolve, reject) => info[2].push([resolve, reject]))

		return new Promise((resolve, reject) => {
			info = this._link_info[url] = [false, null, [[resolve, reject]]];

			const handle = (success, data) => {
				const callbacks = ! info[0] && info[2];
				info[0] = true;
				info[1] = Date.now() + 120000;
				info[2] = success ? data : null;

				if ( callbacks )
					for(const cbs of callbacks)
						cbs[success ? 0 : 1](data);
			}


			timeout(this.socket.call('get_link', url), 15000)
				.then(data => handle(true, data))
				.catch(err => handle(false, err));
		});
	}
}