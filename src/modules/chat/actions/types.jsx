'use strict';

import {createElement} from 'utilities/dom';
import {transformPhrase} from 'src/i18n';

const VAR_REPLACE = /\{\{(.*?)(?:\|(.*?))?\}\}/g;

const process = (input, data, locale = 'en') => transformPhrase(input, data, locale, VAR_REPLACE, {});


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
	description: '%{options.url}',

	tooltip(data) {
		const url = process(data.options.url, data, this.i18n.locale);

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
		const url = process(data.options.url, data, this.i18n.locale);

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
		command: '@{{user.login}} HeyGuys'
	},

	title: 'Chat Command',
	description: '%{options.command}',

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-chat.vue'),

	process(data) {
		return transformPhrase(
			data.options.command,
			data,
			this.i18n.locale,
			VAR_REPLACE,
			{}
		)
	},

	tooltip(data) {
		const msg = process(data.options.command, data, this.i18n.locale);

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
		const msg = data.definition.process.call(this, data);
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
		return this.i18n.t('chat.actions.delete', "Delete %{user.login}'s message", {user: data.user});
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

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-ban.vue'),

	title: 'Ban User',

	tooltip(data) {
		return this.i18n.t('chat.actions.ban', 'Ban %{user.login}', {user: data.user});
	},

	click(event, data) {
		this.sendMessage(data.room.login, `/ban ${data.user.login} ${data.reason||data.options.reason||''}`);
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

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-timeout.vue'),

	title: 'Timeout User',
	description: '%{options.duration} second%{options.duration|en_plural}',

	tooltip(data) {
		return this.i18n.t(
			'chat.actions.timeout',
			'Timeout %{user.login} for %{duration} second%{duration|en_plural}',
			{
				user: data.user,
				duration: data.options.duration
			}
		);
	},

	click(event, data) {
		this.sendMessage(data.room.login, `/timeout ${data.user.login} ${data.options.duration} ${data.reason||data.options.reason||''}`);
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
		return this.i18n.t('chat.actions.unban', 'Unban %{user.login}', {user: data.user});
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
		return this.i18n.t('chat.actions.untimeout', 'Untimeout %{user.login}', {user: data.user});
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
		return this.i18n.t('chat.actions.whisper', 'Whisper %{user.login}', data);
	},

	click(event, data) {
		const site = this.resolve('site'),
			me = site && site.getUser(),
			store = site && site.store;

		if ( ! me || ! store || ! data.user.id || me.id == data.user.id )
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
		return this.i18n.t('chat.actions.gift_sub', 'Gift a Sub to %{user.login}', data);
	},

	context() {
		return (<div class="tw-border">
			Woop woop.
		</div>);
	}
}*/