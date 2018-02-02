'use strict';

// ============================================================================
// Chat Hooks
// ============================================================================

import {ColorAdjuster} from 'utilities/color';
import {setChildren} from 'utilities/dom';
import {has, split_chars} from 'utilities/object';

import Module from 'utilities/module';

import Scroller from './scroller';
import ChatLine from './line';
import SettingsMenu from './settings_menu';
//import EmoteMenu from './emote_menu';


const CHAT_TYPES = (e => {
	e[e.Post = 0] = 'Post';
	e[e.Action = 1] = 'Action';
	e[e.PostWithMention = 2] = 'PostWithMention';
	e[e.Ban = 3] = 'Ban';
	e[e.Timeout = 4] = 'Timeout';
	e[e.AutoModRejectedPrompt = 5] = 'AutoModRejectedPrompt';
	e[e.AutoModMessageRejected = 6] = 'AutoModMessageRejected';
	e[e.AutoModMessageAllowed = 7] = 'AutoModMessageAllowed';
	e[e.AutoModMessageDenied = 8] = 'AutoModMessageDenied';
	e[e.Connected = 9] = 'Connected';
	e[e.Disconnected = 10] = 'Disconnected';
	e[e.Reconnect = 11] = 'Reconnect';
	e[e.Hosting = 12] = 'Hosting';
	e[e.Unhost = 13] = 'Unhost';
	e[e.Subscription = 14] = 'Subscription';
	e[e.Resubscription = 15] = 'Resubscription';
	e[e.SubGift = 16] = 'SubGift';
	e[e.Clear = 17] = 'Clear';
	e[e.SubscriberOnlyMode = 18] = 'SubscriberOnlyMode';
	e[e.FollowerOnlyMode = 19] = 'FollowerOnlyMode';
	e[e.SlowMode = 20] = 'SlowMode';
	e[e.RoomMods = 21] = 'RoomMods';
	e[e.RoomState = 22] = 'RoomState';
	e[e.Raid = 23] = 'Raid';
	e[e.Unraid = 24] = 'Unraid';
	e[e.Notice = 25] = 'Notice';
	e[e.Info = 26] = 'Info';
	e[e.BadgesUpdated = 27] = 'BadgesUpdated';
	e[e.Purchase = 28] = 'Purchase';
	return e;
})({});


const NULL_TYPES = [
	'Reconnect',
	'RoomState',
	'BadgesUpdated'
];


const EVENTS = [
	'onJoinedEvent',
	'onDisconnectedEvent',
	'onReconnectingEvent',
	'onHostingEvent',
	'onUnhostEvent',
	'onChatMessageEvent',
	'onChatActionEvent',
	'onChatNoticeEvent',
	'onTimeoutEvent',
	'onBanEvent',
	'onModerationEvent',
	'onSubscriptionEvent',
	//'onResubscriptionEvent',
	'onSubscriptionGiftEvent',
	'onRoomStateEvent',
	'onSlowModeEvent',
	'onFollowerOnlyModeEvent',
	'onSubscriberOnlyModeEvent',
	'onClearChatEvent',
	'onRaidEvent',
	'onUnraidEvent',
	'onBadgesUpdatedEvent'
];


export default class ChatHook extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.colors = new ColorAdjuster;

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
		//this.inject(EmoteMenu);


		this.ChatController = this.fine.define(
			'chat-controller',
			n => n.chatService
		);

		this.ChatContainer = this.fine.define(
			'chat-container',
			n => n.showViewersList && n.onChatInputFocus
		);

		this.PinnedCheer = this.fine.define(
			'pinned-cheer',
			n => n.collapseCheer && n.saveRenderedMessageRef
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
				path: 'Chat > Bits and Cheering >> Pinned Cheers',
				title: 'Display Pinned Cheer',

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
			c = this.colors;

		// TODO: Get the background color from the theme system.
		// Updated: Use the lightest/darkest colors from alternating rows for better readibility.
		c._base = is_dark ? '#191919' : '#e0e0e0'; //#0e0c13' : '#faf9fa';
		c.mode = mode;
		c.contrast = contrast;

		this.updateChatLines();
	}


	updateChatCSS() {
		const width = this.chat.context.get('chat.width'),
			size = this.chat.context.get('chat.font-size'),
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


	onEnable() {
		this.on('site.web_munch:loaded', () => {
			const ct = this.web_munch.getModule('chat-types');
			this.chat_types = ct && ct.a || CHAT_TYPES;
		})

		const ct = this.web_munch.getModule('chat-types');
		this.chat_types = ct && ct.a || CHAT_TYPES;

		this.chat.context.on('changed:chat.width', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-family', this.updateChatCSS, this);
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
			for(const inst of instances)
				this.containerMounted(inst);
		});


		this.PinnedCheer.on('mount', this.fixPinnedCheer, this);
		this.PinnedCheer.on('update', this.fixPinnedCheer, this);

		this.PinnedCheer.ready((cls, instances) => {
			for(const inst of instances)
				this.fixPinnedCheer(inst);
		});
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


	wrapChatService(cls) {
		const t = this,
			old_handler = cls.prototype.connectHandlers;

		cls.prototype._ffz_was_here = true;

		cls.prototype.connectHandlers = function(...args) {
			if ( ! this._ffz_init ) {
				const i = this,
					pm = this.postMessage;

				for(const key of EVENTS) { // eslint-disable-line guard-for-in
					const original = this[key];
					if ( original )
						this[key] = function(e, t) {
							i._wrapped = e;
							const ret = original.call(i, e, t);
							i._wrapped = null;
							return ret;
						}
				}

				const old_resub = this.onResubscriptionEvent;
				this.onResubscriptionEvent = function(e) {
					try {
						const out = i.convertMessage({message: e});
						out.ffz_type = 'resub';
						out.sub_months = e.months;
						out.sub_plan = e.methods;

						i._wrapped = e;
						const ret = i.postMessage(out);
						i._wrapped = null;
						return ret;

					} catch(err) {
						return old_resub.call(i, e);
					}
				}

				const old_ritual = this.onRitualEvent;
				this.onRitualEvent = function(e) {
					try {
						const out = i.convertMessage(e);
						out.ffz_type = 'ritual';
						out.ritual = e.type;

						i._wrapped = e;
						const ret = i.postMessage(out);
						i._wrapped = null;
						return ret;

					} catch(err) {
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

				this.postMessage = function(e) {
					const original = this._wrapped;
					if ( original ) {
						// Check that the message is relevant to this channel.
						if ( original.channel && this.channelLogin && original.channel.slice(1) !== this.channelLogin.toLowerCase() )
							return;

						const c = e.channel = original.channel;
						if ( c )
							e.roomLogin = c.charAt(0) === '#' ? c.slice(1) : c;

						if ( original.message ) {
							const u = original.message.user;
							if ( u )
								e.emotes = u.emotes;

							if ( original.action )
								e.message = original.action;
							else
								e.message = original.message.body;

							// Twitch doesn't generate a proper emote tag for echoed back
							// actions, so we have to regenerate it. Fun. :D
							if ( u && u.username === i.userLogin )
								e.emotes = findEmotes(e.message, i.selfEmotes);
						}

						//e.original = original;
					}

					//t.log.info('postMessage', e);
					return pm.call(this, e);
				}

				this._ffz_init = true;
			}

			return old_handler.apply(this, ...args);
		}
	}


	updateChatLines() {
		for(const inst of this.PinnedCheer.instances)
			inst.forceUpdate();

		this.chat_line.updateLines();
	}


	// ========================================================================
	// Pinned Cheers
	// ========================================================================

	fixPinnedCheer(inst) {
		const el = this.fine.getHostNode(inst),
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

	for(const part of msg.split(' ')) {
		const len = split_chars(part).length;

		if ( has(emotes, part) ) {
			const em = emotes[part],
				matches = out[em.id] = out[em.id] || [];

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