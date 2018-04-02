'use strict';

// ============================================================================
// Host Button
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';

const HOST_ERRORS = {
	COMMAND_EXECUTION: {
		key: 'command-execution',
		text: 'There was an error executing the host command. Please try again later.',
	},
	CHAT_CONNECTION: {
		key: 'chat-connection',
		text: 'There was an issue connecting to chat. Please try again later.',
	}
};

export default class HostButton extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site');
		this.inject('site.fine');
		this.inject('site.chat');
		this.inject('i18n');
		this.inject('metadata');
		this.inject('settings');

		this.settings.add('metadata.host-button', {
			default: true,

			ui: {
				path: 'Channel > Metadata >> Player',
				title: 'Host Button',
				description: 'Show a host button with the current hosted channel in the tooltip.',
				component: 'setting-check-box'
			},

			changed: () => {
				const ffz_user = this.site.getUser(),
					userLogin = ffz_user && ffz_user.login;

				if (userLogin)
					this.joinChannel(userLogin);

				this.metadata.updateMetadata('host');
			}
		});

		this.metadata.definitions.host = {
			order: 150,
			button: true,

			disabled: () => this._host_updating || this._host_error,

			click: data => {
				if (data.channel) this.sendHostUnhostCommand(data.channel.login);
			},

			popup: async (data, tip) => {
				const vue = this.resolve('vue'),
					_host_options_vue = import(/* webpackChunkName: "host-options" */ './host-options.vue'),
					_autoHosts = this.fetchAutoHosts(),
					_autoHostSettings = this.fetchAutoHostSettings();

				const [, host_options_vue, autoHosts, autoHostSettings] = await Promise.all([vue.enable(), _host_options_vue, _autoHosts, _autoHostSettings]);

				this._auto_host_tip = tip;
				tip.element.classList.remove('tw-pd-1');
				tip.element.classList.add('tw-balloon--lg');
				vue.component('host-options', host_options_vue.default);
				return this.buildAutoHostMenu(vue, autoHosts, autoHostSettings, data.channel);
			},

			label: data => {
				if (!this.settings.get('metadata.host-button')) {
					return '';
				}

				const ffz_user = this.site.getUser(),
					userLogin = ffz_user && ffz_user.login;

				if (data.channel && data.channel.login === userLogin) {
					return '';
				}

				if (this._host_updating) {
					return 'Updating...';
				}

				return (this._last_hosted_channel && this.isChannelHosted(data.channel && data.channel.login))
					? this.i18n.t('metadata.host.button.unhost', 'Unhost')
					: this.i18n.t('metadata.host.button.host', 'Host');
			},

			tooltip: () => {
				if (this._host_error) {
					return this.i18n.t(
						`metadata.host.button.tooltip.error.${this._host_error.key}`,
						this._host_error.text);
				} else {
					return this.i18n.t('metadata.host.button.tooltip',
						'Currently hosting: %{channel}',
						{
							channel: this._last_hosted_channel || this.i18n.t('metadata.host.button.tooltip.none', 'None')
						});
				}
			}
		};
	}

	isChannelHosted(channelLogin) {
		return this._last_hosted_channel === channelLogin;
	}

	sendHostUnhostCommand(channel) {
		if (!this._chat_con) {
			this._host_error = HOST_ERRORS.CHAT_CONNECTION;
			this._host_updating = false;
			return;
		}

		const ffz_user = this.site.getUser(),
			userLogin = ffz_user && ffz_user.login;

		const commandData = {channel: userLogin, username: channel};

		this._host_updating = true;
		this.metadata.updateMetadata('host');

		this._host_feedback = setTimeout(() => {
			if (this._last_hosted_channel === null) {
				this._host_error = HOST_ERRORS.COMMAND_EXECUTION;
				this._host_updating = false;
				this.metadata.updateMetadata('host');
			}
		}, 3000);

		if (this.isChannelHosted(channel)) {
			this._chat_con.commands.unhost.execute(commandData);
		} else {
			this._chat_con.commands.host.execute(commandData);
		}
	}

	joinChannel(channel) {
		if (this._chat_con) {
			if (this.settings.get('metadata.host-button') && !this._chat_con.session.channelstate[`#${channel}`]) {
				this._chat_con.joinChannel(channel);
			}
		}
	}

	hookIntoChatConnection(inst) {
		const userLogin = inst.props.userLogin;

		if (this._chat_con) {
			this.joinChannel(userLogin);
			return;
		}

		this.on('tmi:host', e => {
			if (e.channel.substring(1) !== userLogin) return;

			clearTimeout(this._host_feedback);
			this._host_error = false;
			this._last_hosted_channel = e.target;

			this._host_updating = false;
			this.metadata.updateMetadata('host');
		});

		this.on('tmi:unhost', e => {
			if (e.channel.substring(1) !== userLogin) return;

			clearTimeout(this._host_feedback);
			this._host_error = false;
			this._last_hosted_channel = null;

			this._host_updating = false;
			this.metadata.updateMetadata('host');
		});

		const chatServiceClient = inst.chatService.client;

		this._chat_con = chatServiceClient;
		if (this.settings.get('metadata.host-button'))
			this.joinChannel(userLogin);
	}

	onEnable() {
		this.metadata.updateMetadata('host');

		this.chat.ChatController.ready((cls, instances) => {
			for(const inst of instances) {
				if (inst && inst.chatService) this.hookIntoChatConnection(inst);
			}
		});

		this.chat.ChatController.on('mount', this.hookIntoChatConnection, this);
	}

	buildAutoHostMenu(vue, hosts, autoHostSettings, data) {
		this._current_channel_id = data.id;
		this.activeTab = this.activeTab || 'auto-host';

		const vueEl = new vue.Vue({
			el: createElement('div'),
			render: h => this.vueHostMenu = h('host-options', {
				hosts,
				autoHostSettings,
				activeTab: this.activeTab,

				addedToHosts: this.currentRoomInHosts(),
				addToAutoHosts: () => this.addCurrentRoomToHosts(),
				rearrangeHosts: event => this.rearrangeHosts(event.oldIndex, event.newIndex),
				removeFromHosts: event => this.removeUserFromHosts(event),
				setActiveTab: tab => {
					this.vueHostMenu.data.activeTab = this.activeTab = tab;
				},
				updatePopper: () => {
					if (this._auto_host_tip) this._auto_host_tip.update();
				},
				updateCheckbox: e => {
					const t = e.target,
						setting = t.dataset.setting;
					let state = t.checked;

					if ( setting === 'strategy' )
						state = state ? 'random' : 'ordered';
					else if ( setting === 'deprioritize_vodcast' )
						state = ! state;

					this.updateAutoHostSetting(setting, state);
				}
			})
		});

		return vueEl.$el;
	}

	async fetchAutoHosts() {
		const user = this.site.getUser();
		if ( ! user )
			return;

		let data;
		try {
			data = await fetch('https://api.twitch.tv/kraken/autohost/list', {
				headers: {
					'Accept': 'application/vnd.twitchtv.v4+json',
					'Authorization': `OAuth ${user.authToken}`
				}
			}).then(r => {
				if ( r.ok )
					return r.json();

				throw r.status;
			});

		} catch(err) {
			this.log.error('Error loading auto host list.', err);
			return;
		}

		return this.autoHosts = data.targets;
	}

	async fetchAutoHostSettings() {
		const user = this.site.getUser();
		if ( ! user )
			return;

		let data;
		try {
			data = await fetch('https://api.twitch.tv/kraken/autohost/settings', {
				headers: {
					'Accept': 'application/vnd.twitchtv.v4+json',
					'Authorization': `OAuth ${user.authToken}`
				}
			}).then(r => {
				if ( r.ok )
					return r.json();

				throw r.status;
			});

		} catch(err) {
			this.log.error('Error loading auto host settings.', err);
			return;
		}

		return this.autoHostSettings = data.settings;
	}

	queueHostUpdate() {
		if (this._host_update_timer) clearTimeout(this._host_update_timer);

		this._host_update_timer = setTimeout(() => {
			this._host_update_timer = undefined;
			this.updateAutoHosts(this.autoHosts);
		}, 1000);
	}

	rearrangeHosts(oldIndex, newIndex) {
		const host = this.autoHosts.splice(oldIndex, 1)[0];
		this.autoHosts.splice(newIndex, 0, host);

		this.queueHostUpdate();
	}

	currentRoomInHosts() {
		return this.getAutoHostIDs(this.autoHosts).includes(parseInt(this._current_channel_id, 10));
	}

	addCurrentRoomToHosts() {
		const newHosts = this.autoHosts.slice(0);
		newHosts.push({ _id: parseInt(this._current_channel_id, 10)});

		this.updateAutoHosts(newHosts);
	}

	removeUserFromHosts(event) {
		const id = event.target.closest('.ffz--host-user').dataset.id;

		const newHosts = [];
		for (let i = 0; i < this.autoHosts.length; i++) {
			if (this.autoHosts[i]._id != id) newHosts.push(this.autoHosts[i]);
		}

		this.updateAutoHosts(newHosts);
	}

	getAutoHostIDs(hosts) { // eslint-disable-line class-methods-use-this
		const ids = [];
		if (hosts) {
			for (let i = 0; i < hosts.length; i++) {
				ids.push(hosts[i]._id);
			}
		}
		return ids;
	}

	async updateAutoHosts(newHosts) {
		const user = this.site.getUser();
		if ( ! user )
			return;

		let data;
		try {
			const form = new URLSearchParams();
			const autoHosts = this.getAutoHostIDs(newHosts);
			form.append('targets', autoHosts.join(','));

			data = await fetch('https://api.twitch.tv/kraken/autohost/list', {
				headers: {
					'Accept': 'application/vnd.twitchtv.v4+json',
					'Authorization': `OAuth ${user.authToken}`
				},
				method: autoHosts.length ? 'PUT' : 'DELETE',
				body: autoHosts.length ? form : undefined
			}).then(r => {
				if ( r.ok )
					return r.json();

				throw r.status;
			});

		} catch(err) {
			this.log.error('Error updating auto host list.', err);
			return;
		}

		this.autoHosts = data.targets;
		if (this.vueHostMenu) {
			this.vueHostMenu.data.hosts = this.autoHosts;
			this.vueHostMenu.data.addedToHosts = this.currentRoomInHosts();
		}
	}

	async updateAutoHostSetting(setting, newValue) {
		const user = this.site.getUser();
		if ( ! user )
			return;

		let data;
		try {
			const form = new URLSearchParams();
			form.append(setting, newValue);

			data = await fetch('https://api.twitch.tv/kraken/autohost/settings', {
				headers: {
					'Accept': 'application/vnd.twitchtv.v4+json',
					'Authorization': `OAuth ${user.authToken}`
				},
				method: 'PUT',
				body: form
			}).then(r => {
				if ( r.ok )
					return r.json();

				throw r.status;
			});

		} catch(err) {
			this.log.error('Error updating auto host setting.', err);
			return;
		}

		this.autoHostSettings = data.settings;
		if (this.vueHostMenu) {
			this.vueHostMenu.data.autoHostSettings = this.autoHostSettings;
		}
	}
}