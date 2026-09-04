'use strict';

// ============================================================================
// Chat Settings
// Settings definitions registered from the module constructor. `chat` is
// the module instance; every callback uses it where it used to use `this`.
// ============================================================================

import {LINK_DATA_HOSTS, RESOLVERS_REQUIRE_TOS} from 'utilities/constants';
import {Color} from 'utilities/color';
import {getFontsList} from 'utilities/fonts';
import {has, addWordSeparators, glob_to_regex, escape_regex, deep_copy} from 'utilities/object';


const TERM_FLAGS = ['g', 'gi'];

const GIF_TERMS = ['gif emotes', 'gif emoticons', 'gifs'];

function sortPriorityColorTerms(list) {
	list.sort((a,b) => {
		if ( a[0] < b[0] ) return 1;
		if ( a[0] > b[0] ) return -1;
		if ( ! a[1] && b[1] ) return 1;
		if ( a[1] && ! b[1] ) return -1;
		return 0;
	});
	return list;
}

const UNBLOCKABLE_TOKENS = [
	'filter_test'
];

function formatTerms(data) {
	const out = [];

	for(let i=0; i < data.length; i++) {
		const list = data[i];
		if ( list[0].length )
			list[1].push(addWordSeparators(list[0].join('|')));

		out.push(list[1].length ? new RegExp(list[1].join('|'), TERM_FLAGS[i] || 'gi') : null);
	}

	return out;
}


export function defineSettings(chat) {

	// ========================================================================
	// Settings
	// ========================================================================

	/*chat.settings.add('debug.highlight-reason', {
		default: [],
		type: 'basic_array_merge',
		ui: {
			path: 'Chat > Debugging >> General',
			title: 'Test',
			component: 'setting-select-box',
			multiple: true,
			data: () => chat.getHighlightReasons()
		}
	});*/

	chat.settings.add('debug.link-resolver.source', {
		process: (ctx, val) => {
			return LINK_DATA_HOSTS[val] ?? LINK_DATA_HOSTS.Production;
		},

		default: null,
		ui: {
			path: 'Debugging > Data Sources >> Links',
			title: 'Link Resolver',
			component: 'setting-select-box',
			force_seen: true,
			data: [
				{value: null, title: 'Automatic'},
			].concat(Object.entries(LINK_DATA_HOSTS).map(x => ({
				value: x[0],
				title: x[1].title
			})))
		},

		changed: () => chat.clearLinkCache()
	});

	chat.settings.addUI('debug.link-resolver.test', {
		path: 'Debugging > Data Sources >> Links',
		component: 'link-tester',
		getChat: () => chat,
		force_seen: true
	});

	chat.settings.add('chat.timestamp-size', {
		default: null,
		ui: {
			path: 'Chat > Appearance >> General',
			title: 'Timestamp Font Size',
			description: 'How large should timestamps be, in pixels. Defaults to Font Size if not set.',
			component: 'setting-text-box',
			process: 'to_int',
			bounds: [1]
		}
	});

	chat.settings.add('chat.font-size', {
		default: 14,
		ui: {
			path: 'Chat > Appearance >> General',
			title: 'Font Size',
			description: "How large should text in chat be, in pixels. This may be affected by your browser's zoom and font size settings.",
			component: 'setting-text-box',
			process: 'to_int',
			bounds: [1]
		}
	});

	chat.settings.add('chat.font-family', {
		default: '',
		ui: {
			path: 'Chat > Appearance >> General',
			title: 'Font Family',
			description: 'Set the font used for displaying chat messages.',
			component: 'setting-combo-box',
			data: () => getFontsList()
		}
	});

	chat.settings.add('chat.name-format', {
		default: 0,
		ui: {
			path: 'Chat > Appearance >> Usernames',
			title: 'Display Style',
			description: 'Change how usernames are displayed in chat when users have an international display name set.',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'International Name (Username) <Default>'},
				{value: 1, title: 'International Name'},
				{value: 2, title: 'Username'}
			]
		}
	});

	chat.settings.add('chat.lines.emote-alignment', {
		default: 0,
		ui: {
			path: 'Chat > Appearance >> Chat Lines',
			title: 'Emote Alignment',
			description: 'Change how emotes are positioned in chat, potentially making messages taller in order to avoid having emotes overlap.',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Standard'},
				{value: 1, title: 'Padded'},
				{value: 2, title: 'Baseline (BTTV-Like)'}
			]
		}
	});

	chat.settings.add('chat.rich.enabled', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> Rich Content',
			title: 'Display rich content in chat.',
			description: 'This displays rich content blocks for things like linked clips and videos.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.rich.want-mid', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Rich Content',
			title: 'Display larger rich content in chat.',
			description: 'This enables the use of bigger rich content embeds in chat. This is **not** recommended for most users and/or chats.\n\n**Note:** Enabling this may cause chat to scroll at inopportune times due to content loading. Moderators should not use this feature.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.rich.hide-tokens', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Rich Content',
			title: 'Hide matching links for rich content.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.rich.all-links', {
		default: false,
		ui: {
			path: 'Chat > Appearance >> Rich Content',
			title: 'Display rich content embeds for all links.',
			description: '*Streamers: Please be aware that this is a potential vector for NSFW imagery via thumbnails, so be mindful when capturing chat with this enabled.*',
			component: 'setting-check-box',
			extra: {
				component: 'chat-rich-example',
				getChat: () => chat
			}
		}
	});

	chat.settings.add('chat.rich.minimum-level', {
		default: 0,
		ui: {
			path: 'Chat > Appearance >> Rich Content',
			title: 'Required User Level',
			description: 'Only display rich content embeds on messages posted by users with this level or higher.',
			component: 'setting-select-box',
			data: [
				{value: 4, title: 'Broadcaster'},
				{value: 3, title: 'Moderator'},
				{value: 2, title: 'VIP'},
				{value: 1, title: 'Subscriber'},
				{value: 0, title: 'Everyone'}
			]
		}
	});

	chat.settings.add('chat.scrollback-length', {
		default: 150,
		ui: {
			path: 'Chat > Behavior >> General',
			title: 'Scrollback Length',
			description: 'Keep up to this many lines in chat. Setting this too high will create lag.',
			component: 'setting-text-box',
			process: 'to_int',
			bounds: [1]
		}
	});

	chat.settings.add('chat.filtering.debug', {
		default: false,
		ui: {
			path: 'Chat > Filtering > General >> Behavior',
			title: 'Display a list of highlight reasons on every chat message for debugging.',
			component: 'setting-check-box',
			force_seen: true
		}
	});

	chat.settings.addUI('chat.filtering.pad-bottom', {
		path: 'Chat > Filtering > Highlight',
		sort: 1000,
		component: 'setting-spacer',
		top: '30rem',
		force_seen: true
	});

	chat.settings.add('chat.filtering.click-to-reveal', {
		default: false,
		ui: {
			path: 'Chat > Filtering > General @{"sort":-1} >> Behavior',
			title: 'Click to reveal deleted terms.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.filtering.deleted-style', {
		default: 1,
		ui: {
			path: 'Chat > Behavior >> Deleted Messages',
			title: 'Detailed Message Style',
			description: 'This style will be applied to deleted messages showed in Detailed rendering mode to differentiate them from normal chat messages.',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Faded'},
				{value: 1, title: 'Faded, Line Through'},
				{value: 2, title: 'Line Through'},
				{value: 3, title: 'No Change'}
			]
		}
	});

	chat.settings.add('chat.filtering.display-deleted', {
		default: false,
		ui: {
			path: 'Chat > Behavior >> Deleted Messages',
			sort: -1,
			title: 'Rendering Mode',
			description: 'This, when set, overrides the `Deleted Messages` mode selected in Twitch chat settings, which is normally only accessible for moderators. Brief hides messages entirely and shows a notice in chat that a number of messages were hidden. Detailed shows the contents of the message. Legacy shows `<message deleted>` with click to reveal.',
			component: 'setting-select-box',
			data: [
				{value: false, title: 'Do Not Override'},
				{value: 'BRIEF', title: 'Brief'},
				{value: 'DETAILED', title: 'Detailed'},
				{value: 'LEGACY', title: 'Legacy'}
			]
		}
	});

	chat.settings.add('chat.filtering.display-mod-action', {
		default: 1,
		ui: {
			path: 'Chat > Behavior >> Deleted Messages',
			title: 'Display Reason',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Never'},
				{value: 1, title: 'In Detailed Mode'},
				{value: 2, title: 'Always'}
			]
		}
	});

	chat.settings.add('chat.automod.delete-messages', {
		default: true,
		ui: {
			path: 'Chat > Filtering > General >> AutoMod Filters @{"description": "Extra configuration for Twitch\'s native `Chat Filters`."}',
			title: 'Mark messages as deleted if they contain filtered phrases.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.automod.remove-messages', {
		default: true,
		ui: {
			path: 'Chat > Filtering > General >> AutoMod Filters',
			title: 'Remove messages entirely if they contain filtered phrases.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.automod.run-as-mod', {
		default: false,
		ui: {
			path: 'Chat > Filtering > General >> AutoMod Filters',
			title: 'Use Chat Filters as a moderator.',
			description: 'By default, Twitch\'s Chat Filters feature does not function for moderators. This overrides that behavior.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.filtering.process-own', {
		default: false,
		ui: {
			path: 'Chat > Filtering > General >> Behavior',
			title: 'Filter your own messages.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.filtering.ignore-clear', {
		default: false,
		ui: {
			path: 'Chat > Behavior >> Deleted Messages',
			title: 'Do not Clear Chat when commanded to.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.filtering.remove-deleted', {
		default: 1,
		ui: {
			path: 'Chat > Behavior >> Deleted Messages',
			title: 'Remove deleted messages from chat.',
			description: 'Deleted messages will be removed from chat entirely. This setting is not recommended for moderators.',
			component: 'setting-select-box',

			data: [
				{value: 0, title: 'Do Not Remove'},
				{value: 1, title: 'Remove Unseen (Default)'},
				{value: 2, title: 'Remove Unseen as Moderator'},
				{value: 3, title: 'Remove All'}
			]
		}
	});

	chat.settings.add('chat.delay', {
		default: -1,
		ui: {
			path: 'Chat > Behavior >> General',
			title: 'Artificial Chat Delay',
			description: 'Delay the appearance of chat messages to allow for moderation before you see them.',
			component: 'setting-select-box',

			data: [
				{value: -1, title: 'Default Delay (Room Specific; Non-Mod Only)'},
				{value: 0, title: 'No Delay'},
				{value: 300, title: 'Minor (Bot Moderation; 0.3s)'},
				{value: 1200, title: 'Normal (Human Moderation; 1.2s)'},
				{value: 5000, title: 'Large (Spoiler Removal / Slow Mods; 5s)'},
				{value: 10000, title: 'Extra Large (10s)'},
				{value: 15000, title: 'Extremely Large (15s)'},
				{value: 20000, title: 'Mods Asleep; Delay Chat (20s)'},
				{value: 30000, title: 'Half a Minute (30s)'},
				{value: 60000, title: 'Why??? (1m)'},
				{value: 788400000000, title: 'The CBenni Option (Literally 25 Years)'}
			]
		}
	});

	chat.settings.add('chat.filtering.hidden-tokens', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		process(ctx, val) {
			const out = new Set;
			for(const v of val)
				if ( v?.v || ! UNBLOCKABLE_TOKENS.includes(v.v) )
					out.add(v.v);

			return out;
		},

		ui: {
			path: 'Chat > Appearance >> Hidden Token Types @{"description":"This filter allows you to prevent specific content token types from appearing chat messages, such as hiding all cheers or emotes."}',
			component: 'blocked-types',
			getExtraTerms: () => Object
				.keys(chat.tokenizers)
				.filter(key => ! UNBLOCKABLE_TOKENS.includes(key) && chat.tokenizers[key]?.render),
			data: () => Object
				.keys(chat.tokenizers)
				.filter(key => ! UNBLOCKABLE_TOKENS.includes(key) && chat.tokenizers[key]?.render)
				.sort()
		}
	});

	chat.settings.add('chat.filtering.highlight-basic-users', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		ui: {
			path: 'Chat > Filtering > Highlight @{"description": "These settings allow you to highlight messages in chat based on their contents. Setting priorities on rules allows you to determine which highlight color should be applied if a message matches multiple rules. Rules with a higher priority take priority over rules with lower priorities.\\n\\nYou can also create a rule that removes highlights from messages, preventing lower priority rules from highlighting them, by setting a color with an alpha value of zero. Example: `#00000000`"} >> Users',
			component: 'basic-terms',
			colored: true,
			words: false,
			priority: true
		}
	});

	chat.settings.add('__filter:highlight-users', {
		requires: ['chat.filtering.highlight-basic-users'],
		equals: 'requirements',
		process(ctx) {
			const val = ctx.get('chat.filtering.highlight-basic-users');
			if ( ! val || ! val.length )
				return null;

			const temp = new Map;

			for(const item of val) {
				const p = item.p || 0,
					t = item.t;

				let c = item.c || null;
				let v = item.v;

				if ( t === 'glob' )
					v = glob_to_regex(v);

				else if ( t !== 'raw' )
					v = escape_regex(v);

				if ( ! v || ! v.length )
					continue;

				try {
					new RegExp(v);
				} catch(err) {
					continue;
				}

				let colors = temp.get(p);
				if ( ! colors ) {
					colors = new Map;
					temp.set(p, colors);
				}

				if ( c ) {
					const test = Color.RGBA.fromCSS(c);
					if ( ! test || ! test.a )
						c = false;
				}

				if ( colors.has(c) )
					colors.get(c).push(v);
				else {
					colors.set(c, [v]);
				}
			}

			const out = [];
			for(const [priority, list] of temp) {
				for(const [color, entries] of list) {
					out.push([
						priority,
						color,
						new RegExp(`^(?:${entries.join('|')})$`, 'gi')
					]);
					//list.set(k, new RegExp(`^(?:${entries.join('|')})$`, 'gi'));
				}
			}

			return sortPriorityColorTerms(out);
		}
	});


	chat.settings.add('chat.filtering.highlight-basic-users-blocked', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		ui: {
			path: 'Chat > Filtering > Block >> Users',
			component: 'basic-terms',
			removable: true,
			words: false
		}
	});


	chat.settings.add('__filter:block-users', {
		requires: ['chat.filtering.highlight-basic-users-blocked'],
		equals: 'requirements',
		process(ctx) {
			const val = ctx.get('chat.filtering.highlight-basic-users-blocked');
			if ( ! val || ! val.length )
				return null;

			const out = [[], []];

			for(const item of val) {
				const t = item.t;
				let v = item.v;

				if ( t === 'glob' )
					v = glob_to_regex(v);

				else if ( t !== 'raw' )
					v = escape_regex(v);

				if ( ! v || ! v.length )
					continue;

				out[item.remove ? 1 : 0].push(v);
			}

			return out.map(data => {
				if ( ! data.length )
					return null;

				return new RegExp(`^(?:${data.join('|')})$`, 'i');
			});
		}
	});


	chat.settings.add('chat.filtering.highlight-basic-badges', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		ui: {
			path: 'Chat > Filtering > Highlight >> Badges',
			component: 'badge-highlighting',
			colored: true,
			priority: true,
			data: () => chat.badges.getSettingsBadges(true)
		}
	});


	chat.settings.add('__filter:highlight-badges', {
		requires: ['chat.filtering.highlight-basic-badges'],
		equals: 'requirements',
		process(ctx) {
			const val = ctx.get('chat.filtering.highlight-basic-badges');
			if ( ! val || ! val.length )
				return null;

			const badges = new Map;

			for(const item of val) {
				let c = item.c || null;
				const p = item.p || 0,
					v = item.v;

				if ( c ) {
					const test = Color.RGBA.fromCSS(c);
					if ( ! test || ! test.a )
						c = false;
				}

				const existing = badges.get(v);
				if ( ! existing || existing[0] < p || (c && ! existing[1] && existing[0] <= p) )
					badges.set(v, [p, c]);
			}

			return badges;
		}
	});


	chat.settings.add('chat.filtering.highlight-basic-badges-blocked', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		ui: {
			path: 'Chat > Filtering > Block >> Badges @{"description": "**Note:** This section is for filtering messages out of chat from users with specific badges. If you wish to hide a badge, go to [Chat > Badges >> Visibility](~chat.badges.tabs.visibility)."}',
			component: 'badge-highlighting',
			removable: true,
			data: () => chat.badges.getSettingsBadges(true)
		}
	});

	chat.settings.add('__filter:block-badges', {
		requires: ['chat.filtering.highlight-basic-badges-blocked'],
		equals: 'requirements',
		process(ctx) {
			const val = ctx.get('chat.filtering.highlight-basic-badges-blocked');
			if ( ! val || ! val.length )
				return null;

			const out = [[], []];
			for(const item of val)
				if ( item.v )
					out[item.remove ? 1 : 0].push(item.v);

			if ( ! out[0].length && ! out[1].length )
				return null;

			return out;
		}
	});


	chat.settings.add('chat.filtering.highlight-basic-terms', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		ui: {
			path: 'Chat > Filtering > Highlight >> Terms @{"description": "Please see [Chat > Filtering > Syntax Help](~) for details on how to use terms."}',
			component: 'basic-terms',
			colored: true,
			priority: true,
			highlight: true
		}
	});

	chat.settings.add('__filter:highlight-terms', {
		requires: ['chat.filtering.highlight-tokens', 'chat.filtering.highlight-basic-terms'],
		equals: 'requirements',
		process(ctx) {
			const can_highlight = ctx.get('chat.filtering.highlight-tokens');
			const val = ctx.get('chat.filtering.highlight-basic-terms');
			if ( ! val || ! val.length )
				return null;

			const temp = new Map;
			//const colors = new Map;
			let has_highlight = false,
				has_non = false;

			for(const item of val) {
				const p = item.p || 0,
					highlight = can_highlight && (has(item, 'h') ? item.h : true),
					sensitive = item.s,
					t = item.t,
					word = has(item, 'w') ? item.w : t !== 'raw';

				let c = item.c || null;
				let v = item.v;

				if ( t === 'glob' )
					v = glob_to_regex(v);

				else if ( t !== 'regex' && t !== 'raw' )
					v = escape_regex(v);

				if ( ! v || ! v.length )
					continue;

				try {
					new RegExp(v);
				} catch(err) {
					continue;
				}

				if ( highlight )
					has_highlight = true;
				else
					has_non = true;

				let colors = temp.get(p);
				if ( ! colors ) {
					colors = new Map;
					temp.set(p, colors);
				}

				if ( c ) {
					const test = Color.RGBA.fromCSS(c);
					if ( ! test || ! test.a )
						c = false;
				}

				let data = colors.get(c);
				if ( ! data )
					colors.set(c, data = [
						[ // highlight
							[ // sensitive
								[], [] // word
							],
							[
								[], []
							]
						],
						[
							[
								[], []
							],
							[
								[], []
							]
						]
					]);

				data[highlight ? 0 : 1][sensitive ? 0 : 1][word ? 0 : 1].push(v);
			}

			if ( ! has_highlight && ! has_non )
				return null;

			const out = {
				hl: has_highlight ? [] : null,
				non: has_non ? [] : null
			};

			for(const [priority, colors] of temp) {
				for(const [color, list] of colors) {
					const highlights = formatTerms(list[0]),
						non_highlights = formatTerms(list[1]);

					if ( highlights[0] || highlights[1] )
						out.hl.push([
							priority,
							color,
							highlights
						]);

					if ( non_highlights[0] || non_highlights[1] )
						out.non.push([
							priority,
							color,
							non_highlights
						]);
				}
			}

			if ( has_highlight )
				sortPriorityColorTerms(out.hl);

			if ( has_non )
				sortPriorityColorTerms(out.non);

			return out;
		}
	});


	chat.settings.add('chat.filtering.highlight-basic-blocked', {
		default: [],
		type: 'array_merge',
		always_inherit: true,
		ui: {
			path: 'Chat > Filtering > Block >> Terms @{"description": "Please see [Chat > Filtering > Syntax Help](~) for details on how to use terms."}',
			component: 'basic-terms',
			removable: true
		}
	});


	chat.settings.add('__filter:block-terms', {
		requires: ['chat.filtering.highlight-basic-blocked'],
		equals: 'requirements',
		process(ctx) {
			const val = ctx.get('chat.filtering.highlight-basic-blocked');
			if ( ! val || ! val.length )
				return null;

			const data = [
				[ // no-remove
					[ // sensitive
						[], [] // word
					],
					[ // intensitive
						[], []
					]
				],
				[ // remove
					[ // sensitive
						[], [] // word
					],
					[ // intensiitve
						[], []
					]
				]
			];

			let had_remove = false,
				had_non = false;

			for(const item of val) {
				const t = item.t,
					sensitive = item.s,
					word = has(item, 'w') ? item.w : t !== 'raw';
				let v = item.v;

				if ( t === 'glob' )
					v = glob_to_regex(v);

				else if ( t !== 'regex' && t !== 'raw' )
					v = escape_regex(v);

				if ( ! v || ! v.length )
					continue;

				if ( item.remove )
					had_remove = true;
				else
					had_non = true;

				data[item.remove ? 1 : 0][sensitive ? 0 : 1][word ? 0 : 1].push(v);
			}

			if ( ! had_remove && ! had_non )
				return null;

			return {
				remove: had_remove ? formatTerms(data[1]) : null,
				non: had_non ? formatTerms(data[0]) : null
			};
		}
	});


	chat.settings.add('chat.filtering.clickable-mentions', {
		default: false,
		ui: {
			component: 'setting-check-box',
			path: 'Chat > Viewer Cards >> Behavior',
			title: 'Enable opening viewer cards by clicking mentions in chat.'
		}
	});

	chat.settings.add('chat.filtering.all-mentions', {
		default: false,
		ui: {
			component: 'setting-check-box',
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Display mentions for all users without requiring an at sign (@).',
			description: '**Note**: This setting can increase memory usage and impact chat performance.'
		}
	});

	chat.settings.add('chat.filtering.color-mentions', {
		default: false,
		ui: {
			component: 'setting-check-box',
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Display mentions in chat with username colors.',
			description: '**Note:** Not compatible with color overrides as mentions do not include user IDs.'
		}
	});

	chat.settings.add('chat.filtering.need-colors', {
		requires: ['chat.filtering.all-mentions' ,'chat.filtering.color-mentions'],
		process(ctx) {
			return ctx.get('chat.filtering.all-mentions') || ctx.get('chat.filtering.color-mentions')
		}
	});

	chat.settings.add('chat.filtering.bold-mentions', {
		default: true,
		ui: {
			component: 'setting-check-box',
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Display mentions in chat with a bold font.'
		}
	});

	chat.settings.add('chat.filtering.mention-priority', {
		default: 0,
		ui: {
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Mention Priority',
			component: 'setting-text-box',
			type: 'number',
			process: 'to_int',
			description: 'Mentions of your name have this priority for the purpose of highlighting. See [Chat > Filtering > Highlight](~chat.filtering.highlight) for more details.'
		}
	});

	chat.settings.add('chat.filtering.mention-color', {
		default: '',
		ui: {
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Custom Highlight Color',
			component: 'setting-color-box',
			description: 'If this is set, highlighted messages with no default color set will use this color rather than red.'
		}
	});

	chat.settings.add('chat.filtering.highlight-mentions', {
		default: false,
		ui: {
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Highlight messages that mention you.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.filtering.highlight-tokens', {
		default: false,
		ui: {
			path: 'Chat > Filtering > General >> Appearance',
			title: 'Highlight matched words in chat.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('tooltip.images', {
		default: true,
		ui: {
			path: 'Chat > Tooltips >> General @{"sort": -1}',
			title: 'Display images in tooltips.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('tooltip.badge-images', {
		default: true,
		requires: ['tooltip.images'],
		process(ctx, val) {
			return ctx.get('tooltip.images') ? val : false
		},

		ui: {
			path: 'Chat > Tooltips >> Badges',
			title: 'Display large images of badges.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('tooltip.emote-sources', {
		default: true,
		ui: {
			path: 'Chat > Tooltips >> Emotes',
			title: 'Display known sources.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('tooltip.emote-images', {
		default: true,
		requires: ['tooltip.images'],
		process(ctx, val) {
			return ctx.get('tooltip.images') ? val : false
		},

		ui: {
			path: 'Chat > Tooltips >> Emotes',
			title: 'Display large images of emotes.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('tooltip.rich-links', {
		default: true,
		ui: {
			sort: -1,
			path: 'Chat > Tooltips >> Links',
			title: 'Display rich tooltips for links.',
			component: 'setting-check-box',
			extra: {
				component: 'chat-tooltip-example'
			}
		}
	});

	chat.settings.add('tooltip.link-interaction', {
		default: true,
		ui: {
			path: 'Chat > Tooltips >> Links',
			title: 'Allow interaction with supported link tooltips.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('tooltip.link-images', {
		default: true,
		requires: ['tooltip.images'],
		process(ctx, val) {
			return ctx.get('tooltip.images') ? val : false
		},

		ui: {
			path: 'Chat > Tooltips >> Links',
			title: 'Display images for links.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('tooltip.link-nsfw-images', {
		default: false,
		ui: {
			path: 'Chat > Tooltips >> Links',
			title: 'Display potentially NSFW images.',
			description: 'When enabled, FrankerFaceZ will include images that are tagged as unsafe or that are not rated.',
			component: 'setting-check-box'
		}
	});


	// Terms of Service Stuff
	for(const [key, info] of Object.entries(RESOLVERS_REQUIRE_TOS)) {
		chat.settings.addUI(`tooltip.tos.${key}`, {
			path: 'Chat > Tooltips >> Terms of Service @{"description": "The following services require you to agree to their Terms of Service before we can show you information from their platforms."}',
			component: 'tooltip-tos',
			item: key,
			override_setting: 'agreed-tos',
			getChat: () => chat,
			data: deep_copy(info),
			onUIChange: () => chat.emit(':update-link-resolver')
		});
	}


	chat.settings.add('chat.adjustment-mode', {
		default: null,
		process(ctx, val) {
			if ( val == null )
				return (ctx.get('ls.useHighContrastColors') ?? true) ? 1 : 0;

			return val;
		},
		requires: ['ls.useHighContrastColors'],
		ui: {
			path: 'Chat > Appearance >> Colors',
			title: 'Adjustment',
			description: 'Alter user colors to ensure that they remain readable.',

			default(ctx) {
				return (ctx.get('ls.useHighContrastColors') ?? true) ? 1 : 0;
			},

			component: 'setting-select-box',

			data: [
				{value: -1, title: 'No Color'},
				{value: 0, title: 'Unchanged'},
				{value: 1, title: 'HSL Luma'},
				{value: 2, title: 'Luv Luma'},
				{value: 3, title: 'HSL Loop (BTTV-Like)'},
				{value: 4, title: 'RGB Loop (Deprecated)'}
			]
		}
	});

	chat.settings.add('chat.adjustment-contrast', {
		default: 4.5,
		ui: {
			path: 'Chat > Appearance >> Colors',
			title: 'Minimum Contrast',
			description: 'Set the minimum contrast ratio used by Luma adjustments when determining readability.',

			component: 'setting-text-box',
			process: 'to_float'
		}
	});

	chat.settings.add('chat.me-style', {
		default: 2,
		ui: {
			path: 'Chat > Appearance >> Chat Lines',
			title: 'Action Style',
			description: 'When someone uses `/me`, the message will be rendered in this style.',
			component: 'setting-select-box',

			data: [
				{value: 0, title: 'No Style'},
				{value: 1, title: 'Colorized (Old Style)'},
				{value: 2, title: 'Italic (New Style)'},
				{value: 3, title: 'Colorized Italic'}
			]
		}
	});

	chat.settings.add('chat.bits.stack', {
		default: 0,
		ui: {
			path: 'Chat > Bits and Cheering >> Appearance',
			title: 'Cheer Stacking',
			description: 'Collect all the cheers in a message into a single cheer at the start of the message.',
			component: 'setting-select-box',

			data: [
				{value: 0, title: 'Disabled'},
				{value: 1, title: 'Grouped by Type'},
				{value: 2, title: 'All in One'}
			]
		}
	});

	chat.settings.add('chat.emotes.animated', {
		default: null,
		requires: ['ls.emoteAnimationsEnabled'],
		process(ctx, val) {
			if ( val == null )
				return (ctx.get('ls.emoteAnimationsEnabled') ?? true) ? 1 : 0;
			return val;
		},
		ui: {
			path: 'Chat > Appearance >> Emotes',
			sort: -50,
			title: 'Animated Emotes',

			default(ctx) {
				return (ctx.get('ls.emoteAnimationsEnabled') ?? true) ? 1 : 0;
			},

			getExtraTerms: () => GIF_TERMS,

			description: 'This controls whether or not animated emotes are allowed to play in chat. When this is `Disabled`, emotes will appear as static images. Setting this to `Enable on Hover` may cause performance issues.',
			component: 'setting-select-box',
			data: [
				{value: 0, title: 'Disabled'},
				{value: 1, title: 'Enabled'},
				{value: 2, title: 'Enable on Hover'}
			]
		}
	});

	chat.settings.add('chat.gifs.enabled', {
		default: true,
		ui: {
			path: 'Chat > Appearance >> GIFs',
			title: 'Display GIFs in chat.',
			description: 'Twitch subscribers (Tier 2 and 3) can post [animated GIFs](https://help.twitch.tv/s/article/gif-keyboard). When this is disabled, those messages are shown as a link instead.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.gifs.size', {
		default: 140,
		ui: {
			path: 'Chat > Appearance >> GIFs',
			title: 'GIF Size',
			description: 'How large GIFs should be, in pixels, as their maximum height.',
			component: 'setting-text-box',
			process: 'to_int',
			bounds: [1]
		}
	});

	chat.settings.add('tooltip.emote-images.animated', {
		requires: ['chat.emotes.animated'],
		default: null,
		process(ctx, val) {
			if ( val == null )
				val = ctx.get('chat.emotes.animated') ? true : false;
			return val;
		},
		ui: {
			path: 'Chat > Tooltips >> Emotes',
			title: 'Display animated images of emotes.',
			getExtraTerms: () => GIF_TERMS,
			description: 'If this is not overridden, animated images are only shown in emote tool-tips if [Chat > Appearance >> Emotes > Animated Emotes](~chat.appearance.emotes) is not disabled.',
			component: 'setting-check-box'
		}
	});

	chat.settings.add('chat.bits.animated', {
		default: true,
		ui: {
			path: 'Chat > Bits and Cheering >> Appearance',
			title: 'Display animated cheers.',
			component: 'setting-check-box'
		}
	});

	const ts = new Date(0).toLocaleTimeString().toUpperCase(),
		default_24 = ts.lastIndexOf('PM') === -1 && ts.lastIndexOf('AM') === -1;

	chat.settings.add('chat.timestamp-format', {
		default: default_24 ? 'H:mm' : 'h:mm',
		ui: {
			path: 'Chat > Appearance >> Chat Lines',
			title: 'Timestamp Format',
			component: 'setting-combo-box',

			description: 'Timestamps are formatted using the [Day.js](https://github.com/iamkun/dayjs#readme) library. More details about formatting strings [can be found here](https://github.com/iamkun/dayjs/blob/HEAD/docs/en/API-reference.md#list-of-all-available-formats)',

			data: [
				{value: 'h:mm', title: '12 Hour'},
				{value: 'h:mm:ss', title: '12 Hour with Seconds'},
				{value: 'H:mm', title: '24 Hour'},
				{value: 'H:mm:ss', title: '24 Hour with Seconds'},
				{value: 'hh:mm', title: 'Padded'},
				{value: 'hh:mm:ss', title: 'Padded with Seconds'},
				{value: 'HH:mm', title: 'Padded 24 Hour'},
				{value: 'HH:mm:ss', title: 'Padded 24 Hour with Seconds'},
			]
		}
	});

}
