'use strict';

import { TranslatableError } from 'src/utilities/object';
import {createElement} from 'utilities/dom';


// ============================================================================
// Pin Message
// ============================================================================

export const pin = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-pin'
		}
	}],

	required_context: ['message'],

	title: 'Pin This Message',
	description: "Allows you to pin a chat message if you're a moderator.",

	can_self: true,

	tooltip(data) {
		const pinned = data.line?.props?.pinnedMessage?.message?.id === data.message_id;
		if (pinned)
			return this.i18n.t('chat.actions.pin.already', 'This message is already pinned.');

		return this.i18n.t('chat.actions.pin', 'Pin This Message')
	},

	disabled(data, message, current_room, current_user, mod_icons, instance) {
		const line = instance ?? data.line,
			props = line?.props,
			pinned = props?.pinnedMessage?.message?.id === message.id && message.id != null;

		return pinned;
	},

	hidden(data, message, current_room, current_user, mod_icons, instance) {
		let line = instance;

		if ( ! line )
			return true;

		if ( ! line.props.isPinnable || ! line.onPinMessageClick )
			return true;

		// If the message is empty or deleted, we can't pin it.
		if ( ! message.message || ! message.message.length || message.deleted )
			return true;
	},

	click(event, data) {
		let line = data.line;
		if ( ! line ) {
			const fine = this.resolve('site.fine');
			line = fine ? fine.searchParent(event.target, n => n.setMessageTray && n.props && n.props.message) : null;
		}

		if ( ! line || ! line.props.isPinnable || ! line.onPinMessageClick )
			return;

		if ( line.props.pinnedMessage?.message?.id === data.message_id )
			return;

		line.onPinMessageClick();
	}
}


// ============================================================================
// Send Reply
// ============================================================================

export const reply = {
	presets: [{
		appearance: {
			type: 'dynamic'
		}
	}],

	required_context: ['message'],
	supports_dynamic: true,

	title: 'Reply to Message',
	description: "Allows you to directly reply to another user's message.",

	can_self: true,

	dynamicAppearance(ap, data, message, current_room, current_user, mod_icons, instance) {
		const line = instance ?? data.line,
			props = line?.props,
			has_reply = props?.hasReply || props?.reply;

		return {
			type: 'icon',
			icon: has_reply ? 'ffz-i-threads' : 'ffz-i-reply',
			color: ap.color
		}
	},

	tooltip(data) {
		const props = data.line?.props,
			has_reply = props?.hasReply || props?.reply;

		if (has_reply)
			return this.i18n.t('chat.actions.reply.thread', 'Open Thread');

		return this.i18n.t('chat.actions.reply', 'Reply to Message')
	},

	hidden(data, message, current_room, current_user) {
		const id = message?.id;
		if ( typeof id !== 'string' || ! /^[0-9a-f]+-[0-9a-f]+/.test(id) )
			return true;

		// Users must be able to reply.
		if ( ! current_user?.can_reply )
			return true;

		// If reply mode is set to 0 (Disabled), don't show the action.
		if ( current_user?.reply_mode === 0 )
			return true;

		// If the message is empty or deleted, don't show the action.
		if ( ! message.message || message.deleted )
			return true;
	},

	click(event, data) {
		let line = data.line;
		if ( ! line ) {
			const fine = this.resolve('site.fine');
			line = fine ? fine.searchParent(event.target, n => n.setMessageTray && n.props && n.props.message) : null;
		}

		if ( ! line )
			return;

		line.ffzOpenReply();
	}
}


// ============================================================================
// Edit Overrides
// ============================================================================

export const edit_overrides = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-pencil'
		}
	}],

	required_context: ['user'],

	title: 'Change Name & Color',
	description: 'Allows you to set local overrides for a user\'s name and color in chat.',

	can_self: true,

	tooltip() {
		return this.i18n.t('chat.actions.edit_overrides', 'Change Name & Color')
	},

	click(event, data) {
		//const ref = makeReference(event.clientX, event.clientY);
		this.resolve('chat.overrides').renderUserEditor(data.user, event.target);
	}
}


// ============================================================================
// Copy to Clipboard
// ============================================================================

export const copy_message = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-docs'
		}
	}],

	defaults: {
		format: '{{user.displayName}}: {{message.text}}'
	},

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-copy.vue'),

	required_context: ['user', 'message'],

	title: 'Copy Message',
	description: 'Allows you to quickly copy a chat message to your clipboard.',

	can_self: true,

	tooltip(data) {
		const msg = this.replaceVariables(data.options.format, data);

		return [
			(<div class="tw-border-b tw-mg-b-05">{ // eslint-disable-line react/jsx-key
				this.i18n.t('chat.actions.copy_message', 'Copy Message')
			}</div>),
			(<div class="tw-align-left">{ // eslint-disable-line react/jsx-key
				msg
			}</div>)
		];
	},

	click(event, data) {
		const msg = this.replaceVariables(data.options.format, data);
		navigator.clipboard.writeText(msg);
	}
}


// ============================================================================
// Open URL
// ============================================================================

export const open_url = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-link-ext'
		}
	}],

	defaults: {
		url: 'https://link.example/{{user.login}}'
	},

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-url.vue'),

	title: 'Open URL',
	description(data) {
		return data.options.url;
	},
	description_i18n: null,

	can_self: true,

	tooltip(data) {
		const url = this.replaceVariables(data.options.url, data);

		return [
			(<div class="tw-border-b tw-mg-b-05">{ // eslint-disable-line react/jsx-key
				this.i18n.t('chat.actions.open_url', 'Open URL')
			}</div>),
			(<div class="tw-align-left">{ // eslint-disable-line react/jsx-key
				url
			}</div>)
		]
	},

	click(event, data) {
		const url = this.replaceVariables(data.options.url, data);

		const win = window.open();
		if ( win ) {
			win.opener = null;
			win.location = url;
		}
	}
};


// ============================================================================
// Chat
// ============================================================================

export const chat = {
	presets: [{
		appearance: {
			type: 'text',
			text: 'C'
		}
	}],

	required_context: ['room'],

	defaults: {
		command: '@{{user.login}} HeyGuys',
		paste: false
	},

	title: 'Chat Command',
	description(data) {
		if ( data.options.paste )
			return this.t('chat.actions.chat.desc.paste', 'Paste into chat: {cmd}', {cmd: data.options.command})

		const target = data.options.target ?? '';

		return this.t('chat.actions.chat.desc.target', 'Send in {target}: {cmd}', {
			cmd: data.options.command,
			target: /^\s*$/.test(target)
				? this.t('chat.actions.chat.desc.current', 'current channel')
				: target
		});
	},
	description_i18n: null,

	can_self: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-chat.vue'),

	tooltip(data) {
		const msg = this.replaceVariables(data.options.command, data);
		let target = this.replaceVariables(data.options.target ?? '', data);
		if ( /^\s*$/.test(target) )
			target = null;

		return [
			(<div class="tw-border-b tw-mg-b-05">{ // eslint-disable-line react/jsx-key
				target
					? this.i18n.t('chat.actions.chat.with-target', 'Chat Command in Channel: {target}', {target})
					: this.i18n.t('chat.actions.chat', 'Chat Command')
			}</div>),
			(<div class="tw-align-left">{ // eslint-disable-line react/jsx-key
				msg
			}</div>)
		]
	},

	click(event, data) {
		const msg = this.replaceVariables(data.options.command, data);
		let target = this.replaceVariables(data.options.target ?? '', data);
		if ( data.options.paste || /^\s*$/.test(target) )
			target = data.room.login;

		if ( data.options.paste )
			this.pasteMessage(target, msg);
		else
			this.sendMessage(target, msg);
	}
}


// ============================================================================
// Timeout
// ============================================================================

export const msg_delete = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-trash'
		},

		display: {
			mod: true,
			mod_icons: true
		}
	}],

	defaults: {},
	required_context: ['room', 'user', 'message'],

	title: 'Delete Message',

	tooltip(data) {
		return this.i18n.t('chat.actions.delete.tooltip', "Delete {user.login}'s message", {user: data.user});
	},

	click(event, data) {
		const td = this.resolve('site.twitch_data');
		return td.deleteChatMessage(data.room.id, data.message_id).catch(err => {
			if ( err instanceof TranslatableError )
				this.addNotice(data.room.login, this.i18n.t(err.i18n_key, err.message, err.data));
		});
	}
}



export const ban = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-block'
		},

		display: {
			mod: true,
			mod_icons: true
		}
	}],

	defaults: {},

	required_context: ['room', 'user'],
	uses_reason: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-ban.vue'),

	title: 'Ban User',

	reason_text(data) {
		return this.i18n.t('chat.actions.ban-reason', 'Ban {user.login} for:', {user: data.user});
	},

	tooltip(data) {
		return this.i18n.t('chat.actions.ban.tooltip', 'Ban {user.login}', {user: data.user});
	},

	click(event, data) {
		let reason = data.reason || data.options.reason || '';
		if ( reason.length )
			reason = this.replaceVariables(reason, data);

		this.sendMessage(data.room.login, `/ban ${data.user.login} ${reason}`);
	}
}


export const timeout = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-clock'
		},

		display: {
			mod: true,
			mod_icons: true
		}
	}],

	defaults: {
		duration: 600
	},

	required_context: ['room', 'user'],
	uses_reason: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-timeout.vue'),

	title: 'Timeout User',
	description: '{options.duration, plural, one {# second} other {# seconds}}',

	reason_text(data) {
		return this.i18n.t('chat.actions.timeout-reason',
			'Timeout {user.login} for {duration, plural, one {# second} other {# seconds}} for:',
			{
				user: data.user,
				duration: data.options.duration
			}
		);
	},

	tooltip(data) {
		return this.i18n.t(
			'chat.actions.timeout.tooltip',
			'Timeout {user.login} for {duration, plural, one {# second} other {# seconds}}',
			{
				user: data.user,
				duration: data.options.duration
			}
		);
	},

	click(event, data) {
		let reason = data.reason || data.options.reason || '';
		if ( reason.length )
			reason = this.replaceVariables(reason, data);

		this.sendMessage(data.room.login, `/timeout ${data.user.login} ${data.options.duration} ${reason}`);
	}
}


export const unban = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-ok'
		},

		display: {
			mod: true,
			mod_icons: true
		}
	}],

	required_context: ['room', 'user'],

	title: 'Unban User',

	tooltip(data) {
		return this.i18n.t('chat.actions.unban.tooltip', 'Unban {user.login}', {user: data.user});
	},

	click(event, data) {
		this.sendMessage(data.room.login, `/unban ${data.user.login}`);
	}
}


export const untimeout = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-ok'
		},

		display: {
			mod: true,
			mod_icons: true
		}
	}],

	required_context: ['room', 'user'],

	title: 'Untimeout User',

	tooltip(data) {
		return this.i18n.t('chat.actions.untimeout.tooltip', 'Untimeout {user.login}', {user: data.user});
	},

	click(event, data) {
		this.sendMessage(data.room.login, `/untimeout ${data.user.login}`);
	}
}


// ============================================================================
// Mod and Unmod User
// ============================================================================

export const mod = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-mod'
		}
	}],

	required_context: ['room', 'user'],

	title: 'Mod User',

	tooltip(data) {
		return this.i18n.t('chat.actions.mod.tooltip', 'Mod {user.login}', {user: data.user});
	},

	hidden(data, message, current_room, current_user, mod_icons, instance) {
		// You cannot mod mods.
		if ( message.user.type === 'mod' )
			return true;

		// You cannot mod the broadcaster.
		if ( message.user.id === current_room.id )
			return true;

		// Only the broadcaster can mod, otherwise.
		return current_room.id !== current_user.id;
	},

	click(event, data) {
		this.sendMessage(data.room.login, `/mod ${data.user.login}`);
	}
};


export const unmod = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-unmod'
		}
	}],

	required_context: ['room', 'user'],

	title: 'Un-Mod User',

	tooltip(data) {
		return this.i18n.t('chat.actions.unmod.tooltip', 'Un-Mod {user.login}', {user: data.user});
	},

	hidden(data, message, current_room, current_user, mod_icons, instance) {
		// You can only un-mod mods.
		if ( message.user.type !== 'mod' )
			return true;

		// You can unmod yourself.
		if ( message.user.id === current_user.id )
			return false;

		// You cannot unmod the broadcaster.
		if ( message.user.id === current_room.id )
			return false;

		// Only the broadcaster can unmod, otherwise.
		return current_room.id !== current_user.id;
	},

	click(event, data) {
		this.sendMessage(data.room.login, `/unmod ${data.user.login}`);
	}
};


// ============================================================================
// Whisper
// ============================================================================

export const whisper = {
	presets: [{
		appearance: {
			type: 'text',
			text: 'W'
		}
	}],

	required_context: ['user'],

	title: 'Whisper User',

	tooltip(data) {
		return this.i18n.t('chat.actions.whisper.tooltip', 'Whisper {user.login}', data);
	},

	click(event, data) {
		const site = this.resolve('site'),
			me = site && site.getUser(),
			store = site && site.store;

		if ( ! me || ! store || ! data.user || ! data.user.id || me.id == data.user.id )
			return;

		const id_1 = parseInt(me.id, 10),
			id_2 = parseInt(data.user.id, 10),
			thread = id_1 < id_2 ? `${id_1}_${id_2}` : `${id_2}_${id_1}`;

		store.dispatch({
			type: 'whispers.THREAD_OPENED',
			data: {
				threadID: thread,
				collapsed: false
			}
		});
	}
}


// ============================================================================
// Gift Subscription
// ============================================================================
/*
export const gift_sub = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-gift'
		}
	}],

	required_context: ['room', 'user', 'product'],

	title: 'Gift Subscription',

	tooltip(data) {
		return this.i18n.t('chat.actions.gift_sub', 'Gift a Sub to {user.login}', data);
	},

	context() {
		return (<div class="tw-border">
			Woop woop.
		</div>);
	}
}*/