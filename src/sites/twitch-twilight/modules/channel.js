'use strict';

// ============================================================================
// Channel
// ============================================================================

import Module from 'utilities/module';
import { get, has } from 'utilities/object';

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
			n => (n.updateRoute && n.updateChannel && n.state && has(n.state, 'hostedChannel')) || (n.getHostedChannelLogin && n.handleHostingChange) || (n.onChatHostingChange && n.state && has(n.state, 'hostMode')),
			['user', 'video', 'user-video', 'user-clip', 'user-videos', 'user-clips', 'user-collections', 'user-events', 'user-followers', 'user-following']
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

		this.ChannelPage.on('mount', inst => {
			this.settings.updateContext({
				channel: get('state.channel.login', inst),
				channelID: get('state.channel.id', inst)
			});
		});

		this.ChannelPage.on('unmount', () => {
			this.settings.updateContext({
				channel: null,
				channelID: null
			});
		});

		this.ChannelPage.on('update', inst => {
			this.settings.updateContext({
				channel: get('state.channel.login', inst),
				channelID: get('state.channel.id', inst)
			});

			if ( this.settings.get('channel.hosting.enable') || has(inst.state, 'hostMode') || has(inst.state, 'hostedChannel') )
				return;

			// We can't do this immediately because the player state
			// occasionally screws up if we do.
			setTimeout(() => {
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
			const raid_id = inst.props && inst.props.raid && inst.props.raid.id;
			if ( event && event.type && raid_id )
				t.joined_raids.add(raid_id);

			return old_handle_join.call(this, event, ...args);
		}

		this.noAutoRaids(inst);
	}


	noAutoRaids(inst) {
		if ( this.settings.get('channel.raids.no-autojoin') )
			setTimeout(() => {
				if ( inst.props && inst.props.raid && ! inst.isRaidCreator && inst.hasJoinedCurrentRaid ) {
					const id = inst.props.raid.id;
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

		const t = this,
			new_new_style = inst.updateChannel && has(inst.state, 'hostedChannel'),
			new_style = ! new_new_style && ! inst.handleHostingChange || has(inst.state, 'hostMode');

		inst.ffzGetChannel = () => {
			const params = inst.props.match.params
			if ( ! params )
				return get('props.data.variables.currentChannelLogin', inst)

			return params.channelName || params.channelLogin
		}

		inst.ffzOldSetState = inst.setState;
		inst.setState = function(state, ...args) {
			try {
				if ( new_new_style ) {
					const expected = inst.ffzGetChannel();
					if ( has(state, 'hostedChannel') ) {
						inst.ffzExpectedHost = state.hostedChannel;
						if ( state.hostedChannel && ! t.settings.get('channel.hosting.enable') ) {
							state.hostedChannel = null;
							state.videoPlayerSource = expected;
						}

						t.settings.updateContext({hosting: !!state.hostedChannel});

					} else if ( has(state, 'videoPlayerSource') ) {
						if ( state.videoPlayerSource !== expected && ! t.settings.get('channel.hosting.enable') ) {
							state.videoPlayerSource = expected;
						}
					}

				} else if ( new_style ) {
					const expected = inst.ffzGetChannel();
					if ( has(state, 'hostMode') ) {
						inst.ffzExpectedHost = state.hostMode;
						if ( state.hostMode && ! t.settings.get('channel.hosting.enable') ) {
							state.hostMode = null;
							state.videoPlayerSource = expected;
						}

						t.settings.updateContext({hosting: !!state.hostMode});

					} else if ( has(state, 'videoPlayerSource') ) {
						if ( state.videoPlayerSource !== expected && ! t.settings.get('channel.hosting.enable') )
							state.videoPlayerSource = expected;
					}

				} else {
					if ( ! t.settings.get('channel.hosting.enable') ) {
						if ( has(state, 'isHosting') )
							state.isHosting = false;

						if ( has(state, 'videoPlayerSource') )
							state.videoPlayerSource = inst.ffzGetChannel();
					}

					if ( has(state, 'isHosting') )
						t.settings.updateContext({hosting: state.isHosting});
				}

			} catch(err) {
				t.log.capture(err, {extra: {props: inst.props, state}});
			}

			return inst.ffzOldSetState(state, ...args);
		}

		inst._ffz_hosting_wrapped = true;

		if ( new_new_style ) {
			const hosted = inst.ffzExpectedHost = inst.state.hostedChannel;
			this.settings.updateContext({hosting: this.settings.get('channel.hosting.enable') && !!hosted});

			if ( hosted && ! this.settings.get('channel.hosting.enable') ) {
				inst.ffzOldSetState({
					hostedChannel: null,
					videoPlayerSource: inst.ffzGetChannel()
				});
			}

		} else if ( new_style ) {
			const hosted = inst.ffzExpectedHost = inst.state.hostMode;
			this.settings.updateContext({hosting: this.settings.get('channel.hosting.enable') && !!inst.state.hostMode});

			if ( hosted && ! this.settings.get('channel.hosting.enable') ) {
				inst.ffzOldSetState({
					hostMode: null,
					videoPlayerSource: inst.ffzGetChannel()
				});
			}

		} else {
			inst.ffzOldGetHostedLogin = () => get('props.data.user.hosting.login', inst) || null;
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
			this.settings.updateContext({hosting: this.settings.get('channel.hosting.enable') && inst.state.isHosting});
			if ( ! this.settings.get('channel.hosting.enable') ) {
				inst.ffzOldHostHandler(null);
			}
		}

		// Finally, we force an update so that any child components
		// receive our updated handler.
		inst.forceUpdate();
	}


	updateChannelHosting(val) {
		if ( val === undefined )
			val = this.settings.get('channel.hosting.enable');

		let hosting = val;

		for(const inst of this.ChannelPage.instances) {
			if ( ! inst.ffzExpectedHost )
				hosting = false;

			if ( has(inst.state, 'hostedChannel') ) {
				const host = val ? inst.ffzExpectedHost : null,
					target = host && host.login || inst.ffzGetChannel();

				inst.ffzOldSetState({
					hostedChannel: host,
					videoPlayerSource: target
				});

			} else if ( has(inst.state, 'hostMode') ) {
				const host = val ? inst.ffzExpectedHost : null,
					target = host && host.hostedChannel && host.hostedChannel.login || inst.ffzGetChannel();

				inst.ffzOldSetState({
					hostMode: host,
					videoPlayerSource: target
				});

			} else
				inst.ffzOldHostHandler(val ? inst.ffzExpectedHost : null);
		}

		this.settings.updateContext({hosting});
	}
}