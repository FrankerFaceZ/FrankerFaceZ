'use strict';

import {createElement} from 'utilities/dom';


// ============================================================================
// Send Reply
// ============================================================================

export const reply = {
	presets: [{
		appearance: {
			type: 'icon',
			icon: 'ffz-i-reply'
		}
	}],

	required_context: ['message'],

	title: 'Reply to Message',
	description: 'Allows you to directly reply to another user\'s message. Only functions when the Chat Replies Style is "FrankerFaceZ".',

	can_self: true,

	tooltip() {
		return this.i18n.t('chat.actions.reply', 'Reply to Message')
	},

	hidden(data, message, current_room, current_user) {
		const id = message?.id;
		if ( typeof id !== 'string' || ! /^[0-9a-f]+-[0-9a-f]+/.test(id) )
			return true;

		if ( ! message.message || message.deleted || (current_user && current_user.login === message.user?.login) || ! current_user?.can_reply )
			return true;

		if ( message?.reply )
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
	description: '{options.url}',

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
	description: '{options.command}',

	can_self: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-chat.vue'),

	tooltip(data) {
		const msg = this.replaceVariables(data.options.command, data);

		return [
			(<div class="tw-border-b tw-mg-b-05">{ // eslint-disable-line react/jsx-key
				this.i18n.t('chat.actions.chat', 'Chat Command')
			}</div>),
			(<div class="tw-align-left">{ // eslint-disable-line react/jsx-key
				msg
			}</div>)
		]
	},

	click(event, data) {
		const msg = this.replaceVariables(data.options.command, data);
		if ( data.options.paste )
			this.pasteMessage(data.room.login, msg);
		else
			this.sendMessage(data.room.login, msg);
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
		this.sendMessage(data.room.login, `/delete ${data.message_id}`);
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
	description: '{options.duration,number} second{options.duration,en_plural}',

	reason_text(data) {
		return this.i18n.t('chat.actions.timeout-reason',
			'Timeout {user.login} for {duration,number} second{duration,en_plural} for:',
			{
				user: data.user,
				duration: data.options.duration
			}
		);
	},

	tooltip(data) {
		return this.i18n.t(
			'chat.actions.timeout.tooltip',
			'Timeout {user.login} for {duration,number} second{duration,en_plural}',
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