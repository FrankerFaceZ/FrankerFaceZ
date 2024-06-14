export function doesRewardCostBits(reward) {
	return reward.pricingType === 'BITS';
}

export function isAutomaticReward(reward) {
	return reward?.__typename === 'CommunityPointsAutomaticReward';
}

export function isCustomReward(reward) {
	return reward?.__typename === 'CommunityPointsCustomReward';
}

export function isHighlightedReward(reward) {
	return isAutomaticReward(reward) && reward.type === 'SEND_HIGHLIGHTED_MESSAGE';
}

export function isGiantEmoteReward(reward) {
	return reward && (reward.title?.includes?.('FFZ:GE') ||
		reward.prompt?.includes?.('FFZ:GE'));
}

export function getRewardCost(reward) {
	const is_bits = doesRewardCostBits(reward);
	if ( isAutomaticReward(reward) )
		return is_bits
			? (reward.bitsCost || reward.defaultBitsCost)
			: (reward.cost || reward.defaultCost);

	return is_bits
		? reward.bitsCost
		: reward.cost;
}

export function getRewardColor(reward) {
	if ( isAutomaticReward(reward) )
		return reward.backgroundColor || reward.defaultBackgroundColor;

	return reward.backgroundColor;
}

export function getRewardTitle(reward, i18n) {
	if ( isCustomReward(reward) )
		return reward.title;

	switch(reward.type) {
		case 'SEND_ANIMATED_MESSAGE':
			return i18n.t('chat.points.animated', 'Message Effects');
		case 'SEND_HIGHLIGHTED_MESSAGE':
			return i18n.t('chat.points.highlighted', 'Highlight My Message');
		case 'SINGLE_MESSAGE_BYPASS_SUB_MODE':
			return i18n.t('chat.points.bypass-sub', 'Send a Message in Sub-Only Mode');
		case 'CHOSEN_SUB_EMOTE_UNLOCK':
			return i18n.t('chat.points.choose-emote', 'Choose an Emote to Unlock');
		case 'RANDOM_SUB_EMOTE_UNLOCK':
			return i18n.t('chat.points.random-emote', 'Unlock a Random Sub Emote');
		case 'CHOSEN_MODIFIED_SUB_EMOTE_UNLOCK':
			return i18n.t('chat.points.modify-emote', 'Modify a Single Emote');
		default:
			return i18n.t('chat.points.reward', 'Reward');
	}
}
