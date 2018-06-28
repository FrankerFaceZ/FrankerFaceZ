'use strict';

// ============================================================================
// Chat Hooks
// ============================================================================

import {ColorAdjuster} from 'utilities/color';
import {setChildren} from 'utilities/dom';
import {has, split_chars} from 'utilities/object';
import {FFZEvent} from 'utilities/events';

import Module from 'utilities/module';

import Twilight from 'site';

import Scroller from './scroller';
import ChatLine from './line';
import SettingsMenu from './settings_menu';
import EmoteMenu from './emote_menu';
import TabCompletion from './tab_completion';


const REGEX_EMOTES = {
	'B-?\\)': ['B)', 'B-)'],
	'R-?\\)': ['R)', 'R-)'],
	'[oO](_|\\.)[oO]': ['o_o', 'O_o', 'o_O', 'O_O', 'o.o', 'O.o', 'o.O', 'O.O'],
	'\\&gt\\;\\(': ['>('],
	'\\&lt\\;3': ['<3'],
	'\\:-?(o|O)': [':o', ':O', ':-o', ':-O'],
	'\\:-?(p|P)': [':p', ':P', ':-p', ':-P'],
	'\\:-?D': [':D', ':-D'],
	'\\:-?[\\\\/]': [':/', ':-/', ':\\', ':-\\'],
	'\\:-?[z|Z|\\|]': [':z', ':Z', ':|', ':-z', ':-Z', ':-|'],
	'\\:-?\\(': [':(', ':-('],
	'\\:-?\\)': [':)', ':-)'],
	'\\;-?(p|P)': [';p', ';P', ';-p', ';-P'],
	'\\;-?\\)': [';)', ';-)']
};


const MESSAGE_TYPES = ((e = {}) => {
	e[e.Post = 0] = 'Post';
	e[e.Action = 1] = 'Action';
	e[e.PostWithMention = 2] = 'PostWithMention';
	return e;
})();


const MOD_TYPES = ((e = {}) => {
	e[e.Ban = 0] = 'Ban';
	e[e.Timeout = 1] = 'Timeout';
	return e;
})();


const AUTOMOD_TYPES = ((e = {}) => {
	e[e.MessageRejectedPrompt = 0] = 'MessageRejectedPrompt';
	e[e.MessageRejected = 1] = 'MessageRejected';
	e[e.MessageAllowed = 2] = 'MessageAllowed';
	e[e.MessageDenied = 3] = 'MessageDenied';
	return e;
})();


const CHAT_TYPES = ((e = {}) => {
	e[e.Message = 0] = 'Message';
	e[e.Moderation = 1] = 'Moderation';
	e[e.ModerationAction = 2] = 'ModerationAction';
	e[e.TargetedModerationAction = 3] = 'TargetedModerationAction';
	e[e.AutoMod = 4] = 'AutoMod';
	e[e.Connected = 5] = 'Connected';
	e[e.Disconnected = 6] = 'Disconnected';
	e[e.Reconnect = 7] = 'Reconnect';
	e[e.Hosting = 8] = 'Hosting';
	e[e.Unhost = 9] = 'Unhost';
	e[e.Hosted = 10] = 'Hosted';
	e[e.Subscription = 11] = 'Subscription';
	e[e.Resubscription = 12] = 'Resubscription';
	e[e.SubGift = 13] = 'SubGift';
	e[e.Clear = 14] = 'Clear';
	e[e.SubscriberOnlyMode = 15] = 'SubscriberOnlyMode';
	e[e.FollowerOnlyMode = 16] = 'FollowerOnlyMode';
	e[e.SlowMode = 17] = 'SlowMode';
	e[e.EmoteOnlyMode = 18] = 'EmoteOnlyMode';
	e[e.RoomMods = 19] = 'RoomMods';
	e[e.RoomState = 20] = 'RoomState';
	e[e.Raid = 21] = 'Raid';
	e[e.Unraid = 22] = 'Unraid';
	e[e.Ritual = 23] = 'Ritual';
	e[e.Notice = 24] = 'Notice';
	e[e.Info = 25] = 'Info';
	e[e.BadgesUpdated = 26] = 'BadgesUpdated';
	e[e.Purchase = 27] = 'Purchase';
	e[e.BitsCharity = 28] = 'BitsCharity';
	e[e.CrateGift = 29] = 'CrateGift'
	return e;
})();


const NULL_TYPES = [
	'Reconnect',
	'RoomState',
	'BadgesUpdated',
	'Clear'
];


const MISBEHAVING_EVENTS = [
	'onBitsCharityEvent',
	//'onRitualEvent', -- handled by conversion to Message event
	'onBadgesUpdatedEvent',
	'onPurchaseEvent',
	'onCrateEvent'
];


export default class ChatHook extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.colors = new ColorAdjuster;
		this.inverse_colors = new ColorAdjuster;

		this.inject('settings');

		this.inject('site');
		this.inject('site.router');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');

		this.inject('chat');

		this.inject(Scroller);
		this.inject(ChatLine);
		this.inject(SettingsMenu);
		this.inject(EmoteMenu);
		this.inject(TabCompletion);


		this.ChatController = this.fine.define(
			'chat-controller',
			n => n.chatService,
			Twilight.CHAT_ROUTES
		);

		this.ChatContainer = this.fine.define(
			'chat-container',
			n => n.showViewersList && n.onChatInputFocus,
			Twilight.CHAT_ROUTES
		);

		this.PinnedCheer = this.fine.define(
			'pinned-cheer',
			n => n.collapseCheer && n.saveRenderedMessageRef,
			Twilight.CHAT_ROUTES
		);

		this.RoomPicker = this.fine.define(
			'chat-picker',
			n => n.closeRoomPicker && n.handleRoomSelect,
			Twilight.CHAT_ROUTES
		);


		// Settings

		this.settings.add('chat.width', {
			default: 340,
			ui: {
				path: 'Chat > Appearance >> General @{"sort": -1}',
				title: 'Width',
				description: "How wide chat should be, in pixels. This may be affected by your browser's zoom and font size settings.",
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val <= 0 )
						return 340;

					return val;
				}
			}
		});

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

		this.settings.add('chat.bits.show-pinned', {
			default: true,
			ui: {
				path: 'Chat > Bits and Cheering >> Appearance',
				title: 'Display Top Cheerers',

				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.rituals.show', {
			default: true,
			ui: {
				path: 'Chat > Filtering >> Rituals',
				title: 'Display ritual messages such as "User is new here! Say Hello!".',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.alternate', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Display lines with alternating background colors.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.padding', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Reduce padding around lines.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.borders', {
			default: 0,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Separators',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Basic Line (1px Solid)'},
					{value: 2, title: '3D Line (2px Groove)'},
					{value: 3, title: '3D Line (2px Groove Inset)'},
					{value: 4, title: 'Wide Line (2px Solid)'}
				]
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
	}


	get currentChat() {
		for(const inst of this.ChatController.instances)
			if ( inst && inst.chatService )
				return inst;
	}


	updateColors() {
		const is_dark = this.chat.context.get('theme.is-dark'),
			mode = this.chat.context.get('chat.adjustment-mode'),
			contrast = this.chat.context.get('chat.adjustment-contrast'),
			c = this.colors,
			ic = this.inverse_colors;

		// TODO: Get the background color from the theme system.
		// Updated: Use the lightest/darkest colors from alternating rows for better readibility.
		c._base = is_dark ? '#191919' : '#e0e0e0'; //#0e0c13' : '#faf9fa';
		c.mode = mode;
		c.contrast = contrast;

		ic._base = is_dark ? '#dad8de' : '#19171c';
		ic.mode = mode;
		ic.contrast = contrast;

		this.updateChatLines();
	}


	updateChatCSS() {
		const width = this.chat.context.get('chat.width'),
			size = this.chat.context.get('chat.font-size'),
			emote_alignment = this.chat.context.get('chat.lines.emote-alignment'),
			lh = Math.round((20/12) * size);

		let font = this.chat.context.get('chat.font-family') || 'inherit';
		if ( font.indexOf(' ') !== -1 && font.indexOf(',') === -1 && font.indexOf('"') === -1 && font.indexOf("'") === -1 )
			font = `"${font}"`;

		this.css_tweaks.setVariable('chat-font-size', `${size/10}rem`);
		this.css_tweaks.setVariable('chat-line-height', `${lh/10}rem`);
		this.css_tweaks.setVariable('chat-font-family', font);
		this.css_tweaks.setVariable('chat-width', `${width/10}rem`);

		this.css_tweaks.toggle('chat-font', size !== 12 || font);
		this.css_tweaks.toggle('chat-width', width !== 340);

		this.css_tweaks.toggle('emote-alignment-padded', emote_alignment === 1);
		this.css_tweaks.toggle('emote-alignment-baseline', emote_alignment === 2);
	}

	updateLineBorders() {
		const mode = this.chat.context.get('chat.lines.borders');

		this.css_tweaks.toggle('chat-borders', mode > 0);
		this.css_tweaks.toggle('chat-borders-3d', mode === 2);
		this.css_tweaks.toggle('chat-borders-3d-inset', mode === 3);
		this.css_tweaks.toggle('chat-borders-wide', mode === 4);
	}

	updateMentionCSS() {
		const enabled = this.chat.context.get('chat.filtering.highlight-mentions');
		this.css_tweaks.toggle('chat-mention-token', this.chat.context.get('chat.filtering.highlight-tokens'));
		this.css_tweaks.toggle('chat-mention-bg', enabled);
		this.css_tweaks.toggle('chat-mention-bg-alt', enabled && this.chat.context.get('chat.lines.alternate'));
	}


	async grabTypes() {
		const ct = await this.web_munch.findModule('chat-types');

		this.automod_types = ct && ct.a || AUTOMOD_TYPES;
		this.chat_types = ct && ct.b || CHAT_TYPES;
		this.message_types = ct && ct.c || MESSAGE_TYPES;
		this.mod_types = ct && ct.e || MOD_TYPES;
	}


	onEnable() {
		this.on('site.web_munch:loaded', this.grabTypes);
		this.grabTypes();

		this.chat.context.on('changed:chat.width', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-family', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.lines.emote-alignment', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.adjustment-mode', this.updateColors, this);
		this.chat.context.on('changed:chat.adjustment-contrast', this.updateColors, this);
		this.chat.context.on('changed:theme.is-dark', this.updateColors, this);
		this.chat.context.on('changed:chat.lines.borders', this.updateLineBorders, this);
		this.chat.context.on('changed:chat.filtering.highlight-mentions', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.filtering.highlight-tokens', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.fix-bad-emotes', this.updateChatLines, this);

		this.chat.context.on('changed:chat.lines.alternate', val => {
			this.css_tweaks.toggle('chat-rows', val);
			this.updateMentionCSS();
		});

		this.chat.context.on('changed:chat.lines.padding', val =>
			this.css_tweaks.toggle('chat-padding', val));

		this.chat.context.on('changed:chat.bits.show', val =>
			this.css_tweaks.toggle('hide-bits', !val));
		this.chat.context.on('changed:chat.bits.show-pinned', val =>
			this.css_tweaks.toggleHide('pinned-cheer', !val));

		this.css_tweaks.toggleHide('pinned-cheer', !this.chat.context.get('chat.bits.show-pinned'));
		this.css_tweaks.toggle('hide-bits', !this.chat.context.get('chat.bits.show'));
		this.css_tweaks.toggle('chat-rows', this.chat.context.get('chat.lines.alternate'));
		this.css_tweaks.toggle('chat-padding', this.chat.context.get('chat.lines.padding'));

		this.updateChatCSS();
		this.updateColors();
		this.updateLineBorders();
		this.updateMentionCSS();

		this.ChatController.on('mount', this.chatMounted, this);
		this.ChatController.on('unmount', this.removeRoom, this);
		this.ChatController.on('receive-props', this.chatUpdated, this);

		this.ChatController.ready((cls, instances) => {
			const t = this,
				old_catch = cls.prototype.componentDidCatch,
				old_render = cls.prototype.render;

			// Try catching errors. With any luck, maybe we can
			// recover from the error when we re-build?
			cls.prototype.componentDidCatch = function(err, info) {
				// Don't log infinitely if stuff gets super screwed up.
				const errs = this.state.ffz_errors || 0;
				if ( errs < 100 ) {
					this.setState({ffz_errors: errs + 1});
					t.log.info('Error within Chat', err, info, errs);
				}

				if ( old_catch )
					return old_catch.call(this, err, info);
			}

			cls.prototype.render = function() {
				if ( this.state.ffz_errors > 0 ) {
					const React = t.web_munch.getModule('react'),
						createElement = React && React.createElement;

					if ( ! createElement )
						return null;

					return createElement('div', {
						className: 'tw-border-l tw-c-background-alt-2 tw-c-text tw-full-width tw-full-height tw-align-items-center tw-flex tw-flex-column tw-justify-content-center tw-relative'
					}, 'There was an error displaying chat.');

				} else
					return old_render.call(this);
			}

			for(const inst of instances) {
				const service = inst.chatService;
				if ( ! service._ffz_was_here )
					this.wrapChatService(service.constructor);

				const buffer = inst.chatBuffer;
				if ( ! buffer._ffz_was_here )
					this.wrapChatBuffer(buffer.constructor);

				service.client.events.removeAll();
				service.connectHandlers();

				this.chatMounted(inst);
			}
		});


		this.ChatContainer.on('mount', this.containerMounted, this);
		this.ChatContainer.on('unmount', this.removeRoom, this);
		this.ChatContainer.on('receive-props', this.containerUpdated, this);

		this.ChatContainer.ready((cls, instances) => {
			const t = this,
				old_catch = cls.prototype.componentDidCatch;

			// Try catching errors. With any luck, maybe we can
			// recover from the error when we re-build?
			cls.prototype.componentDidCatch = function(err, info) {
				// Don't log infinitely if stuff gets super screwed up.
				const errs = this.state.ffz_errors || 0;
				if ( errs < 100 ) {
					this.setState({ffz_errors: errs + 1});
					t.log.info('Error within Chat Container', err, info, errs);
				}

				if ( old_catch )
					return old_catch.call(this, err, info);
			}

			for(const inst of instances)
				this.containerMounted(inst);
		});


		this.PinnedCheer.on('mount', this.fixPinnedCheer, this);
		this.PinnedCheer.on('update', this.fixPinnedCheer, this);

		this.PinnedCheer.ready((cls, instances) => {
			for(const inst of instances)
				this.fixPinnedCheer(inst);
		});


		this.RoomPicker.ready((cls, instances) => {
			for(const inst of instances)
				this.closeRoomPicker(inst);
		});

		this.RoomPicker.on('mount', this.closeRoomPicker, this);
	}


	closeRoomPicker(inst) { // eslint-disable-line class-methods-use-this
		inst.closeRoomPicker();
	}


	wrapChatBuffer(cls) {
		const t = this;

		cls.prototype._ffz_was_here = true;

		cls.prototype.toArray = function() {
			const buf = this.buffer,
				size = t.chat.context.get('chat.scrollback-length'),
				ct = t.chat_types || CHAT_TYPES,
				target = buf.length - size;

			if ( target > 0 ) {
				let removed = 0, last;
				for(let i=0; i < target; i++)
					if ( buf[i] && ! NULL_TYPES.includes(ct[buf[i].type]) ) {
						removed++;
						last = i;
					}

				this.buffer = buf.slice(removed % 2 === 0 ? target : Math.max(target - 10, last));
			} else
				// Make a shallow copy of the array because other code expects it to change.
				this.buffer = buf.slice(0);

			this._isDirty = false;
			return this.buffer;
		}
	}


	sendMessage(room, message) {
		const controller = this.ChatController.first,
			service = controller && controller.chatService;

		if ( ! service || ! room )
			return null;

		if ( room.startsWith('#') )
			room = room.slice(1);

		if ( room.toLowerCase() !== service.channelLogin.toLowerCase() )
			return service.client.sendCommand(room, message);

		service.sendMessage(message);
	}


	wrapChatService(cls) {
		const t = this,
			old_handler = cls.prototype.connectHandlers,
			old_send = cls.prototype.sendMessage;

		cls.prototype._ffz_was_here = true;


		cls.prototype.sendMessage = function(raw_msg) {
			const msg = raw_msg.replace(/\n/g, '');

			if ( msg.startsWith('/ffz') ) {
				this.postMessage({
					type: t.chat_types.Notice,
					message: 'The /ffz command is not yet re-implemented.'
				})

				return false;
			}

			const event = new FFZEvent({
				message: msg,
				channel: this.channelLogin
			});

			t.emit('chat:pre-send-message', event);

			if ( event.defaultPrevented )
				return;

			return old_send.call(this, msg);
		}


		cls.prototype.ffzGetEmotes = function() {
			const emote_sets = this.client && this.client.session && this.client.session.emoteSets;
			if ( this._ffz_cached_sets === emote_sets )
				return this._ffz_cached_emotes;

			this._ffz_cached_sets = emote_sets;
			const emotes = this._ffz_cached_emotes = {};

			if ( emote_sets )
				for(const set of emote_sets)
					if ( set && set.emotes )
						for(const emote of set.emotes)
							if ( emote ) {
								const token = emote.token;
								if ( has(REGEX_EMOTES, token) ) {
									for(const token of REGEX_EMOTES[token] )
										if ( ! has(emotes, token) )
											emotes[token] = emote.id;

								} else if ( ! has(emotes, token) )
									emotes[token] = emote.id;
							}

			return emotes;
		}


		cls.prototype.connectHandlers = function(...args) {
			if ( ! this._ffz_init ) {
				const i = this;

				for(const key of MISBEHAVING_EVENTS) {
					const original = this[key];
					if ( original )
						this[key] = function(e, t) {
							i._wrapped = e;
							const ret = original.call(i, e, t);
							i._wrapped = null;
							return ret;
						}
				}

				const old_chat = this.onChatMessageEvent;
				this.onChatMessageEvent = function(e) {
					if ( e && e.sentByCurrentUser ) {
						try {
							e.message.user.emotes = findEmotes(
								e.message.body,
								i.ffzGetEmotes()
							);

						} catch(err) {
							t.log.capture(err, {extra: e});
						}
					}

					return old_chat.call(i, e);
				}


				const old_action = this.onChatActionEvent;
				this.onChatActionEvent = function(e) {
					if ( e && e.sentByCurrentUser ) {
						try {
							e.message.user.emotes = findEmotes(
								e.message.body.slice(8, -1),
								i.ffzGetEmotes()
							);

						} catch(err) {
							t.log.capture(err, {extra: e});
						}
					}

					return old_action.call(i, e);
				}


				const old_resub = this.onResubscriptionEvent;
				this.onResubscriptionEvent = function(e) {
					try {
						const out = i.convertMessage({message: e});
						out.ffz_type = 'resub';
						out.sub_months = e.months;
						out.sub_plan = e.methods;

						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_resub.call(i, e);
					}
				}

				const old_ritual = this.onRitualEvent;
				this.onRitualEvent = function(e) {
					try {
						const out = i.convertMessage(e);
						out.ffz_type = 'ritual';
						out.ritual = e.type;

						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_ritual.call(i, e);
					}
				}

				const old_host = this.onHostingEvent;
				this.onHostingEvent = function (e, _t) {
					t.emit('tmi:host', e, _t);
					return old_host.call(i, e, _t);
				}

				const old_unhost = this.onUnhostEvent;
				this.onUnhostEvent = function (e, _t) {
					t.emit('tmi:unhost', e, _t);
					return old_unhost.call(i, e, _t);
				}

				const old_post = this.postMessage;
				this.postMessage = function(e) {
					const original = i._wrapped;
					if ( original && ! e._ffz_checked )
						return i.postMessageToCurrentChannel(original, e);

					return old_post.call(i, e);
				}

				this._ffz_init = true;
			}

			return old_handler.apply(this, ...args);
		}

		cls.prototype.postMessageToCurrentChannel = function(original, message) {
			message._ffz_checked = true;

			if ( original.channel ) {
				let chan = message.channel = original.channel.toLowerCase();
				if ( chan.startsWith('#') )
					chan = chan.slice(1);

				if ( chan !== this.channelLogin.toLowerCase() )
					return;

				message.roomLogin = chan;
			}

			if ( original.message ) {
				const user = original.message.user;
				if ( user )
					message.emotes = user.emotes;

				if ( typeof original.action === 'string' )
					message.message = original.action;
				else
					message.message = original.message.body;
			}

			this.postMessage(message);
		}
	}


	updateChatLines() {
		this.PinnedCheer.forceUpdate();
		this.chat_line.updateLines();
	}


	// ========================================================================
	// Pinned Cheers
	// ========================================================================

	fixPinnedCheer(inst) {
		const el = this.fine.getChildNode(inst),
			container = el && el.querySelector && el.querySelector('.pinned-cheer__headline'),
			tc = inst.props.topCheer;

		if ( ! container || ! tc )
			return;

		container.dataset.roomId = inst.props.channelID;
		container.dataset.room = inst.props.channelLogin && inst.props.channelLogin.toLowerCase();
		container.dataset.userId = tc.user.userID;
		container.dataset.user = tc.user.userLogin && tc.user.userLogin.toLowerCase();

		if ( tc.user.color ) {
			const user_el = container.querySelector('.chat-author__display-name');
			if ( user_el )
				user_el.style.color = this.colors.process(tc.user.color);

			const login_el = container.querySelector('.chat-author__intl-login');
			if ( login_el )
				login_el.style.color = this.colors.process(tc.user.color);
		}

		const bit_el = container.querySelector('.chat-line__message--emote'),
			cont = bit_el ? bit_el.parentElement.parentElement : container.querySelector('.ffz--pinned-top-emote'),
			prefix = extractCheerPrefix(tc.messageParts);

		if ( cont && prefix ) {
			const tokens = this.chat.tokenizeString(`${prefix}${tc.bits}`, tc);

			cont.classList.add('ffz--pinned-top-emote');
			cont.innerHTML = '';
			setChildren(cont, this.chat.renderTokens(tokens));
		}
	}


	// ========================================================================
	// Room Handling
	// ========================================================================

	addRoom(thing, props) {
		if ( ! props )
			props = thing.props;

		if ( ! props.channelID )
			return null;

		const room = thing._ffz_room = this.chat.getRoom(props.channelID, props.channelLogin && props.channelLogin.toLowerCase(), false, true);
		room.ref(thing);
		return room;
	}


	removeRoom(thing) { // eslint-disable-line class-methods-use-this
		if ( ! thing._ffz_room )
			return;

		thing._ffz_room.unref(thing);
		thing._ffz_room = null;
	}


	// ========================================================================
	// Chat Controller
	// ========================================================================

	chatMounted(chat, props) {
		if ( ! props )
			props = chat.props;

		if ( ! this.addRoom(chat, props) )
			return;

		this.updateRoomBitsConfig(chat, props.bitsConfig);
	}


	chatUpdated(chat, props) {
		if ( props.channelID !== chat.props.channelID ) {
			this.removeRoom(chat);
			this.chatMounted(chat, props);
			return;
		}

		if ( props.bitsConfig !== chat.props.bitsConfig )
			this.updateRoomBitsConfig(chat, props.bitsConfig);

		// TODO: Check if this is the room for the current channel.

		this.settings.updateContext({
			moderator: props.isCurrentUserModerator,
			chatHidden: props.isHidden
		});

		this.chat.context.updateContext({
			moderator: props.isCurrentUserModerator,
			channel: props.channelLogin && props.channelLogin.toLowerCase(),
			channelID: props.channelID,
			ui: {
				theme: props.theme
			}
		});
	}


	updateRoomBitsConfig(chat, config) { // eslint-disable-line class-methods-use-this
		const room = chat._ffz_room;
		if ( ! room )
			return;

		room.updateBitsConfig(formatBitsConfig(config));
		this.updateChatLines();
	}


	// ========================================================================
	// Chat Containers
	// ========================================================================

	containerMounted(cont, props) {
		if ( ! props )
			props = cont.props;

		if ( ! this.addRoom(cont, props) )
			return;

		if ( props.data ) {
			this.chat.badges.updateTwitchBadges(props.data.badges);
			this.updateRoomBadges(cont, props.data.user && props.data.user.broadcastBadges);
		}
	}


	containerUpdated(cont, props) {
		if ( props.channelID !== cont.props.channelID ) {
			this.removeRoom(cont);
			this.containerMounted(cont, props);
			return;
		}

		// Twitch, React, and Apollo are the trifecta of terror so we
		// can't compare the badgeSets property in any reasonable way.
		// Instead, just check the lengths to see if they've changed
		// and hope that badge versions will never change separately.
		const data = props.data || {},
			odata = cont.props.data || {},

			bs = data.badges || [],
			obs = odata.badges || [],

			cs = data.user && data.user.broadcastBadges || [],
			ocs = odata.user && odata.user.broadcastBadges || [];

		if ( bs.length !== obs.length )
			this.chat.badges.updateTwitchBadges(bs);

		if ( cs.length !== ocs.length )
			this.updateRoomBadges(cont, cs);
	}

	updateRoomBadges(cont, badges) { // eslint-disable-line class-methods-use-this
		const room = cont._ffz_room;
		if ( ! room )
			return;

		room.updateBadges(badges);
		this.updateChatLines();
	}
}


// ============================================================================
// Processing Functions
// ============================================================================

export function formatBitsConfig(config) {
	if ( ! config )
		return;

	const out = {},
		actions = config.indexedActions;

	for(const key in actions)
		if ( has(actions, key) ) {
			const action = actions[key],
				new_act = out[key] = {
					id: action.id,
					prefix: action.prefix,
					tiers: []
				};

			for(const tier of action.orderedTiers) {
				const images = {};
				for(const im of tier.images) {
					const themed = images[im.theme] = images[im.theme] || [],
						ak = im.isAnimated ? 'animated' : 'static',
						anim = themed[ak] = themed[ak] || {};

					anim[im.dpiScale] = im.url;
				}

				new_act.tiers.push({
					amount: tier.bits,
					color: tier.color,
					id: tier.id,
					images
				})
			}
		}

	return out;
}


export function findEmotes(msg, emotes) {
	const out = {};
	let idx = 0;

	console.log('findEmotes', msg, emotes);

	for(const part of msg.split(' ')) {
		const len = split_chars(part).length;

		if ( has(emotes, part) ) {
			const em = emotes[part],
				matches = out[em] = out[em] || [];

			matches.push({
				startIndex: idx,
				endIndex: idx + len - 1
			});
		}

		idx += len + 1;
	}

	return out;
}


function extractCheerPrefix(parts) {
	for(const part of parts) {
		if ( part.type !== 3 || ! part.content.cheerAmount )
			continue;

		return part.content.alt;
	}

	return null;
}
