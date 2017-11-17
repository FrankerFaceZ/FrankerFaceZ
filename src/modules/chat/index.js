'use strict';

// ============================================================================
// Chat
// ============================================================================

import {IS_WEBKIT} from 'utilities/constants';
const WEBKIT = IS_WEBKIT ? '-webkit-' : '';

import Module from 'utilities/module';
import {createElement, ManagedStyle} from 'utilities/dom';
import {timeout, has, SourcedSet} from 'utilities/object';

import Badges from './badges';
import Emotes from './emotes';

import Room from './room';
import * as TOKENIZERS from './tokenizers';


export default class Chat extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('i18n');
		this.inject('tooltips');
		this.inject('socket');

		this.inject(Badges);
		this.inject(Emotes);

		this._link_info = {};

		this.style = new ManagedStyle;

		this.context = this.settings.context({});

		this.rooms = {};
		this.users = {};

		this.room_ids = {};
		this.user_ids = {};

		this.tokenizers = {};
		this.__tokenizers = [];


		// ========================================================================
		// Settings
		// ========================================================================

		this.settings.add('chat.scrollback-length', {
			default: 150,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Scrollback Length',
				description: 'Keep up to this many lines in chat. Setting this too high will create lage.',
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val < 1 )
						val = 150;

					return val;
				}
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

		this.context.on('changed:theme.is-dark', () => {
			for(const key in this.rooms)
				if ( this.rooms[key] )
					this.rooms[key].updateBitsCSS();
		});

		this.context.on('changed:chat.bits.animated', () => {
			for(const key in this.rooms)
				if ( this.rooms[key] )
					this.rooms[key].updateBitsCSS();
		});
	}


	onEnable() {
		for(const key in TOKENIZERS)
			if ( has(TOKENIZERS, key) )
				this.addTokenizer(TOKENIZERS[key]);
	}


	getBadge(badge, version, room) {
		let b;
		if ( this.room_ids[room] ) {
			const versions = this.room_ids[room].badges.get(badge);
			b = versions && versions.get(version);
		}

		if ( ! b ) {
			const versions = this.badges.get(badge);
			b = versions && versions.get(version);
		}

		return b;
	}



	updateBadges(badges) {
		this.badges = badges;
		this.updateBadgeCSS();
	}


	updateBadgeCSS() {
		if ( ! this.badges )
			this.style.delete('badges');

		const out = [];
		for(const [key, versions] of this.badges)
			for(const [version, data] of versions) {
				out.push(`.ffz-badge.badge--${key}.version--${version} {
	background-color: transparent;
	filter: none;
	${WEBKIT}mask-image: none;
	background-image: url("${data.image1x}");
	background-image: ${WEBKIT}image-set(
		url("${data.image1x}") 1x,
		url("${data.image2x}") 2x,
		url("${data.image4x}") 4x
	);
}`)
			}

		this.style.set('badges', out.join('\n'));
	}


	getUser(id, login, no_create, no_login) {
		let user;

		if ( this.user_ids[id] )
			user = this.user_ids[id];

		else if ( this.users[login] && ! no_login )
			user = this.users[login];

		else if ( no_create )
			return null;

		else
			user = {id, login, badges: [], emote_sets: new SourcedSet};

		if ( id && id !== user.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes.
			if ( user.id )
				throw new Error('id mismatch');

			// Otherwise, we're just here to set the ID.
			user.id = id;
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


	getRoom(id, login, no_create, no_login) {
		let room;

		if ( this.room_ids[id] )
			room = this.room_ids[id];

		else if ( this.rooms[login] && ! no_login )
			room = this.rooms[login];

		else if ( no_create )
			return null;

		else
			room = new Room(this, id, login);

		if ( id && id !== room.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes. Or React not being atomic.
			if ( room.id )
				throw new Error('id mismatch');

			// Otherwise, we're just here to set the ID.
			room.id = id;
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


	formatTime(time) {
		if (!( time instanceof Date ))
			time = new Date(time);

		let hours = time.getHours();

		const minutes = time.getMinutes(),
			seconds = time.getSeconds(),

			fmt = this.settings.get('chat.timestamp-format');

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
			return a.type < b.sort;
		});
	}


	tokenizeString(message, msg) {
		let tokens = [{type: 'text', text: message}];

		for(const tokenizer of this.__tokenizers)
			tokens = tokenizer.process.call(this, tokens, msg);

		return tokens;
	}


	tokenizeMessage(msg, user) {
		let tokens = [{type: 'text', text: msg.message}];

		for(const tokenizer of this.__tokenizers)
			tokens = tokenizer.process.call(this, tokens, msg, user);

		return tokens;
	}


	renderBadges(msg, e) { // eslint-disable-line class-methods-use-this
		const out = [],
			badges = msg.badges || {};

		for(const key in badges)
			if ( has(badges, key) ) {
				const version = badges[key];
				out.push(e('span', {
					className: `ffz-tooltip ffz-badge badge--${key} version--${version}`,
					'data-tooltip-type': 'badge',
					'data-badge': key,
					'data-version': version
				}))
			}

		return out;
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