'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import PlayerBase from 'src/sites/shared/player';

import Metadata from './metadata';

export default class Player extends PlayerBase {
	constructor(...args) {
		super(...args);

		this.inject('metadata', Metadata);

		this.Player = this.fine.define(
			'highwind-player',
			n => n.setPlayerActive && n.props?.playerEvents && n.props?.mediaPlayerInstance
		);

		this.PlayerSource = this.fine.define(
			'player-source',
			n => n.setSrc && n.setInitialPlaybackSettings
		);
	}

	wantsMetadata() {
		return this.settings.get('player.embed-metadata');
	}

	async getBroadcastID(inst, channel_id) {
		this.twitch_data = await this.parent.awaitTwitchData();
		return super.getBroadcastID(inst, channel_id);
	}
}