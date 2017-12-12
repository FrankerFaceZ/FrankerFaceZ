'use strict';

// ============================================================================
// Host Button
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';

export default class HostButton extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('metadata');

		this.metadata.definitions.host = {
			order: 150,
			button: true,

			disabled: () => {
				return this._host_updating;	
			},
			
			click: (data, event) => {
				if (data.channel) this.sendHostUnhostCommand(data.channel.login);
			},

			popup: async (data, tip) => {
				const vue = this.resolve('vue'),
					_host_options_vue = import(/* webpackChunkName: "host-options" */ './host-options.vue'),
					_autoHosts = this.fetchAutoHosts(),
					_autoHostSettings = this.fetchAutoHostSettings();
				
				const [, host_options_vue, autoHosts, autoHostSettings] = await Promise.all([vue.enable(), _host_options_vue, _autoHosts, _autoHostSettings]);

				this._auto_host_tip = tip;
				tip.element.classList.remove('pd-1');
				tip.element.classList.add('tw-balloon--lg');
				vue.component('host-options', host_options_vue.default);
				return this.buildAutoHostMenu(vue, autoHosts, autoHostSettings, data.channel);
			},

			label: data => {
				if (this._host_updating) {
					return '<figure class="ffz-i-zreknarf loading"/>';
				}

				return (this._last_hosted_channel && this.isChannelHosted(data.channel && data.channel.login)) ? 'Unhost' : 'Host';
			},

			tooltip: () => {
				return `Currently hosting: ${this._last_hosted_channel || 'None'}`;
			}
		};
	}

	sendHostUnhostCommand(channel) {
		if (!this._chat_con) return;

		const ffz_user = ffz.site.getUser(),
			userLogin = ffz_user && ffz_user.login;

		const commandData = {channel: userLogin, username: channel};

		this._host_updating = true;
		this.metadata.updateMetadata('host');

		if (this.isChannelHosted(channel)) {
			this._chat_con.commands.unhost.execute(commandData);
		} else {
			this._chat_con.commands.host.execute(commandData);
		}
	}

	hookIntoChatConnection(inst) {
		if (this._chat_con) return;

		const userLogin = inst.props.userLogin;

		this.on('tmi:host', (e, t) => {
			if (e.channel.substring(1) !== userLogin) return;

			this._last_hosted_channel = e.target;
			
			this._host_updating = false;
			this.metadata.updateMetadata('host');
		});

		this.on('tmi:unhost', (e, t) => {
			if (e.channel.substring(1) !== userLogin) return;
			
			this._last_hosted_channel = null;
			
			this._host_updating = false;
			this.metadata.updateMetadata('host');
		});

		const chatServiceClient = inst.chatService.client;

		this._chat_con = chatServiceClient;
		this._chat_con.joinChannel(userLogin);
	}

	onEnable() {
		this.metadata.updateMetadata('host');

		const chat = this.resolve('site.chat');
		chat.ChatController.ready((cls, instances) => {
			for(const inst of instances) {
				if (inst && inst.chatService) this.hookIntoChatConnection(inst);
			}
		});
	}

	buildAutoHostMenu(vue, hosts, autoHostSettings, data) {
		this._current_channel_id = data.id;
		this.activeTab = this.activeTab || 'auto-host';

		this.vueEl = new vue.Vue({
			el: e('div'),
			render: h => h('host-options', {
				hosts,
				autoHostSettings,
				activeTab: this.activeTab,

				addedToHosts: this.currentRoomInHosts(),
				addToAutoHosts: () => this.addCurrentRoomToHosts(),
				rearrangeHosts: event => this.rearrangeHosts(event.oldIndex, event.newIndex),
				removeFromHosts: event => this.removeUserFromHosts(event),
				setActiveTab: tab => {
					this.vueEl.$children[0]._data.activeTab = this.activeTab = tab;
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

		return this.vueEl.$el;
	}

	async fetchAutoHosts() {
		const user = this.resolve('site').getUser();
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
		const user = this.resolve('site').getUser();
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

	queueHostUpdate(newHosts) {
		if (this._host_update_timer) clearTimeout(this._host_update_timer);
		
		this._host_update_timer = setTimeout(() => {
			this._host_update_timer = undefined;
			this.updateAutoHosts(newHosts);
		}, 1000);
	}
	
	rearrangeHosts(oldIndex, newIndex) {
		const newHosts = this.autoHosts.slice(0);
		
		const host = newHosts.splice(oldIndex, 1)[0];
		newHosts.splice(newIndex, 0, host);
		
		this.queueHostUpdate(newHosts);
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
		const id = event.target.closest('.ffz--host-user').getAttribute('data-id');
		
		const newHosts = [];
		for (let i = 0; i < this.autoHosts.length; i++) {
			if (`${this.autoHosts[i]._id}` !== id) newHosts.push(this.autoHosts[i]);
		}

		this.updateAutoHosts(newHosts);
	}

	getAutoHostIDs(hosts) { // eslint-disable-line
		const ids = [];
		if (hosts) {
			for (let i = 0; i < hosts.length; i++) {
				ids.push(hosts[i]._id);
			}
		}
		return ids;
	}

	async updateAutoHosts(newHosts) {
		const user = this.resolve('site').getUser();
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
		if (this.vueEl) {
			this.vueEl.$children[0]._data.hosts = this.autoHosts;
			this.vueEl.$children[0]._data.addedToHosts = this.currentRoomInHosts();
		}
	}

	async updateAutoHostSetting(setting, newValue) {
		const user = this.resolve('site').getUser();
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
		if (this.vueEl) {
			this.vueEl.$children[0]._data.autoHostSettings = this.autoHostSettings;
		}
	}

	isChannelHosted(channelLogin) {
		return this._last_hosted_channel === channelLogin;
	}
}