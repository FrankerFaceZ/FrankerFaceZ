'use strict';

// ============================================================================
// Badge Data
// Badge categorisation and data normalisation shared with rooms.
// ============================================================================

const CORE_BADGES = [
	'admin',
	'ambassador',
	'anonymous-cheerer',
	'artist-badge',
	'bot-badge',
	'broadcaster',
	'extension',
	'founder',
	'game-developer',
	'global_mod',
	'lead_moderator',
	'moderator',
	'no_audio',
	'no_video',
	'partner',
	'premium',
	'staff',
	'subscriber',
	'turbo',
	'twitch-dj',
	'twitchbot',
	'user-anniversary',
	'vip'
];

const SOCIAL_BADGES = [
	'bits',
	'bits-leader',
	'clip-champ',
	'clip-the-halls',
	'clips-leader',
	'hype-train',
	'moments',
	'predictions',
	'social-sharing',
	'sub-gift-leader',
	'sub-gifter',
];

export function getBadgeCategory(key) {
	if ( CORE_BADGES.includes(key) || key.endsWith('-twitch-staff') )
		return 'm-twitch';
	else if ( SOCIAL_BADGES.includes(key) )
		return 'm-social';
	else if ( key.startsWith('twitchcon') || key.startsWith('glitchcon') )
		return 'm-tcon';
	else if ( /_\d+$/.test(key) )
		return 'm-game';

	return 'm-other';
}

export function fixBadgeData(badge) {
	if ( ! badge )
		return badge;

	// Duplicate the badge object, because
	// Apollo results are frozen.
	badge = {...badge};

	// Click Behavior
	if ( ! badge.clickAction && badge.onClickAction )
		badge.clickAction = badge.onClickAction;

	if ( badge.clickAction === 'VISIT_URL' && badge.clickURL )
		badge.click_url = badge.clickURL;

	if ( badge.clickAction === 'TURBO' )
		badge.click_url = 'https://www.twitch.tv/products/turbo?ref=chat_badge';

	if ( badge.clickAction === 'SUBSCRIBE' && badge.channelName )
		badge.click_url = `https://www.twitch.tv/subs/${badge.channelName}`;
	else if ( badge.clickAction )
		badge.click_action = 'sub';

	// Subscriber Tier
	if ( badge.setID === 'subscriber' ) {
		const id = parseInt(badge.version, 10);
		if ( ! isNaN(id) && isFinite(id) ) {
			badge.tier = (id - (id % 1000)) / 1000;
			if ( badge.tier < 0 )
				badge.tier = 0;
		} else
			badge.tier = 0;
	}

	return badge;
}
