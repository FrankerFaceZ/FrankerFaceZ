'use strict';

// ============================================================================
// Channel
// ============================================================================

import Module from 'utilities/module';
import { has } from 'utilities/object';

import Twilight from 'site';


export default class Channel extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');

		this.joined_raids = new Set;

		this.settings.add('channel.hosting.enable', {
			default: true,
			ui: {
				path: 'Channel > Behavior >> Hosting',
				title: 'Enable Channel Hosting',
				component: 'setting-check-box'
			},
			changed: val => this.updateChannelHosting(val)
		});


		this.settings.add('channel.raids.no-autojoin', {
			default: false,
			ui: {
				path: 'Channel > Behavior >> Raids',
				title: 'Do not automatically join raids.',
				component: 'setting-check-box'
			}
		});


		this.ChannelPage = this.fine.define(
			'channel-page',
			n => n.getHostedChannelLogin && n.handleHostingChange,
			//n => n.hostModeFromGraphQL,
			['user']
		);

		this.RaidController = this.fine.define(
			'raid-controller',
			n => n.handleLeaveRaid && n.handleJoinRaid,
			Twilight.CHAT_ROUTES
		);
	}


	onEnable() {
		this.ChannelPage.on('mount', this.wrapChannelPage, this);
		this.RaidController.on('mount', this.wrapRaidController, this);
		this.RaidController.on('update', this.noAutoRaids, this);

		this.RaidController.ready((cls, instances) => {
			for(const inst of instances)
				this.wrapRaidController(inst);
		});

		this.ChannelPage.on('update', inst => {
			if ( this.settings.get('channel.hosting.enable') )
				return;

			// We can't do this immediately because the player state
			// occasionally screws up if we do.
			setTimeout(() => {
				/*if ( inst.state.hostMode ) {
					inst.ffzExpectedHost = inst.state.hostMode;
					inst.ffzOldSetState({hostMode: null});
				}*/

				const current_channel = inst.props.data && inst.props.data.variables && inst.props.data.variables.currentChannelLogin;
				if ( current_channel && current_channel !== inst.state.videoPlayerSource ) {
					inst.ffzExpectedHost = inst.state.videoPlayerSource;
					inst.ffzOldHostHandler(null);
				}
			});
		});

		this.ChannelPage.ready((cls, instances) => {
			for(const inst of instances)
				this.wrapChannelPage(inst);
		});
	}


	wrapRaidController(inst) {
		if ( inst._ffz_wrapped )
			return this.noAutoRaids(inst);

		inst._ffz_wrapped = true;

		const t = this,
			old_handle_join = inst.handleJoinRaid;

		inst.handleJoinRaid = function(event, ...args) {
			const raid_id = inst.state && inst.state.raid && inst.state.raid.id;
			if ( event && event.type && raid_id )
				t.joined_raids.add(raid_id);

			return old_handle_join.call(this, event, ...args);
		}

		this.noAutoRaids(inst);
	}


	noAutoRaids(inst) {
		if ( this.settings.get('channel.raids.no-autojoin') )
			setTimeout(() => {
				if ( inst.state.raid && ! inst.isRaidCreator && inst.hasJoinedCurrentRaid ) {
					const id = inst.state.raid.id;
					if ( this.joined_raids.has(id) )
						return;

					this.log.info('Automatically leaving raid:', id);
					inst.handleLeaveRaid();
				}
			});
	}


	wrapChannelPage(inst) {
		if ( inst._ffz_hosting_wrapped )
			return;

		const t = this;

		inst.ffzOldSetState = inst.setState;
		inst.setState = function(state, ...args) {
			try {
				if ( ! t.settings.get('channel.hosting.enable') ) {
					if ( has(state, 'isHosting') )
						state.isHosting = false;

					if ( has(state, 'videoPlayerSource') )
						state.videoPlayerSource = inst.props.match.params.channelName;
				}

				/*if ( has(state, 'hostMode') ) {
					inst.ffzExpectedHost = state.hostMode;
					if ( state.hostMode && ! t.settings.get('channel.hosting.enable') ) {
						state.hostMode = null;
						state.videoPlayerSource = inst.props.match.params.channelName;
					}
				}*/

			} catch(err) {
				t.log.capture(err, {extra: {props: inst.props, state}});
			}

			return inst.ffzOldSetState(state, ...args);
		}

		inst._ffz_hosting_wrapped = true;

		inst.ffzOldGetHostedLogin = inst.getHostedChannelLogin;
		inst.getHostedChannelLogin = function() {
			return t.settings.get('channel.hosting.enable') ?
				inst.ffzOldGetHostedLogin() : null;
		}

		inst.ffzOldHostHandler = inst.handleHostingChange;
		inst.handleHostingChange = function(channel) {
			inst.ffzExpectedHost = channel;
			if ( t.settings.get('channel.hosting.enable') )
				return inst.ffzOldHostHandler(channel);
		}

		// Store the current state and disable the current host if needed.
		inst.ffzExpectedHost = inst.state.isHosting ? inst.state.videoPlayerSource : null;
		if ( ! this.settings.get('channel.hosting.enable') )
			inst.ffzOldHostHandler(null);

		// Finally, we force an update so that any child components
		// receive our updated handler.
		inst.forceUpdate();

		/*const hosted = inst.ffzExpectedHost = inst.state.hostMode;
		if ( hosted && ! this.settings.get('channel.hosting.enable') )
			inst.ffzOldSetState({
				hostMode: null,
				videoPlayerSource: inst.props.match.params.channelName
			});*/
	}


	updateChannelHosting(val) {
		if ( val === undefined )
			val = this.settings.get('channel.hosting.enable');

		for(const inst of this.ChannelPage.instances) {
			inst.ffzOldHostHandler(val ? inst.ffzExpectedHost : null);

			/*const host = val ? inst.ffzExpectedHost : null,
				target = host && host.hostedChannel && host.hostedChannel.login || inst.props.match.params.channelName;

			inst.ffzOldSetState({
				hostMode: host,
				videoPlayerSource: target
			});*/
		}
	}
}