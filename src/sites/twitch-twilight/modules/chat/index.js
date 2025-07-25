'use strict';

// ============================================================================
// Chat Hooks
// ============================================================================

import {Color, ColorAdjuster} from 'utilities/color';
import {get, has, make_enum, shallow_object_equals, set_equals, deep_equals, glob_to_regex, escape_regex, generateUUID} from 'utilities/object';
import {WEBKIT_CSS as WEBKIT} from 'utilities/constants';

import {useFont} from 'utilities/fonts';
import awaitMD, { getMD } from 'utilities/markdown';
import Module from 'utilities/module';

import Twilight from 'site';

import Scroller from './scroller';
import ChatLine from './line';
import SettingsMenu from './settings_menu';
import EmoteMenu from './emote_menu';
import Input from './input';
import ViewerCards from './viewer_card';
import { isHighlightedReward, isMessageEffect } from './points';


/*const REGEX_EMOTES = {
	'B-?\\)': ['B)', 'B-)'],
	'R-?\\)': ['R)', 'R-)'],
	'[oO](_|\\.)[oO]': ['o_o', 'O_o', 'o_O', 'O_O', 'o.o', 'O.o', 'o.O', 'O.O'],
	'\\&gt\\;\\(': ['>('],
	'\\&lt\\;3': ['<3'],
	'\\:-?(o|O)': [':o', ':O', ':-o', ':-O'],
	'\\:-?(p|P)': [':p', ':P', ':-p', ':-P'],
	'\\:-?D': [':D', ':-D'],
	'\\:-?[\\\\/]': [':/', ':-/', ':\\', ':-\\'],
	'\\:-?[z|Z|\\|]': [':z', ':Z', ':|', ':-z', ':-Z', ':-|'],
	'\\:-?\\(': [':(', ':-('],
	'\\:-?\\)': [':)', ':-)'],
	'\\;-?(p|P)': [';p', ';P', ';-p', ';-P'],
	'\\;-?\\)': [';)', ';-)'],
	'#-?[\\\\/]': ['#/', '#-/', '#//', '#-//'],
	':-?(?:7|L)': [':7', ':L', ':-7', ':-L'],
	'\\&lt\\;\\]': ['<]'],
	'\\:-?(S|s)': [':s', ':S', ':-s', ':-S'],
	'\\:\\&gt\\;': [':>']
};*/


const MESSAGE_TYPES = make_enum(
	'Post',
	'Action'
);

const MOD_TYPES = make_enum(
	'Ban',
	'Timeout',
	'Delete'
);

const AUTOMOD_TYPES = make_enum(
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

const UNBLOCKABLE_TYPES = [
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

const CHAT_TYPES = make_enum(
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
	'GigantifiedEmote'
);


const NULL_TYPES = [
	'Reconnect',
	'RoomState',
	'BadgesUpdated',
	'Clear'
];


const INLINE_CALLOUT_TYPES = {
	'pinned_re_sub': 'share-resub',
	'community_points_reward': 'community-points-rewards',
	'clip_live_nudge_chat_trigger': 'clip-live-nudge',
	'cheer_badge_grant': 'bits-badge-tier'
};

const CALLOUT_TYPES = {
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

const UNBLOCKABLE_CALLOUTS = [];


const MISBEHAVING_EVENTS = [
	'onBadgesUpdatedEvent',
];


export default class ChatHook extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.shared_room_data = new Map;
		this.shared_rooms = {};

		this.colors = new ColorAdjuster;
		this.inverse_colors = new ColorAdjuster;

		this.inject('settings');
		this.inject('i18n');
		this.inject('experiments');

		this.inject('site');
		this.inject('site.router');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');
		this.inject('site.subpump');
		//this.inject('site.loadable');

		this.inject('chat');

		this.inject(Scroller);
		this.inject(ChatLine);
		this.inject(SettingsMenu);
		this.inject(EmoteMenu);
		this.inject(Input);
		this.inject(ViewerCards);

		this.ChatLeaderboard = this.fine.define(
			'chat-leaderboard',
			n => n.props?.topItems && has(n.props, 'forceMiniView') && has(n.props, 'leaderboardType'),
			Twilight.CHAT_ROUTES
		);

		this.ChatService = this.fine.define(
			'chat-service',
			n => n.join && n.client && n.props.setChatConnectionAPI,
			Twilight.CHAT_ROUTES
		);

		this.ChatBuffer = this.fine.define(
			'chat-buffer',
			n => n.updateHandlers && n.delayedMessageBuffer && n.handleMessage,
			Twilight.CHAT_ROUTES
		);

		this.ChatController = this.fine.define(
			'chat-controller',
			n => n.parseOutgoingMessage && n.onRoomStateUpdated && n.renderNotifications,
			Twilight.CHAT_ROUTES
		);

		this.ChatRenderer = this.fine.define(
			'chat-renderer',
			n => n.mapMessagesToChatLines && n.reportChatRenderSent,
			Twilight.CHAT_ROUTES
		);

		this.ChatContainer = this.fine.define(
			'chat-container',
			n => n.closeViewersList && n.onChatInputFocus,
			Twilight.CHAT_ROUTES
		);

		this.ChatBufferConnector = this.fine.define(
			'chat-buffer-connector',
			n => n.clearBufferHandle && n.syncBufferedMessages,
			Twilight.CHAT_ROUTES
		);

		this.ChatRewardEventHandler = this.fine.define(
			'chat-reward-event-handler',
			n => n.unsubscribe && n.handleMessage && n.props?.messageHandlerAPI && n.props?.rewardMap,
			Twilight.CHAT_ROUTES
		);

		this.joined_raids = new Set;

		this.RaidController = this.fine.define(
			'raid-controller',
			n => n.handleLeaveRaid && n.handleJoinRaid,
			Twilight.CHAT_ROUTES
		);

		this.InlineCallout = this.fine.define(
			'inline-callout',
			n => n.showCTA && n.toggleContextMenu && n.actionClick,
			Twilight.CHAT_ROUTES
		);

		this.PinnedCallout = this.fine.define(
			'pinned-callout',
			n => n.getCalloutTitle && n.buildCalloutProps && n.pin,
			Twilight.CHAT_ROUTES
		);

		this.CalloutSelector = this.fine.define(
			'callout-selector',
			n => n.selectCalloutComponent && n.props && has(n.props, 'callouts'),
			Twilight.CHAT_ROUTES
		);

		this.PointsButton = this.fine.define(
			'points-button',
			n => n.renderIcon && n.renderFlame && n.handleIconAnimationComplete,
			Twilight.CHAT_ROUTES
		);

		this.PointsClaimButton = this.fine.define(
			'points-claim-button',
			n => n.getClaim && n.onClick && n.props && n.props.claimCommunityPoints,
			Twilight.CHAT_ROUTES
		);

		this.CommunityChestBanner = this.fine.define(
			'community-chest-banner',
			n => n.getLastGifterText && n.getBannerText && has(n, 'finalCount'),
			Twilight.CHAT_ROUTES
		);

		this.PointsInfo = this.fine.define(
			'points-info',
			n => n.pointIcon !== undefined && n.pointName !== undefined,
			Twilight.CHAT_ROUTES
		);

		this.GiftBanner = this.fine.define(
			'gift-banner',
			n => n.getBannerText && n.onGiftMoreClick,
			Twilight.CHAT_ROUTES
		);

		// Settings

		this.settings.add('chat.subs.native', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Display subscription notices using Twitch\'s native UI.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.show-reasons', {
			default: false,
			ui: {
				path: 'Chat > Filtering > General >> Appearance',
				title: 'Display Reasons',
				description: 'If this is enabled, the reasons a given message was highlighted will be displayed alongside the message. This is a simple display. Enable the debugging option below in Behavior for more details, but be aware that the debugging option has a slight performance impact compared to this.',
				component: 'setting-select-box',
				data: [
					{value: false, title: 'Disabled'},
					{value: 1, title: 'Above Message'},
					{value: 2, title: 'Inline'}
				]
			}
		});

		this.settings.add('chat.disable-handling', {
			default: null,
			requires: ['context.disable-chat-processing'],
			process(ctx, val) {
				if ( val != null )
					return ! val;
				if ( ctx.get('context.disable-chat-processing') )
					return true;
				return false;
			},
			ui: {
				path: 'Debugging > Chat >> Processing',
				title: 'Enable processing of chat messages.',
				component: 'setting-check-box',
				force_seen: true
			}
		});

		this.settings.addUI('debug.chat-test', {
			path: 'Debugging > Chat >> Chat',
			component: 'chat-tester',
			getChat: () => this,
			force_seen: true
		});

		this.settings.add('chat.filtering.blocked-callouts', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			process: (ctx, val) => {
				const out = new Set,
					type_map = this.callout_types ?? CALLOUT_TYPES;
				for(const v of val)
					if ( v?.v && type_map[v.v] && ! UNBLOCKABLE_CALLOUTS.includes(v.v) )
						out.add(type_map[v.v]);

				return out;
			},

			ui: {
				path: 'Chat > Filtering > Block >> Callout Types @{"description":"This filter allows you to remove callouts of specific types from Twitch chat. Callouts are special messages that can be pinned to the bottom of chat and often have associated actions, like claiming a drop or sharing your resubscription."}',
				component: 'blocked-types',
				getExtraTerms: () => Object.keys(this.callout_types).filter(key => ! UNBLOCKABLE_CALLOUTS.includes(key)),
				data: () => Object
					.keys(this.callout_types)
					.filter(key => ! UNBLOCKABLE_CALLOUTS.includes(key))
					.sort()
			}
		})

		this.settings.add('chat.filtering.blocked-types', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			process(ctx, val) {
				const out = new Set;
				for(const v of val)
					if ( v?.v && ! UNBLOCKABLE_TYPES.includes(v.v) )
						out.add(v.v);

				return out;
			},

			ui: {
				path: 'Chat > Filtering > Block >> Message Types @{"description":"This filter allows you to remove all messages of a certain type from Twitch chat. It can be used to filter system messages, such as Hosts or Raids. Some types, such as moderation actions, cannot be blocked to prevent chat functionality from breaking."}',
				component: 'blocked-types',
				getExtraTerms: () => Object.keys(this.chat_types).filter(key => ! UNBLOCKABLE_TYPES.includes(key) && ! /^\d+$/.test(key)),
				data: () => Object
					.keys(this.chat_types)
					.filter(key => ! UNBLOCKABLE_TYPES.includes(key) && ! /^\d+$/.test(key))
					.sort()
			}
		});

		this.settings.add('chat.replies.style', {
			default: 1,
			ui: {
				path: 'Chat > Appearance >> Replies',
				title: 'Style',
				description: `Twitch's default style adds a floating button to the right and displays a notice above messages that are replies. FrankerFaceZ uses an In-Line Chat Action (that can be removed in [Chat > Actions > In-Line](~chat.actions.in_line)) and uses an in-line mention to denote replies.`,
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Twitch (Default)'},
					{value: 2, title: 'FrankerFaceZ'}
				]
			}
		});

		this.settings.add('channel.raids.no-autojoin', {
			default: false,
			ui: {
				path: 'Channel > Behavior >> Raids',
				title: 'Do not automatically join raids.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.powerup.effects', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow "Message Effects" messages to appear in chat.',
				component: 'setting-check-box',
				description: '*Note*: Only affects messages sent after you change this setting. You can use your own chat for testing.'
			}
		});

		this.settings.add('channel.raids.blocked-channels', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Channel > Behavior >> Raids: Blocked Channels @{"description": "You will not automatically join raids to channels listed here."}',
				component: 'basic-terms',
				words: false
			}
		});

		this.settings.add('__filter:channel.raids.blocked-channels', {
			requires: ['channel.raids.blocked-channels'],
			equals: 'requirements',
			process(ctx) {
				const val = ctx.get('channel.raids.blocked-channels');
				if ( ! val || ! val.length )
					return null;

				const out = [];

				for(const item of val) {
					const t = item.t;
					let v = item.v;

					if ( t === 'glob' )
						v = glob_to_regex(v);

					else if ( t !== 'raw' )
						v = escape_regex(v);

					if ( ! v || ! v.length )
						continue;

					out.push(v);
				}

				if ( out.length )
					return new RegExp(`^(?:${out.join('|')})$`, 'gi');

				return null;
			}
		})

		this.settings.add('chat.hide-community-highlights', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Hide all Community Highlights from the top of chat.',
				component: 'setting-check-box',
				description: 'Community Highlights are polls, community gift subs, etc. that float over the top of chat temporarily with no way to close them.'
			}
		});

		this.settings.add('chat.subs.gift-banner', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Display a banner at the top of chat when a mass gift sub happens.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.banners.last-events', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow the Support Activity Feed to be displayed in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.banners.charity', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow the charity fundraiser progress to be displayed in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.banners.hide-appleplus', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Hide the drop notification for getting AppleTV+ when you buy a subscription.',
				component: 'setting-check-box',
				description: '**Note:** Normally, I wouldn\'t add something that directly affects an advertisement like this, but Twitch broke the "Don\'t show again" checkbox, so it\'s up to us to fix it.'
			}
		});

		this.settings.add('chat.banners.hype-train', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow the Hype Train to be displayed in chat.',
				component: 'setting-check-box',
			}
		});

		/*this.settings.add('chat.banners.kappa-train', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Attempt to always display the Golden Kappa Train, even if other Hype Trains are hidden.',
				description: '**Note**: This setting is currently theoretical and may not work, or may cause non-Kappa hype trains to appear. Due to the infrequent nature of hype trains, and especially the golden kappa hype train, it is very hard to test.',
				component: 'setting-check-box'
			}
		});*/

		this.settings.add('chat.banners.shared-chat', {
			default: true,
			ui: {
				path: 'Chat > Shared Chat >> Behavior',
				title: 'Allow the Shared Chat notice to be displayed in chat when a Shared Chat is enabled.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.banners.pinned-message', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow Pinned Messages to be displayed in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.banners.drops', {
			default: true,
			ui: {
				path: 'Chat > Drops >> Appearance',
				title: 'Allow messages about Drops to be displayed in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.banners.polls', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow Polls to be displayed in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.banners.prediction', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow Predictions to be displayed in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.callouts.clip', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Allow the \"Chat seems active.\" clip suggestion to be displayed in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.community-chest.show', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Display the Community Gift Chest banner.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.points.allow-highlight', {
			default: 2,
			ui: {
				path: 'Chat > Channel Points >> Appearance',
				title: 'Highlight the message in chat when someone redeems Highlight My Message.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Twitch Style'},
					{value: 2, title: 'FFZ Style'}
				]
			}
		});

		this.settings.add('chat.points.show-callouts', {
			default: true,
			ui: {
				path: 'Chat > Channel Points >> General',
				title: 'Display messages in chat about Channel Points rewards.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.points.show-button', {
			default: true,
			ui: {
				path: 'Chat > Channel Points >> General',
				title: 'Display Channel Points button beneath chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.points.show-rewards', {
			default: true,
			requires: ['layout.portrait-min-chat'],
			process(ctx, val) {
				if ( ctx.get('layout.portrait-min-chat') )
					return false;

				return val;
			},
			ui: {
				path: 'Chat > Channel Points >> Behavior',
				title: 'Allow available rewards to appear next to the Channel Points button.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.points.auto-rewards', {
			default: false,
			ui: {
				path: 'Chat > Channel Points >> Behavior',
				title: 'Automatically claim bonus rewards.',
				component: 'setting-check-box',
				force_seen: true
			}
		});

		this.settings.add('chat.drops.auto-rewards', {
			default: false,
			ui: {
				path: 'Chat > Drops >> Behavior',
				title: 'Automatically claim drops.',
				component: 'setting-check-box',
			}
		});

		this.settings.add('chat.pin-resubs', {
			default: false,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Automatically pin re-subscription messages in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.shared-chat.style', {
			default: null,
			ui: {
				path: 'Chat > Shared Chat >> Appearance',
				title: 'Pill Style',
				component: 'setting-select-box',
				description: 'This controls the appearance of the pill at the left-side of chat messages when a message is part of a Shared Chat. By default, this is Avatar for moderators and broadcasters and Hidden for everyone else.',
				data: [
					{value: null, title: 'Automatic'},
					{value: 0, title: 'Hidden'},
					{value: 1, title: 'Channel Name'},
					{value: 2, title: 'Avatar'}
				]
			}
		});

		this.settings.add('chat.shared-chat.username-tooltip', {
			default: true,
			ui: {
				path: 'Chat > Shared Chat >> Appearance',
				component: 'setting-check-box',
				title: 'Display the source channel of a chat message when hovering over the poster\'s username.',
			}
		});

		this.settings.add('chat.width', {
			default: null,
			ui: {
				path: 'Chat > Appearance >> General @{"sort": -1}',
				title: 'Width',
				description: "How wide chat should be, in pixels. This may be affected by your browser's zoom and font size settings.",
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val <= 0 )
						return null;

					return val;
				}
			}
		});

		this.settings.add('chat.effective-width', {
			requires: ['chat.width', 'context.ui.rightColumnWidth'],
			process(ctx) {
				const val = ctx.get('chat.width');
				return val == null ? (ctx.get('context.ui.rightColumnWidth') || 340) : val;
			}
		});

		this.settings.add('chat.use-width', {
			requires: ['chat.width', 'context.ui.rightColumnExpanded', 'context.isWatchParty'],
			process(ctx) {
				if ( ! ctx.get('context.ui.rightColumnExpanded') || ctx.get('context.isWatchParty') )
					return false;

				return ctx.get('chat.width') != null;
			}
		});

		this.settings.add('chat.bits.show-pinned', {
			requires: ['chat.bits.show'],
			default: null,
			process(ctx, val) {
				if ( val != null )
					return val;

				return ctx.get('chat.bits.show')
			},

			ui: {
				path: 'Chat > Appearance >> Community',
				title: 'Display Leaderboard',
				description: 'The leaderboard shows the top cheerers and sub gifters in a channel.\n\nBy default due to a previous implementation, this inherits its value from [Chat > Bits and Cheering > Display Bits](~chat.bits_and_cheering).',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.bits.show-rewards', {
			requires: ['chat.bits.show'],
			default: null,
			process(ctx, val) {
				if ( val != null )
					return val;

				return ctx.get('chat.bits.show')
			},

			ui: {
				path: 'Chat > Bits and Cheering >> Behavior',
				title: 'Display messages when a cheer shares rewards to people in chat.',
				description: 'By default, this inherits its value from Display Bits. This setting only affects newly arrived messages.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.bits.cheer-notice', {
			default: true,
			ui: {
				path: 'Chat > Bits and Cheering >> Appearance',
				title: 'Display a notice on chat messages that include cheers.',
				description: 'This feature is intended to prevent possible confusion from chatters using emotes to fake cheers in messages. When enabled, messages that contain real cheers will display a message above them, similar to how resubscription messages or point redemptions with messages function.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.rituals.show', {
			default: true,
			ui: {
				path: 'Chat > Filtering > General >> Rituals',
				title: 'Display ritual messages such as "User is new here! Say Hello!".',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.extra-timestamps', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Display timestamps on notices.',
				description: 'When enabled, timestamps will be displayed on point redemptions, subscriptions, etc.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.hype.message-style', {
			default: 1,
			ui: {
				path: 'Chat > Hype Chat >> Appearance',
				title: 'Hype Chat Style',
				component: 'setting-select-box',
				description: '**Note**: Hype Chats that include messages will always have their messages displayed, regardless of setting. Changes made to this setting may not affect existing chat messages.',
				data: [
					{value: 0, title: 'Do Not Display'},
					{value: 1, title: 'Standard Twitch (Large, Colored, Limited FFZ Support)'},
					{value: 2, title: 'Minimal (Marked with System Message, No Colors)' }
				]
			}
		});

		this.settings.add('chat.subs.show', {
			default: 3,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Display Subs in Chat',
				component: 'setting-select-box',
				description: '**Note**: Messages sent with re-subs will always be displayed. This only controls the special "X subscribed!" message.',
				data: [
					{value: 0, title: 'Do Not Display'},
					{value: 1, title: 'Re-Subs with Messages Only'},
					{value: 2, title: 'Re-Subs Only'},
					{value: 3, title: 'Display All'}
				]
			}
		});

		this.settings.add('chat.subs.compact', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Display subscription notices in a more compact (classic style) form.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.subs.merge-gifts', {
			default: 1000,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Merge Mass Sub Gifts',
				component: 'setting-select-box',
				data: [
					{value: 1000, title: 'Disabled'},
					{value: 50, title: 'More than 50'},
					{value: 20, title: 'More than 20'},
					{value: 10, title: 'More than 10'},
					{value: 5, title: 'More than 5'},
					{value: 0, title: 'Always'}
				],
				description: 'Merge mass gift subscriptions into a single message, depending on the quantity.\n**Note:** Only affects newly gifted subs.'
			}
		});

		this.settings.add('chat.subs.merge-gifts-visibility', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Expand merged mass sub gift messages by default.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.alternate', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Display lines with alternating background colors.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.padding', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Reduce padding around lines.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.borders', {
			default: 0,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Separators',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Basic Line (1px Solid)'},
					{value: 2, title: '3D Line (2px Groove)'},
					{value: 3, title: '3D Line (2px Groove Inset)'},
					{value: 4, title: 'Wide Line (2px Solid)'}
				]
			}
		});

		this.settings.add('chat.input.show-mod-view', {
			default: true,
			ui: {
				path: 'Chat > Input >> Appearance',
				title: 'Allow the "Mod View" button to appear in relevant channels.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.input.show-highlight', {
			default: true,
			ui: {
				path: 'Chat > Input >> Appearance',
				title: 'Allow the "Chat Highlight Settings" button to appear in relevant channels.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.input.show-shield', {
			default: true,
			ui: {
				path: 'Chat > Input >> Appearance',
				title: 'Allow the "Shield Mode" button to appear in relevant channels.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.input.show-elevate-your-message', {
			default: true,
			ui: {
				path: 'Chat > Input >> Appearance',
				title: 'Allow the "Elevate Your Message" button to be displayed.',
				component: 'setting-check-box'
			}
		});
	}

	get currentChat() {
		for(const inst of this.ChatController.instances)
			if ( inst && inst.chatService )
				return inst;

		return null;
	}


	updateColors() {
		const is_dark = this.chat.context.get('theme.is-dark'),
			mode = this.chat.context.get('chat.adjustment-mode'),
			contrast = this.chat.context.get('chat.adjustment-contrast'),
			c = this.colors,
			ic = this.inverse_colors;

		let chat_dark = is_dark,
			chat_color = Color.RGBA.fromCSS(
				this.chat.context.get('theme.color.chat-background') ||
				this.chat.context.get('theme.color.background')
			);

		if ( chat_color )
			chat_dark = chat_color.toHSLA().l < 0.5;

		chat_color = chat_dark ? '#191919' : '#E0E0E0';

		let text_dark = ! chat_dark,
			chat_text = Color.RGBA.fromCSS(
				this.chat.context.get('theme.color.chat-text') ||
				this.chat.context.get('theme.color.text')
			);

		if ( chat_text )
			text_dark = chat_text.toHSLA().l < 0.5;

		chat_text = text_dark ? '#19171c' : '#dad8de';

		// TODO: Get the background color from the theme system.
		// Updated: Use the lightest/darkest colors from alternating rows for better readibility.
		c._base = chat_color; // is_dark ? '#191919' : '#e0e0e0'; //#0e0c13' : '#faf9fa';
		c.mode = mode;
		c.contrast = contrast;

		ic._base = chat_text; // is_dark ? '#dad8de' : '#19171c';
		ic.mode = mode;
		ic.contrast = contrast;

		this.chat_line.rerenderLines();
		//this.updateChatLines();
		this.updateMentionCSS();
		this.emit(':update-colors');
	}


	updateChatCSS() {
		if ( ! this._update_css_waiter )
			this._update_css_waiter = requestAnimationFrame(() => this._updateChatCSS());
	}

	_updateChatCSS() {
		cancelAnimationFrame(this._update_css_waiter);
		this._update_css_waiter = null;

		const width = this.chat.context.get('chat.effective-width'),
			action_size = this.chat.context.get('chat.actions.size'),
			hover_action_size = this.chat.context.get('chat.actions.hover-size'),
			ts_size = this.chat.context.get('chat.timestamp-size'),
			size = this.chat.context.get('chat.font-size'),
			emote_alignment = this.chat.context.get('chat.lines.emote-alignment'),
			lh = Math.round((20/12) * size);

		const hover_action_icon = Math.round(hover_action_size * (2/3)),
			hover_action_padding = hover_action_size - hover_action_icon;

		let font = this.chat.context.get('chat.font-family') || 'inherit';
		const [processed, unloader] = useFont(font);
		font = processed;

		if ( this._font_unloader )
			this._font_unloader();

		this._font_unloader = unloader;

		if ( font.indexOf(' ') !== -1 && font.indexOf(',') === -1 && font.indexOf('"') === -1 && font.indexOf("'") === -1 )
			font = `"${font}"`;

		if ( ts_size )
			this.css_tweaks.set('ts-size', `.chat-line__timestamp{font-size:${ts_size/10}rem}`);
		else
			this.css_tweaks.delete('ts-size');

		this.css_tweaks.setVariable('chat-actions-size', `${action_size/10}rem`);
		this.css_tweaks.setVariable('chat-actions-hover-size', `${hover_action_icon/10}rem`);
		this.css_tweaks.setVariable('chat-actions-hover-padding', `${hover_action_padding/20}rem`);
		this.css_tweaks.setVariable('chat-font-size', `${size/10}rem`);
		this.css_tweaks.setVariable('chat-line-height', `${lh/10}rem`);
		this.css_tweaks.setVariable('chat-font-family', font);
		this.css_tweaks.setVariable('chat-width', `${width/10}rem`);
		this.css_tweaks.setVariable('negative-chat-width', `${-width/10}rem`);

		this.css_tweaks.toggle('chat-font', size !== 14 || font !== 'inherit');
		this.css_tweaks.toggle('chat-width', this.settings.get('chat.use-width'));
		this.css_tweaks.toggle('chat-fix--watch-party', this.settings.get('context.isWatchParty'));

		this.css_tweaks.toggle('emote-alignment-padded', emote_alignment === 1);
		this.css_tweaks.toggle('emote-alignment-baseline', emote_alignment === 2);

		this.emit(':update-chat-css');
		this.emit('site.player:fix-player');
		this.emit('site.layout:resize');
	}

	updateLineBorders() {
		const mode = this.chat.context.get('chat.lines.borders');

		this.css_tweaks.toggle('chat-borders', mode > 0);
		this.css_tweaks.toggle('chat-borders-3d', mode === 2);
		this.css_tweaks.toggle('chat-borders-3d-inset', mode === 3);
		this.css_tweaks.toggle('chat-borders-wide', mode === 4);
	}

	updateMentionCSS() {
		const enabled = this.chat.context.get('chat.filtering.highlight-mentions');
		this.css_tweaks.toggle('chat-mention-token', this.chat.context.get('chat.filtering.highlight-tokens'));

		const raw_color = this.chat.context.get('chat.filtering.mention-color');
		if ( raw_color ) {
			this.css_tweaks.toggle('chat-mention-bg', false);
			this.css_tweaks.toggle('chat-mention-bg-alt', false);

			this.css_tweaks.toggle('chat-mention-bg-custom', true);
			this.css_tweaks.setVariable('chat-mention-color', this.inverse_colors.process(raw_color));

		} else {
			this.css_tweaks.toggle('chat-mention-bg-custom', false);
			this.css_tweaks.toggle('chat-mention-bg', enabled);
			this.css_tweaks.toggle('chat-mention-bg-alt', enabled && this.chat.context.get('chat.lines.alternate'));
		}
	}


	updatePointsInfo(inst) {
		const icon = inst?.pointIcon,
			name = inst?.pointName;

		if ( icon ) {
			this.css_tweaks.set('points-icon', `.ffz--points-icon:before { display: none }
.ffz--points-icon:after {
	display: inline-block;
	margin: 0 0.5rem -0.6rem;
	background-image: url("${icon.url}");
	background-image: ${WEBKIT}image-set(url("${icon.url}") 1x, url("${icon.url2x}") 2x, url("${icon.url4x}") 4x);
}`);
		} else
			this.css_tweaks.delete('points-icon');

		this.point_name = name || null;
	}


	grabTypes() {
		if ( this.types_loaded )
			return;

		const ct = this.web_munch.getModule('chat-types'),
			callouts = this.web_munch.getModule('callout-types');

		this.callout_types = callouts || CALLOUT_TYPES;
		this.automod_types = ct?.automod || AUTOMOD_TYPES;
		this.chat_types = ct?.chat || CHAT_TYPES;
		this.message_types = ct?.message || MESSAGE_TYPES;
		this.mod_types = ct?.mod || MOD_TYPES;

		if ( ! ct )
			return;

		if ( callouts )
			this.chat.context.update('chat.filtering.blocked-callouts');

		this.types_loaded = true;
		const changes = [];

		if ( ! shallow_object_equals(this.callout_types, CALLOUT_TYPES) )
			changes.push('CALLOUT_TYPES');

		if ( ! shallow_object_equals(this.automod_types, AUTOMOD_TYPES) )
			changes.push('AUTOMOD_TYPES');

		if ( ! shallow_object_equals(this.chat_types, CHAT_TYPES) )
			changes.push('CHAT_TYPES');

		if ( ! shallow_object_equals(this.message_types, MESSAGE_TYPES) )
			changes.push('MESSAGE_TYPES');

		if ( ! shallow_object_equals(this.mod_types, MOD_TYPES) )
			changes.push('MOD_TYPES');

		if ( changes.length )
			this.log.info('Chat Types have changed from static mappings for categories:', changes.join(' '));
	}


	updateDisableHandling() {
		this.disable_handling = this.chat.context.get('chat.disable-handling');
	}


	/*setChatPortal(node) {
		if ( ! node )
			node = null;

		if ( node === this.chat_portal )
			return;

		if ( node && !(node instanceof HTMLElement) )
			throw new Error('Tried to set invalid chat portal, must be null or HTMLElement');

		this.chat_portal = node;
		this.loadable.ErrorBoundaryComponent.forceUpdate();
	}*/


	onEnable() {
		this.on('site.web_munch:new-ready', this.grabTypes);
		this.on('site.web_munch:new-ready', this.defineClasses);
		this.grabTypes();
		this.defineClasses();

		this.chat.context.on('changed:chat.callouts.clip', this.updateCallouts, this);
		this.chat.context.on('changed:chat.filtering.blocked-callouts', this.updateCallouts, this);
		this.chat.context.on('changed:chat.points.show-callouts', this.updateCallouts, this);
		this.chat.context.on('changed:chat.points.show-button', () => this.PointsButton.forceUpdate());
		this.chat.context.on('changed:chat.points.show-rewards', () => {
			this.PointsButton.forceUpdate();
			this.PointsClaimButton.forceUpdate();
		});
		this.chat.context.on('changed:chat.bits.show', () => {
			this.PointsButton.forceUpdate();
		});

		this.chat.context.on('changed:chat.banners.hype-train', this.cleanHighlights, this);
		this.chat.context.on('changed:chat.subs.gift-banner', this.cleanHighlights, this);
		this.chat.context.on('changed:chat.banners.polls', this.cleanHighlights, this);
		this.chat.context.on('changed:chat.banners.prediction', this.cleanHighlights, this);
		this.chat.context.on('changed:chat.banners.drops', this.cleanHighlights, this);
		this.chat.context.on('changed:chat.banners.pinned-message', this.cleanHighlights, this);
		this.chat.context.on('changed:chat.banners.hide-appleplus', this.cleanHighlights, this);
		this.chat.context.on('changed:chat.banners.shared-chat', this.cleanHighlights, this);

		this.chat.context.on('changed:chat.disable-handling', this.updateDisableHandling, this);

		this.chat.context.on('changed:chat.banners.charity', () => {
			this.ChatContainer.forceUpdate();
		});

		this.chat.context.on('changed:chat.subs.gift-banner', () => this.GiftBanner.forceUpdate(), this);
		this.chat.context.on('changed:chat.effective-width', this.updateChatCSS, this);
		this.settings.main_context.on('changed:chat.use-width', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.actions.size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.actions.hover-size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.timestamp-size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-family', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.lines.emote-alignment', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.adjustment-mode', this.updateColors, this);
		this.chat.context.on('changed:chat.adjustment-contrast', this.updateColors, this);
		this.chat.context.on('changed:theme.is-dark', this.updateColors, this);
		this.chat.context.on('changed:theme.color.background', this.updateColors, this);
		this.chat.context.on('changed:theme.color.chat-background', this.updateColors, this);
		this.chat.context.on('changed:theme.color.text', this.updateColors, this);
		this.chat.context.on('changed:theme.color.chat-text', this.updateColors, this);
		this.chat.context.on('changed:chat.lines.borders', this.updateLineBorders, this);
		this.chat.context.on('changed:chat.filtering.highlight-mentions', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.filtering.highlight-tokens', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.filtering.mention-color', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.pin-resubs', val => {
			if ( val ) {
				this.updateInlineCallouts();
				this.updatePinnedCallouts();
			}
		}, this);

		this.chat.context.on('changed:chat.community-chest.show', () => {
			this.CommunityChestBanner.forceUpdate();
			this.updateCallouts();
		}, this);

		this.chat.context.getChanges('chat.emotes.2x', val => {
			this.css_tweaks.toggle('big-emoji', val > 1);
			this.toggleEmoteJail();
		});

		this.chat.context.getChanges('chat.emotes.limit-size', () =>
			this.toggleEmoteJail());

		this.chat.context.getChanges('chat.banners.last-events', val =>
			this.css_tweaks.toggleHide('last-x-events', ! val));

		this.chat.context.getChanges('chat.input.show-mod-view', val =>
			this.css_tweaks.toggleHide('ci-mod-view', ! val));

		this.chat.context.getChanges('chat.input.show-highlight', val =>
			this.css_tweaks.toggleHide('ci-highlight-settings', !val));

		this.chat.context.getChanges('chat.input.show-shield', val =>
			this.css_tweaks.toggleHide('ci-shield-mode', ! val));

		this.chat.context.getChanges('chat.lines.padding', val =>
			this.css_tweaks.toggle('chat-padding', val));

		this.chat.context.getChanges('chat.bits.show', val =>
			this.css_tweaks.toggle('hide-bits', !val));

		this.chat.context.on('changed:chat.bits.show-pinned', () =>
			this.ChatLeaderboard.forceUpdate());

		this.chat.context.getChanges('chat.filtering.deleted-style', val => {
			this.css_tweaks.toggle('chat-deleted-strike', val === 1 || val === 2);
			this.css_tweaks.toggle('chat-deleted-fade', val < 2);
		});

		this.chat.context.getChanges('chat.filtering.clickable-mentions', val =>
			this.css_tweaks.toggle('clickable-mentions', val));

		this.chat.context.getChanges('chat.filtering.bold-mentions', val =>
			this.css_tweaks.toggle('chat-mention-no-bold', ! val));

		this.chat.context.getChanges('chat.hide-community-highlights', val =>
			this.css_tweaks.toggleHide('community-highlights', val));

		this.chat.context.getChanges('chat.lines.alternate', val => {
			this.css_tweaks.toggle('chat-rows', val);
			this.updateMentionCSS();
		});

		this.chat.context.getChanges('chat.input.show-elevate-your-message', val =>
			this.css_tweaks.toggleHide('elevate-your-message', ! val));

		this.updateDisableHandling();
		this.updateChatCSS();
		this.updateColors();
		this.updateLineBorders();
		//this.updateMentionCSS();

		this.on('chat:get-messages-late', (include_chat, include_whisper, include_video, messages) => {
			if ( ! include_chat )
				return;

			const msg_ids = new Set(messages.map(x => x.message?.id));

			for(const inst of this.ChatBuffer.instances) {
				for(const msg of inst.buffer) {
					const msg_id = msg?.id;
					if ( ! msg_id || msg_ids.has(msg_id) || ! msg.ffz_standardized )
						continue;

					msg_ids.add(msg_id);
					messages.push({
						message: msg,
						_instance: null,
						update: () => null
					});
				}

				for(const raw of inst.delayedMessageBuffer) {
					const msg = raw?.event,
						msg_id = msg?.id;
					if ( ! msg_id || msg_ids.has(msg_id) || ! msg.ffz_standardized )
						continue;

					msg_ids.add(msg_id);
					messages.push({
						message: msg,
						_instance: null,
						update: () => null
					});
				}
			}
		});

		this.on('chat:get-tab-commands', e => {
			e.commands.push({
				name: 'reconnect',
				description: 'Force chat to reconnect.',
				permissionLevel: 0,
				ffz_group: 'FrankerFaceZ'
			})
		});

		this.on('chat:pre-send-message', e => {
			const msg = e.message,
				inst = e._inst;

			if ( ! /^\/reconnect ?/i.test(msg) )
				return;

			e.preventDefault();

			if ( ! inst.client?.reconnect )
				inst.addMessage({
					type: t.chat_types.Notice,
					message: t.i18n.t('chat.reconnect.unable', 'FFZ is unable to force chat to reconnect.')
				});
			else {
				inst.addMessage({
					type: t.chat_types.Notice,
					message: t.i18n.t('chat.reconnect', 'FFZ is forcing chat to reconnect...')
				});

				inst.client.reconnect();
			}
		});

		/*this.loadable.ErrorBoundaryComponent.ready(cls => {
			const t = this,
				proto = cls.prototype,
				old_render = proto.render;

			proto.render = function() {
				try {
					const type = this.props.name;
					if ( type === 'ChatLive' && t.chat_portal ) {
						const ReactDOM = t.site.getReactDom(),
							createPortal = ReactDOM?.createPortal;

						if ( createPortal ) {
							const out = old_render.call(this);
							console.log('creating portal', out);
							return createPortal(out, t.chat_portal, 'ffz-chat-portal');
						}
					}

				} catch(err) {
					/* no-op * /
				}

				return old_render.call(this);
			}
		});*/

		this.RaidController.on('mount', this.wrapRaidController, this);
		this.RaidController.on('update', this.noAutoRaids, this);
		this.RaidController.ready((cls, instances) => {
			for(const inst of instances)
				this.wrapRaidController(inst);
		});

		this.InlineCallout.on('mount', this.onInlineCallout, this);
		this.InlineCallout.on('update', this.onInlineCallout, this);
		this.InlineCallout.ready(() => this.updateInlineCallouts());

		this.PinnedCallout.on('mount', this.onPinnedCallout, this);
		this.PinnedCallout.on('update', this.onPinnedCallout, this);
		this.PinnedCallout.ready(() => this.updatePinnedCallouts());

		const t = this;

		this.PointsInfo.on('mount', this.updatePointsInfo, this);
		this.PointsInfo.on('update', this.updatePointsInfo, this);
		this.PointsInfo.on('unmount', () => this.updatePointsInfo(null));
		this.PointsInfo.ready(() => this.updatePointsInfo(this.PointsInfo.first));

		this.ChatLeaderboard.ready(cls => {
			const old_render = cls.prototype.render;
			cls.prototype.render = function() {
				if ( ! t.chat.context.get('chat.bits.show-pinned') )
					return null;

				return old_render.call(this);
			}

			this.ChatLeaderboard.forceUpdate();
		});

		this.GiftBanner.ready(cls => {
			const old_render = cls.prototype.render;
			cls.prototype.render = function() {
				if ( ! t.chat.context.get('chat.subs.gift-banner') )
					return null;

				return old_render.call(this);
			}

			this.GiftBanner.forceUpdate();
		});

		this.CommunityChestBanner.ready(cls => {
			const old_render = cls.prototype.render;
			cls.prototype.render = function() {
				try {
					if ( ! t.chat.context.get('chat.community-chest.show') )
						return null;
				} catch(err) {
					t.log.capture(err);
					t.log.error(err);
				}

				return old_render.call(this);
			};

			this.CommunityChestBanner.forceUpdate();
		});

		this.PointsButton.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				try {
					if ( ! t.chat.context.get('chat.points.show-button') )
						return null;

					const old_aq = this.state.animationQueue,
						old_bits = this.props.bitsEnabled;

					if ( ! t.chat.context.get('chat.points.show-rewards') )
						this.state.animationQueue = [];

					if ( ! t.chat.context.get('chat.bits.show') )
						this.props.bitsEnabled = false;

					const out = old_render.call(this);

					this.state.animationQueue = old_aq;
					this.props.bitsEnabled = old_bits;
					return out;

				} catch(err) {
					t.log.capture(err);
					t.log.error(err);
				}

				return old_render.call(this);
			}

			this.PointsButton.forceUpdate();
		});

		this.PointsClaimButton.ready(cls => {
			cls.prototype.ffzHasOffer = function() {
				return ! this.props.hidden && ! this.state?.error && this.getClaim() != null;
			};

			const old_render = cls.prototype.render;
			cls.prototype.render = function() {
				try {
					if ( this.ffzHasOffer() && ! this._ffz_timer && t.chat.context.get('chat.points.auto-rewards') )
						this._ffz_timer = setTimeout(() => {
							this._ffz_timer = null;
							if ( this.onClick && this.ffzHasOffer() )
								this.onClick();
						}, 1000 + Math.floor(Math.random() * 5000));

					if ( ! t.chat.context.get('chat.points.show-rewards') )
						return null;

				} catch(err) {
					t.log.capture(err);
					t.log.error(err);
				}

				return old_render.call(this);
			}

			this.PointsClaimButton.forceUpdate();
		});

		this.ChatController.on('mount', this.chatMounted, this);
		this.ChatController.on('unmount', this.chatUnmounted, this);
		//this.ChatController.on('receive-props', this.chatUpdated, this);
		this.ChatController.on('update', this.chatUpdated, this);

		this.ChatService.ready((cls, instances) => {
			this.wrapChatService(cls);

			for(const inst of instances) {
				inst.client.events.removeAll();

				inst._ffzInstall();

				const channel = inst.joinedChannel,
					state = inst.client?.session?.channelstate?.[`#${channel}`]?.roomState;

				if ( state )
					this.updateChatState(state);

				inst.addEventListeners();

				inst.props.setChatConnectionAPI({
					sendMessage: inst.sendMessage,
					_ffz_inst: inst
				});
			}
		});

		this.ChatBuffer.ready((cls, instances) => {
			this.wrapChatBuffer(cls);

			for(const inst of instances) {
				const handler = inst.props.messageHandlerAPI;
				if ( handler )
					handler.removeMessageHandler(inst.handleMessage);

				inst._ffzInstall();

				if ( handler )
					handler.addMessageHandler(inst.handleMessage);

				// We grab this from the chat client now.
				/*if ( Array.isArray(inst.buffer) ) {
					let i = inst.buffer.length;
					const ct = this.chat_types || CHAT_TYPES;

					while(i--) {
						const msg = inst.buffer[i];
						if ( msg && msg.type === ct.RoomState && msg.state ) {
							this.updateChatState(msg.state);
							break;
						}
					}
				}*/

				inst.props.setMessageBufferAPI({
					addUpdateHandler: inst.addUpdateHandler,
					removeUpdateHandler: inst.removeUpdateHandler,
					getUnreadCount: inst.getUnreadCount,
					getMessages: inst.getMessages,
					getMessagesForHighlight: inst.getMessagesForHighlight,
					getMessagesForAllHighlights: inst.getMessagesForAllHighlights,
					isPaused: inst.isPaused,
					setPaused: inst.setPaused,
					hasNewerLeft: inst.hasNewerLeft,
					loadNewer: inst.loadNewer,
					loadNewest: inst.loadNewest,
					_ffz_inst: inst
				});
			}
		});

		this.ChatRewardEventHandler.ready((cls, instances) => {
			const t = this,
				old_subscribe = cls.prototype.subscribe;

			cls.prototype.ffzInstall = function() {
				if (this._ffz_installed)
					return;

				this._ffz_installed = true;
				const inst = this;
				const old_handle = this.handleMessage;
				this.handleMessage = function(msg) {
					//t.log.info('reward-message', msg, inst);
					if ( t.disable_handling )
						return old_handle.call(this, msg);

					try {
						if ( ! inst.props?.channelID || ! msg )
							return;

						t.insertChannelPointMessage(msg);
						return;

					} catch(err) {
						t.log.error('Error handling reward event:', err);
						return old_handle.call(this, msg);
					}
				}
			};

			cls.prototype.subscribe = function(...args) {
				try {
					this.ffzInstall();
				} catch(err) {
					t.log.error('Error in subscribe for RewardEventHandler:', err);
				}
				return old_subscribe.call(this, ...args);
			}

			for(const inst of instances)
				inst.subscribe();
		});

		this.ChatBufferConnector.on('mount', this.connectorMounted, this);
		this.ChatBufferConnector.on('update', this.connectorUpdated, this);
		this.ChatBufferConnector.on('unmount', this.connectorUnmounted, this);

		this.ChatBufferConnector.ready((cls, instances) => {
			for(const inst of instances)
				this.connectorMounted(inst);
		});

		this.ChatController.ready((cls, instances) => {
			const t = this,
				old_catch = cls.prototype.componentDidCatch,
				old_render = cls.prototype.render;

			// Try catching errors. With any luck, maybe we can
			// recover from the error when we re-build?
			cls.prototype.componentDidCatch = function(err, info) {
				// Don't log infinitely if stuff gets super screwed up.
				const errs = this.state.ffz_errors || 0;
				if ( errs < 100 ) {
					this.setState({ffz_errors: errs + 1});
					t.log.info('Error within Chat', err, info, errs);
				}

				if ( old_catch )
					return old_catch.call(this, err, info);
			}

			cls.prototype.render = function() {
				if ( this.state.ffz_errors > 0 ) {
					const React = t.site.getReact(),
						createElement = React && React.createElement;

					if ( ! createElement )
						return null;

					return createElement('div', {
						className: 'tw-border-l tw-c-background-alt-2 tw-c-text-base tw-full-width tw-full-height tw-align-items-center tw-flex tw-flex-column tw-justify-content-center tw-relative'
					}, 'There was an error displaying chat.');

				}

				return old_render.call(this);
			}

			for(const inst of instances)
				this.chatMounted(inst);
		});

		this.ChatRenderer.on('mount', this.rendererMounted, this);
		this.ChatRenderer.on('unmount', this.rendererUnmounted, this);
		this.ChatRenderer.on('update', this.rendererUpdated, this);

		this.ChatRenderer.ready((cls, instances) => {
			for(const inst of instances)
				this.rendererMounted(inst);
		})

		this.ChatContainer.on('mount', this.containerMounted, this);
		this.ChatContainer.on('unmount', this.containerUnmounted, this); //removeRoom, this);
		this.ChatContainer.on('update', this.containerUpdated, this);

		this.CalloutSelector.ready((cls, instances) => {
			const t = this,
				old_render = cls.prototype.render;

			cls.prototype.render = function() {
				try {
					if ( t.CalloutStackHandler ) {
						const React = t.site.getReact(),
							out = old_render.call(this),
							thing = out?.props?.children;

						if ( Array.isArray(thing) )
							thing.push(React.createElement(t.CalloutStackHandler));

						return out;
					}
				} catch(err) {
					/* no-op */
				}

				return old_render.call(this);
			}

			for(const inst of instances)
				inst.forceUpdate();
		});

		this.ChatContainer.ready((cls, instances) => {
			const t = this,
				old_render = cls.prototype.render,
				old_catch = cls.prototype.componentDidCatch;

			cls.prototype.ffzRender = function() {
				if ( t.chat.context.get('chat.banners.charity') )
					return old_render.call(this);

				const cd = this.props.campaignData;
				this.props.campaignData = null;
				let result;

				try {
					result = old_render.call(this);
				} catch(err) {
					this.props.campaignData = cd;
					throw err;
				}

				this.props.campaignData = cd;
				return result;
			}

			cls.prototype.render = function() {
				try {
					if ( t.CommunityStackHandler ) {
						const React = t.site.getReact(),
							out = this.ffzRender(),
							thing = out?.props?.children?.props?.children;

						if ( React && Array.isArray(thing) )
							thing.push(React.createElement(t.CommunityStackHandler));

						return out;
					}

				} catch(err) {
					// No op
				}

				return this.ffzRender();
			}

			// Try catching errors. With any luck, maybe we can
			// recover from the error when we re-build?
			cls.prototype.componentDidCatch = function(err, info) {
				// Don't log infinitely if stuff gets super screwed up.
				const errs = this.state.ffz_errors || 0;
				if ( errs < 100 ) {
					this.setState({ffz_errors: errs + 1});
					t.log.info('Error within Chat Container', err, info, errs);
				}

				if ( old_catch )
					return old_catch.call(this, err, info);
			}


			for(const inst of instances)
				this.containerMounted(inst);
		});

		this.subpump.on(':pubsub-message', event => {
			if ( event.prefix !== 'community-points-channel-v1' || this.disable_handling )
				return;

			if ( event.prefix === 'pinned-chat-updates-v1' ) {
				this.log.debug('Pinned Chat', event);
				return;
			}

			const service = this.ChatService.first,
				message = event.message,
				data = message?.data?.redemption;
			if ( ! message || ! service || message.type !== 'reward-redeemed' || service.props.channelID != data?.channel_id )
				return;

			this.insertChannelPointMessage(message);
		});
	}

	insertChannelPointMessage(msg) {
		const service = this.ChatService.first,
			data = msg?.data?.redemption,
			type = msg?.type,
			isRedeemed = type === 'reward-redeemed',
			isAutomaticReward = type === 'automatic-reward-redeemed';

		if ( ! data?.reward || ! service || (!isAutomaticReward && !isRedeemed) || service.props.channelID != data?.channel_id )
			return;

		if ((isRedeemed && data.user_input) || (isAutomaticReward && data.reward.reward_type !== 'celebration'))
			return;

		let rewardID;
		if (isAutomaticReward)
			rewardID = `${inst.props.channelID}:${data.reward.reward_type}`;
		else
			rewardID = data.reward.id;

		const reward = service.props.rewardMap[rewardID];
		if ( ! reward )
			return;

		if ( this.chat.context.get('chat.filtering.blocked-types').has('ChannelPointsReward') )
			return;

		if ( this.last_points_redeem === data.id )
			return;

		this.last_points_redeem = data.id;

		service.postMessageToCurrentChannel({}, {
			id: data.id,
			type: this.chat_types.Message,
			ffz_type: 'points',
			ffz_reward: reward,
			ffz_reward_highlight: isHighlightedReward(reward),
			messageParts: [],
			user: {
				id: data.user.id,
				login: data.user.login,
				displayName: data.user.display_name
			},
			timestamp: new Date(msg.data.timestamp || data.redeemed_at).getTime()
		});
	}


	shouldHideCallout(type) {
		if ( ! type )
			return;

		type = INLINE_CALLOUT_TYPES[type] ?? type.replace(/_/g, '-');

		const ctm = this.callout_types ?? CALLOUT_TYPES,
			blocked = this.chat.context.get('chat.filtering.blocked-callouts');

		if ( blocked && blocked.has(type) )
			return true;

		if ( type === ctm.CommunityPointsRewards &&
			! this.chat.context.get('chat.points.show-callouts')
		)
			return true;

		if ( type === ctm.ClipLiveNudge &&
			! this.chat.context.get('chat.callouts.clip')
		)
			return true;

		if ( type === 'prime_gift_bomb' &&
			! this.chat.context.get('chat.community-chest.show')
		)
			return true;

		if ( type === 'megacheer_emote_recipient' &&
			! t.chat.context.get('chat.bits.show-rewards')
		)
			return true;

		return false;
	}


	updateCallouts() {
		this.updatePinnedCallouts();
		this.updateInlineCallouts();
	}


	updatePinnedCallouts() {
		for(const inst of this.PinnedCallout.instances)
			this.onPinnedCallout(inst);
	}

	onPinnedCallout(inst) {
		const props = inst.props,
			event = props?.event,
			type = event?.type;

		//console.warn('pinned-callout', type, event, inst);

		// Hidden callouts
		if ( this.shouldHideCallout(type) ) {
			if ( inst.props.pinned )
				inst.unpin();
			else
				inst.hide();
		}

		// Auto-pin resubs
		if ( type === 'share-resub' && ! props.pinned && this.chat.context.get('chat.pin-resubs') && ! inst._ffz_pinned ) {
			this.log.info('Automatically pinning re-sub notice.');
			inst._ffz_pinned = true;
			inst.pin();
		}

		// Auto-claim drops
		if ( type === 'drop' )
			this.autoClickDrop(inst);
	}

	updateInlineCallouts() {
		for(const inst of this.InlineCallout.instances)
			this.onInlineCallout(inst);
	}

	onInlineCallout(inst) {
		// Skip hidden inline callouts.
		if ( inst.state.isHidden )
			return;

		const contextMenuProps = inst.props?.event?.callout?.contextMenuProps,
			event = contextMenuProps?.event ?? inst.props?.event,
			type = event?.type;

		//console.warn('inline-callout', type, event, inst);

		// Hidden callouts
		if ( this.shouldHideCallout(type) || this.shouldHideCallout(inst.props?.event?.trackingType) ) {
			inst.setState({isHidden: true});
			return;
		}

		// Auto-pin resubs
		if ( type === 'share-resub' && this.chat.context.get('chat.pin-resubs') && ! inst._ffz_pinned ) {
			const onPin = contextMenuProps?.onPin;
			if ( onPin ) {
				this.log.info('Automatically pinning re-sub notice.');
				inst._ffz_pinned = true;
				if ( inst.hideOnContextMenuAction )
					inst.hideOnContextMenuAction(onPin)();
				else
					onPin();
			}
		}

		// Auto-claim drops
		if ( type === 'drop' )
			this.autoClickDrop(inst);
	}


	autoClickDrop(inst) {
		const event = inst.props?.event?.callout?.contextMenuProps?.event ?? inst.props?.event,
			type = event?.type;

		if ( type !== 'drop' || inst._ffz_clicking || ! this.chat.context.get("chat.drops.auto-rewards") )
			return;

		//console.warn('autoClickDrop', event, inst);
		inst._ffz_clicking = true;

		// Wait for the button to be added to the DOM.
		const waiter = this.resolve('site').awaitElement(
			'button[data-a-target="chat-private-callout__primary-button"]',
			this.fine.getHostNode(inst),
			10000
		);

		waiter.then(btn => {
			inst._ffz_clicking = false;

			// Check AGAIN because time has passed.
			const event = inst.props?.event?.callout?.contextMenuProps?.event ?? inst.props?.event,
				type = event?.type;

			if ( type !== 'drop' || ! this.chat.context.get("chat.drops.auto-rewards") )
				return;

			btn.click();

		}).catch(() => {
			inst._ffz_clicking = false;
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
		if ( inst._ffz_no_raid )
			return;

		inst._ffz_no_raid = setTimeout(() => {
			inst._ffz_no_raid = null;

			if ( inst.props && inst.props.raid && ! inst.isRaidCreator && inst.hasJoinedCurrentRaid ) {
				const id = inst.props.raid.id;
				if ( this.joined_raids.has(id) )
					return;

				let leave = this.settings.get('channel.raids.no-autojoin');

				if ( ! leave ) {
					const blocked = this.settings.get('__filter:channel.raids.blocked-channels');
					if ( blocked && ((inst.props.raid.targetLogin && blocked.test(inst.props.raid.targetLogin)) || (inst.props.raid.targetDisplayName && blocked.test(inst.props.raid.targetDisplayName))) )
						leave = true;

					if ( ! leave )
						return;
				}

				this.log.info('Automatically leaving raid:', id);
				inst.handleLeaveRaid();
			}
		});
	}

	toggleEmoteJail() {
		const bigger = this.chat.context.get('chat.emotes.2x'),
			enabled = this.chat.context.get('chat.emotes.limit-size');

		this.css_tweaks.toggle('big-emote-jail', enabled && ! bigger);
		this.css_tweaks.toggle('bigger-emote-jail', enabled && bigger);
	}

	cleanHighlights() {
		const types = {
			'community_sub_gift': this.chat.context.get('chat.subs.gift-banner'),
			'megacheer': this.chat.context.get('chat.bits.show'),
			'hype_train': this.chat.context.get('chat.banners.hype-train'),
			'prediction': this.chat.context.get('chat.banners.prediction'),
			'poll': this.chat.context.get('chat.banners.polls'),
			'pinned_chat': this.chat.context.get('chat.banners.pinned-message'),
			'mw-drop-available': this.chat.context.get('chat.banners.drops'),
			'shared_chat': this.chat.context.get('chat.banners.shared-chat')
		};

		const highlights = this.community_stack?.highlights;
		if ( ! Array.isArray(highlights) )
			return;

		for(const entry of highlights) {
			if ( ! entry || ! entry.event || ! entry.id )
				continue;

			const type = entry.event.type;
			if ( type && has(types, type) && ! types[type] ) {
				// Attempt to allow Golden Kappa hype trains?
				//if ( type === 'hype_train' && entry.event.typeDetails === '0' && this.chat.context.get('chat.banners.kappa-train') )
				//	continue;

				this.log.info('Removing community highlight: ', type, '#', entry.id);
				this.community_dispatch({
					type: 'remove-highlight',
					id: entry.id
				});
			}

			if (type === 'mw-drop-available' &&
				entry.event.detailsURL === 'https://blog.twitch.tv/2024/07/26/sub-and-get-apple-tv/' &&
				this.chat.context.get('chat.banners.hide-appleplus')
			) {
				this.log.info('Removing community highlight: ', type, '#', entry.id);
				this.community_dispatch({
					type: 'remove-highlight',
					id: entry.id
				});
			}

		}
	}

	cleanCallouts() {
		const stack = this.callout_stack;
		if (stack?.pinnedCallout?.event?.type && this.shouldHideCallout(stack.pinnedCallout.event.type))
			stack.unpinCallout();

		if (stack?.callouts?.[0]?.event?.type && this.shouldHideCallout(stack.callouts[0].event.type))
			stack.clearCalloutType(stack.callouts[0].event.type);
	}

	defineClasses() {
		if ( this.CommunityStackHandler && this.CalloutStackHandler )
			return true;

		const t = this,
			React = this.site.getReact(),
			createElement = React?.createElement,
			StackMod = this.web_munch.getModule('highlightstack'),
			CalloutMod = this.web_munch.getModule('calloutstack');

		if ( ! createElement )
			return false;

		if ( ! this.CalloutStackHandler && CalloutMod ) {
			this.CalloutStackHandler = function() {
				const stack = React.useContext(CalloutMod.stack);

				t.callout_stack = stack;
				t.cleanCallouts();
				return null;
			}

			this.CalloutSelector.forceUpdate();
		}

		if ( ! this.CommunityStackHandler && StackMod ) {
			this.CommunityStackHandler = function() {
				const stack = React.useContext(StackMod.stack),
					dispatch = React.useContext(StackMod.dispatch);

				t.community_stack = stack;
				t.community_dispatch = dispatch;

				t.cleanHighlights();

				return null;
			}

			this.ChatContainer.forceUpdate();
		}

		return true;
	}


	updateChatState(state) {
		const old_state = this.chat.context.get('context.chat_state') || {};
		if ( deep_equals(state, old_state) )
			return;

		this.chat.context.updateContext({
			chat_state: state
		});

		this.input.updateInput();
	}


	tryUpdateBadges() {
		if ( !this._badge_timer )
			this._badge_timer = setTimeout(() => this._tryUpdateBadges(), 0);
	}

	_tryUpdateBadges() {
		if ( this._badge_timer )
			clearTimeout(this._badge_timer);
		this._badge_timer = null;

		this.log.info('Trying to update badge data from the chat container.');
		const inst = this.ChatContainer.first;
		if ( inst )
			this.containerUpdated(inst, inst.props);
	}


	wrapChatBuffer(cls) {
		if ( cls.prototype._ffz_was_here )
			return;

		const t = this,
			old_clear = cls.prototype.clear,
			old_flush = cls.prototype.flushRawMessages,
			old_mount = cls.prototype.componentDidMount;

		cls.prototype._ffzInstall = function() {
			if ( this._ffz_installed )
				return;

			this._ffz_installed = true;

			const inst = this,
				old_handle = inst.handleMessage,
				old_set = inst.props.setMessageBufferAPI;

			inst.props.setMessageBufferAPI = function(api) {
				if ( api )
					api._ffz_inst = inst;

				return old_set(api);
			}

			inst.handleMessage = function(msg) {
				if ( msg ) {
					try {
						const types = t.chat_types || {},
							mod_types = t.mod_types || {},
							blocked_types = t.chat.context.get('chat.filtering.blocked-types');

						if ( blocked_types.has(types[msg.type]) )
							return;

						if ( msg.type === types.ChannelPointsReward && ! isMessageEffect(msg.reward) )
							return;

						if ( msg.type === types.RewardGift && ! t.chat.context.get('chat.bits.show-rewards') )
							return;

						if ( msg.type === types.Message ) {
							const m = t.chat.standardizeMessage(msg),
								cont = inst._ffz_connector ?? inst.ffzGetConnector();

							let room_id = m.roomID = m.roomID ? m.roomID : cont?.props?.channelID;
							let room = m.roomLogin = m.roomLogin ? m.roomLogin : m.channel ? m.channel.slice(1) : cont?.props?.channelLogin;

							if ( ! room && room_id ) {
								const r = t.chat.getRoom(room_id, null, true);
								if ( r && r.login )
									room = m.roomLogin = r.login;
							}

							if ( ! room_id && room ) {
								const r = t.chat.getRoom(null, room, true);
								if ( r && r.id )
									room_id = m.roomID = r.id;
							}

							const u = t.site.getUser();
							if ( u && cont ) {
								u.moderator = cont.props.isCurrentUserModerator;
								u.staff = cont.props.isStaff;
							}

							m.ffz_tokens = m.ffz_tokens || t.chat.tokenizeMessage(m, u, true);
							if ( m.ffz_removed )
								return;

							if ( t.hasListeners('chat:receive-message') ) {
								const event = t.makeEvent({
									message: m,
									inst,
									channel: room,
									channelID: room_id
								});

								t.emit('chat:receive-message', event);
								if ( event.defaultPrevented || m.ffz_removed )
									return;
							}

						} /*else if ( msg.type === types.ModerationAction ) {
							t.emit('chat:mod-user', msg.moderationActionType, )

						} */ else if ( msg.type === types.Moderation ) {
							t.emit('chat:mod-user', msg.moderationType, msg.userLogin, msg.targetMessageID, msg);

							// Special handling
							if ( ! inst.props.isCurrentUserModerator ) {
								const type = msg.moderationType,
									target = msg.userLogin;

								// Whee~
								let mat;
								if ( type === mod_types.Ban )
									mat = 'ban';
								else if ( type === mod_types.Timeout )
									mat = 'timeout';
								else if ( type === mod_types.Delete )
									mat = 'delete';

								if ( mat )
									msg.moderationActionType = mat;

								// Handle moderation events ourself if it's not
								// a delete, so that we can pass the action info.
								if ( ! inst.moderatedUsers.has(target) && type !== mod_types.Delete ) {
									inst.moderateBuffers(
										[
											inst.buffer,
											inst.delayedMessageBuffer.map(e => e.event)
										],
										target,
										msg
									);

									inst.delayedMessageBuffer.push({
										event: msg,
										time: Date.now(),
										shouldDelay: false
									});

									return;
								}
							}

						} /*else if ( msg.type === types.ModerationAction && false && inst.markUserEventDeleted && inst.unsetModeratedUser ) {
							if ( !((! msg.level || ! msg.level.length) && msg.targetUserLogin && msg.targetUserLogin === inst.props.currentUserLogin) ) {
								//t.log.info('Moderation Action', msg);
								if ( ! inst.props.isCurrentUserModerator )
									return;

								const mod_action = msg.moderationActionType;
								if ( mod_action === 'ban' || mod_action === 'timeout' || mod_action === 'delete' ) {
									const user = msg.targetUserLogin;
									if ( inst.moderatedUsers.has(user) )
										return;

									const do_remove = t.chat.context.get('chat.filtering.remove-deleted') === 3;
									if ( do_remove ) {
										const len = inst.buffer.length,
											target_id = msg.messageID;
										inst.buffer = inst.buffer.filter(m =>
											m.type !== types.Message || ! m.user || m.user.userLogin !== user ||
											(target_id && m.id !== target_id)
										);
										if ( len !== inst.buffer.length && ! inst.props.isBackground )
											inst.notifySubscribers();

										inst.moderateBuffers([
											inst.delayedMessageBuffer.map(e => e.event)
										], user, msg);

									} else
										inst.moderateBuffers([
											inst.buffer,
											inst.delayedMessageBuffer.map(e => e.event)
										], user, msg);

									inst.delayedMessageBuffer.push({
										event: msg,
										time: Date.now(),
										shouldDelay: false
									});

									return;
								}
							}

						} else if ( msg.type === types.Moderation && false && inst.unsetModeratedUser ) {
							//t.log.info('Moderation', msg);
							if ( inst.props.isCurrentUserModerator )
								return;

							const user = msg.userLogin;
							if ( inst.moderatedUsers.has(user) )
								return;

							const mod_action = msg.moderationType;
							let new_action;
							if ( mod_action === mod_types.Ban )
								new_action = 'ban';
							else if ( mod_action === mod_types.Delete )
								new_action = 'delete';
							else if ( mod_action === mod_types.Unban )
								new_action = 'unban';
							else if ( mod_action === mod_types.Timeout )
								new_action = 'timeout';

							if ( new_action )
								msg.moderationActionType = new_action;

							const do_remove = t.chat.context.get('chat.filtering.remove-deleted') === 3;
							if ( do_remove ) {
								const len = inst.buffer.length,
									target_id = msg.targetMessageID;
								inst.buffer = inst.buffer.filter(m =>
									m.type !== types.Message || ! m.user || m.user.userLogin !== user ||
									(target_id && m.id !== target_id)
								);
								if ( len !== inst.buffer.length && ! inst.props.isBackground )
									inst.notifySubscribers();

								inst.moderateBuffers([
									inst.delayedMessageBuffer.map(e => e.event)
								], user, msg);

							} else
								inst.moderateBuffers([
									inst.buffer,
									inst.delayedMessageBuffer.map(e => e.event)
								], user, msg);

							inst.delayedMessageBuffer.push({
								event: msg,
								time: Date.now(),
								shouldDelay: false
							});

							return;

						} */ else if ( msg.type === types.Clear ) {
							if ( t.chat.context.get('chat.filtering.ignore-clear') )
								msg = {
									type: types.Info,
									message: t.i18n.t('chat.ignore-clear', 'An attempt by a moderator to clear chat was ignored.')
								}
							else
								t.emit('chat:clear-chat', msg);
						}

					} catch(err) {
						t.log.error('Error processing chat event.', err);
						t.log.capture(err, {extra: {msg}});
					}
				}

				return old_handle.call(inst, msg);
			}

			/*inst.ffzModerateBuffer = function(buffers, event) {
				const mod_types = t.mod_types || {},
					ctypes = t.chat_types || {},
					mod_type = event.moderationActionType,
					user_login = event.targetUserLogin || event.userLogin,
					mod_login = event.createdByLogin,
					target_id = event.targetMessageID || event.messageID;

				let deleted_count = 0, last_msg;

				const is_delete = mod_type === mod_types.Delete,
					updater = m => {
						if ( m.event )
							m = m.event;

						/*if ( m.message && m.type in [ctypes.ChannelPointsReward, ctypes.Resubscription, ctypes.Ritual] )
							m = m.message;/

						if ( m.reply ) {
							if ( target_id ? target_id === m.reply.parentMsgId : (user_login && user_login === m.reply.parentUserLogin) )
								m.reply = {
									...m.reply,
									parentDeleted: true
								}
						}

						if ( ! user_login || ! m.user || user_login !== m.user.userLogin || ! m.messageParts )
							return;

						if ( ! m || m.deleted )
							return;

						if ( target_id && m.id !== target_id )
							return;

						m.deleted = true;
						m.banned = mod_type === mod_types.Ban;

						last_msg = m;
						deleted_count++;

						m.modLogin = mod_login;
						m.modActionType = mod_type;
						m.duration = event.duration;
					};

				for(const buffer of buffers)
					if ( buffer.some(updater) )
						break;

				//t.log.info('Moderate Buffer', mod_type, user_login, mod_login, target_id, deleted_count, last_msg);

				if ( last_msg )
					last_msg.deletedCount = deleted_count;
			}*/

			inst.setPaused = function(paused) {
				if ( inst.paused === paused )
					return;

				inst.paused = paused;
				if ( ! paused ) {
					inst.slidingWindowEnd = Math.min(inst.buffer.length, t.chat.context.get('chat.scrollback-length'));
					if ( ! inst.props.isBackground )
						inst.notifySubscribers();
				}
			}

			inst.loadNewer = function() {
				if ( ! inst.hasNewerLeft() )
					return;

				const end = Math.min(inst.buffer.length, inst.slidingWindowEnd + 40),
					start = Math.max(0, end - t.chat.context.get('chat.scrollback-length'));

				inst.clear(inst.buffer.length - start);
				inst.slidingWindowEnd = end - start;
				if ( ! inst.props.isBackground )
					inst.notifySubscribers();
			}

			inst.loadNewest = function() {
				if ( ! inst.hasNewerLeft() )
					return;

				const max_size = t.chat.context.get('chat.scrollback-length');

				inst.clear(max_size);
				inst.slidingWindowEnd = Math.min(max_size, inst.buffer.length);
				if ( ! inst.props.isBackground )
					inst.notifySubscribers();
			}

			inst.getMessages = function() {
				return inst.buffer.slice(0, inst.slidingWindowEnd + (inst.ffz_extra || 0));
			}
		}

		cls.prototype.componentDidMount = function() {
			try {
				this._ffzInstall();
			} catch(err) {
				t.log.error('Error installing FFZ features onto chat buffer.', err);
			}

			return old_mount.call(this);
		}

		cls.prototype.clear = function(count) {
			try {
				if ( count == null )
					count = 0;

				const max_size = t.chat.context.get('chat.scrollback-length');
				if ( ! this.isPaused() && count > max_size )
					count = max_size;

				if ( count <= 0 ) {
					this.ffz_extra = 0;
					this.buffer = [];
					this.delayedMessageBuffer = [];
					this.paused = false;

				} else {
					const buffer = this.buffer,
						ct = t.chat_types || CHAT_TYPES,
						target = buffer.length - count;

					if ( target > 0 ) {
						let removed = 0, last;
						for(let i=0; i < target; i++)
							if ( buffer[i] && ! NULL_TYPES.includes(ct[buffer[i].type]) ) {
								removed++;
								last = i;
							}

						// When we remove less then expected, we want to keep track
						// of that so we can return the extra messages from getMessages.
						this.buffer = buffer.slice(removed % 2 !== 0 ? Math.max(target - 4, last) : target);
						this.ffz_extra = buffer.length - count;

					} else {
						this.ffz_extra = 0;
						this.buffer = this.buffer.slice(0);
					}

					if ( this.paused && this.buffer.length >= 900 )
						this.setPaused(false);
				}
			} catch(err) {
				t.log.error('Error running clear', err);
				return old_clear.call(this, count);
			}
		}

		cls.prototype.ffzGetConnector = function() {
			if ( this._ffz_connector )
				return this._ffz_connector;

			const now = Date.now();
			if ( now - (this._ffz_connect_tried || 0) > 5000 ) {
				this._ffz_connect_tried = now;
				const thing = t.ChatBufferConnector.first;
				if ( thing?.props?.messageBufferAPI?._ffz_inst === this )
					return this._ffz_connector = thing;
			}
		}

		cls.prototype.flushRawMessages = function() {
			try {
				const out = [],
					ct = t.chat_types || CHAT_TYPES,
					now = Date.now(),
					raw_delay = t.chat.context.get('chat.delay'),
					delay = raw_delay === -1 ? this.delayDuration : raw_delay,
					first = now - delay,
					see_deleted = this.shouldSeeBlockedAndDeletedMessages || this.props && this.props.shouldSeeBlockedAndDeletedMessages,
					has_newer = this.hasNewerLeft(),
					paused = this.isPaused(),
					max_size = t.chat.context.get('chat.scrollback-length'),
					do_remove = t.chat.context.get('chat.filtering.remove-deleted'),

					want_event = t.hasListeners('chat:buffer-message');

				let added = 0,
					buffered = this.slidingWindowEnd,
					changed = false,
					event;

				for(const msg of this.delayedMessageBuffer) {
					if ( msg.time <= first || ! msg.shouldDelay ) {
						if ( do_remove !== 0 && (do_remove > 1 || ! see_deleted) && this.isDeletable(msg.event) && msg.event.deleted )
							continue;

						if ( want_event ) {
							if ( ! event ) {
								event = t.makeEvent({
									inst: this,
									channel: undefined,
									channelID: undefined,
									message: undefined
								});

								const cont = this._ffz_connector ?? this.ffzGetConnector(),
									room_id = cont && cont.props.channelID;

								event.channelID = room_id;

								if ( room_id ) {
									const r = t.chat.getRoom(room_id, null, true);
									if ( r && r.login )
										event.channel = r.login;
								}

							} else
								event._reset();

							event.message = msg.event;
							t.emit('chat:buffer-message', event);
							if ( event.defaultPrevented || msg.event.ffz_removed )
								continue;
						}

						const last = this.buffer[this.buffer.length - 1],
							type = last?.type;

						if ( !(
							! this.props.isLoadingHistoricalMessages &&
								! this.props.historicalMessages ||
								type !== ct.Connected ||
								msg.event.type === ct.Connected ||
								this.buffer.find(e => e.type === ct.LiveMessageSeparator)
						) )
							this.buffer.push({
								type: ct.LiveMessageSeparator,
								id: 'live-message-separator'
							});

						/*if ( type === ct.Connected ) {
							const non_null = this.buffer.filter(x => x && ct[x.type] && ! NULL_TYPES.includes(ct[x.type]));
							if ( non_null.length > 1 )
								this.buffer.push({
									type: ct.LiveMessageSeparator,
									id: 'live-message-separator'
								});
						}*/

						this.buffer.push(msg.event);
						changed = true;

						if ( ! this.paused ) {
							if ( this.buffer.length > max_size )
								added++;
							else
								buffered++;
						}

					} else
						out.push(msg);
				}

				this.delayedMessageBuffer = out;
				if ( changed ) {
					this.clear(Math.min(900, this.buffer.length - added));
					if ( !(added === 0 && buffered === this.slidingWindowEnd && has_newer === this.hasNewerLeft() && paused === this.isPaused()) ) {
						this.slidingWindowEnd = buffered;
						if ( ! this.props.isBackground )
							this.notifySubscribers();
					}
				}

				if ( this.flushHighlightsBuffer )
					this.flushHighlightsBuffer();

			} catch(err) {
				t.log.error('Error running flush.', err);
				return old_flush.call(this);
			}
		}
	}


	addNotice(room, message) {
		if ( ! room )
			return false;

		if ( room.startsWith('#') )
			room = room.slice(1);

		room = room.toLowerCase();

		for(const inst of this.ChatService.instances) {
			if ( room === '*' || inst.props.channelLogin.toLowerCase() === room ) {
				if ( typeof message === 'string' )
					inst.addMessage({
						type: (this.chat_types ?? CHAT_TYPES).Notice,
						message
					});
				else {
					const props = inst.props,
						login = props.channelLogin,
						id = props.channelID;

					if ( message.markdown ) {
						const md = getMD();
						if ( ! md )
							awaitMD();
					}

					inst.addMessage({
						type: (this.chat_types ?? CHAT_TYPES).Message,
						channel: `#${login}`,
						roomID: id,
						roomLogin: login,
						id: `ffz_notice_${generateUUID()}`,
						ffz_type: 'notice',
						ffz_no_actions: true,
						ffz_data: message,
						message: null,
						messageParts: [],
						timestamp: Date.now(),
						user: {
							userID: id,
							userLogin: login
						}
					})
				}

				return true;
			}
		}

		return false;
	}


	sendMessage(room, message) {
		const service = this.ChatService.first;

		if ( ! service || ! room )
			return null;

		if ( room.startsWith('#') )
			room = room.slice(1);

		if ( room.toLowerCase() !== service.props.channelLogin.toLowerCase() )
			return service.client.sendCommand(room, message);

		service.sendMessage(message);
	}


	scheduleMystery(mystery) { // eslint-disable-line class-methods-use-this
		if ( ! mystery.line )
			return;

		if ( mystery._timer )
			return;

		mystery._timer = setTimeout(() => requestAnimationFrame(() => {
			mystery._timer = null;
			if ( mystery.line )
				mystery.line.forceUpdate();
		}), 250);
	}


	wrapChatService(cls) {
		const t = this,
			old_mount = cls.prototype.componentDidMount,
			old_handler = cls.prototype.addEventListeners;

		cls.prototype._ffz_was_here = true;

		cls.prototype._ffzInstall = function() {
			if ( this._ffz_installed )
				return;

			this._ffz_installed = true;

			const inst = this,
				old_send = this.sendMessage,
				addMessage = (...args) => inst.addMessage(...args),
				sendMessage = (msg, extra) => inst.sendMessage(msg, extra);

			inst.sendMessage = function(msg, extra) {
				msg = msg.replace(/\s+/g, ' ');

				if ( msg.startsWith('/ffz:') ) {
					msg = msg.slice(5).trim();
					const idx = msg.indexOf(' ');
					let subcmd;
					if ( idx === -1 ) {
						subcmd = msg;
						msg = '';
					} else {
						subcmd = msg.slice(0, idx);
						msg = msg.slice(idx + 1).trimStart();
					}

					const event = t.makeEvent({
						command: subcmd,
						message: msg,
						extra,
						context: t.chat.context,
						channel: inst.props.channelLogin,
						_inst: inst,
						addMessage,
						sendMessage
					});

					const topic = `chat:ffz-command:${subcmd}`,
						listeners = t.listeners(topic);

					if ( listeners?.length > 0 )
						t.emit(topic, event);
					else
						inst.addMessage({
							type: t.chat_types.Notice,
							message: t.i18n.t('chat.ffz-command.invalid', 'No such command: /ffz:{subcmd}', {subcmd})
						});

					return false;
				}

				const event = t.makeEvent({
					message: msg,
					extra,
					context: t.chat.context,
					channel: inst.props.channelLogin,
					_inst: inst,
					addMessage,
					sendMessage
				});

				t.emit('chat:pre-send-message', event);

				if ( event.defaultPrevented )
					return;

				return old_send.call(this, event.message, event.extra);
			}
		}


		cls.prototype.componentDidMount = function() {
			try {
				this._ffzInstall();
			} catch(err) {
				t.log.error('Error installing FFZ features onto chat service.', err);
			}

			return old_mount.call(this);
		}


		cls.prototype.addEventListeners = function(...args) {
			if ( ! this._ffz_init ) {
				const i = this;

				for(const key of MISBEHAVING_EVENTS) {
					const original = this[key];
					if ( original )
						this[key] = function(e, t) {
							i._wrapped = e;
							const ret = original.call(i, e, t);
							i._wrapped = null;
							return ret;
						}
				}

				const old_announce = this.onAnnouncementEvent;
				this.onAnnouncementEvent = function(e) {
					//console.log('announcement', e);
					return old_announce.call(this, e);
				}


				const old_sub = this.onSubscriptionEvent;
				this.onSubscriptionEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('Subscription') )
							return;

						if ( t.disable_handling || t.chat.context.get('chat.subs.native') )
							return old_sub.call(i, e);

						if ( t.chat.context.get('chat.subs.show') < 3 )
							return;

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'resub';
						out.gift_theme = e.giftTheme;
						out.sharedChat = e.sharedChat;
						out.sub_goal = i.getGoalData ? i.getGoalData(e.goalData) : null;
						out.sub_plan = e.methods;
						out.sub_multi = e.multiMonthData?.multiMonthDuration ? {
							count: e.multiMonthData.multiMonthDuration,
							tenure: e.multiMonthData.multiMonthTenure
						} : null;

						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_sub.call(i, e);
					}
				}

				const old_state = this.onRoomStateEvent;
				this.onRoomStateEvent = function(e) {
					try {
						const channel = e.channel,
							current = t.chat.context.get('context.channel');

						if ( channel && (channel === current || channel === `#${current}`) )
							t.updateChatState(e.state);

					} catch(err) {
						t.log.capture(err, {extra: e});
					}

					return old_state.call(i, e);
				}

				const old_pinned = this.onPinnedChatEvent;
				this.onPinnedChatEvent = function(e) {
					try {
						const setting = t.chat.context.get('chat.hype.message-style');
						if ( setting !== 1 ) {
							// Drop messages with no message if we're not displaying them.
							if ( e.isSystemMessage && setting === 0 )
								return;

							const out = i.convertMessage(e);
							out.ffz_type = 'hype';
							out.sharedChat = e.sharedChat;
							out.hype_amount = e.amount;
							out.hype_canonical_amount = e.canonical_amount;
							out.hype_currency = e.currency;
							out.hype_exponent = e.exponent;
							out.hype_level = e.level;

							if ( e.isSystemMessage ) {
								// Delete the message it comes with.
								out.message = '';
								out.messageBody = '';
								out.messageParts = [];
								e.message.body = '';
							}

							//t.log.info('Pinned Event', e, out);

							return i.postMessageToCurrentChannel(e, out);
						}

					} catch(err) {
						t.log.capture(err, {extra: e});
					}

					return old_pinned.call(i, e);
				}

				const old_resub = this.onResubscriptionEvent;
				this.onResubscriptionEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('Resubscription') )
							return;

						if ( t.disable_handling || t.chat.context.get('chat.subs.native')  )
							return old_resub.call(i, e);

						if ( t.chat.context.get('chat.subs.show') < 2 && ! e.body )
							return;

						const out = i.convertMessage({message: e});
						out.ffz_type = 'resub';
						out.sharedChat = e.sharedChat;
						out.gift_theme = e.giftTheme;
						out.sub_goal = i.getGoalData ? i.getGoalData(e.goalData) : null;
						out.sub_cumulative = e.cumulativeMonths || 0;
						out.sub_streak = e.streakMonths || 0;
						out.sub_share_streak = e.shouldShareStreakTenure;
						out.sub_months = e.months;
						out.sub_plan = e.methods;
						out.sub_multi = e.multiMonthData?.multiMonthDuration ? {
							count: e.multiMonthData.multiMonthDuration,
							tenure: e.multiMonthData.multiMonthTenure
						} : null;

						//t.log.info('Resub Event', e, out);

						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_resub.call(i, e);
					}
				}

				const mysteries = this.ffz_mysteries = {};

				const old_subgift = this.onSubscriptionGiftEvent;
				this.onSubscriptionGiftEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('SubGift') )
							return;

						if ( t.disable_handling || t.chat.context.get('chat.subs.native')  )
							return old_subgift.call(i, e);

						const key = `${e.channel}:${e.user.userID}`,
							mystery = mysteries[key];

						if ( mystery ) {
							if ( mystery.expires < Date.now() ) {
								mysteries[key] = null;
							} else {
								mystery.recipients.push({
									id: e.recipientID,
									login: e.recipientLogin,
									displayName: e.recipientName
								});

								if( mystery.recipients.length >= mystery.size )
									mysteries[key] = null;

								if ( mystery.line )
									t.scheduleMystery(mystery);

								return;
							}
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_gift';
						out.sharedChat = e.sharedChat;
						out.sub_recipient = {
							id: e.recipientID,
							login: e.recipientLogin,
							displayName: e.recipientName
						};
						out.gift_theme = e.giftTheme;
						out.sub_goal = i.getGoalData ? i.getGoalData(e.goalData) : null;
						out.sub_months = e.giftMonths;
						out.sub_plan = e.methods;
						out.sub_total = e.senderCount;

						//t.log.info('Sub Gift', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_subgift.call(i, e);
					}
				}

				const old_communityintro = this.onCommunityIntroductionEvent;
				this.onCommunityIntroductionEvent = function(e) {
					try {
						if ( t.disable_handling )
							return old_communityintro.call(this, e);

						if ( t.chat.context.get('chat.filtering.blocked-types').has('CommunityIntroduction') ) {
							const out = i.convertMessage(e);
							out.sharedChat = e.sharedChat;
							return i.postMessageToCurrentChannel(e, out);
						}

					} catch(err) {
						t.log.capture(err, {extra: e});
						t.log.error(err);
					}

					return old_communityintro.call(this, e);
				}

				const old_anonsubgift = this.onAnonSubscriptionGiftEvent;
				this.onAnonSubscriptionGiftEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('AnonSubGift') )
							return;

						if ( t.disable_handling || t.chat.context.get('chat.subs.native')  )
							return old_anonsubgift.call(i, e);

						const key = `${e.channel}:ANON`,
							mystery = mysteries[key];

						if ( mystery ) {
							if ( mystery.expires < Date.now() )
								mysteries[key] = null;
							else {
								mystery.recipients.push({
									id: e.recipientID,
									login: e.recipientLogin,
									displayName: e.recipientName
								});

								if( mystery.recipients.length >= mystery.size )
									mysteries[key] = null;

								if ( mystery.line )
									t.scheduleMystery(mystery);

								return;
							}
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_gift';
						out.sharedChat = e.sharedChat;
						out.gift_theme = e.giftTheme;
						out.sub_goal = i.getGoalData ? i.getGoalData(e.goalData) : null;
						out.sub_anon = true;
						out.sub_recipient = {
							id: e.recipientID,
							login: e.recipientLogin,
							displayName: e.recipientName
						};
						out.sub_months = e.giftMonths;
						out.sub_plan = e.methods;
						out.sub_total = e.senderCount;

						//t.log.info('Anon Sub Gift', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_anonsubgift.call(i, e);
					}
				}

				const old_submystery = this.onSubscriptionMysteryGiftEvent;
				this.onSubscriptionMysteryGiftEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('SubMysteryGift') )
							return;

						if ( t.disable_handling || t.chat.context.get('chat.subs.native')  )
							return old_submystery.call(i, e);

						let mystery = null;
						if ( e.massGiftCount > t.chat.context.get('chat.subs.merge-gifts') ) {
							const key = `${e.channel}:${e.user.userID}`;
							mystery = mysteries[key] = {
								recipients: [],
								size: e.massGiftCount,
								expires: Date.now() + 30000,
								toJSON: () => null
							};
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_mystery';
						out.sharedChat = e.sharedChat;
						out.gift_theme = e.giftTheme;
						out.sub_goal = i.getGoalData ? i.getGoalData(e.goalData) : null;
						out.mystery = mystery;
						out.sub_plan = e.plan;
						out.sub_count = e.massGiftCount;
						out.sub_total = e.senderCount;

						//t.log.info('Sub Mystery', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_submystery.call(i, e);
					}
				}

				const old_anonsubmystery = this.onAnonSubscriptionMysteryGiftEvent;
				this.onAnonSubscriptionMysteryGiftEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('AnonSubMysteryGift') )
							return;

						if ( t.disable_handling || t.chat.context.get('chat.subs.native')  )
							return old_anonsubmystery.call(i, e);

						let mystery = null;
						if ( e.massGiftCount > t.chat.context.get('chat.subs.merge-gifts') ) {
							const key = `${e.channel}:ANON`;
							mystery = mysteries[key] = {
								recipients: [],
								size: e.massGiftCount,
								expires: Date.now() + 30000,
								toJSON: () => null
							};
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_mystery';
						out.sharedChat = e.sharedChat;
						out.sub_anon = true;
						out.mystery = mystery;
						out.sub_plan = e.plan;
						out.sub_count = e.massGiftCount;
						out.sub_total = e.senderCount;

						//t.log.info('Anon Sub Mystery', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_anonsubmystery.call(i, e);
					}
				}

				const old_ritual = this.onRitualEvent;
				this.onRitualEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('Ritual') )
							return;

						if ( t.disable_handling )
							return old_ritual.call(i, e);

						const out = i.convertMessage(e);
						out.sharedChat = e.sharedChat;
						out.ffz_type = 'ritual';
						out.ritual = e.type;

						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_ritual.call(i, e);
					}
				}

				const old_points = this.onChannelPointsRewardEvent;
				this.onChannelPointsRewardEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.filtering.blocked-types').has('ChannelPointsReward') )
							return;

						if ( t.disable_handling )
							return old_points.call(i, e);

						const reward = e.rewardID && get(e.rewardID, i.props.rewardMap);
						if ( reward ) {
							const out = i.convertMessage(e);

							if ( t.chat.context.get('chat.powerup.effects') && isMessageEffect(reward) && e.animationID ) {
								return i.postMessageToCurrentChannel(e, {
									type: t.chat_types.ChannelPointsReward,
									id: out.id,
									displayName: out.user.userDisplayName,
									login: out.user.userLogin,
									reward: reward,
									message: out,
									userID: out.user.userID,
									animationID: e.animationID,
									sharedChat: e.sharedChat
								})
							} else {
								out.ffz_animation_id = e.animationID;
								out.sharedChat = e.sharedChat;
								out.ffz_type = 'points';
								out.ffz_reward = reward;
								out.ffz_reward_highlight = isHighlightedReward(reward);

								return i.postMessageToCurrentChannel(e, out);
							}
						}

					} catch(err) {
						t.log.error(err);
						t.log.capture(err, {extra: e});
					}

					return old_points.call(i, e);
				}

				/*const old_host = this.onHostingEvent;
				this.onHostingEvent = function (e, _t) {
					t.emit('tmi:host', e, _t);
					return old_host.call(i, e, _t);
				}

				const old_unhost = this.onUnhostEvent;
				this.onUnhostEvent = function (e, _t) {
					t.emit('tmi:unhost', e, _t);
					return old_unhost.call(i, e, _t);
				}*/

				const old_add = this.addMessage;
				this.addMessage = function(e) {
					const original = i._wrapped;
					if ( original && ! e._ffz_checked )
						return i.postMessageToCurrentChannel(original, e);

					return old_add.call(i, e);
				}

				this._ffz_init = true;
			}

			return old_handler.apply(this, ...args);
		}

		cls.prototype.postMessageToCurrentChannel = function(original, message) {
			const original_msg = message;
			message._ffz_checked = true;

			// For certain message types, the message is contained within
			// a message sub-object.
			if ( message.type === t.chat_types.ChannelPointsReward || message.type === t.chat_types.CommunityIntroduction || (message.message?.user & message.message?.badgeDynamicData) ) {
				message = message.message;
			}

			if ( original.channel ) {
				let chan = message.channel = original.channel.toLowerCase();
				if ( chan.startsWith('#') )
					chan = chan.slice(1);

				if ( chan !== this.props.channelLogin.toLowerCase() )
					return;

				message.roomLogin = chan;
			}

			message.ffz_first_msg = message.isFirstMsg || original.message?.isFirstMsg || false;
			message.ffz_returning = original.message?.isReturningChatter || false;

			if ( original.message ) {
				const user = original.message.user,
					flags = original.message.flags;
				if ( user )
					message.emotes = user.emotes;

				if ( flags && this.getFilterFlagOptions ) {
					const clear_mod = this.props.isCurrentUserModerator && t.chat.context.get('chat.automod.run-as-mod');
					if ( clear_mod )
						this.props.isCurrentUserModerator = false;
					message.flags = this.getFilterFlagOptions(flags);
					if ( clear_mod )
						this.props.isCurrentUserModerator = true;
				}

				if (! message.message || typeof message.message === 'string') {
					if ( typeof original.action === 'string' )
						message.message = original.action;
					else
						message.message = original.message.body;
				}
			}

			this.addMessage(original_msg);
		}
	}


	/*updateChatLines() {
		this.chat_line.updateLines();
	}*/


	// ========================================================================
	// Room Handling
	// ========================================================================

	addRoom(thing, props) {
		if ( ! props )
			props = thing.props;

		if ( ! props.channelID )
			return null;

		const room = thing._ffz_room = this.chat.getRoom(props.channelID, props.channelLogin && props.channelLogin.toLowerCase(), false, true);
		room.ref(thing);
		return room;
	}


	removeRoom(thing) { // eslint-disable-line class-methods-use-this
		if ( ! thing._ffz_room )
			return;

		thing._ffz_room.unref(thing);
		thing._ffz_room = null;
	}


	// ========================================================================
	// Chat Controller
	// ========================================================================

	chatMounted(chat, props) {
		if ( chat.chatBuffer )
			chat.chatBuffer.ffzController = chat;

		if ( ! props )
			props = chat.props;

		if ( ! this.addRoom(chat, props) )
			return;

		this.updateRoomBitsConfig(chat, props.bitsConfig);

		// TODO: Check if this is the room for the current channel.

		this.settings.updateContext({
			moderator: props.isCurrentUserModerator,
			chatHidden: props.isHidden
		});

		if ( props.isEmbedded || props.isPopout )
			this.settings.updateContext({
				channel: props.channelLogin && props.channelLogin.toLowerCase(),
				channelID: props.channelID
			});

		this.chat.context.updateContext({
			moderator: props.isCurrentUserModerator,
			channel: props.channelLogin && props.channelLogin.toLowerCase(),
			channelID: props.channelID,
			/*ui: {
				theme: props.theme
			}*/
		});
	}


	chatUnmounted(chat) {
		if ( chat.chatBuffer && chat.chatBuffer.ffzController === this )
			chat.chatBuffer.ffzController = null;

		if ( chat.props.isEmbedded || chat.props.isPopout )
			this.settings.updateContext({
				channel: null,
				channelID: null
			});

		this.settings.updateContext({
			moderator: false,
			chatHidden: false
		});

		this.chat.context.updateContext({
			moderator: false,
			channel: null,
			channelID: null
		});

		this.removeRoom(chat);
	}


	chatUpdated(chat, props) {
		if ( chat.chatBuffer )
			chat.chatBuffer.ffzController = chat;

		if ( ! chat._ffz_room || props.channelID != chat._ffz_room.id ) {
			this.removeRoom(chat);
			if ( chat._ffz_mounted )
				this.chatMounted(chat);
			return;
		}

		if ( props.bitsConfig !== chat.props.bitsConfig )
			this.updateRoomBitsConfig(chat, chat.props.bitsConfig);

		// TODO: Check if this is the room for the current channel.

		let login = chat.props.channelLogin;
		if ( login )
			login = login.toLowerCase();

		if ( chat.props.isEmbedded || chat.props.isPopout )
			this.settings.updateContext({
				channel: login,
				channelID: chat.props.channelID
			});

		this.settings.updateContext({
			moderator: chat.props.isCurrentUserModerator,
			chatHidden: chat.props.isHidden
		});

		this.chat.context.updateContext({
			moderator: chat.props.isCurrentUserModerator,
			channel: login,
			channelID: chat.props.channelID,
			/*ui: {
				theme: props.theme
			}*/
		});
	}


	updateRoomBitsConfig(chat, config) { // eslint-disable-line class-methods-use-this
		const room = chat._ffz_room;
		if ( ! room )
			return;

		// We have to check that the available cheers haven't changed
		// to avoid doing too many recalculations.
		let new_bits = null;
		if ( config && Array.isArray(config.orderedActions) ) {
			new_bits = new Set;
			for(const action of config.orderedActions)
				if ( action && action.prefix )
					new_bits.add(action.prefix);
		}

		if ( (! this._ffz_old_bits && ! new_bits) || set_equals(this._ffz_old_bits, new_bits) )
			return;

		this._ffz_old_bits = new_bits;

		room.updateBitsConfig(formatBitsConfig(config));
		this.chat_line.updateLineTokens();
		//this.updateChatLines();
	}


	// ========================================================================
	// Chat Buffer Connector
	// ========================================================================

	connectorMounted(inst) { // eslint-disable-line class-methods-use-this
		const buffer = inst.props.messageBufferAPI;
		if ( buffer && buffer._ffz_inst && buffer._ffz_inst._ffz_connector !== inst )
			buffer._ffz_inst._ffz_connector = inst;
	}

	connectorUpdated(inst, props) { // eslint-disable-line class-methods-use-this
		const buffer = props.messageBufferAPI,
			new_buffer = inst.props.messageBufferAPI;

		if ( buffer === new_buffer )
			return;

		if ( buffer && buffer._ffz_inst && buffer._ffz_inst._ffz_connector === inst )
			buffer._ffz_inst._ffz_connector = null;

		if ( new_buffer && new_buffer._ffz_inst && new_buffer._ffz_inst._ffz_connector !== inst )
			buffer._ffz_inst._ffz_connector = inst;
	}

	connectorUnmounted(inst) { // eslint-disable-line class-methods-use-this
		const buffer = inst.props.messageBufferAPI;
		if ( buffer && buffer._ffz_inst && buffer._ffz_inst._ffz_connector === inst )
			buffer._ffz_inst._ffz_connector = null;
	}


	// ========================================================================
	// Chat Renderers
	// ========================================================================

	rendererMounted(cont, props) {
		if ( ! props )
			props = cont.props;

		// We keep our own track of shared rooms, so that we can load/unload
		// the associated data as relevant.
		this.updateRendererSharedChats(cont, props?.sharedChatDataByChannelID);
	}


	updateRendererSharedChats(cont, data) {
		data ??= cont.props.sharedChatDataByChannelID;

		if ( cont._ffz_cached_shared === data )
			return;

		this.shared_room_data = cont._ffz_cached_shared = data;
		this.shared_rooms = cont._ffz_shared_rooms = cont._ffz_shared_rooms || {};

		const unexpected = new Set(Object.keys(cont._ffz_shared_rooms));
		let badges_updated = false;

		if (data != null)
			for(const [room_id, d2] of data.entries()) {
				unexpected.delete(room_id);

				let room = cont._ffz_shared_rooms[room_id];
				if ( ! room ) {
					// We need to add the room.
					room = this.chat.getRoom(room_id, d2.login);
					room.ref(cont);
					cont._ffz_shared_rooms[room_id] = room;
				}

				// Check badges.
				const bd = d2.badges?.channelsBySet;

				// Since we don't have a flat structure, we have to recurse
				// a little to get the count.
				let count = 0;
				if (bd) {
					for(const entry of bd.values()) {
						for(const _ of entry.values()) {
							count++;
						}
					}
				}

				if ( room.badgeCount() !== count ) {
					badges_updated = true;
					room.updateBadges(bd);
				}
			}

		// Unref rooms that are no longer shared.
		for(const room_id of unexpected) {
			const room = cont._ffz_shared_rooms[room_id];
			if ( room )
				room.unref(cont);

			room.unshareChat();
			delete cont._ffz_shared_rooms[room_id];
		}

		const shared = Object.keys(cont._ffz_shared_rooms);

		for(const room of Object.values(cont._ffz_shared_rooms))
			room.shareChats(shared);

		//this.log.info('!!!!! updated shared chats', cont._ffz_shared_rooms);

		if ( shared.length > 0 && this.settings.provider.get('shared-chat-notice') !== 1 ) {
			this.settings.provider.set('shared-chat-notice', 1);
			this.addNotice('*', {
				icon: 'ffz-i-zreknarf',
				message: this.i18n.t('chat.shared-chat.welcome', 'FrankerFaceZ: This is a Shared Chat, a new feature from Twitch to combine multiple stream chats into one. FrankerFaceZ support is early, so some messages might not look correct. Sorry for any trouble!')
			});
		}

		if ( badges_updated )
			this.chat_line.updateLineBadges();
	}

	rendererUnmounted(cont) {
		// Unref all shared rooms.
		if (cont._ffz_shared_rooms)
			for(const room of Object.values(cont._ffz_shared_rooms))
				room.unref(cont);

		cont._ffz_shared_rooms = null;
		cont._ffz_cached_shared = null;
		this.shared_room_data = new Map;
		this.shared_rooms = {};
	}

	rendererUpdated(cont, props) {
		this.updateRendererSharedChats(cont, props?.sharedChatDataByChannelID);
	}


	// ========================================================================
	// Chat Containers
	// ========================================================================

	get shouldUpdateChannel() {
		const route = this.router.current_name;
		return Twilight.POPOUT_ROUTES.includes(route) || Twilight.SUNLIGHT_ROUTES.includes(route);
	}

	containerMounted(cont, props) {
		if ( ! props )
			props = cont.props;

		if ( ! this.addRoom(cont, props) )
			return;

		this.updateRoomBitsConfig(cont, props.bitsConfig);

		if ( props.globalBadgeData?.badges )
			this.chat.badges.updateTwitchBadges(props.globalBadgeData.badges);
		else if (props.data?.badges )
			this.chat.badges.updateTwitchBadges(props.data.badges);

		if ( props.data ) {
			if ( this.shouldUpdateChannel ){
				const color = props.data.user?.primaryColorHex;
				this.resolve('site.channel').updateChannelColor(color);

				this.settings.updateContext({
					channel: props.channelLogin,
					channelID: props.channelID,
					channelColor: color
				});
			}

			this.updateRoomBadges(cont, props.data.user && props.data.user.broadcastBadges);
			this.updateRoomRules(cont, props.chatRules);
		}
	}


	containerUnmounted(cont) {
		if ( this.shouldUpdateChannel ) {
			this.resolve('site.channel').updateChannelColor();

			this.settings.updateContext({
				channel: null,
				channelID: null,
				channelColor: null
			});
		}

		this.removeRoom(cont);
	}


	containerUpdated(cont, props) {
		// If we don't have a room, or if the room ID doesn't match our ID
		// then we need to just create a new Room because the chat room changed.
		if ( ! cont._ffz_room || props.channelID != cont._ffz_room.id ) {
			this.removeRoom(cont);
			if ( cont._ffz_mounted )
				this.containerMounted(cont, props);
			return;
		}

		if ( props.bitsConfig !== cont.props.bitsConfig )
			this.updateRoomBitsConfig(cont, props.bitsConfig);

		if ( props.data && Twilight.POPOUT_ROUTES.includes(this.router.current_name) ) {
			const color = props.data.user?.primaryColorHex;
			this.resolve('site.channel').updateChannelColor(color);

			this.settings.updateContext({
				channel: props.channelLogin,
				channelID: props.channelID,
				channelColor: color
			});
		}

		// Twitch, React, and Apollo are the trifecta of terror so we
		// can't compare the badgeSets property in any reasonable way.
		// Instead, just check the lengths to see if they've changed
		// and hope that badge versions will never change separately.
		const cs = props.data?.user?.broadcastBadges ?? [],
			ocs = cont.props.data?.user?.broadcastBadges ?? [];

		const bs = props.globalBadgeData?.badges ?? [],
			obs = cont.props.globalBadgeData?.badges ?? [];

		/*const data = props.data || {},
			odata = cont.props.data || {},

			bs = data.badges || [],
			obs = odata.badges || [],

			cs = data.user && data.user.broadcastBadges || [],
			ocs = odata.user && odata.user.broadcastBadges || [];*/

		if ( this.chat.badges.getTwitchBadgeCount() !== bs.length || bs.length !== obs.length )
			this.chat.badges.updateTwitchBadges(bs);

		if ( cont._ffz_room.badgeCount() !== cs.length || cs.length !== ocs.length )
			this.updateRoomBadges(cont, cs);

		this.updateRoomRules(cont, props.chatRules);
	}

	hasRoomBadges(cont) { // eslint-disable-line class-methods-use-this
		const room = cont._ffz_room;
		if ( ! room )
			return false;

		return room.hasBadges();
	}

	updateRoomBadges(cont, badges) { // eslint-disable-line class-methods-use-this
		const room = cont._ffz_room;
		if ( ! room )
			return;

		room.updateBadges(badges);
		this.chat_line.updateLineBadges();
		//this.updateChatLines();
	}

	updateRoomRules(cont, rules) { // eslint-disable-line class-methods-use-this
		const room = cont._ffz_room;
		if ( ! room )
			return;

		room.rules = rules;
	}
}


// ============================================================================
// Processing Functions
// ============================================================================

export function formatBitsConfig(config) {
	if ( ! config )
		return;

	const out = {},
		actions = config.indexedActions,
		tier_colors = {};

	if ( Array.isArray(config.tiers) )
		for(const tier of config.tiers)
			tier_colors[tier.bits] = tier.color;

	for(const key in actions)
		if ( has(actions, key) ) {
			const action = actions[key],
				new_act = out[key] = {
					id: action.id,
					prefix: action.prefix,
					tiers: []
				};

			if ( config?.getImage ) {
				for(const tier of action.orderedTiers) {
					const images = {};

					for(const theme of ['light', 'dark']) {
						const themed = images[theme] = images[theme] || {},
							stat = themed.static = themed.static || {},
							animated = themed.animated = themed.animated || {};

						for(const scale of [1, 2, 4]) {
							// Static Images
							stat[scale] = config.getImage(action.prefix, theme, 'static', tier.bits, scale, 'png');

							// Animated Images
							animated[scale] = config.getImage(action.prefix, theme, 'animated', tier.bits, scale, 'gif');
						}
					}

					new_act.tiers.push({
						amount: tier.bits,
						color: tier.color || tier_colors[tier.bits] || 'inherit',
						id: tier.id,
						images
					});
				}

			} else if ( action.orderedTiers[0]?.images ) {
				for(const tier of action.orderedTiers) {
					const images = {};

					for(const im of tier.images) {
						const themed = images[im.theme] = images[im.theme] || [],
							ak = im.isAnimated ? 'animated' : 'static',
							anim = themed[ak] = themed[ak] || {};

						anim[im.dpiScale] = im.url;
					}

					new_act.tiers.push({
						amount: tier.bits,
						color: tier.color || tier_colors[tier.bits] || 'inherit',
						id: tier.id,
						images
					})
				}
			}
		}

	return out;
}
