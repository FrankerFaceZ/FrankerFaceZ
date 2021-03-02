'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import PlayerBase from 'src/sites/shared/player';

export default class Player extends PlayerBase {
	constructor(...args) {
		super(...args);

		this.Player = this.fine.define(
			'highwind-player',
			n => n.setPlayerActive && n.props?.playerEvents && n.props?.mediaPlayerInstance
		);

		this.PlayerSource = this.fine.define(
			'player-source',
			n => n.setSrc && n.setInitialPlaybackSettings
		);
	}
}