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
	'CommunityIntroduction',
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

export const CALLOUT_TYPES = {
	"AppointedModerator": "appointed-moderator",
	"BitsBadgeTier": "bits-badge-tier",
	"BitsPowerUps": "bits-power-ups",
	"ClipLiveNudge": "clip-live-nudge",
	"CommunityMoment": "community-moment",
	"CommunityPointsRewards": "community-points-rewards",
	"CosmicAbyss": "cosmic-abyss",
	"CreatorAnniversaries": "creator-anniversaries",
	"Drop": "drop",
	"EarnedSubBadge": "earned-sub-badge",
	"FavoritedGuestCollab": "favorited-guest-collab",
	"GiftBadgeExpiration": "gift-badge-expiration",
	"GiftBadgeRestored": "gift-badge-restored",
	"GiftBundleUpSell": "gift-bundle-up-sell",
	"HypeTrainRewards": "hype-train-rewards",
	"LapsedBitsUser": "lapsed-bits-user",
	"PartnerPlusUpSellNudge": "partner-plus-up-sell-nudge",
	"ReplyByKeyboard": "reply-by-keyboard",
	"RequestToJoinAccepted": "request-to-join-accepted",
	"STPromo": "st-promo",
	"ShareResub": "share-resub",
	"SubtemberPromoBits": "subtember-promo-bits",
	"ThankSubGifter": "thank-sub-gifter",
	"TurnOffAnimatedEmotes": "turn-off-animated-emotes",
	"WalletDrop": "wallet-drop"
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
