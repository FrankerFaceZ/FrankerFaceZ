'use strict';

// ============================================================================
// Channel
// ============================================================================

import Module from 'utilities/module';
import { has } from 'utilities/object';


export default class Channel extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');

		this.left_raids = new Set;

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
			n => n.hostModeFromGraphQL,
			['user']
		);

		this.RaidController = this.fine.define(
			'raid-controller',
			n => n.handleLeaveRaid && n.handleJoinRaid,
			['user']
		);
	}


	onEnable() {
		this.ChannelPage.on('mount', this.wrapChannelPage, this);
		this.RaidController.on('mount', this.noAutoRaids, this);
		this.RaidController.on('update', this.noAutoRaids, this);

		this.RaidController.ready((cls, instances) => {
			for(const inst of instances)
				this.noAutoRaids(inst);
		});

		this.ChannelPage.on('update', inst => {
			if ( this.settings.get('channel.hosting.enable') )
				return;

			// We can't do this immediately because the player state
			// occasionally screws up if we do.
			setTimeout(() => {
				if ( inst.state.hostMode ) {
					inst.ffzExpectedHost = inst.state.hostMode;
					inst.ffzOldSetState({hostMode: null});
				}
			});
		});

		this.ChannelPage.ready((cls, instances) => {
			for(const inst of instances)
				this.wrapChannelPage(inst);
		});
	}


	noAutoRaids(inst) {
		if ( this.settings.get('channel.raids.no-autojoin') )
			setTimeout(() => {
				if ( inst.state.raid && inst.hasJoinedCurrentRaid ) {
					const id = inst.state.raid.id;
					if ( this.left_raids.has(id) )
						return;

					this.log.info('Automatically leaving raid:', id);
					this.left_raids.add(id);
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
				if ( has(state, 'hostMode') ) {
					inst.ffzExpectedHost = state.hostMode;
					if ( state.hostMode && ! t.settings.get('channel.hosting.enable') ) {
						state.hostMode = null;
						state.videoPlayerSource = inst.props.match.params.channelName;
					}
				}

			} catch(err) {
				t.log.capture(err, {extra: {props: inst.props, state}});
			}

			return inst.ffzOldSetState(state, ...args);
		}

		inst._ffz_hosting_wrapped = true;

		const hosted = inst.ffzExpectedHost = inst.state.hostMode;
		if ( hosted && ! this.settings.get('channel.hosting.enable') )
			inst.ffzOldSetState({
				hostMode: null,
				videoPlayerSource: inst.props.match.params.channelName
			});
	}


	updateChannelHosting(val) {
		if ( val === undefined )
			val = this.settings.get('channel.hosting.enable');

		for(const inst of this.ChannelPage.instances) {
			const host = val ? inst.ffzExpectedHost : null,
				target = host && host.hostedChannel && host.hostedChannel.login || inst.props.match.params.channelName;

			inst.ffzOldSetState({
				hostMode: host,
				videoPlayerSource: target
			});
		}
	}
}