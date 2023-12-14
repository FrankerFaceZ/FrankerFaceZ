'use strict';

// ============================================================================
// Chat
// ============================================================================

import dayjs from 'dayjs';

import { DEBUG, LINK_DATA_HOSTS } from 'utilities/constants';
import Module, { buildAddonProxy } from 'utilities/module';
import {Color} from 'utilities/color';
import {createElement, ManagedStyle} from 'utilities/dom';
import {getFontsList} from 'utilities/fonts';
import {timeout, has, addWordSeparators, glob_to_regex, escape_regex, split_chars, makeAddonIdChecker} from 'utilities/object';

import Badges from './badges';
import Emotes from './emotes';
import Emoji from './emoji';
import Overrides from './overrides';

import Room from './room';
import User from './user';
import * as TOKENIZERS from './tokenizers';
import * as RICH_PROVIDERS from './rich_providers';
import * as LINK_PROVIDERS from './link_providers';

import Actions from './actions/actions';


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

const TERM_FLAGS = ['g', 'gi'];

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

const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';
const EMOTE_CHARS = /[ .,!]/;
const GIF_TERMS = ['gif emotes', 'gif emoticons', 'gifs'];

export default class Chat extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('i18n');
		this.inject('tooltips');
		this.inject('experiments');
		this.inject('staging');
		this.inject('load_tracker');

		this.inject(Badges);
		this.inject(Emotes);
		this.inject(Emoji);
		this.inject(Actions);
		this.inject('overrides', Overrides);

		this._link_info = {};

		// Bind for JSX stuff
		this.clickToReveal = this.clickToReveal.bind(this);
		this.handleLinkClick = this.handleLinkClick.bind(this);
		this.handleMentionClick = this.handleMentionClick.bind(this);
		this.handleReplyClick = this.handleReplyClick.bind(this);

		this.style = new ManagedStyle;

		this.context = this.settings.context({});

		this.rooms = {};
		this.users = {};

		this.room_ids = {};
		this.user_ids = {};

		this.tokenizers = {};
		this.__tokenizers = [];

		this.rich_providers = {};
		this.__rich_providers = [];

		this.link_providers = {};
		this.__link_providers = [];

		this._hl_reasons = {};
		this.addHighlightReason('mention', 'Mentioned');
		this.addHighlightReason('user', 'Highlight User');
		this.addHighlightReason('badge', 'Highlight Badge');
		this.addHighlightReason('term', 'Highlight Term');

		// ========================================================================
		// Settings
		// ========================================================================

		/*this.settings.add('debug.highlight-reason', {
			default: [],
			type: 'basic_array_merge',
			ui: {
				path: 'Chat > Debugging >> General',
				title: 'Test',
				component: 'setting-select-box',
				multiple: true,
				data: () => this.getHighlightReasons()
			}
		});*/

		this.settings.add('debug.link-resolver.source', {
			process: (ctx, val) => {
				if ( val == null ) {
					const exp = this.experiments.getAssignment('api_links');
					if ( exp === 'cf' )
						val = 'test-cf';
					else if ( exp )
						val = 'test';
					else
						val = 'socket';
				}

				return LINK_DATA_HOSTS[val] ?? LINK_DATA_HOSTS.test;
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

			changed: () => this.clearLinkCache()
		});

		this.settings.addUI('debug.link-resolver.test', {
			path: 'Debugging > Data Sources >> Links',
			component: 'link-tester',
			getChat: () => this,
			force_seen: true
		});

		this.settings.add('chat.timestamp-size', {
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

		this.settings.add('chat.font-size', {
			default: 13,
			ui: {
				path: 'Chat > Appearance >> General',
				title: 'Font Size',
				description: "How large should text in chat be, in pixels. This may be affected by your browser's zoom and font size settings.",
				component: 'setting-text-box',
				process: 'to_int',
				bounds: [1]
			}
		});

		this.settings.add('chat.font-family', {
			default: '',
			ui: {
				path: 'Chat > Appearance >> General',
				title: 'Font Family',
				description: 'Set the font used for displaying chat messages.',
				component: 'setting-combo-box',
				data: () => getFontsList()
			}
		});

		this.settings.add('chat.name-format', {
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

		this.settings.add('chat.lines.emote-alignment', {
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

		this.settings.add('chat.rich.enabled', {
			default: true,
			ui: {
				path: 'Chat > Appearance >> Rich Content',
				title: 'Display rich content in chat.',
				description: 'This displays rich content blocks for things like linked clips and videos.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.rich.want-mid', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Rich Content',
				title: 'Display larger rich content in chat.',
				description: 'This enables the use of bigger rich content embeds in chat. This is **not** recommended for most users and/or chats.\n\n**Note:** Enabling this may cause chat to scroll at inopportune times due to content loading. Moderators should not use this feature.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.rich.hide-tokens', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Rich Content',
				title: 'Hide matching links for rich content.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.rich.all-links', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Rich Content',
				title: 'Display rich content embeds for all links.',
				description: '*Streamers: Please be aware that this is a potential vector for NSFW imagery via thumbnails, so be mindful when capturing chat with this enabled.*',
				component: 'setting-check-box',
				extra: {
					component: 'chat-rich-example',
					getChat: () => this
				}
			}
		});

		this.settings.add('chat.rich.minimum-level', {
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

		this.settings.add('chat.scrollback-length', {
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

		this.settings.add('chat.filtering.debug', {
			default: false,
			ui: {
				path: 'Chat > Filtering > General >> Behavior',
				title: 'Display a list of highlight reasons on every chat message for debugging.',
				component: 'setting-check-box',
				force_seen: true
			}
		});

		this.settings.addUI('chat.filtering.pad-bottom', {
			path: 'Chat > Filtering > Highlight',
			sort: 1000,
			component: 'setting-spacer',
			top: '30rem',
			force_seen: true
		});

		this.settings.add('chat.filtering.click-to-reveal', {
			default: false,
			ui: {
				path: 'Chat > Filtering > General @{"sort":-1} >> Behavior',
				title: 'Click to reveal deleted terms.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.deleted-style', {
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

		this.settings.add('chat.filtering.display-deleted', {
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

		this.settings.add('chat.filtering.display-mod-action', {
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

		this.settings.add('chat.automod.delete-messages', {
			default: true,
			ui: {
				path: 'Chat > Filtering > General >> AutoMod Filters @{"description": "Extra configuration for Twitch\'s native `Chat Filters`."}',
				title: 'Mark messages as deleted if they contain filtered phrases.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.automod.remove-messages', {
			default: true,
			ui: {
				path: 'Chat > Filtering > General >> AutoMod Filters',
				title: 'Remove messages entirely if they contain filtered phrases.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.automod.run-as-mod', {
			default: false,
			ui: {
				path: 'Chat > Filtering > General >> AutoMod Filters',
				title: 'Use Chat Filters as a moderator.',
				description: 'By default, Twitch\'s Chat Filters feature does not function for moderators. This overrides that behavior.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.process-own', {
			default: false,
			ui: {
				path: 'Chat > Filtering > General >> Behavior',
				title: 'Filter your own messages.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.ignore-clear', {
			default: false,
			ui: {
				path: 'Chat > Behavior >> Deleted Messages',
				title: 'Do not Clear Chat when commanded to.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.remove-deleted', {
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

		this.settings.add('chat.delay', {
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

		this.settings.add('chat.filtering.hidden-tokens', {
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
				data: () => Object
					.keys(this.tokenizers)
					.filter(key => ! UNBLOCKABLE_TOKENS.includes(key) && this.tokenizers[key]?.render)
					.sort()
			}
		});

		this.settings.add('chat.filtering.highlight-basic-users', {
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

		this.settings.add('__filter:highlight-users', {
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


		this.settings.add('chat.filtering.highlight-basic-users-blocked', {
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


		this.settings.add('__filter:block-users', {
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

					return new RegExp(`^(?:${data.join('|')})$`, 'gi');
				});
			}
		});


		this.settings.add('chat.filtering.highlight-basic-badges', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Chat > Filtering > Highlight >> Badges',
				component: 'badge-highlighting',
				colored: true,
				priority: true,
				data: () => this.badges.getSettingsBadges(true)
			}
		});


		this.settings.add('__filter:highlight-badges', {
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


		this.settings.add('chat.filtering.highlight-basic-badges-blocked', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Chat > Filtering > Block >> Badges @{"description": "**Note:** This section is for filtering messages out of chat from users with specific badges. If you wish to hide a badge, go to [Chat > Badges >> Visibility](~chat.badges.tabs.visibility)."}',
				component: 'badge-highlighting',
				removable: true,
				data: () => this.badges.getSettingsBadges(true)
			}
		});

		this.settings.add('__filter:block-badges', {
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


		this.settings.add('chat.filtering.highlight-basic-terms', {
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

		this.settings.add('__filter:highlight-terms', {
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


		this.settings.add('chat.filtering.highlight-basic-blocked', {
			default: [],
			type: 'array_merge',
			always_inherit: true,
			ui: {
				path: 'Chat > Filtering > Block >> Terms @{"description": "Please see [Chat > Filtering > Syntax Help](~) for details on how to use terms."}',
				component: 'basic-terms',
				removable: true
			}
		});


		this.settings.add('__filter:block-terms', {
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


		this.settings.add('chat.filtering.clickable-mentions', {
			default: false,
			ui: {
				component: 'setting-check-box',
				path: 'Chat > Viewer Cards >> Behavior',
				title: 'Enable opening viewer cards by clicking mentions in chat.'
			}
		});

		this.settings.add('chat.filtering.all-mentions', {
			default: false,
			ui: {
				component: 'setting-check-box',
				path: 'Chat > Filtering > General >> Appearance',
				title: 'Display mentions for all users without requiring an at sign (@).',
				description: '**Note**: This setting can increase memory usage and impact chat performance.'
			}
		});

		this.settings.add('chat.filtering.color-mentions', {
			default: false,
			ui: {
				component: 'setting-check-box',
				path: 'Chat > Filtering > General >> Appearance',
				title: 'Display mentions in chat with username colors.',
				description: '**Note:** Not compatible with color overrides as mentions do not include user IDs.'
			}
		});

		this.settings.add('chat.filtering.need-colors', {
			requires: ['chat.filtering.all-mentions' ,'chat.filtering.color-mentions'],
			process(ctx) {
				return ctx.get('chat.filtering.all-mentions') || ctx.get('chat.filtering.color-mentions')
			}
		});

		this.settings.add('chat.filtering.bold-mentions', {
			default: true,
			ui: {
				component: 'setting-check-box',
				path: 'Chat > Filtering > General >> Appearance',
				title: 'Display mentions in chat with a bold font.'
			}
		});

		this.settings.add('chat.filtering.mention-priority', {
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

		this.settings.add('chat.filtering.mention-color', {
			default: '',
			ui: {
				path: 'Chat > Filtering > General >> Appearance',
				title: 'Custom Highlight Color',
				component: 'setting-color-box',
				description: 'If this is set, highlighted messages with no default color set will use this color rather than red.'
			}
		});

		this.settings.add('chat.filtering.highlight-mentions', {
			default: false,
			ui: {
				path: 'Chat > Filtering > General >> Appearance',
				title: 'Highlight messages that mention you.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.filtering.highlight-tokens', {
			default: false,
			ui: {
				path: 'Chat > Filtering > General >> Appearance',
				title: 'Highlight matched words in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.images', {
			default: true,
			ui: {
				path: 'Chat > Tooltips >> General @{"sort": -1}',
				title: 'Display images in tooltips.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.badge-images', {
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

		this.settings.add('tooltip.emote-sources', {
			default: true,
			ui: {
				path: 'Chat > Tooltips >> Emotes',
				title: 'Display known sources.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.emote-images', {
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

		this.settings.add('tooltip.rich-links', {
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

		this.settings.add('tooltip.link-interaction', {
			default: true,
			ui: {
				path: 'Chat > Tooltips >> Links',
				title: 'Allow interaction with supported link tooltips.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('tooltip.link-images', {
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

		this.settings.add('tooltip.link-nsfw-images', {
			default: false,
			ui: {
				path: 'Chat > Tooltips >> Links',
				title: 'Display potentially NSFW images.',
				description: 'When enabled, FrankerFaceZ will include images that are tagged as unsafe or that are not rated.',
				component: 'setting-check-box'
			}
		});


		this.settings.add('chat.adjustment-mode', {
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

		this.settings.add('chat.adjustment-contrast', {
			default: 4.5,
			ui: {
				path: 'Chat > Appearance >> Colors',
				title: 'Minimum Contrast',
				description: 'Set the minimum contrast ratio used by Luma adjustments when determining readability.',

				component: 'setting-text-box',
				process: 'to_float'
			}
		});

		this.settings.add('chat.me-style', {
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

		this.settings.add('chat.bits.stack', {
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

		this.settings.add('chat.emotes.animated', {
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

		this.settings.add('tooltip.emote-images.animated', {
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

		this.settings.add('chat.bits.animated', {
			default: true,
			ui: {
				path: 'Chat > Bits and Cheering >> Appearance',
				title: 'Display animated cheers.',
				component: 'setting-check-box'
			}
		});

		const ts = new Date(0).toLocaleTimeString().toUpperCase(),
			default_24 = ts.lastIndexOf('PM') === -1 && ts.lastIndexOf('AM') === -1;

		this.settings.add('chat.timestamp-format', {
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

		this.context.on('changed:theme.is-dark', () => {
			for(const room of this.iterateRooms())
				room.buildBitsCSS();
		});

		this.context.on('changed:chat.bits.animated', () => {
			for(const room of this.iterateRooms())
				room.buildBitsCSS();
		});

		this.context.on('changed:chat.filtering.need-colors', async val => {
			if ( val )
				await this.createColorCache();
			else
				this.color_cache = null;

			this.emit(':update-line-tokens');
		});

		this.context.on('changed:chat.filtering.all-mentions', () => this.emit(':update-line-tokens'));
		this.context.on('changed:chat.filtering.color-mentions', () => this.emit(':update-line-tokens'));
	}


	async createColorCache() {
		const LRUCache = await require(/* webpackChunkName: 'utils' */ 'mnemonist/lru-cache');
		this.color_cache = new LRUCache(150);
	}


	generateLog() {
		const out = ['chat settings', '-------------------------------------------------------------------------------'];
		for(const [key, value] of this.context.__cache.entries())
			out.push(`${key}: ${JSON.stringify(value)}`);

		return out.join('\n');
	}


	getAddonProxy(addon_id, addon, module) {
		if ( ! addon_id )
			return this;

		const is_dev = DEBUG || addon?.dev,
			id_checker = makeAddonIdChecker(addon_id);

		const overrides = {},
			warnings = {};

		const user_proxy = buildAddonProxy(module, null, 'getUser()', {
			addBadge: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().addBadge() did not include addon ID in provider:', provider);

				return this.addBadge(provider, ...args);
			} : undefined,

			removeBadge: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().removeBadge() did not include addon ID in provider:', provider);

				return this.removeBadge(provider, ...args);
			} : undefined,

			addSet(provider, set_id, data) {
				if ( is_dev && ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().addSet() did not include addon ID in provider:', provider);

				if ( data ) {
					if ( is_dev && ! id_checker.test(set_id) )
						module.log.warn('[DEV-CHECK] Call to getUser().addSet() loaded set data but did not include addon ID in set ID:', set_id);
					data.__source = addon_id;
				}

				return this.addSet(provider, set_id, data);
			},

			removeAllSets: is_dev ? function(provider) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().removeAllSets() did not include addon ID in provider:', provider);

				return this.removeAllSets(provider);
			} : undefined,

			removeSet: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getUser().removeSet() did not include addon ID in provider:', provider);

				return this.removeSet(provider, ...args);
			} : undefined

		}, is_dev ? {
			badges: 'Please use addBadge(), getBadge(), or removeBadge()',
			emote_sets: 'Please use addSet(), removeSet(), or removeAllSets()',
			room: true
		} : null, true);

		const room_proxy = buildAddonProxy(module, null, 'getRoom()', {
			getUser(...args) {
				const result = this.getUser(...args);
				if ( result )
					return new Proxy(result, user_proxy);
			},

			addSet(provider, set_id, data) {
				if ( is_dev && ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getRoom().addSet() did not include addon ID in provider:', provider);

				if ( data ) {
					if ( is_dev && ! id_checker.test(set_id) )
						module.log.warn('[DEV-CHECK] Call to getRoom().addSet() loaded set data but did not include addon ID in set ID:', set_id);
					data.__source = addon_id;
				}

				return this.addSet(provider, set_id, data);
			},

			removeAllSets: is_dev ? function(provider) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getRoom().removeAllSets() did not include addon ID in provider:', provider);

				return this.removeAllSets(provider);
			} : undefined,

			removeSet: is_dev ? function(provider, ...args) {
				if ( ! id_checker.test(provider) )
					module.log.warn('[DEV-CHECK] Call to getRoom().removeSet() did not include addon ID in provider:', provider);

				return this.removeSet(provider, ...args);
			} : undefined

		}, {
			badges: true,
			load_data: true,
			emote_sets: 'Please use addSet(), removeSet(), or removeAllSets()',
			refs: 'Please use ref() or unref()',
			style: true,
			users: 'Please use getUser()',
			user_ids: 'Please use getUser()'
		}, true);

		overrides.iterateUsers = function*() {
			for(const user of this.iterateUsers())
				yield new Proxy(user, user_proxy);
		}

		overrides.iterateRooms = function*() {
			for(const room of this.iterateRooms())
				yield new Proxy(room, room_proxy);
		}

		overrides.iterateAllRoomsAndUsers = function*() {
			for(const thing of this.iterateAllRoomsAndUsers())
				yield new Proxy(thing, (thing instanceof Room)
					? room_proxy
					: user_proxy
				);
		}

		overrides.addTokenizer = tokenizer => {
			if ( tokenizer )
				tokenizer.__source = addon_id;

			return this.addTokenizer(tokenizer);
		}

		overrides.addLinkProvider = provider => {
			if ( provider )
				provider.__source = addon_id;

			return this.addLinkProvider(provider);
		}

		overrides.addRichProvider = provider => {
			if ( provider )
				provider.__source = addon_id;

			return this.addRichProvider(provider);
		}

		if ( is_dev ) {
			overrides.getUser = (...args) => {
				let result = this.getUser(...args);
				if ( result )
					return new Proxy(result, user_proxy);
			}

			overrides.getRoom = (...args) => {
				let result = this.getRoom(...args);
				if ( result )
					return new Proxy(result, room_proxy);
			}

			overrides.removeTokenizer = tokenizer => {
				let type;
				if ( typeof tokenizer === 'string' )
					type = tokenizer;
				else
					type = tokenizer.type;

				const existing = this.tokenizers[type];
				if ( existing && existing.__source !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned tokenizer with chat.removeTokenizer:', type, ' owner:', existing.__source ?? 'ffz');

				return this.removeTokenizer(tokenizer);
			}

			overrides.removeLinkProvider = provider => {
				let type;
				if ( typeof provider === 'string' )
					type = provider;
				else
					type = provider.type;

				const existing = this.link_providers[type];
				if ( existing && existing.__source !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned link provider with chat.removeLinkProvider:', type, ' owner:', existing.__source ?? 'ffz');

				return this.removeLinkProvider(provider);
			}

			overrides.removeRichProvider = provider => {
				let type;
				if ( typeof provider === 'string' )
					type = provider;
				else
					type = provider.type;

				const existing = this.link_providers[type];
				if ( existing && existing.__source !== addon_id )
					module.log.warn('[DEV-CHECK] Removed un-owned rich provider with chat.removeRichProvider:', type, ' owner:', existing.__source ?? 'ffz');

				return this.removeRichProvider(provider);
			}
		}

		return buildAddonProxy(module, this, 'chat', overrides, warnings);
	}



	onEnable() {
		this.socket = this.resolve('socket');
		this.pubsub = this.resolve('pubsub');

		this.on('site.subpump:pubsub-message', this.onPubSub, this);

		if ( this.context.get('chat.filtering.need-colors') )
			this.createColorCache().then(() => this.emit(':update-line-tokens'));

		for(const key in TOKENIZERS)
			if ( has(TOKENIZERS, key) )
				this.addTokenizer(TOKENIZERS[key]);

		for(const key in RICH_PROVIDERS)
			if ( has(RICH_PROVIDERS, key) )
				this.addRichProvider(RICH_PROVIDERS[key]);

		for(const key in LINK_PROVIDERS)
			if ( has(LINK_PROVIDERS, key) )
				this.addLinkProvider(LINK_PROVIDERS[key]);

		this.on('chat:reload-data', flags => {
			for(const room of this.iterateRooms())
				room.load_data();
		});

		this.on('chat:get-tab-commands', event => {
			event.commands.push({
				name: 'ffz:reload',
				description: this.i18n.t('chat.command.reload', 'Reload FFZ and add-on chat data (emotes, badges, etc.)'),
				permissionLevel: 0,
				ffz_group: 'FrankerFaceZ'
			});
		});

		this.triggered_reload = false;

		this.on('chat:ffz-command:reload', event => {
			if ( this.triggered_reload )
				return;

			const sc = this.resolve('site.chat');
			if ( sc?.addNotice )
				sc.addNotice('*', this.i18n.t('chat.command.reload.starting', 'FFZ is reloading data...'));

			this.triggered_reload = true;
			this.emit('chat:reload-data');
		});

		this.on('load_tracker:complete:chat-data', (list) => {
			if ( this.triggered_reload ) {
				const sc = this.resolve('site.chat');
				if ( sc?.addNotice )
					sc.addNotice('*', this.i18n.t('chat.command.reload.done', 'FFZ has finished reloading data. (Sources: {list})', {list: list.join(', ')}));
			}

			this.triggered_reload = false;
		});

		this.on('addon:fully-unload', addon_id => {
			let removed = 0;
			for(const [key, def] of Object.entries(this.link_providers)) {
				if ( def?.__source === addon_id ) {
					removed++;
					this.removeLinkProvider(key);
				}
			}

			for(const [key, def] of Object.entries(this.rich_providers)) {
				if ( def?.__source === addon_id ) {
					removed++;
					this.removeRichProvider(key);
				}
			}

			for(const [key, def] of Object.entries(this.tokenizers)) {
				if ( def?.__source === addon_id ) {
					removed++;
					this.removeTokenizer(key);
				}
			}

			for(const item of this.iterateAllRoomsAndUsers())
				removed += item._unloadAddon(addon_id) ?? 0;

			// If we removed things, retokenize all chat messages.
			// TODO: Debounce this.
			if ( removed ) {
				this.log.debug(`Cleaned up ${removed} entries when unloading addon:`, addon_id);
				this.emit(':update-line-tokens');
			}
		});
	}


	onPubSub(event) {
		if ( event.prefix === 'stream-chat-room-v1' && event.message.type === 'chat_rich_embed' ) {
			const data = event.message.data,
				url = data.request_url,

				providers = this.__link_providers;

			// Don't re-cache.
			if ( this._link_info[url] )
				return;

			for(const provider of providers) {
				const match = provider.test.call(this, url);
				if ( match ) {
					const processed = provider.receive ? provider.receive.call(this, match, data) : data;
					let result = provider.process.call(this, match, processed);

					if ( !(result instanceof Promise) )
						result = Promise.resolve(result);

					result.then(value => {
						// If something is already running, don't override it.
						let info = this._link_info[url];
						if ( info )
							return;

						// Save the value.
						this._link_info[url] = [true, Date.now() + 120000, value];
					});

					return;
				}
			}
		}
	}


	getUser(id, login, no_create, no_login, error = false) {
		let user;
		if ( id && typeof id === 'number' )
			id = `${id}`;

		if ( id && this.user_ids[id] )
			user = this.user_ids[id];

		else if ( login && this.users[login] && ! no_login )
			user = this.users[login];

		if ( user && user.destroyed )
			user = null;

		if ( ! user ) {
			if ( no_create )
				return null;
			else
				user = new User(this, null, id, login);
		}

		if ( id && id !== user.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes.
			if ( user.id ) {
				this.log.warn(`Data mismatch for user #${id} -- Stored ID: ${user.id} -- Login: ${login} -- Stored Login: ${user.login}`);
				if ( error )
					throw new Error('id mismatch');

				// Remove the old reference if we're going with this.
				if ( this.user_ids[user.id] === user )
					this.user_ids[user.id] = null;
			}

			// Otherwise, we're just here to set the ID.
			user._id = id;
			this.user_ids[id] = user;
		}

		if ( login ) {
			const other = this.users[login];
			if ( other ) {
				if ( other !== user && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.users[login] = user;
					else {
						user.merge(other);
						other.destroy(true);
					}
				}
			} else
				this.users[login] = user;
		}

		return user;
	}


	getRoom(id, login, no_create, no_login, error = false) {
		let room;
		if ( id && typeof id === 'number' )
			id = `${id}`;

		if ( id && this.room_ids[id] )
			room = this.room_ids[id];

		else if ( login && this.rooms[login] && ! no_login )
			room = this.rooms[login];

		if ( room && room.destroyed )
			room = null;

		if ( ! room ) {
			if ( no_create )
				return null;
			else
				room = new Room(this, id, login);
		}

		if ( id && id !== room.id ) {
			// If the ID isn't what we expected, something is very wrong here.
			// Blame name changes. Or React not being atomic.
			if ( room.id ) {
				this.log.warn(`Data mismatch for room #${id} -- Stored ID: ${room.id} -- Login: ${login} -- Stored Login: ${room.login}`);
				if ( error )
					throw new Error('id mismatch');

				// Remove the old reference if we're going with this.
				if ( this.room_ids[room.id] === room )
					this.room_ids[room.id] = null;
			}

			// Otherwise, we're just here to set the ID.
			room._id = id;
			this.room_ids[id] = room;
		}

		if ( login ) {
			const other = this.rooms[login];
			if ( other ) {
				if ( other !== room && ! no_login ) {
					// If the other has an ID, something weird happened. Screw it
					// and just take over.
					if ( other.id )
						this.rooms[login] = room;
					else {
						room.merge(other);
						other.destroy(true);
					}
				}

			} else
				this.rooms[login] = room;
		}

		return room;
	}


	*iterateAllRoomsAndUsers() {
		for(const room of this.iterateRooms()) {
			yield room;
			for(const user of room.iterateUsers())
				yield user;
		}

		for(const user of this.iterateUsers())
			yield user;
	}


	*iterateUsers() {
		const visited = new Set;

		for(const user of Object.values(this.user_ids)) {
			if ( user && ! user.destroyed ) {
				visited.add(user);
				yield user;
			}
		}

		for(const user of Object.values(this.users)) {
			if ( user && ! user.destroyed )
				yield user;
		}
	}


	*iterateRooms() {
		const visited = new Set;

		for(const room of Object.values(this.room_ids)) {
			if ( room && ! room.destroyed ) {
				visited.add(room);
				yield room;
			}
		}

		for(const room of Object.values(this.rooms)) {
			if ( room && ! room.destroyed && ! visited.has(room) )
				yield room;
		}
	}


	iterateMessages(include_chat = true, include_whisper = true, include_video = true) {
		const messages = [];
		this.emit('chat:get-messages', include_chat, include_whisper, include_video, messages);
		this.emit('chat:get-messages-late', include_chat, include_whisper, include_video, messages);
		return messages;
	}


	handleLinkClick(event) {
		if ( event.ctrlKey || event.shiftKey )
			return;

		const target = event.currentTarget,
			ds = target?.dataset;

		if ( ! ds )
			return;

		const evt = this.makeEvent({
			url: ds.url ?? target.href,
			source: event
		});

		this.emit('chat:click-link', evt);
		if ( evt.defaultPrevented ) {
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
	}


	handleReplyClick(event) {
		const target = event.target,
			fine = this.resolve('site.fine');

		if ( ! target || ! fine )
			return;

		const chat = fine.searchParent(target, n => n.props && n.props.reply && n.setOPCardTray);
		if ( chat )
			chat.setOPCardTray(chat.props.reply);
	}


	handleMentionClick(event) {
		if ( ! this.context.get('chat.filtering.clickable-mentions') )
			return;

		const target = event.target,
			ds = target && target.dataset;

		if ( ! ds || ! ds.login )
			return;

		const fine = this.resolve('site.fine');
		if ( ! fine )
			return;

		const chat = fine.searchParent(target, n => n.props && n.props.onUsernameClick);
		if ( ! chat )
			return;

		chat.props.onUsernameClick(
			ds.login,
			undefined, undefined,
			event.currentTarget.getBoundingClientRect().bottom
		);
	}


	clickToReveal(event) {
		const target = event.target;
		if ( target ) {
			if ( target._ffz_visible )
				target.textContent = '×××';
			else if ( ! this.context.get('chat.filtering.click-to-reveal') )
				return;
			else if ( target.dataset )
				target.textContent = target.dataset.text;

			target._ffz_visible = ! target._ffz_visible;
		}
	}


	standardizeWhisper(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		if ( msg._ffz_message )
			return msg._ffz_message;

		const emotes = {},
			is_action = msg.content.startsWith('/me '),
			offset = is_action ? 4 : 0,

			out = msg._ffz_message = {
				user: {...msg.from}, // Apollo seals this~
				message: msg.content.slice(offset),
				is_action,
				ffz_emotes: emotes,
				timestamp: msg.sentAt && msg.sentAt.getTime(),
				deleted: false
			};

		out.user.color = out.user.chatColor;

		if ( Array.isArray(msg.emotes) && msg.emotes.length )
			for(const emote of msg.emotes) {
				const id = emote.emoteID,
					em = emotes[id] = emotes[id] || [];

				em.push({
					startIndex: emote.from - offset,
					endIndex: emote.to - offset
				});
			}

		return out;
	}


	getUserLevel(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg || ! msg.user )
			return 0;

		if ( msg.user.login === msg.roomLogin || (msg.badges && msg.badges.broadcaster) )
			return 4;

		if ( ! msg.badges )
			return 0;

		if ( msg.badges.moderator )
			return 3;

		if ( msg.badges.vip )
			return 2;

		if ( msg.badges.subscriber )
			return 1;

		return 0;
	}


	tokenizeReply(reply) {
		if ( ! reply )
			return null;

		return [
			{
				type: 'reply',
				text: reply.parentDisplayName,
				color: (this.context.get('chat.filtering.color-mentions') && this.color_cache)
					? this.color_cache.get(reply.parentUserLogin)
					: null,
				recipient: reply.parentUserLogin
			},
			{
				type: 'text',
				text: ' '
			}
		];
	}


	applyHighlight(msg, priority, color, reason, use_null_color = false) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		const is_null = msg.mention_priority == null,
			matched = is_null || priority >= msg.mention_priority,
			higher = is_null || priority > msg.mention_priority;

		if ( msg.filters )
			msg.filters.push(`${reason}(${priority})${matched && color === false ? ':remove' : color ? `:${color}` : ''}`);

		if ( matched ) {
			msg.mention_priority = priority;

			if ( color === false ) {
				if ( higher ) {
					msg.mentioned = false;
					msg.clear_priority = priority;
					msg.mention_color = msg.highlights = null;
				}

				return;
			}

			msg.mentioned = true;
			if ( ! msg.highlights )
				msg.highlights = new Set;
		}

		if ( msg.mentioned && (msg.clear_priority == null || priority >= msg.clear_priority) ) {
			msg.highlights.add(reason);
			if ( (color || use_null_color) && (higher || ! msg.mention_color) )
				msg.mention_color = color;
		}
	}


	standardizeMessage(msg) { // eslint-disable-line class-methods-use-this
		if ( ! msg )
			return msg;

		msg.ffz_standardized = true;

		// Standardize User
		if ( msg.sender && ! msg.user )
			msg.user = msg.sender;

		if ( msg.from && ! msg.user )
			msg.user = msg.from;

		let user = msg.user;
		if ( ! user )
			user = msg.user = {};

		const ext = msg.extension || {};

		user.color = user.color || user.chatColor || ext.chatColor || null;
		user.type = user.type || user.userType || null;
		user.id = user.id || user.userID || null;
		user.login = user.login || user.userLogin || null;
		user.displayName = user.displayName || user.userDisplayName || user.login || ext.displayName;
		user.isIntl = user.login && user.displayName && user.displayName.trim().toLowerCase() !== user.login;

		if ( this.color_cache && user.color )
			this.color_cache.set(user.login, user.color);

		// Standardize Message Content
		if ( ! msg.message && msg.messageParts )
			this.detokenizeMessage(msg);

		if ( msg.content && ! msg.message ) {
			if ( msg.content.fragments )
				this.detokenizeContent(msg);
			else
				msg.message = msg.content.text;
		}

		// Standardize Emotes
		if ( ! msg.ffz_emotes )
			this.standardizeEmotes(msg);

		// Standardize Badges
		if ( ! msg.badges && user.displayBadges ) {
			const b = msg.badges = {};
			for(const item of user.displayBadges)
				b[item.setID] = item.version;
		}

		if ( ! msg.badges && ext.displayBadges ) {
			const b = msg.badges = {};
			for(const item of ext.displayBadges)
				b[item.setID] = item.version;
		}

		// Validate User Type
		if ( user.type == null && msg.badges && msg.badges.moderator )
			user.type = 'mod';

		// Standardize Timestamp
		if ( ! msg.timestamp && msg.sentAt )
			msg.timestamp = new Date(msg.sentAt).getTime();

		// Standardize Deletion
		if ( msg.deletedAt !== undefined )
			msg.deleted = !!msg.deletedAt;

		// Addon Badges
		msg.ffz_badges = this.badges.getBadges(user.id, user.login, msg.roomID, msg.roomLogin);

		return msg;
	}


	standardizeEmotes(msg) { // eslint-disable-line class-methods-use-this
		if ( msg.emotes && msg.message ) {
			const emotes = {},
				chars = split_chars(msg.message);

			let offset = 0;
			if ( msg.message && msg.messageBody && msg.message !== msg.messageBody )
				offset = chars.length - split_chars(msg.messageBody).length;

			for(const key in msg.emotes)
				if ( has(msg.emotes, key) ) {
					const raw_emote = msg.emotes[key];
					if ( Array.isArray(raw_emote) )
						return msg.ffz_emotes = msg.emotes;

					const em = emotes[raw_emote.id] = emotes[raw_emote.id] || [];
					let idx = raw_emote.startIndex + 1 + offset;
					while(idx < chars.length) {
						if ( EMOTE_CHARS.test(chars[idx]) )
							break;

						idx++;
					}

					em.push({
						startIndex: raw_emote.startIndex + offset,
						endIndex: idx - 1
					});
				}

			msg.ffz_emotes = emotes;
			return;
		}

		if ( msg.messageParts )
			this.detokenizeMessage(msg, true);

		else if ( msg.content && msg.content.fragments )
			this.detokenizeContent(msg, true);
	}


	detokenizeContent(msg, emotes_only = false) { // eslint-disable-line class-methods-use-this
		const out = [],
			parts = msg.content.fragments,
			l = parts.length,
			emotes = {};

		let idx = 0, ret, first = true;

		for(let i=0; i < l; i++) {
			const part = parts[i],
				content = part.content,
				ct = content && content.__typename;

			ret = part.text;

			if ( ct === 'Emote' ) {
				const id = content.emoteID,
					em = emotes[id] = emotes[id] || [];

				em.push({startIndex: idx, endIndex: idx + ret.length - 1});
			}

			if ( ret && ret.length ) {
				if ( first && ret.startsWith('/me ') ) {
					msg.is_action = true;
					ret = ret.slice(4);
				}

				idx += split_chars(ret).length;
				out.push(ret);
			}

			first = false;
		}

		if ( ! emotes_only )
			msg.message = out.join('');

		msg.ffz_emotes = emotes;
		return msg;
	}


	detokenizeMessage(msg, emotes_only = false) { // eslint-disable-line class-methods-use-this
		const out = [],
			parts = msg.messageParts,
			l = parts.length,
			emotes = {};

		let idx = 0, ret, last_type = null, bits = 0;

		for(let i=0; i < l; i++) {
			const part = parts[i],
				content = part.ffz_content ?? part.content;

			if ( ! content )
				continue;

			if ( typeof content === 'string' )
				ret = content;

			else if ( content.recipient )
				ret = `@${content.recipient}`;

			else if ( content.url )
				ret = content.url;

			else if ( content.cheerAmount ) {
				bits += content.cheerAmount;
				ret = `${content.alt}${content.cheerAmount}`;

			} else if ( content.images ) {
				const url = (content.images.themed ? content.images.dark : content.images.sources);
				let id = content.emoteID;
				if ( ! id ) {
					const match = url && (
						/\/emoticons\/v1\/(\d+)\/[\d.]+$/.exec(url['1x']) ||
						/\/emoticons\/v2\/(\d+)\//.exec(url['1x'])
					);
					id = match && match[1];
				}

				ret = content.alt;

				if ( id ) {
					const em = emotes[id] = emotes[id] || [],
						offset = last_type > 0 ? 1 : 0;

					em.push({startIndex: idx + offset, endIndex: idx + ret.length - 1});
				}

				if ( last_type > 0 )
					ret = ` ${ret}`;

			} else
				continue;

			if ( ret ) {
				idx += split_chars(ret).length;
				last_type = part.type;
				out.push(ret)
			}
		}

		if ( ! emotes_only )
			msg.message = out.join('');

		msg.bits = bits;
		msg.ffz_emotes = emotes;
		return msg;
	}


	/**
	 * Format a user block. This uses our use "chat.name-format" style.
	 *
	 * @param {Object} user The user object we're rendering.
	 * @param {Function} e createElement method, either from React or utilities/dom.
	 * @returns {Array} Array of rendered elements.
	 */
	formatUser(user, e) {
		const setting = this.context.get('chat.name-format');
		const name = setting === 2 && user.isIntl ? user.login : (user.displayName || user.login);

		const out = [e('span', {
			className: 'chat-author__display-name'
		}, name)];

		if ( setting === 0 && user.isIntl )
			out.push(e('span', {
				className: 'chat-author__intl-login'
			}, ` (${user.login})`));

		return out;
	}


	formatTime(time) {
		if (!( time instanceof Date ))
			time = new Date(time);

		const fmt = this.context.get('chat.timestamp-format'),
			d = dayjs(time);

		try {
			return d.locale(this.i18n.locale).format(fmt);
		} catch(err) {
			// If the locale isn't loaded, this can fail.
			return d.format(fmt);
		}
	}


	addHighlightReason(key, data) {
		if ( typeof key === 'object' && key.key ) {
			data = key;
			key = data.key;

		} else if ( typeof data === 'string' )
			data = {title: data};

		data.value = data.key = key;
		if ( ! data.i18n_key )
			data.i18n_key = `hl-reason.${key}`;

		if ( this._hl_reasons[key] )
			throw new Error(`Highlight Reason already exists with key ${key}`);

		this._hl_reasons[key] = data;
	}

	getHighlightReasons() {
		return Object.values(this._hl_reasons);
	}

	addTokenizer(tokenizer) {
		const type = tokenizer.type;
		if ( has(this.tokenizers, type) ) {
			this.log.warn(`Tried adding tokenizer of type '${type}' when one was already present.`);
			return;
		}

		this.tokenizers[type] = tokenizer;
		if ( tokenizer.priority == null )
			tokenizer.priority = 0;

		if ( tokenizer.tooltip ) {
			const tt = tokenizer.tooltip;
			const tk = this.tooltips.types[type] = tt.bind(this);

			for(const i of ['interactive', 'delayShow', 'delayHide', 'onShow', 'onHide'])
				tk[i] = typeof tt[i] === 'function' ? tt[i].bind(this) : tt[i];
		}

		this.__tokenizers.push(tokenizer);
		this.__tokenizers.sort((a, b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});
	}

	removeTokenizer(tokenizer) {
		let type;
		if ( typeof tokenizer === 'string' ) type = tokenizer;
		else type = tokenizer.type;

		tokenizer = this.tokenizers[type];
		if ( ! tokenizer )
			return null;

		delete this.tokenizers[type];

		if ( tokenizer.tooltip )
			delete this.tooltips.types[type];

		const idx = this.__tokenizers.indexOf(tokenizer);
		if ( idx !== -1 )
			this.__tokenizers.splice(idx, 1);

		return tokenizer;
	}

	addLinkProvider(provider) {
		const type = provider.type;
		if ( has(this.link_providers, type) ) {
			this.log.warn(`Tried adding link provider of type '${type}' when one was already present.`);
			return;
		}

		this.link_providers[type] = provider;
		if ( provider.priority == null )
			provider.priority = 0;

		this.__link_providers.push(provider);
		this.__link_providers.sort((a,b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});
	}

	removeLinkProvider(provider) {
		let type;
		if ( typeof provider === 'string' ) type = provider;
		else type = provider.type;

		provider = this.link_providers[type];
		if ( ! provider )
			return null;

		delete this.link_providers[type];

		const idx = this.__link_providers.indexOf(provider);
		if ( idx !== -1 )
			this.__link_providers.splice(idx, 1);

		return provider;
	}

	addRichProvider(provider) {
		const type = provider.type;
		if ( has(this.rich_providers, type) ) {
			this.log.warn(`Tried adding rich provider of type '${type}' when one was already present.`);
			return;
		}

		this.rich_providers[type] = provider;
		if ( provider.priority == null )
			provider.priority = 0;

		this.__rich_providers.push(provider);
		this.__rich_providers.sort((a,b) => {
			if ( a.priority > b.priority ) return -1;
			if ( a.priority < b.priority ) return 1;
			return a.type < b.type;
		});
	}

	removeRichProvider(provider) {
		let type;
		if ( typeof provider === 'string' ) type = provider;
		else type = provider.type;

		provider = this.rich_providers[type];
		if ( ! provider )
			return null;

		delete this.rich_providers[type];

		const idx = this.__rich_providers.indexOf(provider);
		if ( idx !== -1 )
			this.__rich_providers.splice(idx, 1);

		return provider;
	}


	tokenizeString(message, msg, user, haltable = false) {
		let tokens = [{type: 'text', text: message}];

		for(const tokenizer of this.__tokenizers) {
			if ( ! tokenizer.process )
				continue;

			const new_tokens = tokenizer.process.call(this, tokens, msg, user, haltable);
			if ( new_tokens )
				tokens = new_tokens;

			if ( haltable && msg.ffz_halt_tokens ) {
				msg.ffz_halt_tokens = undefined;
				break;
			}
		}

		return tokens;
	}


	pluckRichContent(tokens, msg) { // eslint-disable-line class-methods-use-this
		if ( ! this.context.get('chat.rich.enabled') || this.context.get('chat.rich.minimum-level') > this.getUserLevel(msg) )
			return;

		if ( ! Array.isArray(tokens) )
			return;

		const providers = this.__rich_providers;

		const want_mid = this.context.get('chat.rich.want-mid');

		for(const token of tokens) {
			if ( token.allow_rich ?? true )
				for(const provider of providers)
					if ( provider.test.call(this, token, msg) ) {
						token.hidden = provider.can_hide_token && (this.context.get('chat.rich.hide-tokens') || provider.hide_token);
						return provider.process.call(this, token, want_mid);
					}
		}
	}


	tokenizeMessage(msg, user, haltable = false) {
		if ( msg.content && ! msg.message )
			msg.message = msg.content.text;

		if ( msg.sender && ! msg.user )
			msg.user = msg.sender;

		if ( ! msg.message )
			return [];

		let tokens = [{type: 'text', text: msg.message}];

		for(const tokenizer of this.__tokenizers) {
			if ( ! tokenizer.process )
				continue;

			const new_tokens = tokenizer.process.call(this, tokens, msg, user, haltable);
			if ( new_tokens )
				tokens = new_tokens;

			if ( haltable && msg.ffz_halt_tokens ) {
				msg.ffz_halt_tokens = undefined;
				break;
			}
		}

		return tokens || [];
	}


	renderTokens(tokens, e, reply) {
		if ( ! e )
			e = createElement;

		const out = [],
			tokenizers = this.tokenizers,
			l = tokens.length;

		const hidden = this.context.get('chat.filtering.hidden-tokens');

		for(let i=0; i < l; i++) {
			const token = tokens[i],
				type = token.type,
				tk = tokenizers[type];

			if ( token.hidden || hidden.has(type) )
				continue;

			let res;

			// If we have a reply, skip the initial mention.
			if ( reply && i === 0 && type === 'mention' && token.recipient && token.recipient === reply.parentUserLogin )
				continue;

			if ( type === 'text' )
				res = e('span', {
					className: 'text-fragment',
					'data-a-target': 'chat-message-text'
				}, token.text);

			else if ( tk )
				res = tk.render.call(this, token, e, reply);

			else
				res = e('em', {
					className: 'ffz-unknown-token ffz-tooltip',
					'data-tooltip-type': 'json',
					'data-data': JSON.stringify(token, null, 2)
				}, `[unknown token: ${type}]`)

			if ( res )
				out.push(res);
		}

		return out;
	}


	// ====
	// Twitch Crap
	// ====

	clearLinkCache(url) {
		if ( url ) {
			const info = this._link_info[url];
			if ( ! info[0] ) {
				for(const pair of info[2])
					pair[1]();
			}

			this._link_info[url] = null;
			this.emit(':update-link-resolver', url);
			return;
		}

		const old = this._link_info;
		this._link_info = {};

		for(const info of Object.values(old)) {
			if ( ! info[0] ) {
				for(const pair of info[2])
					pair[1]();
			}
		}

		this.emit(':update-link-resolver');
	}


	get_link_info(url, no_promises, refresh = false) {
		let info = this._link_info[url];
		const expires = info && info[1];

		if ( (info && info[0] && refresh) || (expires && Date.now() > expires) )
			info = this._link_info[url] = null;

		if ( info && info[0] )
			return no_promises ? info[2] : Promise.resolve(info[2]);

		if ( no_promises )
			return null;

		else if ( info )
			return new Promise((resolve, reject) => info[2].push([resolve, reject]))

		return new Promise((resolve, reject) => {
			info = this._link_info[url] = [false, null, [[resolve, reject]]];

			const handle = (success, data) => {
				data = this.fixLinkInfo(data);

				const callbacks = ! info[0] && info[2];
				info[0] = true;
				info[1] = Date.now() + 120000;
				info[2] = success ? data : null;

				if ( callbacks )
					for(const cbs of callbacks)
						cbs[success ? 0 : 1](data);
			}

			// Try using a link provider.
			for(const lp of this.__link_providers) {
				const match = lp.test.call(this, url);
				if ( match ) {
					timeout(lp.process.call(this, match), 15000)
						.then(data => handle(true, data))
						.catch(err => handle(false, err));
					return;
				}
			}

			let provider = this.settings.get('debug.link-resolver.source').value;
			if ( provider === 'special:socket' && ! this.socket )
				provider = LINK_DATA_HOSTS.test.value;

			if ( provider === 'special:socket' ) {
				timeout(this.socket.call('get_link', url), 15000)
					.then(data => handle(true, data))
					.catch(err => handle(false, err));
			} else {
				timeout(fetch(`${provider}?url=${encodeURIComponent(url)}`).then(r => r.json()), 15000)
					.then(data => handle(true, data))
					.catch(err => handle(false, err));
			}
		});
	}

	fixLinkInfo(data) {
		if ( ! data )
			return data;

		if ( data.error && data.message )
			data.error = data.message;

		if ( data.error )
			data = {
				v: 5,
				title: this.i18n.t('card.error', 'An error occurred.'),
				description: data.error,
				short: {
					type: 'header',
					image: {type: 'image', url: ERROR_IMAGE},
					title: {type: 'i18n', key: 'card.error', phrase: 'An error occurred.'},
					subtitle: data.error
				},
				unsafe: data.unsafe,
				urls: data.urls
			}

		if ( data.v < 5 && ! data.short && ! data.full && (data.title || data.desc_1 || data.desc_2) ) {
			const image = data.preview || data.image;

			data = {
				v: 5,
				short: {
					type: 'header',
					image: image ? {
						type: 'image',
						url: image,
						sfw: data.image_safe ?? false,
					} : null,
					title: data.title,
					subtitle: data.desc_1,
					extra: data.desc_2
				}
			}
		}

		return data;
	}
}
