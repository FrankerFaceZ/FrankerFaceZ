'use strict';

// ============================================================================
// Host Button
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';

import Popper from 'popper.js';

export default class HostButton extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('vue');

		this.ChannelBar = this.fine.define(
			'channel-bar',
			n => n.getTitle && n.getGame && n.renderGame
		);

		this.ChatController = this.fine.define(
			'chat-controller',
			n => n.chatService
		);
	}
	
	async onLoad() {
		// this.vue.component('host-options', require(/* webpackChunkName: "host-options" */ './host-options.vue'));
		this.vue.component('host-options',
			(await import(/* webpackChunkName: "host-options" */ './host-options.vue')).default
		);
	}

	sendHostUnhostCommand(currentChannel) {
		if (!this._chat_con) return;

		const ffz_user = ffz.site.getUser(),
			userLogin = ffz_user && ffz_user.login;

		const commandData = {channel: userLogin, username: currentChannel};

		if (this.isChannelHosted(currentChannel)) {
			this._chat_con.commands.unhost.execute(commandData);
		} else {
			this._chat_con.commands.host.execute(commandData);
		}
	}

	createSelfChatConnection(inst) {
		if (this._chat_con) return;

		const chatServiceClient = inst.chatService.client;

		this._chat_con = new chatServiceClient.constructor({connection: {secure: true, port: 443, server: 'irc-ws.chat.twitch.tv'}});
		this._chat_con.updateIdentity({authToken: inst.props.authToken, username: inst.props.userLogin});
		this._chat_con.events.hosting(e => {
			this._last_hosted_channel = e.target;

			this.updateCurrentChannelHost(inst);
		});
		this._chat_con.events.unhost(e => {
			this._last_hosted_channel = null;

			this.updateCurrentChannelHost(inst);
		});
		this._chat_con.events.connected(e => {
			this._chat_con.joinChannel(inst.props.userLogin);
		});
		this._chat_con.session.getChannelState = () => {};
		this._chat_con.connect();
	}

	onEnable() {
		this.ChannelBar.ready((cls, instances) => {
			for(const inst of instances)
				this.appendHostButton(inst);
		});

		this.ChannelBar.on('mount', this.appendHostButton, this);
		this.ChannelBar.on('update', this.appendHostButton, this);

		this.ChatController.ready((cls, instances) => {
			for(const inst of instances) this.createSelfChatConnection(inst);
		});

		this.fetchAutoHosts();
		document.body.addEventListener('click', this.destroyHostOptions.bind(this));
	}

	destroyHostOptions(event) {
		if (!event || event && event.target && event.target.closest('.ffz-hosting-menu') === null && Date.now() > this.popperBuffer) {
			this.popper && this.popper.destroy();
			this.popperEl && this.popperEl.remove();
			this.popper = this.popperEl = undefined;
		}
	}

	createHostOptionsMenu(inst, hostButton) {
		this.destroyHostOptions();

		if ( this._menu )
			return;

		this._vue = new this.vue.Vue({
			el: e('div'),
			render: h => h('host-options', {
				hosts: this.autoHosts,

				addedToHosts: this.currentRoomInHosts(inst),
				addToAutoHosts: () => this.addCurrentRoomToHosts(inst),
				rearrangeHosts: event => this.rearrangeHosts(inst, event.oldIndex, event.newIndex),
				shuffle: () => this.shuffleHosts(inst),
				removeFromHosts: event => this.removeUserFromHosts(inst, event)
			})
		});

		this.popperEl = this._vue.$el;
		document.body.appendChild(this.popperEl);
		
		this.popper = new Popper(hostButton, this.popperEl, {
			placement: 'top'
		});

		this.popperBuffer = Date.now() + 50;
	}

	showHostOptions(inst, hostButton) {
		this.popper && this.popper.destroy();
		
		this.popperEl && this.popperEl.remove();

		this.popperEl = e('div', 'ffz-hosting-menu tw-balloon block',
			e('div', 'pd-y-1',
				e('button', {
					class: 'tw-interactable',
					onclick: () => this.createHostOptionsMenu(inst, hostButton)
				},
				e('div', {
					class: 'pd-x-1 pd-y-05',
					textContent: 'Manage auto hosts'
				})
				)
			)
		);

		document.body.appendChild(this.popperEl);

		this.popper = new Popper(hostButton, this.popperEl, {
			placement: 'top'
		});

		this.popperBuffer = Date.now() + 50;
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

		this.autoHosts = data.targets;
	}

	queueHostUpdate(inst, newHosts) {
		if (this._host_update_timer) clearTimeout(this._host_update_timer);
		
		this._host_update_timer = setTimeout(() => {
			this._host_update_timer = undefined;
			this.updateAutoHosts(inst, newHosts);
		}, 1000);
	}
	
	rearrangeHosts(inst, oldIndex, newIndex) {
		const newHosts = this.autoHosts.slice(0);
		
		const host = newHosts.splice(oldIndex, 1)[0];
		newHosts.splice(newIndex, 0, host);
		
		this.queueHostUpdate(inst, newHosts);
	}
	
	currentRoomInHosts(inst) {
		return this.getAutoHostIDs(this.autoHosts).includes(parseInt(inst.props.userData.user.id));
	}

	addCurrentRoomToHosts(inst) {
		const newHosts = this.autoHosts.slice(0);
		newHosts.push({ _id: parseInt(inst.props.userData.user.id)});

		this.queueHostUpdate(inst, newHosts);
	}

	removeUserFromHosts(inst, event) {
		const id = event.target.closest('.ffz--host-user').getAttribute('data-id');
		
		const newHosts = [];
		for (let i = 0; i < this.autoHosts.length; i++) {
			if (`${this.autoHosts[i]._id}` !== id) newHosts.push(this.autoHosts[i]);
		}

		this.queueHostUpdate(inst, newHosts);
	}

	getAutoHostIDs(hosts) {
		const ids = [];
		if (hosts) {
			for (let i = 0; i < hosts.length; i++) {
				ids.push(hosts[i]._id);
			}
		}
		return ids;
	}

	async updateAutoHosts(inst, newHosts) {
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
			this.log.error('Error loading auto host list.', err);
			return;
		}

		this.autoHosts = data.targets;
		if (this._vue) {
			this._vue.$children[0]._data.hosts = this.autoHosts;
			this._vue.$children[0]._data.addedToHosts = this.currentRoomInHosts(inst);
			if (this.popper && this.popper.update) this.popper.update();
		}
	}

	updateCurrentChannelHost(inst) {
		if (!this._host_button_span) return;

		this._host_button_span.textContent = this.isChannelHosted(inst.props.channelLogin) ? 'Unhost' : 'Host';
		this._host_button_span.parentElement.classList.remove('tw-button--disabled');
	}

	isChannelHosted(channelLogin) {
		return this._last_hosted_channel === channelLogin;
	}

	appendHostButton(inst) {
		const container = this.fine.getHostNode(inst),
			allFlex = container && container.querySelector && container.querySelectorAll('.channel-info-bar__action-container > .flex'),
			buttonBar = allFlex && allFlex[allFlex.length - 1];

		if (buttonBar == null || buttonBar && buttonBar.querySelector && buttonBar.querySelector('.ffz-host-container') !== null) return;

		if (this._host_button_span) this._host_button_span.destroy();
		this._host_button_span = null;

		const hostButton = e('div', 'ffz-host-container mg-x-1', [
			e('button', {
				class: 'tw-button tw-button--hollow tw-button--disabled',
				onclick: () => {
					if (!this._chat_con) return;

					this._host_button_span.parentElement.classList.add('tw-button--disabled');
					this.sendHostUnhostCommand(inst.props.channelLogin);
				}
			}, this._host_button_span = e('span', {
				class: 'tw-button__text',
				textContent: this.isChannelHosted(inst.props.channelLogin) ? 'Unhost' : 'Host'
			})),
			e('button', {
				class: 'tw-button-icon tw-button-icon--hollow',
				onclick: () => this.showHostOptions(inst, hostButton)
			}, e('figure', {
				class: 'ffz-i-down-dir',
				style: 'padding: .4rem .2rem'
			}))
		]);

		buttonBar.insertAdjacentElement('afterbegin', hostButton);
	}
}