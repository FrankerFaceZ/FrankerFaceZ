'use strict';

// ============================================================================
// Twitch Chat Settings
// Settings definitions registered from the module constructor. `chat` is
// the module instance; every callback uses it where it used to use `this`.
// ============================================================================

import {glob_to_regex, escape_regex} from 'utilities/object';
import { CHAT_TYPES, CALLOUT_TYPES, UNBLOCKABLE_TYPES, UNBLOCKABLE_CALLOUTS } from './constants';


export function defineSettings(chat) {

	// Settings

	chat.settings.add('chat.subs.native', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Subscriptions',
			title: 'Display subscription notices using Twitch\'s native UI.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.filtering.show-reasons', {
		default: false,
		ui: {
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Display Reasons',
			description: 'If this is enabled, the reasons a given message was highlighted will be displayed alongside the message. This is a simple display. Enable the debugging option below in Behavior for more details, but be aware that the debugging option has a slight performance impact compared to chat.',
			component: 'setting-select-box',
			data: [
				{value: false, title: 'Disabled'},
				{value: 1, title: 'Above Message'},
				{value: 2, title: 'Inline'}
			]
		}
	});

	chat.settings.add('chat.disable-handling', {
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

	chat.settings.addUI('debug.chat-test', {
		path: 'Debugging > Chat >> Chat',
		component: 'chat-tester',
		getChat: () => chat,
		force_seen: true
	});

	chat.settings.add('chat.filtering.blocked-callouts', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		process: (ctx, val) => {
			const out = new Set,
				type_map = chat.callout_types ?? CALLOUT_TYPES;
			for(const v of val)
				if ( v?.v && type_map[v.v] && ! UNBLOCKABLE_CALLOUTS.includes(v.v) )
					out.add(type_map[v.v]);

			return out;
		},

		ui: {
			path: 'Chat > Filtering > Block >> Callout Types @{"description":"This filter allows you to remove callouts of specific types from Twitch chat. Callouts are special messages that can be pinned to the bottom of chat and often have associated actions, like claiming a drop or sharing your resubscription."}',
			component: 'blocked-types',
			getExtraTerms: () => Object.keys(chat.callout_types ?? CALLOUT_TYPES).filter(key => ! UNBLOCKABLE_CALLOUTS.includes(key)),
			data: () => Object
				.keys(chat.callout_types ?? CALLOUT_TYPES)
				.filter(key => ! UNBLOCKABLE_CALLOUTS.includes(key))
				.sort()
		}
	})

	chat.settings.add('chat.filtering.blocked-types', {
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
			getExtraTerms: () => Object.keys(chat.chat_types ?? CHAT_TYPES).filter(key => ! UNBLOCKABLE_TYPES.includes(key) && ! /^\d+$/.test(key)),
			data: () => Object
				.keys(chat.chat_types ?? CHAT_TYPES)
				.filter(key => ! UNBLOCKABLE_TYPES.includes(key) && ! /^\d+$/.test(key))
				.sort()
		}
	});

	chat.settings.add('chat.replies.style', {
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

	chat.settings.add('channel.raids.no-autojoin', {
		default: false,
		ui: {
			path: 'Channel > Behavior >> Raids',
			title: 'Do not automatically join raids.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.powerup.effects', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow "Message Effects" messages to appear in chat.',
			component: 'setting-check-box',
			description: '*Note*: Only affects messages sent after you change this setting. You can use your own chat for testing.'
		}
	});

	chat.settings.add('channel.raids.blocked-channels', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		ui: {
			path: 'Channel > Behavior >> Raids: Blocked Channels @{"description": "You will not automatically join raids to channels listed here."}',
			component: 'basic-terms',
			words: false
		}
	});

	chat.settings.add('__filter:channel.raids.blocked-channels', {
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

	chat.settings.add('chat.hide-community-highlights', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Hide all Community Highlights from the top of chat.',
			component: 'setting-check-box',
			description: 'Community Highlights are polls, community gift subs, etc. that float over the top of chat temporarily with no way to close them.'
		}
	});

	chat.settings.add('chat.subs.gift-banner', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Display a banner at the top of chat when a mass gift sub happens.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.banners.last-events', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow the Support Activity Feed to be displayed in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.banners.charity', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow the charity fundraiser progress to be displayed in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.banners.hide-appleplus', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Hide the drop notification for getting AppleTV+ when you buy a subscription.',
			component: 'setting-check-box',
			description: '**Note:** Normally, I wouldn\'t add something that directly affects an advertisement like this, but Twitch broke the "Don\'t show again" checkbox, so it\'s up to us to fix it.'
		}
	});

	chat.settings.add('chat.banners.hype-train', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow the Hype Train to be displayed in chat.',
			component: 'setting-check-box',
		}
	});

	/*chat.settings.add('chat.banners.kappa-train', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Attempt to always display the Golden Kappa Train, even if other Hype Trains are hidden.',
			description: '**Note**: This setting is currently theoretical and may not work, or may cause non-Kappa hype trains to appear. Due to the infrequent nature of hype trains, and especially the golden kappa hype train, it is very hard to test.',
			component: 'setting-check-box'
		}
	});*/

	chat.settings.add('chat.banners.shared-chat', {
		default: true,
		ui: {
			path: 'Chat > Shared Chat >> Behavior',
			title: 'Allow the Shared Chat notice to be displayed in chat when a Shared Chat is enabled.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.banners.pinned-message', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow Pinned Messages to be displayed in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.banners.drops', {
		default: true,
		ui: {
			path: 'Chat > Drops >> Appearance',
			title: 'Allow messages about Drops to be displayed in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.banners.polls', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow Polls to be displayed in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.banners.prediction', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow Predictions to be displayed in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.callouts.clip', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Allow the \"Chat seems active.\" clip suggestion to be displayed in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.community-chest.show', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Display the Community Gift Chest banner.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.points.allow-highlight', {
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

	chat.settings.add('chat.points.show-callouts', {
		default: true,
		ui: {
			path: 'Chat > Channel Points >> General',
			title: 'Display messages in chat about Channel Points rewards.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.points.show-button', {
		default: true,
		ui: {
			path: 'Chat > Channel Points >> General',
			title: 'Display Channel Points button beneath chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.points.show-rewards', {
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

	chat.settings.add('chat.points.auto-rewards', {
		default: false,
		ui: {
			path: 'Chat > Channel Points >> Behavior',
			title: 'Automatically claim bonus rewards.',
			component: 'setting-check-box',
			force_seen: true
		}
	});

	chat.settings.add('chat.drops.auto-rewards', {
		default: false,
		ui: {
			path: 'Chat > Drops >> Behavior',
			title: 'Automatically claim drops.',
			description: 'When enabled, drops will be automatically claimed the next time you complete one. Drops that are already available will not be claimed until a new one is earned.',
			component: 'setting-check-box',
		}
	});

	chat.settings.add('chat.pin-resubs', {
		default: false,
		ui: {
			path: 'Chat > Behavior >> General',
			title: 'Automatically pin re-subscription messages in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.shared-chat.style', {
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

	chat.settings.add('chat.shared-chat.username-tooltip', {
		default: true,
		ui: {
			path: 'Chat > Shared Chat >> Appearance',
			component: 'setting-check-box',
			title: 'Display the source channel of a chat message when hovering over the poster\'s username.',
		}
	});

	chat.settings.add('chat.width', {
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

	chat.settings.add('chat.effective-width', {
		requires: ['chat.width', 'context.ui.rightColumnWidth'],
		process(ctx) {
			const val = ctx.get('chat.width');
			return val == null ? (ctx.get('context.ui.rightColumnWidth') || 340) : val;
		}
	});

	chat.settings.add('chat.use-width', {
		requires: ['chat.width', 'context.ui.rightColumnExpanded', 'context.isWatchParty'],
		process(ctx) {
			if ( ! ctx.get('context.ui.rightColumnExpanded') || ctx.get('context.isWatchParty') )
				return false;

			return ctx.get('chat.width') != null;
		}
	});

	chat.settings.add('chat.bits.show-pinned', {
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

	chat.settings.add('chat.bits.show-pinned-progression', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Community',
			title: 'Display Gift Badge Progression',
			description: 'Show the gift badge progression at the top of chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.bits.show-rewards', {
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

	chat.settings.add('chat.bits.cheer-notice', {
		default: true,
		ui: {
			path: 'Chat > Bits and Cheering >> Appearance',
			title: 'Display a notice on chat messages that include cheers.',
			description: 'This feature is intended to prevent possible confusion from chatters using emotes to fake cheers in messages. When enabled, messages that contain real cheers will display a message above them, similar to how resubscription messages or point redemptions with messages function.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.rituals.show', {
		default: true,
		ui: {
			path: 'Chat > Filtering > General >> Rituals',
			title: 'Display ritual messages such as "User is new here! Say Hello!".',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.extra-timestamps', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Chat Lines',
			title: 'Display timestamps on notices.',
			description: 'When enabled, timestamps will be displayed on point redemptions, subscriptions, etc.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.hype.message-style', {
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

	chat.settings.add('chat.subs.show', {
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

	chat.settings.add('chat.subs.compact', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Subscriptions',
			title: 'Display subscription notices in a more compact (classic style) form.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.subs.merge-gifts', {
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

	chat.settings.add('chat.subs.merge-gifts-visibility', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Subscriptions',
			title: 'Expand merged mass sub gift messages by default.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.lines.alternate', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Chat Lines',
			title: 'Display lines with alternating background colors.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.lines.padding', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Chat Lines',
			title: 'Reduce padding around lines.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.lines.borders', {
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

	chat.settings.add('chat.lines.first-time-chatter', {
		default: 1,
		ui: {
			sort: 2,
			path: 'Chat > Appearance >> Chat Lines',
			title: 'First Time Chatter',
			description: 'Display a users first time messages in chat.',
			component: 'setting-select-box',
			data: [
				{ value: 0, title: 'Disabled' },
				{ value: 1, title: 'Enabled' },
				{ value: 2, title: 'Without background' }
			]
		}
	});

	chat.settings.add('chat.input.show-mod-view', {
		default: true,
		ui: {
			path: 'Chat > Input >> Appearance',
			title: 'Allow the "Mod View" button to appear in relevant channels.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.input.show-highlight', {
		default: true,
		ui: {
			path: 'Chat > Input >> Appearance',
			title: 'Allow the "Chat Highlight Settings" button to appear in relevant channels.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.input.show-shield', {
		default: true,
		ui: {
			path: 'Chat > Input >> Appearance',
			title: 'Allow the "Shield Mode" button to appear in relevant channels.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.input.show-elevate-your-message', {
		default: true,
		ui: {
			path: 'Chat > Input >> Appearance',
			title: 'Allow the "Elevate Your Message" button to be displayed.',
			component: 'setting-check-box'
		}
	});

}
