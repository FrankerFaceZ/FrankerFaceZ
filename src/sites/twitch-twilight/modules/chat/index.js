'use strict';

// ============================================================================
// Chat Hooks
// ============================================================================

import {ColorAdjuster} from 'utilities/color';
import {setChildren} from 'utilities/dom';
import {has} from 'utilities/object';

import Module from 'utilities/module';

import Scroller from './scroller';


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
	'onResubscriptionEvent',
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


		this.ChatController = this.fine.define(
			'chat-controller',
			n => n.chatService
		);

		this.ChatContainer = this.fine.define(
			'chat-container',
			n => n.showViewersList && n.onChatInputFocus
		);

		this.ChatLine = this.fine.define(
			'chat-line',
			n => n.renderMessageBody
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
				description: 'How wide chat should be, in pixels.',
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val <= 0 )
						return 340;

					return val;
				}
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
		c._base = is_dark ? '#0e0c13' : '#faf9fa';
		c.mode = mode;
		c.contrast = contrast;

		this.updateChatLines();
	}


	updateChatWidth() {
		const width = this.chat.context.get('chat.width');
		if ( width === 340 )
			this.css_tweaks.style.delete('chat-width');
		else
			this.css_tweaks.style.set('chat-width', `.channel-page__right-column{width:${width}px!important}`);
	}

	updateLineBorders() {
		const mode = this.chat.context.get('chat.lines.borders');

		this.css_tweaks.toggle('chat-borders', mode > 0);
		this.css_tweaks.toggle('chat-borders-3d', mode === 2);
		this.css_tweaks.toggle('chat-borders-3d-inset', mode === 3);
		this.css_tweaks.toggle('chat-borders-wide', mode === 4);
	}


	onEnable() {
		this.chat.context.on('changed:chat.width', this.updateChatWidth, this);
		this.chat.context.on('changed:chat.bits.stack', this.updateChatLines, this);
		this.chat.context.on('changed:chat.adjustment-mode', this.updateColors, this);
		this.chat.context.on('changed:chat.adjustment-contrast', this.updateColors, this);
		this.chat.context.on('changed:theme.is-dark', this.updateColors, this);
		this.chat.context.on('changed:chat.lines.borders', this.updateLineBorders, this);

		this.chat.context.on('changed:chat.lines.alternate', val =>
			this.css_tweaks.toggle('chat-rows', val));

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

		this.updateChatWidth();
		this.updateColors();
		this.updateLineBorders();

		this.ChatController.on('mount', this.chatMounted, this);
		this.ChatController.on('unmount', this.removeRoom, this);
		this.ChatController.on('receive-props', this.chatUpdated, this);

		this.ChatController.ready((cls, instances) => {
			for(const inst of instances) {
				const service = inst.chatService;
				if ( ! service._ffz_was_here )
					this.wrapChatService(service.constructor);

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


		const React = this.web_munch.getModule('react');

		if ( React ) {
			const t = this,
				e = React.createElement;

			this.ChatLine.ready((cls, instances) => {
				cls.prototype.shouldComponentUpdate = function(props, state) {
					const show = state.alwaysShowMessage || ! props.message.deleted,
						old_show = this._ffz_show;

					// We can't just compare props.message.deleted to this.props.message.deleted
					// because the message object is the same object. So, store the old show
					// state for later reference.
					this._ffz_show = show;

					return show !== old_show ||
						//state.renderDebug !== this.state.renderDebug ||
						props.message !== this.props.message ||
						props.isCurrentUserModerator !== this.props.isCurrentUserModerator ||
						props.showModerationIcons !== this.props.showModerationIcons ||
						props.showTimestamps !== this.props.showTimestamps;
				}

				//const old_render = cls.prototype.render;

				cls.prototype.render = function() {
					const msg = this.props.message,
						is_action = msg.type === 1,
						user = msg.user,
						color = t.colors.process(user.color),
						room = msg.channel ? msg.channel.slice(1) : undefined,

						show = this.state.alwaysShowMessage || ! this.props.message.deleted;

					if ( ! msg.message && msg.messageParts )
						detokenizeMessage(msg);

					const tokens = t.chat.tokenizeMessage(msg),
						fragment = t.chat.renderTokens(tokens, e);

					return e('div', {
						className: 'chat-line__message',
						'data-room-id': this.props.channelID,
						'data-room': room,
						'data-user-id': user.userID,
						'data-user': user.userLogin,

						//onClick: () => this.setState({renderDebug: ((this.state.renderDebug||0) + 1) % 3})
					}, [
						this.props.showTimestamps && e('span', {
							className: 'chat-line__timestamp'
						}, t.chat.formatTime(msg.timestamp)),
						this.renderModerationIcons(),
						e('span', {
							className: 'chat-line__message--badges'
						}, t.chat.renderBadges(msg, e)),
						e('a', {
							className: 'chat-author__display-name',
							style: { color },
							onClick: this.usernameClickHandler
						}, user.userDisplayName),
						user.isIntl && e('span', {
							className: 'chat-author__intl-login',
							style: { color },
							onClick: this.usernameClickHandler
						}, ` (${user.userLogin})`),
						e('span', null, is_action ? ' ' : ': '),
						show ?
							e('span', {
								className:'message',
								style: is_action ? { color } : null
							}, fragment)
							:
							e('span', {
								className: 'chat-line__message--deleted',
							}, e('a', {
								href: '',
								onClick: this.alwaysShowMessage
							}, `<message deleted>`)),

						/*this.state.renderDebug === 2 && e('div', {
							className: 'border mg-t-05'
						}, old_render.call(this)),

						this.state.renderDebug === 1 && e('div', {
							className: 'message--debug',
							style: {
								fontFamily: 'monospace',
								whiteSpace: 'pre-wrap',
								lineHeight: '1.1em'
							}
						}, JSON.stringify([tokens, msg.emotes], null, 2))*/
					])
				}

				for(const inst of instances)
					inst.forceUpdate();
			});
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

				this.postMessage = function(e) {
					const original = this._wrapped;
					if ( original ) {
						// Check that the message is relevant to this channel.
						if ( original.channel && original.channel.slice(1) !== this.channelLogin )
							return;

						const c = e.channel = original.channel;
						if ( c )
							e.roomLogin = c.charAt(0) === '#' ? c.slice(1) : c;

						if ( original.message ) {
							if ( original.action )
								e.message = original.action;
							else
								e.message = original.message.body;

							if ( original.message.user )
								e.emotes = original.message.user.emotes;
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

		for(const inst of this.ChatLine.instances)
			inst.forceUpdate();
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
		container.dataset.room = inst.props.channelLogin;
		container.dataset.userId = tc.user.userID;
		container.dataset.user = tc.user.userLogin;

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

		const room = thing._ffz_room = this.chat.getRoom(props.channelID, props.channelLogin, false, true);
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
			channel: props.channelLogin,
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

		if ( props.badgeSets ) {
			this.chat.updateBadges(props.badgeSets.globalsBySet);
			this.updateRoomBadges(cont, props.badgeSets.channelsBySet);
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
		const bs = props.badgeSets,
			obs = cont.props.badgeSets,

			bsgl = bs.globalsBySet && bs.globalsBySet.size || 0,
			obsgl = obs.globalsBySet && obs.globalsBySet.size || 0,

			bscl = bs.channelsBySet && bs.channelsBySet.size || 0,
			obscl = obs.channelsBySet && obs.channelsBySet.size || 0;

		if ( bsgl !== obsgl )
			this.chat.updateBadges(bs.globalsBySet);

		if ( bscl !== obscl )
			this.updateRoomBadges(cont, bs.channelsBySet);
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


function extractCheerPrefix(parts) {
	for(const part of parts) {
		if ( part.type !== 3 || ! part.content.cheerAmount )
			continue;

		return part.content.alt;
	}

	return null;
}


export function detokenizeMessage(msg) {
	const out = [],
		parts = msg.messageParts,
		l = parts.length,
		emotes = {};

	let idx = 0, ret, last_type = null;

	for(let i=0; i < l; i++) {
		const part = parts[i],
			type = part.type,
			content = part.content;

		if ( type === 0 )
			ret = content;

		else if ( type === 1 )
			ret = `@${content.recipient}`;

		else if ( type === 2 )
			ret = content.displayText;

		else if ( type === 3 ) {
			if ( content.cheerAmount ) {
				ret = `${content.alt}${content.cheerAmount}`;

			} else {
				const url = (content.images.themed ? content.images.dark : content.images.sources)['1x'],
					match = /\/emoticons\/v1\/(\d+)\/[\d.]+$/.exec(url),
					id = match && match[1];

				ret = content.alt;

				if ( id ) {
					const em = emotes[id] = emotes[id] || [],
						offset = last_type > 0 ? 1 : 0;
					em.push({startIndex: idx + offset, endIndex: idx + ret.length - 1});
				}
			}

			if ( last_type > 0 )
				ret = ` ${ret}`;

		} else if ( type === 4 )
			ret = `https://clips.twitch.tv/${content.slug}`;

		if ( ret ) {
			idx += ret.length;
			last_type = type;
			out.push(ret);
		}
	}

	msg.message = out.join('');
	msg.emotes = emotes;
	return msg;
}