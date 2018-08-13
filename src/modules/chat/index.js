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

export const SEPARATORS = '[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]';


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

		this.settings.add('chat.font-size', {
			default: 12,
			ui: {
				path: 'Chat > Appearance >> General',
				title: 'Font Size',
				description: "How large should text in chat be, in pixels. This may be affected by your browser's zoom and font size settings.",
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val <= 0 )
						return 12;

					return val;
				}
			}
		});

		this.settings.add('chat.font-family', {
			default: '',
			ui: {
				path: 'Chat > Appearance >> General',
				title: 'Font Family',
				description: 'Set the font used for displaying chat messages.',
				component: 'setting-text-box'
			}
		});

		this.settings.add('chat.lines.emote-alignment', {
			default: 0,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Emote Alignment',
				description: 'Change how emotes are positioned in chat, potentially making messages taller in order to avoid having emotes overlap.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Standard'},
					{value: 1, title: 'Padded'},
					{value: 2, title: 'Baseline (BTTV-Like)'}
				]
			}
		});

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
				path: 'Chat > Behavior >> Deleted Messages',
				title: 'Always display deleted messages.',
				description: 'Deleted messages will be displayed differently for differentiation, but never hidden behind <message deleted>.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.deleted-style', {
			default: 1,
			ui: {
				path: 'Chat > Behavior >> Deleted Messages',
				title: 'Deleted Message Style',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Faded'},
					{value: 1, title: 'Faded, Line Through'}
				]
			}
		});

		this.settings.add('chat.filtering.process-own', {
			default: false,
			ui: {
				path: 'Chat > Filtering >> Behavior',
				title: 'Filter your own messages.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.ignore-clear', {
			default: false,
			ui: {
				path: 'Chat > Behavior >> Deleted Messages',
				title: 'Do not Clear Chat when commanded to.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.remove-deleted', {
			default: 1,
			ui: {
				path: 'Chat > Behavior >> Deleted Messages',
				title: 'Remove deleted messages from chat.',
				description: 'Deleted messages will be removed from chat entirely. This setting is not recommended for moderators.',
				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Do Not Remove'},
					{value: 1, title: 'Remove Unseen (Default)'},
					{value: 2, title: 'Remove Unseen as Moderator'},
					{value: 3, title: 'Remove All'}
				]
			}
		});

		this.settings.add('chat.delay', {
			default: -1,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Artificial Chat Delay',
				description: 'Delay the appearance of chat messages to allow for moderation before you see them.',
				component: 'setting-select-box',

				data: [
					{value: -1, title: 'Default Delay (Room Specific; Non-Mod Only)'},
					{value: 0, title: 'No Delay'},
					{value: 300, title: 'Minor (Bot Moderation; 0.3s)'},
					{value: 1200, title: 'Normal (Human Moderation; 1.2s)'},
					{value: 5000, title: 'Large (Spoiler Removal / Slow Mods; 5s)'},
					{value: 10000, title: 'Extra Large (10s)'},
					{value: 15000, title: 'Extremely Large (15s)'},
					{value: 20000, title: 'Mods Asleep; Delay Chat (20s)'},
					{value: 30000, title: 'Half a Minute (30s)'},
					{value: 60000, title: 'Why??? (1m)'},
					{value: 788400000000, title: 'The CBenni Option (Literally 25 Years)'}
				]
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
						list[1].push(`(^|.*?${SEPARATORS})(?:${list[0].join('|')})(?=$|${SEPARATORS})`);

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
				component: 'basic-terms',
				removable: true
			}
		});


		this.settings.add('chat.filtering.highlight-basic-blocked--regex', {
			requires: ['chat.filtering.highlight-basic-blocked'],
			process(ctx) {
				const val = ctx.get('chat.filtering.highlight-basic-blocked');
				if ( ! val || ! val.length )
					return null;

				const out = [
					[[], []],
					[[], []]
				];

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

					out[item.remove ? 1 : 0][word ? 0 : 1].push(v);
				}

				return out.map(data => {
					if ( data[0].length )
						data[1].push(`(^|.*?${SEPARATORS})(?:${data[0].join('|')})(?=$|${SEPARATORS})`);

					return data[1].length ? new RegExp(data[1].join('|'), 'gi') : null;
				});
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


	standardizeWhisper(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		if ( msg._ffz_message )
			return msg._ffz_message;

		const emotes = {},
			is_action = msg.content.startsWith('/me '),
			offset = is_action ? 4 : 0,

			out = msg._ffz_message = {
				user: msg.from,
				message: msg.content.slice(offset),
				is_action,
				ffz_emotes: emotes,
				timestamp: msg.sentAt && msg.sentAt.getTime(),
				deleted: false
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


	standardizeMessage(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		// Standardize User
		if ( msg.sender && ! msg.user )
			msg.user = msg.sender;

		if ( msg.from && ! msg.user )
			msg.user = msg.from;

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

		// Standardize Emotes
		if ( ! msg.ffz_emotes )
			this.standardizeEmotes(msg);

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


	standardizeEmotes(msg) { // eslint-disable-line class-methods-use-this
		if ( msg.emotes && msg.message ) {
			const emotes = {},
				chars = split_chars(msg.message);

			for(const key in msg.emotes)
				if ( has(msg.emotes, key) ) {
					const raw_emote = msg.emotes[key];
					if ( Array.isArray(raw_emote) )
						return msg.ffz_emotes = msg.emotes;

					const em = emotes[raw_emote.id] = emotes[raw_emote.id] || [],
						idx = chars.indexOf(' ', raw_emote.startIndex);

					em.push({
						startIndex: raw_emote.startIndex,
						endIndex: (idx === -1 ? chars.length : idx) - 1
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
				idx += split_chars(ret).length;
				last_type = part.type;
				out.push(ret)
			}
		}

		if ( ! emotes_only )
			msg.message = out.join('');

		msg.ffz_emotes = emotes;
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