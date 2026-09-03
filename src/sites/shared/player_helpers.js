'use strict';

// ============================================================================
// Player Helpers
// Selectors and lookup helpers shared by the player module and its audio mixin.
// ============================================================================


export const LEFT_CONTROLS = '.video-player__default-player .player-controls__left-control-group';

export function findPlayer(props) {
	const player = props?.mediaPlayerInstance;
	if ( player?.playerInstance )
		return player.playerInstance;
	return player;
}

export function findPlayerCore(props) {
	const player = findPlayer(props);
	return player?.core ?? player;
}
