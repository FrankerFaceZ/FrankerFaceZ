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

		this.settings.add('chat.actions.size', {
			default: 16,
			ui: {
				path: 'Chat > Actions @{"always_list_pages": true} >> Appearance',
				title: 'Action Size',
				description: "How tall actions should be, in pixels. This may be affected by your browser's zoom and font size settings.",
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val <= 0 )
						return 16;

					return val;
				}
			}
		});

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
				{v: {action: 'msg_delete', appearance: {type: 'icon', icon: 'ffz-i-trash'}, options: {}, display: {mod: true, mod_icons: true}}},
				{v: {action: 'reply', appearance: {type: 'icon', icon: 'ffz-i-reply'}, options: {}, display: {}}}
			],

			type: 'array_merge',
			inherit_default: true,

			ui: {
				path: 'Chat > Actions > In-Line @{"description": "Here, you can define custom actions that will appear along messages in chat. If you aren\'t seeing an action you\'ve defined here in chat, please make sure that you have enabled Mod Icons in the chat settings menu."}',
				component: 'chat-actions',
				context: ['user', 'room', 'message'],
				inline: true,
				modifiers: true,

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

		this.settings.add('chat.actions.user-context', {
			// Filter out actions
			process: (ctx, val) =>
				val.filter(x => x.type || (x.appearance &&
					this.renderers[x.appearance.type] &&
					(! this.renderers[x.appearance.type].load || this.renderers[x.appearance.type].load(x.appearance)) &&
					(! x.action || this.actions[x.action])
				)),

			default: [],
			type: 'array_merge',
			inherit_default: true,

			ui: {
				path: 'Chat > Actions > User Context @{"description": "Here, you can define custom actions that will appear in a context menu when you right-click a username in chat."}',
				component: 'chat-actions',
				context: ['user', 'room', 'message'],
				mod_icons: true,

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
			inherit_default: true,

			ui: {
				path: 'Chat > Actions > Room @{"description": "Here, you can define custom actions that will appear above the chat input box."}',
				component: 'chat-actions',
				context: ['room', 'room-mode'],
				inline: false,

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

		this.settings.add('chat.actions.room-above', {
			default: false,
			ui: {
				path: 'Chat > Actions > Room >> General',
				component: 'setting-check-box',
				title: 'Display Room Actions above the chat input box.'
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

		this.handleClick = this.handleClick.bind(this);
		this.handleContext = this.handleContext.bind(this);
		this.handleUserContext = this.handleUserContext.bind(this);
	}


	onEnable() {
		this.tooltips.types.action = (target, tip) => {
			const data = this.getData(target);
			if ( ! data )
				return this.i18n.t('chat.actions.unknown', 'Unknown Action Type');

			if ( ! data.definition.tooltip )
				return `Error: The "${data.action}" action provider does not have tooltip support.`;

			if ( data.tip && data.tip.length )
				return this.replaceVariables(data.tip, data);

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
						class="tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive tw-pd-05"
						onClick={click_fn(text)}
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
						class="tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive tw-pd-05"
						onClick={click_fn(rule)}
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
		const definition = data.definition;
		let content;

		if ( definition.context )
			content = (t, tip) => definition.context.call(this, data, t, tip);

		else if ( definition.uses_reason ) {
			content = (t, tip) => this.renderInlineReasons(data, t, tip);

		} else
			return;

		return this.renderPopup(target, content);
	}


	renderPopup(target, content) {
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

			if ( target._ffz_on_destroy )
				target._ffz_on_destroy();

			target._ffz_destroy = target._ffz_outside = target._ffz_on_destroy = null;
		}

		const parent = document.fullscreenElement || document.body.querySelector('#root>div') || document.body,
			tt = target._ffz_popup = new Tooltip(parent, target, {
				logger: this.log,
				manual: true,
				live: false,
				html: true,
				hover_events: true,
				no_update: true,

				tooltipClass: 'ffz-action-balloon ffz-balloon tw-block tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base',
				arrowClass: 'ffz-balloon__tail tw-overflow-hidden tw-absolute',
				arrowInner: 'ffz-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-c-background-base  tw-absolute',
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
				onShow: async (t, tip) => {
					await tip.waitForDom();
					target._ffz_outside = new ClickOutside(tip.outer, destroy)
				},

				onMove: (target, tip, event) => {
					this.emit('tooltips:mousemove', target, tip, event)
				},

				onLeave: (target, tip, event) => {
					this.emit('tooltips:leave', target, tip, event);
				},

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


	renderRoom(mod_icons, current_user, current_room, is_above, createElement) {
		const lines = [],
			chat = this.resolve('site.chat');
		let line = null;

		for(const data of this.parent.context.get('chat.actions.room')) {
			if ( ! data )
				continue;

			const type = data.type;
			if ( type ) {
				if ( type === 'new-line' ) {
					line = null;

				} else if ( type === 'space' ) {
					if ( ! line )
						lines.push(line = []);

					line.push(<div class="tw-flex-grow-1" />);

				} else if ( type === 'space-small' ) {
					if ( ! line )
						lines.push(line = []);

					line.push(<div class="tw-mg-x-1" />);

				} else
					this.log.warn('Unknown action type', type);

				continue;
			}

			if ( ! data.action || ! data.appearance )
				continue;

			let ap = data.appearance || {};
			const disp = data.display || {},
				act = this.actions[data.action];

			if ( ! act || disp.disabled ||
				(disp.mod_icons != null && disp.mod_icons !== !!mod_icons) ||
				(disp.mod != null && disp.mod !== (current_user ? !!current_user.mod : false)) ||
				(disp.staff != null && disp.staff !== (current_user ? !!current_user.staff : false)) ||
				(disp.emoteOnly != null && disp.emoteOnly !== current_room.emoteOnly) ||
				(disp.slowMode != null && disp.slowMode !== current_room.slowMode) ||
				(disp.subsMode != null && disp.subsMode !== current_room.subsMode) ||
				(disp.r9kMode != null && disp.r9kMode !== current_room.r9kMode) ||
				(disp.followersOnly != null && disp.followersOnly !== current_room.followersOnly) )
				continue;

			if ( maybe_call(act.hidden, this, data, null, current_room, current_user, mod_icons) )
				continue;

			if ( act.override_appearance ) {
				const out = act.override_appearance.call(this, Object.assign({}, ap), data, null, current_room, current_user, mod_icons);
				if ( out )
					ap = out;
			}

			const def = this.renderers[ap.type];
			if ( ! def )
				continue;

			const has_color = def.colored && ap.color,
				disabled = maybe_call(act.disabled, this, data, null, current_room, current_user, mod_icons) || false,
				color = has_color && (chat && chat.colors ? chat.colors.process(ap.color) : ap.color),
				contents = def.render.call(this, ap, createElement, color);

			if ( ! line )
				lines.push(line = []);

			line.push(<button
				class={`ffz-tooltip tw-pd-x-05 mod-icon ffz-mod-icon tw-c-text-alt-2${disabled ? ' disabled' : ''}${has_color ? ' colored' : ''}`}
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

		if ( ! lines.length )
			return null;

		const room = current_room && JSON.stringify(current_room),
			multi_line = lines.length > 1;

		const actions = multi_line ?
			lines.map((line, idx) => <div key={idx} class="tw-flex tw-full-width tw-flex-row tw-flex-wrap">{line}</div>) :
			lines[0];

		return (<div
			class={`ffz--room-actions${multi_line ? ' tw-flex-column' : ''} ffz-action-data tw-flex tw-flex-grow-1 tw-flex-wrap tw-align-items-center ${is_above ? 'tw-pd-y-05 tw-border-t' : 'tw-mg-x-05'}`}
			data-room={room}
		>
			{actions}
		</div>)
	}


	renderUserContext(target, actions) {
		const fine = this.resolve('site.fine'),
			site = this.resolve('site'),
			chat = this.resolve('site.chat'),
			line = fine && fine.searchParent(target, n => n.props && n.props.message);

		const msg = line?.props?.message;
		if ( ! msg || ! site || ! chat )
			return;

		let room = msg.roomLogin ? msg.roomLogin : msg.channel ? msg.channel.slice(1) : undefined;
		if ( ! room && line.props.channelID ) {
			const r = this.parent.getRoom(line.props.channelID, null, true);
			if ( r && r.login )
				room = msg.roomLogin = r.login;
		}

		const u = site.getUser(),
			r = {id: line.props.channelID, login: room};

		const has_replies = line.chatRepliesTreatment ? line.chatRepliesTreatment !== 'control' : false,
			can_replies = has_replies && ! msg.deleted && ! line.props.disableReplyClick,
			can_reply = can_replies && u.login !== msg.user?.login && ! msg.reply;

		msg.roomId = r.id;

		if ( u ) {
			u.moderator = line.props.isCurrentUserModerator;
			u.staff = line.props.isCurrentUserStaff;
			u.can_reply = this.parent.context.get('chat.replies.style') === 2 && can_reply;
		}

		const current_level = this.getUserLevel(r, u),
			msg_level = this.getUserLevel(r, msg.user);

		let mod_icons = line.props.showModerationIcons;
		if ( current_level < 3 )
			mod_icons = false;

		const chat_line = line;

		return this.renderPopup(target, (t, tip) => {
			const lines = [];
			let line = null;

			const handle_click = event => {
				this.handleClick(event, line);
				tip.hide();
			};

			for(const data of actions) {
				if ( ! data )
					continue;

				if ( data.type === 'new-line' ) {
					line = null;
					continue;

				} else if ( data.type === 'space-small' ) {
					if ( ! line )
						lines.push(line = []);

					line.push(<div class="tw-pd-x-1" />);
					continue;

				} else if ( data.type === 'space' ) {
					if ( ! line )
						lines.push(line = []);

					line.push(<div class="tw-flex-grow-1" />);
					continue;

				} else if ( ! data.action || ! data.appearance )
					continue;

				let ap = data.appearance || {};
				const disp = data.display || {},
					act = this.actions[data.action];

				if ( ! act || disp.disabled ||
					(disp.mod_icons != null && disp.mod_icons !== !!mod_icons) ||
					(disp.mod != null && disp.mod !== (current_level > msg_level)) ||
					(disp.staff != null && disp.staff !== (u ? !!u.staff : false)) ||
					(disp.deleted != null && disp.deleted !== !!msg.deleted) )
					continue;

				if ( maybe_call(act.hidden, this, data, msg, r, u, mod_icons) )
					continue;

				if ( act.override_appearance ) {
					const out = act.override_appearance.call(this, Object.assign({}, ap), data, msg, r, u, mod_icons);
					if ( out )
						ap = out;
				}

				const def = this.renderers[ap.type];
				if ( ! def )
					continue;

				const has_color = def.colored && ap.color,
					disabled = maybe_call(act.disabled, this, data, msg, r, u, mod_icons) || false,
					color = has_color && (chat && chat.colors ? chat.colors.process(ap.color) : ap.color),
					contents = def.render.call(this, ap, createElement, color);

				if ( ! line )
					lines.push(line = []);

				const btn = (<button
					class={`ffz-tooltip ffz-tooltip--no-mouse tw-button tw-button--text${disabled ? ' tw-button--disabled disabled' : ''}`}
					disabled={disabled}
					data-tooltip-type="action"
					data-action={data.action}
					data-options={data.options ? JSON.stringify(data.options) : null}
					onClick={handle_click} // eslint-disable-line react/jsx-no-bind
					onContextMenu={this.handleContext}
				>
					<span class="tw-button__text">
						{contents}
					</span>
				</button>);

				if ( ap.tooltip )
					btn.dataset.tip = ap.tooltip;

				line.push(btn);
			}

			const out = (<div class="ffz-action-data tw-pd-05" data-source="msg">
				<div class="tw-pd-b-05 tw-border-b">
					<strong>{ msg.user.displayName || msg.user.login }</strong>...
				</div>
				{lines.map(line => {
					if ( ! line || ! line.length )
						return null;

					return (<div class="tw-flex tw-flex-no-wrap">
						{line}
					</div>);
				})}
			</div>);

			out.ffz_message = msg;
			out.ffz_line = chat_line;
			return out;
		});
	}


	renderInline(msg, mod_icons, current_user, current_room, createElement) {
		const actions = [];

		const current_level = this.getUserLevel(current_room, current_user),
			msg_level = this.getUserLevel(current_room, msg.user),
			is_self = msg.user && current_user && current_user.login === msg.user.login;

		if ( current_level < 3 )
			mod_icons = false;

		const chat = this.resolve('site.chat'),
			modified = [];

		let had_action = false;

		for(const data of this.parent.context.get('chat.actions.inline')) {
			if ( ! data.action || ! data.appearance )
				continue;

			let ap = data.appearance || {};
			const disp = data.display || {},
				keys = disp.keys,
				hover = disp.hover,
				act = this.actions[data.action];

			if ( ! act || disp.disabled ||
				(disp.mod_icons != null && disp.mod_icons !== !!mod_icons) ||
				(disp.mod != null && disp.mod !== (current_level > msg_level)) ||
				(disp.staff != null && disp.staff !== (current_user ? !!current_user.staff : false)) ||
				(disp.deleted != null && disp.deleted !== !!msg.deleted) )
				continue;

			if ( is_self && ! act.can_self )
				continue;

			if ( maybe_call(act.hidden, this, data, msg, current_room, current_user, mod_icons) )
				continue;

			if ( act.override_appearance ) {
				const out = act.override_appearance.call(this, Object.assign({}, ap), data, msg, current_room, current_user, mod_icons);
				if ( out )
					ap = out;
			}

			const def = this.renderers[ap.type];
			if ( ! def )
				continue;

			const has_color = def.colored && ap.color,
				disabled = maybe_call(act.disabled, this, data, msg, current_room, current_user, mod_icons) || false,
				color = has_color && (chat && chat.colors ? chat.colors.process(ap.color) : ap.color),
				contents = def.render.call(this, ap, createElement, color);

			let list = actions;

			if ( keys || hover )
				list = modified;

			had_action = true;
			list.push(<button
				class={`ffz-tooltip mod-icon ffz-mod-icon tw-c-text-alt-2${disabled ? ' disabled' : ''}${has_color ? ' colored' : ''}${keys ? ` ffz-modifier-${keys}` : ''}${hover ? ' ffz-hover' : ''}`}
				disabled={disabled}
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

		if ( ! had_action )
			return null;

		/*const room = current_room && JSON.stringify(current_room),
			user = msg.user && JSON.stringify({
				login: msg.user.login,
				displayName: msg.user.displayName,
				id: msg.user.id,
				type: msg.user.type
			});*/

		let out = null;
		if ( actions.length )
			out = (<div
				class="ffz--inline-actions ffz-action-data tw-inline-block tw-mg-r-05"
				data-source="line"
			>
				{actions}
			</div>);

		if ( modified.length ) {
			const modified_out = (<div
				class="ffz--inline-actions ffz--modifier-actions ffz-action-data"
				data-source="line"
			>
				{modified}
			</div>);

			if ( out )
				return [out, modified_out];
			return modified_out;
		}

		return out;
	}


	getData(element) {
		const ds = element.dataset,
			parent = element.closest('.ffz-action-data'),
			pds = parent && parent.dataset,
			action = ds && ds.action,
			definition = this.actions[action];

		if ( ! definition )
			return null;

		let user, room, message, loaded = false, line;

		if ( pds ) {
			if ( pds.source === 'msg' && parent.ffz_message ) {
				const msg = parent.ffz_message;
				line = parent.ffz_line;

				loaded = true;
				user = msg.user ? {
					color: msg.user.color,
					id: msg.user.id,
					login: msg.user.login,
					displayName: msg.user.displayName,
					type: msg.user.type
				} : null;

				room = {
					login: msg.roomLogin,
					id: msg.roomId
				};

				message = {
					id: msg.id,
					text: msg.message
				};

			} else if ( pds.source === 'line' ) {
				const fine = this.resolve('site.fine');
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
			message_id: message ? message.id : null,
			line
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

		if ( target.classList.contains('disabled') )
			return;

		if ( ! data.definition.click ) {
			if ( data.definition.context )
				return this.handleContext(event);

			return this.log.warn(`No click handler for action provider "${data.action}"`);
		}

		if ( target._ffz_tooltip )
			target._ffz_tooltip.hide();

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

		if ( target.classList.contains('disabled') )
			return;

		if ( target._ffz_tooltip )
			target._ffz_tooltip.hide();

		if ( ! data.definition.context && ! data.definition.uses_reason )
			return;

		this.renderInlineContext(target, data);
	}

	handleUserContext(event) {
		if ( event.shiftKey )
			return;

		const actions = this.parent.context.get('chat.actions.user-context');
		if ( ! Array.isArray(actions) || ! actions.length )
			return;

		event.preventDefault();

		const target = event.target;
		if ( target._ffz_tooltip )
			target._ffz_tooltip.hide();

		this.renderUserContext(target, actions);
	}

	pasteMessage(room, message) {
		return this.resolve('site.chat.input').pasteMessage(room, message);
	}


	sendMessage(room, message) {
		return this.resolve('site.chat').sendMessage(room, message);
	}
}