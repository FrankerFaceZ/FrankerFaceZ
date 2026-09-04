'use strict';

// ============================================================================
// Twitch Chat Constants
// Message, moderation and callout type enums shared by the chat hook and
// its settings definitions.
// ============================================================================

import {make_enum} from 'utilities/object';


export const MESSAGE_TYPES = make_enum(
	'Post',
	'Action'
);

export const MOD_TYPES = make_enum(
	'Ban',
	'Timeout',
	'Delete'
);

export const AUTOMOD_TYPES = make_enum(
	'MessageRejectedPrompt',
	'CheerMessageRejectedPrompt',
	'MessageRejected',
	'MessageAllowed',
	'MessageDenied',
	'CheerMessageDenied',
	'CheerMessageTimeout',
	'MessageModApproved',
	'MessageModDenied'
);

export const CHAT_TYPES = make_enum(
	'Message',
	'ExtensionMessage',
	'Moderation',
	'ModerationAction',
	'TargetedModerationAction',
	'AutoMod',
	'SubscriberOnlyMode',
	'FollowerOnlyMode',
	'SlowMode',
	'EmoteOnlyMode',
	'R9KMode',
	'Connected',
	'Disconnected',
	'Reconnect',
	'Subscription',
	'Resubscription',
	'GiftPaidUpgrade',
	'AnonGiftPaidUpgrade',
	'PrimePaidUpgrade',
	'PrimeCommunityGiftReceivedEvent',
	'ExtendSubscription',
	'SubGift',
	'AnonSubGift',
	'Clear',
	'RoomMods',
	'RoomState',
	'Raid',
	'Unraid',
	'Notice',
	'Info',
	'BadgesUpdated',
	'Purchase',
	'BitsCharity',
	'CrateGift',
	'RewardGift',
	'SubMysteryGift',
	'AnonSubMysteryGift',
	'StandardPayForward',
	'CommunityPayForward',
	'FirstCheerMessage',
	'FirstMessageHighlight',
	'BitsBadgeTierMessage',
	'InlinePrivateCallout',
	'ChannelPointsReward',
	'CommunityChallengeContribution',
	'LiveMessageSeparator',
	'RestrictedLowTrustUserMessage',
	'Shoutout',
	'AnnouncementMessage',
	'CharityDonation',
	'MessageIdUpdate',
	'ViewerMilestone',
	'GigantifiedEmote',
	'SubsidizedSub',
	'SubsidizedSubMysteryGift',
	'SocialSharingBadge',
	'GiftSubBaseMatch',
	'GiftSubBonusMatchSummary',
	'GiftSubBonusMatchIndividual',
	'Modiversary',
	'SponsoredShoppingPurchase'
);


export const NULL_TYPES = [
	'Reconnect',
	'RoomState',
	'BadgesUpdated',
	'Clear'
];


export const INLINE_CALLOUT_TYPES = {
	'pinned_re_sub': 'share-resub',
	'community_points_reward': 'community-points-rewards',
	'clip_live_nudge_chat_trigger': 'clip-live-nudge',
	'cheer_badge_grant': 'bits-badge-tier'
};

// Twitch's callout types as of September 2026. The live table from
// Twitch's bundle takes precedence when it can be found.
export const CALLOUT_TYPES = {
	'AppointedModerator': 'appointed-moderator',
	'BitsBadgeTier': 'bits-badge-tier',
	'ClipLiveNudge': 'clip-live-nudge',
	'CommunityMoment': 'community-moment',
	'CommunityPointsRewards': 'community-points-rewards',
	'CreatorAnniversaries': 'creator-anniversaries',
	'CustomPowerUpsFTUE': 'custom-power-ups-ftue',
	'Drop': 'drop',
	'DropEarned': 'drop-earned',
	'EarnedSubBadge': 'earned-sub-badge',
	'FavoritedGuestCollab': 'favorited-guest-collab',
	'HypeTrainRewards': 'hype-train-rewards',
	'MidStreamSummary': 'mid-stream-summary',
	'ModToolsAvailable': 'mod-tools-available',
	'Modiversary': 'modiversary',
	'MultimonthUpsell': 'multimonth-upsell',
	'ReplyByKeyboard': 'reply-by-keyboard',
	'RequestToJoinAccepted': 'request-to-join-accepted',
	'RewardBitsGranted': 'reward-bits-granted',
	'STPromo': 'st-promo',
	'ShareResub': 'share-resub',
	'SocialSharingBadge': 'social-sharing-badge',
	'SubtemberPromoBits': 'subtember-promo-bits',
	'ThankSubGifter': 'thank-sub-gifter',
	'TopSupporterBadge': 'top-supporter-badge',
	'TurnOffAnimatedEmotes': 'turn-off-animated-emotes',
	'WalletDrop': 'wallet-drop',
	'WatchStreakSuspended': 'watch-streak-suspended',
	'WeeklyRewardsFTUE': 'weekly-rewards-ftue',
	'WeeklyRewardsProgress': 'weekly-rewards-progress'
};


export const MISBEHAVING_EVENTS = [
	'onBadgesUpdatedEvent',
];


export const UNBLOCKABLE_TYPES = [
	'Message',
	'Notice',
	'Moderation',
	'ModerationAction',
	'TargetedModerationAction',
	'AutoMod',
	'SubscriberOnlyMode',
	'FollowerOnlyMode',
	'SlowMode',
	'EmoteOnlyMode',
	'R9KMode',
	'Connected',
	'Disconnected',
	'Reconnect',
	'RoomMods',
	'RoomState',
	'BadgesUpdated'
]

export const UNBLOCKABLE_CALLOUTS = [];
