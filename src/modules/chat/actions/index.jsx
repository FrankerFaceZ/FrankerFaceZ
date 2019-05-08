'use strict';

// ============================================================================
// Emoji Handling
// ============================================================================

import Module from 'utilities/module';
import {has, maybe_call, deep_copy} from 'utilities/object';
import {createElement, ClickOutside} from 'utilities/dom';
import Tooltip from 'utilities/tooltip';

import * as ACTIONS from './types';
import * as RENDERERS from './renderers';
import { transformPhrase } from 'src/i18n';

const VAR_REPLACE = /\{\{(.*?)(?:\|(.*?))?\}\}/g;

export default class Actions extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('tooltips');
		this.inject('i18n');

		this.actions = {};
		this.renderers = {};

		this.settings.add('chat.actions.reasons', {
			default: [
				{v: {text: 'One-Man Spam', i18n: 'chat.reasons.spam'}},
				{v: {text: 'Posting Bad Links', i18n: 'chat.reasons.links'}},
				{v: {text: 'Ban Evasion', i18n: 'chat.reasons.evasion'}},
				{v: {text: 'Threats / Personal Info', i18n: 'chat.reasons.personal'}},
				{v: {text: 'Hate / Harassment', i18n: 'chat.reasons.hate'}},
				{v: {text: 'Ignoring Broadcaster / Moderators', i18n: 'chat.reason.ignore'}}
			],

			type: 'array_merge',
			always_inherit: true,

			// Clean up after Vue being stupid.
			process(ctx, val) {
				if ( Array.isArray(val) )
					for(const entry of val)
						if ( entry.i18n && typeof entry.i18n !== 'string' )
							delete entry.i18n;

				return val;
			},

			ui: {
				path: 'Chat > Actions > Reasons >> Custom Reasons',
				component: 'chat-reasons',
			}
		});

		this.settings.add('chat.actions.inline', {
			// Filter out actions
			process: (ctx, val) =>
				val.filter(x => x.appearance &&
					this.renderers[x.appearance.type] &&
					(! this.renderers[x.appearance.type].load || this.renderers[x.appearance.type].load(x.appearance)) &&
					(! x.action || this.actions[x.action])
				),

			default: [
				{v: {action: 'ban', appearance: {type: 'icon', icon: 'ffz-i-block'}, options: {}, display: {mod: true, mod_icons: true, deleted: false}}},
				{v: {action: 'unban', appearance: {type: 'icon', icon: 'ffz-i-ok'}, options: {}, display: {mod: true, mod_icons: true, deleted: true}}},
				{v: {action: 'timeout', appearance: {type: 'icon', icon: 'ffz-i-clock'}, display: {mod: true, mod_icons: true}}},
				{v: {action: 'msg_delete', appearance: {type: 'icon', icon: 'ffz-i-trash'}, options: {}, display: {mod: true, mod_icons: true}}}
			],

			type: 'array_merge',
			ui: {
				path: 'Chat > Actions > In-Line @{"description": "Here, you can define custom actions that will appear along messages in chat. If you aren\'t seeing an action you\'ve defined here in chat, please make sure that you have enabled Mod Icons in the chat settings menu."}',
				component: 'chat-actions',
				context: ['user', 'room', 'message'],
				inline: true,

				data: () => {
					const chat = this.resolve('site.chat');

					return {
						color: val => chat && chat.colors ? chat.colors.process(val) : val,
						actions: deep_copy(this.actions),
						renderers: deep_copy(this.renderers)
					}
				}
			}
		});

		this.settings.add('chat.actions.room', {
			// Filter out actions
			process: (ctx, val) =>
				val.filter(x => x.type || (x.appearance &&
					this.renderers[x.appearance.type] &&
					(! this.renderers[x.appearance.type].load || this.renderers[x.appearance.type].load(x.appearance)) &&
					(! x.action || this.actions[x.action])
				)),

			default: [],
			type: 'array_merge',
			ui: {
				path: 'Chat > Actions > Room @{"description": "Here, you can define custom actions that will appear above the chat input box."}',
				component: 'chat-actions',
				context: ['room'],
				inline: true,

				data: () => {
					const chat = this.resolve('site.chat');

					return {
						color: val => chat && chat.colors ? chat.colors.process(val) : val,
						actions: deep_copy(this.actions),
						renderers: deep_copy(this.renderers)
					}
				}
			}
		});

		this.settings.add('chat.actions.rules-as-reasons', {
			default: true,
			ui: {
				path: 'Chat > Actions > Reasons >> Rules',
				component: 'setting-check-box',
				title: "Include the current room's rules in the list of reasons."
			}
		});

		this.settings.add('chat.actions.viewer-card', {
			// Filter out actions
			process: (ctx, val) =>
				val.filter(x => x.type || (x.appearance &&
					this.renderers[x.appearance.type] &&
					(! this.renderers[x.appearance.type].load || this.renderers[x.appearance.type].load(x.appearance)) &&
					(! x.action || this.actions[x.action])
				)),

			default: [
				{v: {action: 'friend'}},
				{v: {action: 'whisper', appearance: {type: 'text', text: 'Whisper', button: true}}},
				{v: {type: 'space'}},
				{v: {action: 'card_menu'}},
				{v: {type: 'new-line'}},
				{v: {action: 'ban', appearance: {type: 'icon', icon: 'ffz-i-block'}, display: {mod: true}}},
				{v: {action: 'timeout', appearance: {type: 'icon', icon: 'ffz-i-clock'}, display: {mod: true}}}
			],

			type: 'array_merge',
			_ui: {
				path: 'Chat > Viewer Cards >> tabs ~> Actions @{"description": "Here, you define what actions are available on viewer cards."}',
				component: 'chat-actions',
				context: ['user', 'room', 'product'],

				data: () => {
					const chat = this.resolve('site.chat');

					return {
						color: val => chat && chat.colors ? chat.colors.process(val) : val,
						actions: deep_copy(this.actions),
						renderers: deep_copy(this.renderers)
					}
				}
			}
		})

		this.handleClick = this.handleClick.bind(this);
		this.handleContext = this.handleContext.bind(this);
	}


	onEnable() {
		this.tooltips.types.action = (target, tip) => {
			const data = this.getData(target);
			if ( ! data )
				return this.i18n.t('chat.actions.unknown', 'Unknown Action Type');

			if ( ! data.definition.tooltip )
				return `Error: The "${data.action}" action provider does not have tooltip support.`;

			if ( data.tip && data.tip.length )
				return data.tip;

			return maybe_call(data.definition.tooltip, this, data, target, tip);
		}


		for(const key in ACTIONS)
			if ( has(ACTIONS, key) )
				this.addAction(key, ACTIONS[key]);

		for(const key in RENDERERS)
			if ( has(RENDERERS, key) )
				this.addRenderer(key, RENDERERS[key]);
	}


	addAction(key, data) {
		if ( has(this.actions, key) )
			return this.log.warn(`Attempted to add action "${key}" which is already defined.`);

		this.actions[key] = data;

		for(const ctx of this.settings.__contexts)
			ctx.update('chat.actions.inline');
	}


	addRenderer(key, data) {
		if ( has(this.renderers, key) )
			return this.log.warn(`Attempted to add renderer "${key}" which is already defined.`);

		this.renderers[key] = data;

		for(const ctx of this.settings.__contexts)
			ctx.update('chat.actions.inline');
	}


	replaceVariables(text, data) {
		return transformPhrase(
			text,
			data,
			this.i18n.locale,
			VAR_REPLACE,
			{}
		);
	}


	renderInlineReasons(data, t, tip) {
		const reasons = this.parent.context.get('chat.actions.reasons'),
			reason_elements = [],
			room = this.parent.context.get('chat.actions.rules-as-reasons') && this.parent.getRoom(data.room.id, data.room.login, true),
			rules = room && room.rules;

		if ( ! reasons && ! rules ) {
			tip.hide();
			return null;
		}

		const click_fn = reason => e => {
			tip.hide();
			data.definition.click.call(this, e, Object.assign({reason}, data));
			e.preventDefault();
			return false;
		};

		if ( reasons && reasons.length ) {
			for(const reason of reasons) {
				const text = this.replaceVariables((typeof reason.i18n === 'string') ? this.i18n.t(reason.i18n, reason.text) : reason.text, data);

				reason_elements.push(<li class="tw-full-width tw-relative">
					<a
						href="#"
						onClick={click_fn(text)}
						class="tw-block tw-full-width tw-interactable tw-interactable--inverted tw-interactive tw-pd-05"
					>
						{text}
					</a>
				</li>)
			}
		}

		if ( rules && rules.length ) {
			if ( reasons && reasons.length )
				reason_elements.push(<div class="tw-mg-y-05 tw-border-b"></div>);

			for(const rule of rules) {
				reason_elements.push(<li class="tw-full-width tw-relative">
					<a
						href="#"
						onClick={click_fn(rule)}
						class="tw-block tw-full-width tw-interactable tw-interactable--inverted tw-interactive tw-pd-05"
					>
						{rule}
					</a>
				</li>);
			}
		}

		let reason_text;
		if ( data.definition.reason_text )
			reason_text = data.definition.reason_text.call(this, data, t, tip);
		else
			reason_text = this.i18n.t('chat.actions.select-reason', 'Please select a reason from the list below:');

		return (<div class="ffz--inline-reasons">
			{reason_text ? <div class="tw-pd-05 tw-border-b">
				{reason_text}
			</div> : null}
			<ul>{reason_elements}</ul>
		</div>);
	}


	renderInlineContext(target, data) {
		if ( target._ffz_destroy )
			return target._ffz_destroy();

		const destroy = target._ffz_destroy = () => {
			if ( target._ffz_outside )
				target._ffz_outside.destroy();

			if ( target._ffz_popup ) {
				const fp = target._ffz_popup;
				target._ffz_popup = null;
				fp.destroy();
			}

			target._ffz_destroy = target._ffz_outside = null;
		}

		const definition = data.definition;
		let content;

		if ( definition.context )
			content = (t, tip) => definition.context.call(this, data, t, tip);

		else if ( definition.uses_reason ) {
			content = (t, tip) => this.renderInlineReasons(data, t, tip);

		} else
			return;

		const parent = document.body.querySelector('#root>div') || document.body,
			tt = target._ffz_popup = new Tooltip(parent, target, {
				logger: this.log,
				manual: true,
				live: false,
				html: true,

				tooltipClass: 'ffz-action-balloon tw-balloon tw-block tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base',
				arrowClass: 'tw-balloon__tail tw-overflow-hidden tw-absolute',
				arrowInner: 'tw-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-c-background-base  tw-absolute',
				innerClass: '',

				popper: {
					placement: 'bottom',
					modifiers: {
						preventOverflow: {
							boundariesElement: parent
						},
						flip: {
							behavior: ['bottom', 'top', 'left', 'right']
						}
					}
				},

				content,
				onShow: (t, tip) =>
					setTimeout(() => {
						target._ffz_outside = new ClickOutside(tip.outer, destroy)
					}),

				onHide: destroy
			});

		tt._enter(target);
	}


	getUserLevel(room, user) { // eslint-disable-line class-methods-use-this
		if ( ! room || ! user  )
			return 0;

		if ( room.id === user.id || room.login === user.login )
			return 5;

		else if ( user.moderator || user.type === 'mod' || (user.badges && user.badges.moderator) )
			return 3;

		return 0;
	}


	renderRoom(mod_icons, current_user, current_room, createElement) {
		const actions = [],
			chat = this.resolve('site.chat');

		for(const data of this.parent.context.get('chat.actions.room')) {
			if ( ! data || ! data.action || ! data.appearance )
				continue;

			const ap = data.appearance || {},
				disp = data.display || {},

				def = this.renderers[ap.type];

			if ( ! def || disp.disabled ||
				(disp.mod_icons != null && disp.mod_icons !== !!mod_icons) ||
				(disp.mod != null && disp.mod !== (current_user ? !!current_user.mod : false)) ||
				(disp.staff != null && disp.staff !== (current_user ? !!current_user.staff : false)) )
				continue;

			const has_color = def.colored && ap.color,
				color = has_color && (chat && chat.colors ? chat.colors.process(ap.color) : ap.color),
				contents = def.render.call(this, ap, createElement, color);

			actions.push(<button
				class={`ffz-tooltip ffz-mod-icon mod-icon tw-c-text-alt-2${has_color ? ' colored' : ''}`}
				data-tooltip-type="action"
				data-action={data.action}
				data-options={data.options ? JSON.stringify(data.options) : null}
				data-tip={ap.tooltip}
				onClick={this.handleClick}
				onContextMenu={this.handleContext}
			>
				{contents}
			</button>);
		}

		if ( ! actions.length )
			return null;

		const room = current_room && JSON.stringify(current_room);

		return (<div
			class="ffz--room-actions ffz-action-data tw-pd-y-05 tw-border-t"
			data-room={room}
		>
			{actions}
		</div>)
	}


	renderInline(msg, mod_icons, current_user, current_room, createElement) {
		const actions = [];

		if ( msg.user && current_user && current_user.login === msg.user.login )
			return;

		const current_level = this.getUserLevel(current_room, current_user),
			msg_level = this.getUserLevel(current_room, msg.user);

		if ( current_level < 3 )
			mod_icons = false;

		const chat = this.resolve('site.chat');

		for(const data of this.parent.context.get('chat.actions.inline')) {
			if ( ! data.action || ! data.appearance )
				continue;

			const ap = data.appearance || {},
				disp = data.display || {},

				def = this.renderers[ap.type];

			if ( ! def || disp.disabled ||
				(disp.mod_icons != null && disp.mod_icons !== !!mod_icons) ||
				(disp.mod != null && disp.mod !== (current_level > msg_level)) ||
				(disp.staff != null && disp.staff !== (current_user ? !!current_user.staff : false)) ||
				(disp.deleted != null && disp.deleted !== !!msg.deleted) )
				continue;

			const has_color = def.colored && ap.color,
				color = has_color && (chat && chat.colors ? chat.colors.process(ap.color) : ap.color),
				contents = def.render.call(this, ap, createElement, color);

			actions.push(<button
				class={`ffz-tooltip ffz-mod-icon mod-icon tw-c-text-alt-2${has_color ? ' colored' : ''}`}
				data-tooltip-type="action"
				data-action={data.action}
				data-options={data.options ? JSON.stringify(data.options) : null}
				data-tip={ap.tooltip}
				onClick={this.handleClick}
				onContextMenu={this.handleContext}
			>
				{contents}
			</button>);
		}

		if ( ! actions.length )
			return null;

		/*const room = current_room && JSON.stringify(current_room),
			user = msg.user && JSON.stringify({
				login: msg.user.login,
				displayName: msg.user.displayName,
				id: msg.user.id,
				type: msg.user.type
			});*/

		return (<div
			class="ffz--inline-actions ffz-action-data tw-inline-block tw-mg-r-05"
			data-source="line"
		>
			{actions}
		</div>);
	}


	getData(element) {
		const ds = element.dataset,
			parent = element.closest('.ffz-action-data'),
			pds = parent && parent.dataset,
			action = ds && ds.action,
			definition = this.actions[action];

		if ( ! definition )
			return null;

		let user, room, message, loaded = false;

		if ( pds ) {
			if ( pds.source === 'line' ) {
				const fine = this.resolve('site.fine'),
					line = fine && fine.searchParent(parent, n => n.props && n.props.message);

				if ( line && line.props && line.props.message ) {
					loaded = true;

					const msg = line.props.message;

					user = msg.user ? {
						color: msg.user.color,
						id: msg.user.id,
						login: msg.user.login,
						displayName: msg.user.displayName,
						type: msg.user.type
					} : null;

					room = {
						login: line.props.channelLogin,
						id: line.props.channelID
					}

					message = {
						id: msg.id,
						text: msg.message
					}
				}
			}

			if ( ! loaded ) {
				user = pds.user ? JSON.parse(pds.user) : null;
				room = pds.room ? JSON.parse(pds.room) : null;
				message = pds.message ? JSON.parse(pds.message) : pds.msgId ? {id: pds.msgId} : null;
			}
		}

		const data = {
			action,
			definition,
			tip: ds.tip,
			options: ds.options ? JSON.parse(ds.options) : null,
			user,
			room,
			message,
			message_id: message ? message.id : null
		};

		if ( definition.defaults )
			data.options = Object.assign({}, maybe_call(definition.defaults, this, data, element), data.options);

		return data;
	}


	handleClick(event) {
		const target = event.target,
			data = this.getData(target);
		if ( ! data )
			return;

		if ( ! data.definition.click ) {
			if ( data.definition.context )
				return this.handleContext(event);

			return this.log.warn(`No click handler for action provider "${data.action}"`);
		}

		if ( target._ffz_tooltip$0 )
			target._ffz_tooltip$0.hide();

		return data.definition.click.call(this, event, data);
	}

	handleContext(event) {
		if ( event.shiftKey )
			return;

		event.preventDefault();

		const target = event.target,
			data = this.getData(event.target);
		if ( ! data )
			return;

		if ( target._ffz_tooltip$0 )
			target._ffz_tooltip$0.hide();

		if ( ! data.definition.context && ! data.definition.uses_reason )
			return;

		this.renderInlineContext(event.target, data);
	}


	sendMessage(room, message) {
		return this.resolve('site.chat').sendMessage(room, message);
	}
}