'use strict';

// ============================================================================
// Emoji Handling
// ============================================================================

import Module from 'utilities/module';
import {has, maybe_call, deep_copy} from 'utilities/object';
import {ClickOutside} from 'utilities/dom';
import Tooltip from 'utilities/tooltip';

import * as ACTIONS from './types';
import * as RENDERERS from './renderers';


export default class Actions extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('tooltips');
		this.inject('i18n');

		this.actions = {};
		this.renderers = {};

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
				path: 'Chat > In-Line Actions @{"description": "Here, you can define custom actions that will appear along messages in chat. If you aren\'t seeing an action you\'ve defined here in chat, please make sure that you have enabled Mod Icons in the chat settings menu."}',
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

		const parent = document.body.querySelector('#root>div') || document.body,
			tt = target._ffz_popup = new Tooltip(parent, target, {
				logger: this.log,
				manual: true,
				html: true,

				tooltipClass: 'ffz-action-balloon tw-balloon tw-block tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base',
				arrowClass: 'tw-balloon__tail tw-overflow-hidden tw-absolute',
				arrowInner: 'tw-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-c-background-base  tw-absolute',
				innerClass: 'tw-pd-1',

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

				content: (t, tip) => data.definition.context.call(this, data, t, tip),
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


	renderInline(msg, mod_icons, current_user, current_room, createElement) {
		const actions = [];

		if ( msg.user && current_user && current_user.login === msg.user.login )
			return;

		const current_level = this.getUserLevel(current_room, current_user),
			msg_level = this.getUserLevel(current_room, msg.user);

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

		const room = current_room && JSON.stringify(current_room),
			user = msg.user && JSON.stringify({
				login: msg.user.login,
				displayName: msg.user.displayName,
				id: msg.user.id,
				type: msg.user.type
			});

		return (<div
			class="ffz--inline-actions ffz-action-data tw-inline-block tw-mg-r-05"
			data-msg-id={msg.id}
			data-user={user}
			data-room={room}
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

		const user = pds && pds.user ? JSON.parse(pds.user) : null,
			room = pds && pds.room ? JSON.parse(pds.room) : null,
			message_id = pds && pds.msgId,

			data = {
				action,
				definition,
				tip: ds.tip,
				options: ds.options ? JSON.parse(ds.options) : null,
				user,
				room,
				message_id
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

		if ( ! data.definition.context )
			return;

		if ( target._ffz_tooltip$0 )
			target._ffz_tooltip$0.hide();

		this.renderInlineContext(event.target, data);
	}


	sendMessage(room, message) {
		return this.resolve('site.chat').sendMessage(room, message);
	}
}