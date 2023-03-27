'use strict';

// ============================================================================
// Chat Emote Menu
// ============================================================================

import {has, get, once, maybe_call, set_equals, getTwitchEmoteURL, getTwitchEmoteSrcSet, deep_equals} from 'utilities/object';
import {TWITCH_GLOBAL_SETS, EmoteTypes, TWITCH_POINTS_SETS, TWITCH_PRIME_SETS, WEBKIT_CSS as WEBKIT, IS_OSX, KNOWN_CODES, REPLACEMENT_BASE, REPLACEMENTS, KEYS} from 'utilities/constants';
import {HIDDEN_CATEGORIES, CATEGORIES, CATEGORY_SORT, IMAGE_PATHS} from 'src/modules/chat/emoji';
import {ClickOutside} from 'utilities/dom';

import Twilight from 'site';
import Module from 'utilities/module';

import SUB_STATUS from './sub_status.gql';
//import Tooltip from 'src/utilities/tooltip';

const TIERS = {
	1000: 'Tier 1',
	2000: 'Tier 2',
	3000: 'Tier 3'
};

const TONE_EMOJI = [
	'the_horns',
	'raised_back_of_hand',
	'ok_hand',
	'+1',
	'clap',
	'fist',
	'pinched_fingers',
	'wave',
	'pinch',
	'victory',
	'love_you_gesture'
];

function maybe_date(val) {
	if ( ! val )
		return val;

	try {
		return new Date(val);
	} catch(err) {
		return null;
	}
}


const COLLATOR = window?.Intl?.Collator && new Intl.Collator(undefined, {numeric: true});


const EMOTE_SORTERS = [
	function id_asc(a, b) {
		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return -1;
		if ( a.id > b.id ) return 1;
		return 0;
	},
	function id_desc(a, b) {
		if ( COLLATOR )
			return COLLATOR.compare(b.id, a.id);

		if ( a.id > b.id ) return -1;
		if ( a.id < b.id ) return 1;
		return 0;
	},
	function name_asc(a, b) {
		const a_n = a.name.toLowerCase(),
			b_n = b.name.toLowerCase();

		if ( a_n < b_n ) return -1;
		if ( a_n > b_n ) return 1;

		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return -1;
		if ( a.id > b.id ) return 1;
		return 0;
	},
	function name_desc(a, b) {
		const a_n = a.name.toLowerCase(),
			b_n = b.name.toLowerCase();

		if ( a_n > b_n ) return -1;
		if ( a_n < b_n ) return 1;

		if ( COLLATOR )
			return COLLATOR.compare(b.id, a.id);

		if ( a.id > b.id ) return -1;
		if ( a.id < b.id ) return 1;
		return 0;
	},
	function native_asc(a, b) {
		if ( a.order != null || b.order != null ) {
			if ( a.order && b.order == null ) return -1;
			if ( b.order && a.order == null ) return 1;

			if ( a.order < b.order ) return -1;
			if ( a.order > b.order ) return 1;
		}

		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return -1;
		if ( a.id > b.id ) return 1;
		return 0;
	},
	function native_desc(a, b) {
		if ( a.order != null || b.order != null ) {
			if ( a.order && b.order == null ) return 1;
			if ( b.order && a.order == null ) return -1;

			if ( a.order < b.order ) return 1;
			if ( a.order > b.order ) return -1;
		}

		if ( COLLATOR )
			return COLLATOR.compare(a.id, b.id);

		if ( a.id < b.id ) return 1;
		if ( a.id > b.id ) return -1;
		return 0;
	}
];


function sort_sets(a, b) {
	const a_sk = a.sort_key,
		b_sk = b.sort_key;

	if ( a_sk < b_sk ) return -1;
	if ( b_sk < a_sk ) return 1;

	const a_n = a.title.toLowerCase(),
		b_n = b.title.toLowerCase();

	if ( a_n < b_n ) return -1;
	if ( b_n < a_n ) return 1;
	return 0;
}


export default class EmoteMenu extends Module {
	constructor(...args) {
		super(...args);

		this.inject('staging');
		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('chat.badges');
		this.inject('chat.emotes');
		this.inject('chat.emoji');

		this.inject('site');
		this.inject('site.fine');
		this.inject('site.apollo');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');

		this.SUB_STATUS = SUB_STATUS;

		this.settings.add('chat.emote-menu.shortcut', {
			default: false,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Use Ctrl+E to open the Emote Menu.',
				description: 'When enabled and you press Ctrl+E with the chat input focused, the emote menu will open.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.modifiers', {
			default: 0,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Emote Modifiers',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'In-Line'}
				]
			}
		});

		this.settings.add('chat.emote-menu.clear-search', {
			default: false,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Reset search when closing the Emote Menu.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.enabled', {
			default: true,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Use the FrankerFaceZ Emote Menu.',
				description: 'The FFZ emote menu replaces the built-in Twitch emote menu and provides enhanced functionality.',
				component: 'setting-check-box'
			},
			changed: () => this.EmoteMenu.forceUpdate()
		});

		this.settings.add('chat.emote-menu.icon', {
			requires: ['chat.emote-menu.enabled', 'context.bttv.emote_menu'],
			default: false,
			process(ctx, val) {
				if ( ! ctx.get('chat.emote-menu.enabled') )
					return false;

				return ctx.get('context.bttv.emote_menu') || val;
			},

			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Replace the emote menu icon with the FFZ icon for that classic feel.',
				description: '**Note:** This setting may be forcibly enabled if other emote menus are detected, to ensure you can visually identify the FFZ Emote Menu.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.show-quick-nav', {
			default: false,
			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Show a quick navigation bar along the side of the menu.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.tall', {
			default: false,
			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Use extra height for the emote menu.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.show-heading', {
			default: 1,
			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Show Headers',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Never'},
					{value: 1, title: 'Always'},
					{value: 2, title: 'When Not Searching'}
				]
			}
		});

		this.settings.add('chat.emote-menu.show-search', {
			default: true,
			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Show the search box.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.reduced-padding', {
			default: false,
			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Use reduced padding.',
				component: 'setting-check-box'
			}
		});


		this.settings.add('chat.emote-menu.default-tab', {
			default: 'channel',
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Default Tab',
				component: 'setting-select-box',
				data: [
					{value: 'fav', title: 'Favorites'},
					{value: 'channel', title: 'Channel'},
					{value: 'effect', title: 'Emote Effects'},
					{value: 'all', title: 'My Emotes'},
					{value: 'emoji', title: 'Emoji'}
				]
			}
		});

		this.settings.add('chat.emote-menu.effect-tab', {
			default: true,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Display Emote Effects in their own tab.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.show-emoji', {
			default: true,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Display emoji in the emote menu.',
				component: 'setting-check-box'
			}
		});


		this.settings.add('chat.emote-menu.combine-tabs', {
			default: false,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Display all emotes on one tab.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.emote-menu.stay-loaded', {
			requires: ['chat.emote-menu.combine-tabs'],
			default: null,
			process(ctx, val) {
				if ( val == null )
					val = ctx.get('chat.emote-menu.combine-tabs');
				return val;
			},
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Stay loaded after opening.',
				component: 'setting-check-box',
				description: `This causes the emote menu to stay in the DOM even when it's not visible. Enabling this may help the site perform better when opening the menu if it's slow. By default, this setting is enabled when using \`Display all emotes on one tab.\``
			}
		});

		this.settings.add('chat.emote-menu.sort-emotes', {
			default: 4,
			ui: {
				path: 'Chat > Emote Menu >> Sorting',
				title: 'Sort Emotes By',
				component: 'setting-select-box',
				data: [
					{value: 4, title: 'Native Order, Ascending'},
					{value: 5, title: 'Native Order, Descending'},
					{value: 0, title: 'Order Added (ID), Ascending'},
					{value: 1, title: 'Order Added (ID), Descending'},
					{value: 2, title: 'Name, Ascending'},
					{value: 3, title: 'Name, Descending'}
				]
			}
		});

		this.settings.add('chat.emote-menu.sort-tiers-last', {
			default: true,
			ui: {
				path: 'Chat > Emote Menu >> Sorting',
				title: 'List emotes from higher sub tiers last.',
				component: 'setting-check-box'
			}
		});


		this.EmoteMenu = this.fine.define(
			'chat-emote-menu',
			n => n.getAllEmoteSets && n.getSortedChannelEmotes && n.props?.emotePickerSource,
			//n => n.subscriptionProductHasEmotes,
			Twilight.CHAT_ROUTES
		)


		this.MenuWrapper = this.fine.wrap('ffz-emote-menu');
		//this.MenuSection = this.fine.wrap('ffz-menu-section');
		//this.MenuEmote = this.fine.wrap('ffz-menu-emote');
	}

	async onEnable() {
		this.on('i18n:update', () => this.EmoteMenu.forceUpdate());
		this.on('chat.emotes:update-default-sets', this.maybeUpdate, this);
		this.on('chat.emotes:update-user-sets', this.maybeUpdate, this);
		this.on('chat.emotes:update-room-sets', this.maybeUpdate, this);
		this.on('chat.emotes:loaded', this.maybeUpdate, this);
		this.on('chat.emotes:change-favorite', this.maybeUpdate, this);
		this.on('chat.emotes:change-hidden', this.maybeUpdate, this);
		this.on('chat.emoji:populated', this.maybeUpdate, this);

		this.chat.context.on('changed:chat.emote-menu.enabled', () =>
			this.EmoteMenu.forceUpdate());

		const rebuild = () => {
			for(const inst of this.MenuWrapper.instances)
				inst.rebuildData();
		}

		this.chat.context.on('changed:chat.emotes.enabled', rebuild);
		this.chat.context.on('changed:chat.emote-menu.modifiers', rebuild);
		this.chat.context.on('changed:chat.emote-menu.show-emoji', rebuild);
		this.chat.context.on('changed:chat.fix-bad-emotes', rebuild);
		this.chat.context.on('changed:chat.emote-menu.effect-tab', rebuild);
		this.chat.context.on('changed:chat.emote-menu.sort-emotes', rebuild);
		this.chat.context.on('changed:chat.emote-menu.sort-tiers-last', rebuild);

		this.chat.context.on('changed:chat.emoji.style', this.updateEmojiVariables, this);

		this.chat.context.getChanges('chat.emote-menu.icon', val =>
			this.css_tweaks.toggle('emote-menu', val));

		this.updateEmojiVariables();

		this.css_tweaks.setVariable('emoji-menu--sheet', `//cdn.frankerfacez.com/static/emoji/images/sheet-twemoji-36.png`);
		this.css_tweaks.setVariable('emoji-menu--count', 58);
		this.css_tweaks.setVariable('emoji-menu--size', 36);

		const t = this,
			React = await this.web_munch.findModule('react'),
			createElement = React && React.createElement;

		if ( ! createElement )
			return t.log.warn('Unable to get React.');

		this.defineClasses();


		this.EmoteMenu.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				this._ffz_no_scan = false;

				if ( ! this.props || ! has(this.props, 'channelID') || ! t.chat.context.get('chat.emote-menu.enabled') ) {
					return old_render.call(this);
				}

				return (<t.MenuErrorWrapper visible={this.props.visible}>
					<t.MenuComponent
						source={this.props.emotePickerSource}
						visible={this.props.visible}
						toggleVisibility={this.props.toggleVisibility}
						channel_data={this.props.channelData}
						emote_data={this.props.emoteSetsData}
						user_id={this.props.currentUserID}
						channel_id={this.props.channelID}
						loading={this.props.channelData?.loading || this.props.emoteSetsData?.loading}
						error={this.props.channelData?.error || this.props.emoteSetsData?.error}
						onClickToken={this.props.onClickToken}
					/>
				</t.MenuErrorWrapper>)
			}

			this.EmoteMenu.forceUpdate();
		})
	}

	updateEmojiVariables() {

		const style = this.chat.context.get('chat.emoji.style') || 'twitter',
			base = `//cdn.frankerfacez.com/static/emoji/images/sheet-${IMAGE_PATHS[style] || 'twemoji'}-`;

		const emoji_size = this.emoji_size = 36,
			sheet_count = this.emoji_sheet_count = 58,
			sheet_size = this.emoji_sheet_size = sheet_count * (emoji_size + 2),
			sheet_pct = this.emoji_sheet_pct = 100 * sheet_size / emoji_size;

		this.emoji_sheet_remain = sheet_size - emoji_size;

		this.css_tweaks.set('emoji-menu', `.ffz--emoji-tone-picker__emoji,.emote-picker__emoji .emote-picker__emote-figure {
	background-size: ${sheet_pct}% ${sheet_pct}%;
	background-image: url("${base}36.png");
	background-image: ${WEBKIT}image-set(
		url("${base}18.png") 0.5x,
		url("${base}36.png") 1x,
		url("${base}72.png") 2x
	);
}`);
	}

	maybeUpdate() {
		if ( ! this.chat.context.get('chat.emote-menu.enabled') )
			return;

		for(const inst of this.MenuWrapper.instances)
			inst.rebuildData();
	}


	defineClasses() {
		const t = this,
			storage = this.settings.provider,
			React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		this.EmojiTonePicker = class FFZEmojiTonePicker extends React.Component {
			constructor(props) {
				super(props);

				this.onClick = () => this.setState({open: ! this.state.open});
				this.onMouseEnter = () => this.state.open || this.setState({emoji: this.pickRandomEmoji()});
				this.onClickOutside = () => this.state.open && this.setState({open: false});

				this.clickTone = event => {
					this.props.pickTone(event.currentTarget.dataset.tone);
					this.setState({open: false});
				}

				this.element = null;
				this.saveRef = element => this.element = element;

				this.state = {
					open: false,
					emoji: this.pickRandomEmoji(),
					tone: null
				}
			}

			componentDidMount() {
				if ( this.element )
					this._clicker = new ClickOutside(this.element, this.onClickOutside);
			}

			componentWillUnmount() {
				if ( this._clicker ) {
					this._clicker.destroy();
					this._clicker = null;
				}
			}

			pickRandomEmoji() { // eslint-disable-line class-methods-use-this
				const possibilities = this.props.choices,
					pick = Math.floor(Math.random() * possibilities.length);

				return possibilities[pick];
			}

			renderTone(data, tone) {
				if ( ! data )
					return null;

				return (<button
					key={data.code}
					data-tone={tone}
					class="tw-interactive tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive tw-pd-y-05 tw-pd-x-2"
					onClick={this.clickTone}
				>
					{this.renderEmoji(data)}
				</button>)
			}

			renderToneMenu() {
				if ( ! this.state.open )
					return null;

				const emoji = this.state.emoji;
				if ( ! emoji || ! emoji.variants )
					return null;

				const tones = Object.entries(emoji.variants).map(([tone, emoji]) => this.renderTone(emoji, tone));

				return (<div class="tw-absolute ffz-balloon ffz-il-tooltip--up ffz-il-tooltip--align-right ffz-balloon tw-block">
					<div class="tw-border-b tw-border-l tw-border-r tw-border-t tw-border-radius-medium tw-c-background-base tw-elevation-1">
						{this.renderTone(emoji, null)}
						{tones}
					</div>
				</div>);
			}

			renderEmoji(data) { // eslint-disable-line class-methods-use-this
				if ( ! data )
					return null;

				const emoji_x = (data.sheet_x * (t.emoji_size + 2)) + 1,
					emoji_y = (data.sheet_y * (t.emoji_size + 2)) + 1,

					x_pct = 100 * emoji_x / t.emoji_sheet_remain,
					y_pct = 100 * emoji_y / t.emoji_sheet_remain;

				return (<figure
					class="ffz--emoji-tone-picker__emoji"
					style={{
						backgroundPosition: `${x_pct}% ${y_pct}%`
					}}
				/>)
			}

			render() {
				const emoji = this.state.emoji,
					tone = this.props.tone,
					toned = tone && emoji.variants[tone];

				return (<div ref={this.saveRef} class="ffz--emoji-tone-picker tw-relative tw-mg-l-1">
					<button
						class="tw-interactive tw-button tw-button--dropmenu ffz-button--hollow"
						onClick={this.onClick}
						onMouseEnter={this.onMouseEnter}
					>
						<span class="tw-button__text">
							{this.renderEmoji(toned || emoji)}
						</span>
						<span class="tw-button__icon tw-button__icon--right">
							<figure class="ffz-i-down-dir" />
						</span>
					</button>
					{this.renderToneMenu()}
				</div>)
			}
		}

		this.MenuSection = class FFZMenuSection extends React.Component {
			constructor(props) {
				super(props);

				this.ref = null;
				this.saveRef = ref => {
					if ( this.ref )
						this.props.stopObserving(this.ref);

					this.ref = ref;
					if ( ref )
						this.props.startObserving(this.ref, this);
				}

				const collapsed = storage.get('emote-menu.collapsed'),
					hidden = storage.get('emote-menu.hidden-sets');

				this.state = {
					active: false,
					activeEmote: -1,
					hidden: hidden && props.data && hidden.includes(props.data.hide_key || props.data.key),
					collapsed: collapsed && props.data && collapsed.includes(props.data.key),
					intersecting: window.IntersectionObserver ? false : true
				}

				this.keyHeading = this.keyHeading.bind(this);
				this.clickHeading = this.clickHeading.bind(this);
				this.clickEmote = this.clickEmote.bind(this);

				this.mouseEnter = () => this.state.intersecting || this.setState({intersecting: true});

				this.onMouseEnter = this.onMouseEnter.bind(this);
				this.onMouseLeave = this.onMouseLeave.bind(this);
			}

			componentDidMount() {
				this.props.addSection(this);

				if ( this.ref )
					this.props.startObserving(this.ref, this);
			}

			componentWillUnmount() {
				this.props.removeSection(this);

				if ( this.ref )
					this.props.stopObserving(this.ref);
			}

			keyInteract(code) { // eslint-disable-line
				/* no-op */
			}

			clickEmote(event) {
				if ( this.props.visibility_control ) {
					const ds = event.currentTarget.dataset;
					let source, id = ds.id;

					if ( ds.provider === 'twitch' )
						source = 'twitch';
					else if ( ds.provider === 'ffz' ) {
						const emote_set = t.emotes.emote_sets[ds.set],
							emote = emote_set && emote_set.emotes[id];

						if ( ! emote )
							return;

						source = emote_set.source || 'ffz';
						id = emote.id;

					} else
						return;

					t.emotes.toggleHidden(source, id);
					return;
				}

				if ( t.emotes.handleClick(event, true) )
					return;

				// Check for magic.
				let prefix = '';
				const effects = event.currentTarget.dataset.effects;
				if ( effects?.length > 0 && effects != '0' && t.emotes.target_emote )
					prefix = `${t.emotes.target_emote.name} `;

				this.props.onClickToken(`${prefix}${event.currentTarget.dataset.name}`);
			}

			keyHeading(event) {
				if ( event.keyCode === KEYS.Enter || event.keyCode === KEYS.Space )
					this.clickHeading();
			}

			clickHeading() {
				if ( this.props.visibility_control ) {
					const hidden = storage.get('emote-menu.hidden-sets') || [],
						key = this.props.data.hide_key || this.props.data.key,
						idx = hidden.indexOf(key);

					if ( key === 'twitch-current-channel' )
						return;

					if ( idx === -1 ) {
						hidden.push(key);
						this.setState({hidden: true});
					} else {
						hidden.splice(idx, 1);
						this.setState({hidden: false});
					}

					storage.set('emote-menu.hidden-sets', hidden);
					t.emit('chat.emotes:change-set-hidden', key);
					return;
				}

				if ( this.props.filtered )
					return;

				const collapsed = storage.get('emote-menu.collapsed') || [],
					val = ! this.state.collapsed,
					key = this.props.data.key,
					idx = collapsed.indexOf(key);

				this.setState({collapsed: val});

				if ( val && idx === -1 )
					collapsed.push(key);
				else if ( ! val && idx !== -1 )
					collapsed.splice(idx, 1);
				else
					return;

				storage.set('emote-menu.collapsed', collapsed);
			}

			onMouseEnter(event) {
				const set_id = event.currentTarget.dataset.setId;
				this.setState({unlocked: set_id});
			}

			onMouseLeave() {
				this.setState({unlocked: null});
			}

			render() {
				const data = this.props.data,
					filtered = this.props.filtered,
					visibility = this.props.visibility_control;

				let show_heading = ! (data.is_favorites && ! this.props.combineTabs) && this.props.showHeading;
				if ( show_heading === 2 )
					show_heading = ! filtered;
				else
					show_heading = !! show_heading;

				if ( visibility )
					show_heading = true;

				const hidden = visibility ? this.state.hidden : false,
					collapsed = visibility ? hidden : (show_heading && ! filtered && this.state.collapsed);

				if ( ! data )
					return null;

				let image;
				if ( data.image )
					image = (<img class={`ffz--menu-badge${data.image_large ? ' ffz--menu-badge__large' : ''}`} src={data.image} srcSet={data.image_set} />);
				else
					image = (<figure class={`ffz--menu-badge ffz-i-${data.icon || 'zreknarf'}`} />);

				let calendar;

				const renews = data.renews && data.renews.getTime(),
					ends = data.ends && data.ends.getTime();

				if ( renews > 0 ) {
					calendar = {
						icon: 'calendar',
						message: t.i18n.t('emote-menu.sub-renews', 'This sub renews {seconds,humantime}.', {seconds: renews})
					}

				} else if ( ends ) {
					if ( data.prime )
						calendar = {
							icon: 'crown',
							message: t.i18n.t('emote-menu.sub-prime', 'This is your free sub with Prime Gaming.\nIt ends {seconds,humantime}.', {seconds: ends})
						}
					else if ( data.gift )
						calendar = {
							icon: 'gift',
							message: t.i18n.t('emote-menu.sub-gift-ends', 'This gifted sub ends {seconds,humantime}.', {seconds: ends})
						}
					else
						calendar = {
							icon: 'calendar-empty',
							message: t.i18n.t('emote-menu.sub-ends', 'This sub ends {seconds,humantime}.', {seconds: ends})
						}
				}

				let source = data.source_i18n ? t.i18n.t(data.source_i18n, data.source) : data.source;
				if ( source == null )
					source = 'FFZ';

				return (<section ref={this.saveRef} data-key={data.key} class={filtered ? 'filtered' : ''} onMouseEnter={this.mouseEnter}>
					{show_heading ? (<heading tabindex="0" class="tw-pd-1 tw-border-b tw-flex tw-flex-nowrap" onKeyDown={this.keyHeading} onClick={this.clickHeading}>
						{image}
						<div class="tw-pd-l-05">
							{(data.i18n ? t.i18n.t(data.i18n, data.title) : data.title) || t.i18n.t('emote-menu.unknown', 'Unknown Source')}
							{! visibility && calendar && (<span
								class={`tw-mg-x-05 ffz--expiry-info ffz-tooltip ffz-i-${calendar.icon}`}
								data-tooltip-type="html"
								data-title={calendar.message}
							/>)}
						</div>
						<div class="tw-flex-grow-1" />
						{visibility ?
							(hidden ?
								t.i18n.t('emote-menu.visibility.hidden', 'Hidden') :
								t.i18n.t('emote-menu.visibility.visible', 'Visible') )
							: source
						}
						{(visibility ? false : filtered) ? '' : <figure class={`tw-pd-l-05 ffz-i-${collapsed ? 'left' : 'down'}-dir`} />}
					</heading>) : null}
					{collapsed || this.renderBody(show_heading)}
				</section>)
			}

			renderBody(show_sources) {
				const data = this.props.data,
					filtered = this.props.filtered,
					lock = data.locks && data.locks[this.state.unlocked],

					emotes = data.filtered_emotes && data.filtered_emotes.map(emote => {
						if ( filtered && emote.locked )
							return;

						const locked = emote.locked && (! lock || ! lock.emotes.has(emote.id)),
							emote_lock = locked && data.locks && data.locks[emote.set_id];
						let sellout = '';

						if ( emote_lock ) {
							if ( emote_lock.id === 'subwoofer' ) {
								sellout = t.i18n.t('emote-menu.emote-subwoofer', 'Become an FFZ Subwoofer to unlock this emote.');
							} else if ( emote_lock.id === 'cheer' ) {
								sellout = t.i18n.t('emote-menu.emote-cheer', 'Cheer an additional {bits_remaining, plural, one {# bit} other {# bits}} to unlock this emote.', emote_lock);
							} else if ( emote_lock.id === 'follower' ) {
								sellout = t.i18n.t('emote-menu.emote-follower', 'Follow {user} to unlock this emote in their channel.', emote_lock);
							} else if ( data.all_locked )
								sellout = t.i18n.t('emote-menu.emote-sub', 'Subscribe for {price} to unlock this emote.', emote_lock);
							else
								sellout = t.i18n.t('emote-menu.emote-up', 'Upgrade your sub to {price} to unlock this emote.', emote_lock);
						}

						return this.renderEmote(
							emote,
							locked,
							show_sources,
							sellout
						);
					});

				return (<div class="tw-pd-1 tw-border-b tw-c-background-alt tw-align-center">
					{emotes}
					{! this.props.visibility_control && !filtered && this.renderSellout()}
				</div>)
			}

			renderEmote(emote, locked, source, sellout) {
				if ( ! this.state.intersecting )
					return <span key={emote.id} class="emote-picker__placeholder" style={{width: `${emote.width||28}px`, height: `${emote.height||28}px`}} />;

				const visibility = this.props.visibility_control,
					modifiers = this.props.emote_modifiers[emote.id],
					has_modifiers = Array.isArray(modifiers) && modifiers.length > 0,
					//has_menu = has_modifiers && this.state.open_menu == emote.id,
					animated = this.props.animated,
					hidden = visibility && emote.hidden;

				let src, srcSet;
				if ( animated && emote.animSrc ) {
					src = emote.animSrc;
					srcSet = emote.animSrcSet;
				} else {
					src = emote.src;
					srcSet = emote.srcSet;
				}

				return (<button
					key={emote.id}
					class={`ffz-tooltip emote-picker__emote-link${!visibility && locked ? ' locked' : ''}${hidden ? ' emote-hidden' : ''}`}
					data-tooltip-type="emote"
					data-provider={emote.provider}
					data-id={emote.id}
					data-set={emote.set_id}
					data-code={emote.code}
					data-modifiers={modifiers}
					data-effects={emote.effects}
					data-variant={emote.variant}
					data-no-source={source}
					data-name={emote.name}
					aria-label={emote.name}
					data-locked={emote.locked}
					data-sellout={sellout}
					onClick={(this.props.visibility_control || !emote.locked) && this.clickEmote}
				>
					<figure class="emote-picker__emote-figure">
						<img
							class={`emote-picker__emote-image${emote.emoji ? ' ffz-emoji' : ''}`}
							src={src}
							srcSet={srcSet}
							alt={emote.name}
							height={emote.height ? `${emote.height}px` : null}
							width={emote.width ? `${emote.width}px` : null}
						/>
					</figure>
					{! visibility && has_modifiers && <div class="emote-button__options" />}
					{! visibility && emote.favorite && <figure class="ffz--favorite ffz-i-star" />}
					{! visibility && locked && <figure class={`ffz-i-${emote.lock_icon || 'lock'}`} />}
					{hidden && <figure class="ffz-i-eye-off" />}
				</button>)
			}

			renderSellout() {
				const data = this.props.data;

				if ( ! data.all_locked || ! data.locks )
					return null;

				let lock = data.locks[this.state.unlocked],
					locks = Object.values(data.locks).filter(x => x.id !== 'cheer'),
					has_ffz = locks.filter(x => x.is_ffz).length > 0;

				if ( ! lock && data.locks.length === 1 )
					lock = data.locks[0];

				if ( ! locks.length )
					return null;

				return (<div class="tw-mg-1 tw-border-t tw-pd-t-1 tw-mg-b-0">
					{has_ffz
						? t.i18n.t('emote-menu.ffz-unlock', 'This feature is available to FFZ Subwoofers.')
						: (lock
							? t.i18n.t('emote-menu.sub-unlock', 'Subscribe for {price} to unlock {count, plural, one {# emote} other {# emotes}}', {price: lock.price, count: lock.emotes.size})
							: t.i18n.t('emote-menu.sub-basic', 'Subscribe to unlock some emotes')
						)
					}
					{has_ffz && this.props.ffz_sub_data?.has_free_sub
						? <div class="tw-pd-y-1">{t.i18n.t('emote-menu.free-sub.about', 'As thanks for supporting us in the past, you can get one month of FFZ Subwoofer for free.')}</div>
						: null}
					<div class="ffz--sub-buttons tw-mg-t-05">
						{locks.map(lock => lock.hide_button ? null : (<a
							key={lock.price}
							class="tw-button tw-border-radius-none"
							href={lock.url}
							target="_blank"
							rel="noopener noreferrer"
							data-set-id={lock.set_id}
							onMouseEnter={this.onMouseEnter}
							onMouseLeave={this.onMouseLeave}
						>
							<span class="tw-button__text">
								{has_ffz && this.props.ffz_sub_data?.has_free_sub
									? t.i18n.t('emote-menu.free-sub', 'Use My Free Month')
									: lock.price
								}
							</span>
						</a>))}
					</div>
				</div>)
			}
		}

		this.fine.wrap('ffz-menu-section', this.MenuSection);

		this.EmojiSection = class FFZMenuEmojiSection extends this.MenuSection {
			renderEmote(emote, locked, source, sellout) {
				const emoji_x = (emote.x * (t.emoji_size + 2)) + 1,
					emoji_y = (emote.y * (t.emoji_size + 2)) + 1,

					x_pct = 100 * emoji_x / t.emoji_sheet_remain,
					y_pct = 100 * emoji_y / t.emoji_sheet_remain;

				return (<button
					key={emote.id}
					class={`ffz-tooltip emote-picker__emote-link${locked ? ' locked' : ''}${emote.emoji ? ' emote-picker__emoji' : ''}`}
					data-tooltip-type="emote"
					data-provider={emote.provider}
					data-id={emote.id}
					data-set={emote.set_id}
					data-code={emote.code}
					data-variant={emote.variant}
					data-no-source={source}
					data-name={emote.name}
					aria-label={emote.name}
					data-locked={emote.locked}
					data-sellout={sellout}
					onClick={!emote.locked && this.clickEmote}
				>
					<figure
						class="emote-picker__emote-figure"
						style={{
							backgroundPosition: `${x_pct}% ${y_pct}%`,
						}}
					/>
					{emote.favorite && <figure class="ffz--favorite ffz-i-star" />}
					{locked && <figure class={`ffz-i-${emote.lock_icon || 'lock'}`} />}
				</button>)
			}
		}

		let timer;
		const doClear = () => requestAnimationFrame(() => this.emit('tooltips:cleanup')),
			clearTooltips = () => {
				clearTimeout(timer);
				setTimeout(doClear, 100);
			};

		this.MenuErrorWrapper = class FFZEmoteMenuErrorWrapper extends React.Component {
			constructor(props) {
				super(props);
				this.state = {errored: false, error: null};
			}

			static getDerivedStateFromError(error) {
				return {
					errored: true,
					error
				}
			}

			componentDidCatch(error) { // eslint-disable-line class-methods-use-this
				t.log.capture(error);
				t.log.error('Error rendering the FFZ Emote Menu.');
				this.setState({
					errored: true,
					error
				});
			}

			render() {
				if ( this.state.errored ) {
					if ( ! this.props.visible )
						return null;

					const padding = t.chat.context.get('chat.emote-menu.reduced-padding');

					return (<div
						class={`ffz-balloon ffz-balloon--md ffz-il-tooltip--up ffz-il-tooltip--align-right tw-block tw-absolute ffz--emote-picker${padding ? ' reduced-padding' : ''}`}
						data-a-target="emote-picker"
					>
						<div class="tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base">
							<div
								class="emote-picker__tab-content scrollable-area"
								data-test-selector="scrollable-area-wrapper"
								data-simplebar
							>
								<div class="tw-align-center tw-pd-1">
									<div class="tw-mg-b-1">
										<div class="tw-mg-2">
											<img
												src="//cdn.frankerfacez.com/emoticon/26608/2"
												srcSet="//cdn.frankerfacez.com/emoticon/26608/2 1x, //cdn.frankerfacez.com/emoticon/26608/4 2x"
											/>
										</div>
										{t.i18n.t('emote-menu.error', 'There was an error rendering this menu.')}
										<br />
										{t.settings.get('reports.error.enable') ?
											t.i18n.t('emote-menu.error-report', 'An error report has been automatically submitted.')
											: ''
										}
										<div class="tw-mg-t-05 tw-border-t-1 tw-pd-t-05">
											{t.i18n.t('emote-menu.disable', 'As a temporary workaround, try disabling the FFZ Emote Menu in the FFZ Control Center.') }
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>);
				}

				return this.props.children;
			}
		}

		this.MenuComponent = class FFZEmoteMenuComponent extends React.Component {
			constructor(props) {
				super(props);

				this.nav_ref = null;
				this.saveNavRef = ref => {
					this.nav_ref = ref;
				}

				this.ref = null;
				this.saveScrollRef = ref => {
					this.ref = ref;
					this.createObserver();
				}

				this.sections = [];
				this.activeSection = -1;

				this.state = {
					tab: null,
					active_nav: null,
					stayLoaded: t.chat.context.get('chat.emote-menu.stay-loaded'),
					quickNav: t.chat.context.get('chat.emote-menu.show-quick-nav'),
					animated: t.chat.context.get('chat.emotes.animated'),
					showHeading: t.chat.context.get('chat.emote-menu.show-heading'),
					tall: t.chat.context.get('chat.emote-menu.tall'),
					reducedPadding: t.chat.context.get('chat.emote-menu.reduced-padding'),
					combineTabs: t.chat.context.get('chat.emote-menu.combine-tabs'),
					showSearch: t.chat.context.get('chat.emote-menu.show-search'),
					clearSearch: t.chat.context.get('chat.emote-menu.clear-search'),
					hasNewEffects: false,
					unlockedEffects: t.settings.provider.get('unlocked-effects', []),
					tone: t.settings.provider.get('emoji-tone', null)
				}

				if ( props.visible ) {
					this.loadData();
					if ( this.state.wants_plan_info )
						this.loadFFZPlanData();
					if ( this.state.wants_resub_info )
						this.loadFFZSubData();
				}

				this.rebuildData();

				this.observing = new Map;

				this.addSection = inst => {
					if ( ! this.sections.includes(inst) )
						this.sections.push(inst);
				}

				this.removeSection = inst => {
					const idx = this.sections.indexOf(inst);
					if ( idx !== -1 ) {
						this.sections.splice(idx);
						if ( idx === this.activeSection )
							this.activeSection = -1;
						else if ( idx < this.activeSection )
							this.activeSection--;
					}
				}

				this.startObserving = this.startObserving.bind(this);
				this.stopObserving = this.stopObserving.bind(this);
				this.handleObserve = this.handleObserve.bind(this);
				this.pickTone = this.pickTone.bind(this);
				this.clickTab = this.clickTab.bind(this);
				this.clickSideNav = this.clickSideNav.bind(this);
				//this.clickRefresh = this.clickRefresh.bind(this);
				this.handleFilterChange = this.handleFilterChange.bind(this);
				this.handleKeyDown = this.handleKeyDown.bind(this);
				this.toggleVisibilityControl = this.toggleVisibilityControl.bind(this);
			}

			createObserver() {
				if ( this.observer ) {
					if ( this._observed === this.ref )
						return;

					this.observer.disconnect();
					this.observer = this._observed = null;
				}

				if ( ! this.ref || ! window.IntersectionObserver )
					return;

				this._observed = this.ref;
				this.observer = new IntersectionObserver(this.handleObserve, {
					root: this.ref,
					rootMargin: '50px 0px',
					threshold: 0.01
				});

				for(const element of this.observing.keys())
					this.observer.observe(element);

				this.observeSoon();
			}

			observeSoon() {
				requestAnimationFrame(() => {
					if ( this.observer )
						this.handleObserve(this.observer.takeRecords());
				});
			}

			destroyObserver() {
				if ( ! this.observer )
					return;

				this.observer.disconnect();
				this.observer = this._observed = null;
			}

			scrollNavIntoView() {
				requestAnimationFrame(() => {
					const el = this.nav_ref?.querySelector?.(`button[data-key="${this.state.active_nav}"]`);
					if ( el )
						el.scrollIntoView({block: 'nearest'});
				});
			}

			handleObserve(event) {
				let changed = false,
					active = this.state.active_nav;

				for(const entry of event) {
					const inst = this.observing.get(entry.target),
						intersecting = entry.isIntersecting;
					if ( ! inst || inst.state.intersecting === intersecting )
						continue;

					changed = true;
					inst.setState({intersecting});

					if ( intersecting )
						active = inst.props?.data?.key;
				}

				if ( changed ) {
					requestAnimationFrame(clearTooltips);

					if ( ! this.lock_active && active !== this.state.active_nav )
						this.setState({
							active_nav: active
						}, () => this.scrollNavIntoView());
				}
			}

			startObserving(element, inst) {
				const old_inst = this.observing.get(element);
				if ( inst === old_inst )
					return;

				if ( old_inst )
					this.stopObserving(element);

				this.observing.set(element, inst);
				if ( this.observer )
					this.observer.observe(element);

				this.observeSoon();
			}

			stopObserving(element) {
				if ( ! this.observing.has(element) )
					return;

				this.observing.delete(element);
				if ( this.observer )
					this.observer.unobserve(element);
			}

			componentDidMount() {
				if ( this.ref )
					this.createObserver();

				t.chat.context.on('changed:chat.emotes.animated', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.stay-loaded', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.show-quick-nav', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.reduced-padding', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.show-heading', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.combine-tabs', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.show-search', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.clear-search', this.updateSettingState, this);
				t.chat.context.on('changed:chat.emote-menu.tall', this.updateSettingState, this);

				window.ffz_menu = this;
			}

			componentWillUnmount() {
				this.destroyObserver();

				t.chat.context.off('changed:chat.emotes.animated', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.stay-loaded', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.show-quick-nav', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.show-heading', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.reduced-padding', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.combine-tabs', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.show-search', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.clear-search', this.updateSettingState, this);
				t.chat.context.off('changed:chat.emote-menu.tall', this.updateSettingState, this);

				if ( window.ffz_menu === this )
					window.ffz_menu = null;
			}

			updateSettingState() {
				this.setState({
					stayLoaded: t.chat.context.get('chat.emote-menu.stay-loaded'),
					quickNav: t.chat.context.get('chat.emote-menu.show-quick-nav'),
					animated: t.chat.context.get('chat.emotes.animated'),
					showHeading: t.chat.context.get('chat.emote-menu.show-heading'),
					reducedPadding: t.chat.context.get('chat.emote-menu.reduced-padding'),
					combineTabs: t.chat.context.get('chat.emote-menu.combine-tabs'),
					showSearch: t.chat.context.get('chat.emote-menu.show-search'),
					clearSearch: t.chat.context.get('chat.emote-menu.clear-search'),
					tall: t.chat.context.get('chat.emote-menu.tall')
				});
			}

			seeEffects() {
				if ( this.state.hasNewEffects ) {
					t.settings.provider.set('unlocked-effects', this.state.unlockedEffects);

					this.setState({
						hasNewEffects: false
					});
				}
			}

			pickTone(tone) {
				tone = tone || null;
				t.settings.provider.set('emoji-tone', tone);

				this.setState(this.filterState(
					this.state.filter,
					this.buildEmoji(
						Object.assign({}, this.state, {tone})
					)
				));
			}

			clickSideNav(event) {
				const key = event.currentTarget.dataset.key;
				const el = this.ref?.querySelector?.(`section[data-key="${key}"]`);
				if ( el ) {
					this.lock_active = true;
					el.scrollIntoView();
					this.setState({
						active_nav: key
					});
					setTimeout(() => this.lock_active = false, 250);
				}
			}

			clickTab(event) {
				const tab = event.currentTarget.dataset.tab;

				if ( tab === 'effect' )
					this.seeEffects();

				if ( this.state.combineTabs ) {
					let sets;
					switch(tab) {
						case 'fav':
							sets = this.state.filtered_fav_sets;
							break;
						case 'channel':
							sets = this.state.filtered_channel_sets;
							break;
						case 'effect':
							sets = this.state.filtered_effect_sets;
							break;
						case 'emoji':
							sets = this.state.filtered_emoji_sets;
							break;
						case 'all':
						default:
							sets = this.state.filtered_all_sets;
							break;
					}

					const set = sets && sets[0],
						el = set && this.ref?.querySelector?.(`section[data-key="${set.key}"]`);

					if ( el )
						el.scrollIntoView();

					return;
				}

				this.setState({
					tab
				});
			}

			clickSettings(event) { // eslint-disable-line class-methods-use-this
				const layout = t.resolve('site.layout');
				if ( (layout && layout.is_minimal) || (event && (event.ctrlKey || event.shiftKey)) ) {
					const win = window.open(
						'https://twitch.tv/popout/frankerfacez/chat?ffz-settings',
						'_blank',
						'resizable=yes,scrollbars=yes,width=850,height=600'
					);

					if ( win )
						win.focus();

				} else {
					const menu = t.resolve('main_menu');

					if ( menu ) {
						menu.requestPage('chat.emote_menu');
						if ( menu.showing )
							return;
					}

					t.emit('site.menu_button:clicked');
				}
			}

			/*clickRefresh(event) {
				const target = event.currentTarget,
					tt = target && target._ffz_tooltip;

				if ( tt && tt.hide )
					tt.hide();

				this.setState({
					loading: true
				}, async () => {
					const props = this.props,
						promises = [],
						emote_data = props.emote_data,
						channel_data = props.channel_data;

					if ( emote_data )
						promises.push(emote_data.refetch())

					if ( channel_data )
						promises.push(channel_data.refetch());

					await Promise.all(promises);

					const es = props.emote_data && props.emote_data.emoteSets,
						sets = es && es.length ? new Set(es.map(x => parseInt(x.id, 10))) : new Set;

					const data = await t.getData(sets, true);
					this.setState(this.filterState(this.state.filter, this.buildState(
						this.props,
						Object.assign({}, this.state, {set_sets: sets, set_data: data, loading: false})
					)));
				});
			}*/

			toggleVisibilityControl() {
				this.setState(this.filterState(this.state.filter, this.state, ! this.state.visibility_control));
			}

			handleFilterChange(event) {
				this.setState(this.filterState(event.target.value, this.state));
			}

			handleKeyDown(event) {
				const code = event.keyCode;
				if ( code === KEYS.Escape )
					this.props.toggleVisibility();
				else
					return;

				event.preventDefault();
			}

			loadData(force = false, props, state) {
				state = state || this.state;
				if ( ! state )
					return false;

				props = props || this.props;

				const emote_sets = props.emote_data && props.emote_data.emoteSets,
					sets = Array.isArray(emote_sets) ? new Set(emote_sets.map(x => x.id)) : new Set;

				force = force || (state.set_data && ! set_equals(state.set_sets, sets));

				if ( state.set_data && ! force )
					return false;

				this.setState({loading: true}, () => {
					t.getData(sets, force).then(d => {
						this.setState(this.filterState(this.state.filter, this.buildState(
							this.props,
							Object.assign({}, this.state, {set_sets: sets, set_data: d, loading: false})
						)));
					});
				});

				return true;
			}

			loadFFZPlanData(force = false, props, state) {
				state = state || this.state;
				if ( ! state || state.ffz_plan_loading )
					return false;

				if ( state.ffz_sub_data && ! force )
					return false;

				this.setState({ffz_plan_loading: true}, () => {
					t.getFFZSubPrices().then(d => {
						this.setState(this.filterState(this.state.filter, this.buildState(
							this.props,
							Object.assign({}, this.state, {ffz_plan_data: d, ffz_plan_loading: false})
						)));
					})
				});

				return true;
			}

			loadFFZSubData(force = false, props, state) {
				state = state || this.state;
				if ( ! state || state.ffz_loading )
					return false;

				if ( state.ffz_sub_data && ! force )
					return false;

				this.setState({ffz_loading: true}, () => {
					t.getFFZSubData().then(d => {
						this.setState(this.filterState(this.state.filter, this.buildState(
							this.props,
							Object.assign({}, this.state, {ffz_sub_data: d, ffz_loading: false})
						)));
					})
				});

				return true;
			}

			filterState(input, old_state, visibility_control) {
				const state = Object.assign({}, old_state);

				if ( visibility_control != null )
					state.visibility_control = visibility_control;
				else
					visibility_control = state.visibility_control;

				state.filter = input;
				state.filtered = input && input.length > 0 && input !== ':' || false;

				state.filtered_channel_sets = this.filterSets(input, state.channel_sets, visibility_control);
				state.filtered_effect_sets = this.filterSets(input, state.effect_sets, visibility_control);
				state.filtered_all_sets = this.filterSets(input, state.all_sets, visibility_control);
				state.filtered_fav_sets = this.filterSets(input, state.fav_sets, visibility_control);
				state.filtered_emoji_sets = this.filterSets(input, state.emoji_sets, visibility_control);

				state.has_effect_tab = state.filtered_effect_sets.length > 0;

				return state;
			}

			filterSets(input, sets, visibility_control) {
				const out = [];
				if ( ! sets || ! sets.length )
					return out;

				const filtering = input && input.length > 0 && input !== ':',
					hidden_sets = storage.get('emote-menu.hidden-sets') || [];

				for(const emote_set of sets) {
					if ( ! visibility_control && hidden_sets.includes(emote_set.key) )
						continue;

					const filtered = emote_set.filtered_emotes = emote_set.emotes.filter(emote => {
						if ( ! visibility_control && emote.hidden )
							return false;

						return ! filtering || (! emote.locked && this.doesEmoteMatch(input, emote))
					});

					if ( filtered.length )
						out.push(emote_set);
				}

				return out;
			}

			doesEmoteMatch(filter, emote) { //eslint-disable-line class-methods-use-this
				if ( ! filter || ! filter.length )
					return true;

				const emote_name = emote.search || emote.name,
					emote_lower = emote_name.toLowerCase(),
					term_lower = filter.toLowerCase(),
					has_colon = filter.startsWith(':'),
					term_trail = term_lower.slice(1);

				if ( Array.isArray(emote.extra) ) {
					let i = emote.extra.length;
					while(i--) {
						if ( ! has_colon && emote.extra[i].includes(term_lower) )
							return true;
						else if ( has_colon && emote.extra[i].startsWith(term_trail) )
							return true;
					}
				}

				if ( ! has_colon )
					return emote_lower.includes(term_lower);

				if ( emote_lower.startsWith(term_trail) )
					return true;

				const idx = emote_name.indexOf(filter.charAt(1).toUpperCase());
				if ( idx !== -1 )
					return emote_lower.slice(idx+1).startsWith(term_lower.slice(2));

				return false;
			}


			buildEmoji(old_state) { // eslint-disable-line class-methods-use-this
				const state = Object.assign({}, old_state),

					sets = state.emoji_sets = [],
					emoji_favorites = t.emotes.getFavorites('emoji'),
					favorites = state.favorites = (state.favorites || []).filter(x => ! x.emoji),

					tone = state.tone = state.tone || null,
					tone_choices = state.tone_emoji = [],
					categories = {};

				if ( t.chat.context.get('chat.emote-menu.show-emoji') ) {
					let style = t.chat.context.get('chat.emoji.style') || 'twitter';
					if ( ! IMAGE_PATHS[style] )
						style = 'twitter';

					for(const emoji of Object.values(t.emoji.emoji)) {
						if ( ! emoji || ! emoji.has[style] || HIDDEN_CATEGORIES.includes(emoji.category) )
							continue;

						if ( emoji.variants ) {
							for(const name of emoji.names)
								if ( TONE_EMOJI.includes(name) ) {
									tone_choices.push(emoji);
									break;
								}
						}

						const is_fav = emoji_favorites.includes(emoji.code),
							toned = emoji.variants && emoji.variants[tone],
							has_tone = toned && toned.has[style],
							source = has_tone ? toned : emoji;

						let cat = categories[emoji.category];
						if ( ! cat ) {
							cat = categories[emoji.category] = [];

							sets.push({
								key: `emoji-${emoji.category}`,
								sort_key: CATEGORY_SORT.indexOf(emoji.category),
								emoji: true,
								image: t.emoji.getFullImage(source.image),
								i18n: `emoji.category.${emoji.category.toSnakeCase()}`,
								title: CATEGORIES[emoji.category] || emoji.category,
								src: 'emoji',
								source: 'Emoji',
								source_i18n: 'emote-menu.emoji',
								emotes: cat
							});
						}

						const em = {
							provider: 'emoji',
							id: emoji.sort,
							emoji: true,
							code: emoji.code,
							name: source.raw,
							variant: has_tone && tone,
							hidden: emoji.hidden,

							search: emoji.names[0],
							extra: emoji.names.length > 1 ? emoji.names.map(x => x.toLowerCase()) : null,

							height: 18,
							width: 18,

							x: source.sheet_x,
							y: source.sheet_y,

							favorite: is_fav,

							src: t.emoji.getFullImage(source.image),
							srcSet: t.emoji.getFullImageSet(source.image)
						};

						cat.push(em);

						if ( is_fav )
							favorites.push(em);
					}
				}

				state.has_emoji_tab = sets.length > 0;

				state.fav_sets = [{
					key: 'favorites',

					title: 'Favorites',
					i18n: 'emote-menu.favorites',
					icon: 'star',
					source: '',

					is_favorites: true,
					emotes: favorites
				}];

				// We use this sorter because we don't want things grouped by sets.
				favorites.sort(this.getSorter());
				sets.sort(sort_sets);

				return state;
			}

			getAllSets() {
				return [
					...(this.state.channel_sets || []),
					...(this.state.effect_sets || []),
					...(this.state.all_sets || [])
				];
			}

			getSorter() { // eslint-disable-line class-methods-use-this
				return EMOTE_SORTERS[t.chat.context.get('chat.emote-menu.sort-emotes')] || EMOTE_SORTERS[0] || (() => 0);
			}

			buildState(props, old_state) {
				const state = Object.assign({}, old_state),

					data = state.set_data || {},
					modifiers = state.emote_modifiers = {},
					channel = state.channel_sets = [],
					all = state.all_sets = [],
					effects = state.effect_sets = [],
					favorites = state.favorites = [];

				// If we're still loading, don't set any data.
				if ( props.loading || props.error || state.loading )
					return state;

				// If we start loading because the sets we have
				// don't match, don't set any data either.
				if ( state.set_data && this.loadData(false, props, state) )
					return state;

				// Sorters
				const sorter = this.getSorter(),
					sort_tiers = t.chat.context.get('chat.emote-menu.sort-tiers-last'),
					sort_emotes = (a,b) => {
						if ( a.misc || b.misc )
							return sorter(a,b);

						if ( ! a.locked && b.locked ) return -1;
						if ( a.locked && ! b.locked ) return 1;

						if ( sort_tiers || a.locked || b.locked ) {
							if ( a.bits || b.bits ) {
								if ( ! b.bits )
									return 1;
								else if ( ! a.bits )
									return -1;

								const a_val = a.bit_value || 0,
									b_val = b.bit_value || 0;

								if ( COLLATOR ) {
									const result = COLLATOR.compare(a_val, b_val);
									if ( result != 0 )
										return result;
								} else {
									if ( a_val < b_val ) return -1;
									if ( a_val > b_val ) return 1;
								}
							} else {
								if ( COLLATOR ) {
									const result = COLLATOR.compare(a.set_id, b.set_id);
									if ( result != 0 )
										return result;
								} else {
									if ( a.set_id < b.set_id ) return -1;
									if ( a.set_id > b.set_id ) return 1;
								}
							}
						}

						return sorter(a,b);
					}


				// Before anything, identify the follower sets.
				const user = props.channel_data && props.channel_data.user,
					products = user && user.subscriptionProducts,
					local_sets = user && props.channel_data?.channel?.localEmoteSets,
					is_following = user && user.self?.follower != null,
					follower_locked = ! is_following && (props.user_id && user?.id != props.user_id),
					bits = user?.cheer?.badgeTierEmotes;

				const follower_sets = new Set();
				if ( Array.isArray(local_sets) )
					for(const local of local_sets)
						if ( local?.id )
							follower_sets.add(local.id);

				// Start with the All tab. Some data calculated for
				// all is re-used for the Channel tab.

				const emote_sets = props.emote_data && props.emote_data.emoteSets,
					emote_map = props.emote_data && props.emote_data.emoteMap,
					twitch_favorites = t.emotes.getFavorites('twitch'),
					twitch_hidden = t.emotes.getHidden('twitch'),
					twitch_seen = new Set,

					bits_unlocked = [],

					//twitch_seen_favorites = new Set,

					grouped_sets = {},
					set_ids = new Set;

				if ( Array.isArray(emote_sets) )
					for(const emote_set of emote_sets) {
						if ( ! emote_set || ! Array.isArray(emote_set.emotes) )
							continue;

						const set_id = emote_set.id,
							int_id = parseInt(set_id, 10),
							owner = emote_set.owner,
							is_follower = follower_sets.has(set_id),
							is_bits = ! is_follower && int_id > 5e8,
							is_points = TWITCH_POINTS_SETS.includes(int_id) || owner?.login === 'channel_points',
							chan = is_follower ? user : is_points ? null : owner,
							set_data = data[set_id],
							is_current_bits = is_bits && owner && owner.id == user?.id;

						/*if ( chan )
							t.emotes.setTwitchSetChannel(set_id, {
								s_id: set_id,
								c_id: chan.id,
								c_name: chan.login,
								c_title: chan.displayName
							});*/

						set_ids.add(set_id);

						let key = `twitch-set-${set_id}`,
							sort_key = 0,
							icon = 'twitch',
							title = chan && (chan.displayName || chan.login);

						if ( title ) {
							key = `twitch-${chan?.id}`;

							if ( is_follower )
								t.emotes.setTwitchSetChannel(set_id, {
									id: set_id,
									type: EmoteTypes.Follower,
									owner: {
										id: chan.id,
										login: chan.login,
										displayName: chan.displayName
									}
								});
							else if ( is_bits )
								t.emotes.setTwitchSetChannel(set_id, {
									id: set_id,
									type: EmoteTypes.BitsTier,
									owner: {
										id: chan.id,
										login: chan.login,
										displayName: chan.displayName
									}
								});
							else
								t.emotes.setTwitchSetChannel(set_id, {
									id: set_id,
									type: EmoteTypes.Subscription,
									owner: {
										id: chan.id,
										login: chan.login,
										displayName: chan.displayName
									}
								});

						} else if ( ! chan ) {
							if ( is_points ) {
								title = t.i18n.t('emote-menu.points', 'Unlocked with Points');
								key = 'twitch-points';
								icon = 'channel-points';
								sort_key = 45;

								/*t.emotes.setTwitchSetChannel(set_id, {
									id: set_id,
									type: EmoteTypes.ChannelPoints,
									owner: null
								});*/

							} else if ( TWITCH_GLOBAL_SETS.includes(int_id) ) {
								title = t.i18n.t('emote-menu.global', 'Global Emotes');
								key = 'twitch-global';
								sort_key = 100;

								t.emotes.setTwitchSetChannel(set_id, {
									id: set_id,
									type: EmoteTypes.Global,
									owner: null
								});

							} else if ( TWITCH_PRIME_SETS.includes(int_id) ) {
								title = t.i18n.t('emote_menu.prime', 'Prime');
								key = 'twitch-prime';
								icon = 'crown';
								sort_key = 75;

								t.emotes.setTwitchSetChannel(set_id, {
									id: set_id,
									type: EmoteTypes.Prime,
									owner: null
								});

							} else {
								title = t.i18n.t('emote-menu.misc', 'Miscellaneous');
								key = 'twitch-misc';
								icon = 'inventory';
								sort_key = 50;
							}

						} else
							title = t.i18n.t('emote-menu.unknown-set', 'Set #{set_id}', {set_id})

						// Do not display follower emotes the user does not have.
						if ( is_follower )
							continue;

						let section, emotes;

						if ( grouped_sets[key] ) {
							section = grouped_sets[key];
							emotes = section.emotes;

							if ( set_data && section.bad ) {
								section.bad = false;
								section.renews = set_data.renews;
								section.ends = set_data.ends;
								section.prime = set_data.prime;
								section.gift = set_data.gift;
							}

						} else {
							emotes = [];
							section = grouped_sets[key] = {
								sort_key,
								key,
								image: chan?.profileImageURL,
								image_large: true,
								icon,
								title,
								source: t.i18n.t('emote-menu.twitch', 'Twitch'),
								emotes,
								renews: set_data?.renews,
								ends: set_data?.ends,
								prime: set_data?.prime,
								gift: set_data?.gift
							}

							if ( ! set_data )
								section.bad = true;
						}

						let order = 0;

						for(const emote of emote_set.emotes) {
							// Validate emotes, because apparently Twitch is handing
							// out bad emote data.
							if ( ! emote || ! emote.id || ! emote.token )
								continue;

							const id = emote.id,
								name = KNOWN_CODES[emote.token] || emote.token,
								mapped = emote_map && emote_map[name];

							if ( ! is_points )
								t.emotes.setTwitchEmoteSet(id, set_id);

							//if ( Array.isArray(emote.modifiers) && emote.modifiers.length )
							//	modifiers[id] = emote.modifiers.map(x => x.code);

							const modes = [''];
							if ( Array.isArray(emote.modifiers) && emote.modifiers.length ) {
								if ( t.chat.context.get('chat.emote-menu.modifiers') === 1 )
									for(const mod of emote.modifiers)
										modes.push(`_${mod.code}`);
							}

							for(const mode of modes) {
								const new_id = `${id}${mode}`,
									new_name = `${name}${mode}`,
									is_fav = twitch_favorites.includes(new_id),
									overridden = mapped && mapped.id != new_id,
									replacement = REPLACEMENTS[new_id];

								let src, srcSet, animSrc, animSrcSet;

								if ( replacement && t.chat.context.get('chat.fix-bad-emotes') )
									src = `${REPLACEMENT_BASE}${replacement}`;
								else {
									src = getTwitchEmoteURL(new_id, 1, false);
									srcSet = getTwitchEmoteSrcSet(new_id, false);

									animSrc = getTwitchEmoteURL(new_id, 1, true);
									animSrcSet = getTwitchEmoteSrcSet(new_id, true);
								}

								const em = {
									provider: 'twitch',
									id: new_id,
									set_id,
									name: new_name,
									src,
									srcSet,
									animSrc,
									animSrcSet,
									order: order++,
									overridden: overridden ? mapped.id : null,
									misc: ! chan,
									bits: is_bits,
									hidden: twitch_hidden.includes(new_id),
									favorite: is_fav
								};

								emotes.push(em);

								if ( is_current_bits )
									bits_unlocked.push(em);

								if ( is_fav && ! twitch_seen.has(new_id) )
									favorites.push(em);

								twitch_seen.add(new_id);
							}
						}

						if ( emotes.length ) {
							emotes.sort(sort_emotes);

							if ( ! all.includes(section) )
								all.push(section);
						}
					}


				// Now we handle the current Channel's emotes.

				if ( Array.isArray(local_sets) || Array.isArray(products) || Array.isArray(bits) ) {
					const badge = t.badges.getTwitchBadge('subscriber', '0', user.id, user.login),
						emotes = [],
						unlockable_emotes = new Set,
						locks = {},
						section = {
							sort_key: -10,
							key: `twitch-current-channel`,
							hide_key: `twitch-${user.id}`,
							image: badge && badge.image1x,
							image_set: badge && `${badge.image1x} 1x, ${badge.image2x} 2x, ${badge.image4x} 4x`,
							icon: 'twitch',
							title: t.i18n.t('emote-menu.main-set', 'Channel Emotes'),
							source: t.i18n.t('emote-menu.twitch', 'Twitch'),
							emotes,
							locks,
							all_locked: true
						};

					if ( Array.isArray(local_sets) ) {
						for(const local of local_sets) {
							if ( ! local || ! Array.isArray(local.emotes) )
								continue;

							const set_id = local.id;

							let lock_set;

							// If we're not following, we can't use the emote
							// so lock it.
							if ( follower_locked )
								locks[set_id] = {
									set_id,
									id: 'follower',
									user: user?.displayName || user?.login,
									hide_button: true,
									emotes: lock_set = new Set()
								}
							/*else
								section.all_locked = false;*/

							let order = 0;
							for(const emote of local.emotes) {
								if ( ! emote || ! emote.id || ! emote.token )
									continue;

								const id = emote.id,
									name = KNOWN_CODES[emote.token] || emote.token,
									seen = twitch_seen.has(id),
									is_fav = twitch_favorites.includes(id);

								const em = {
									provider: 'twitch',
									id,
									set_id,
									name,
									order: order++,
									src: getTwitchEmoteURL(id, 1, false),
									srcSet: getTwitchEmoteSrcSet(id, false),
									animSrc: getTwitchEmoteURL(id, 1, true),
									animSrcSet: getTwitchEmoteSrcSet(id, true),
									favorite: is_fav,
									hidden: twitch_hidden.includes(id),
									locked: follower_locked,
									lock_icon: 'heart'
								};

								emotes.push(em);

								if ( is_fav && ! seen )
									favorites.push(em);

								twitch_seen.add(id);

								if ( lock_set )
									lock_set.add(id);
							}
						}
					}

					if ( Array.isArray(products) ) {
						for(const product of products) {
							if ( ! product || ! Array.isArray(product.emotes) )
								continue;

							const set_id = product.emoteSetID,
								set_data = data[set_id],
								locked = ! set_ids.has(set_id);

							let lock_set;

							if ( set_data ) {
								section.renews = set_data.renews;
								section.ends = set_data.ends;
								section.prime = set_data.prime;
								section.gift = set_data.gift && set_data.gift.isGift;
							}

							// If the channel is locked, store data about that in the
							// section so we can show appropriate UI to let people
							// subscribe. Also include all the already known emotes
							// in the list of emotes this product unlocks.
							if ( locked )
								locks[set_id] = {
									set_id,
									id: product.id,
									price: product.price || TIERS[product.tier],
									url: product.url,
									emotes: lock_set = new Set(unlockable_emotes)
								}
							else
								section.all_locked = false;

							let order = 0;

							for(const emote of product.emotes) {
								// Validate emotes, because apparently Twitch is handing
								// out bad emote data.
								if ( ! emote || ! emote.id || ! emote.token )
									continue;

								const id = emote.id,
									name = KNOWN_CODES[emote.token] || emote.token,
									seen = twitch_seen.has(id),
									is_fav = twitch_favorites.includes(id);

								const em = {
									provider: 'twitch',
									id,
									set_id,
									name,
									order: order++,
									locked: locked && ! seen,
									src: getTwitchEmoteURL(id, 1, false),
									srcSet: getTwitchEmoteSrcSet(id, false),
									animSrc: getTwitchEmoteURL(id, 1, true),
									animSrcSet: getTwitchEmoteSrcSet(id, true),
									favorite: is_fav,
									hidden: twitch_hidden.includes(id)
								};

								emotes.push(em);

								if ( ! locked && is_fav && ! seen )
									favorites.push(em);

								twitch_seen.add(id);

								if ( lock_set ) {
									unlockable_emotes.add(id);
									lock_set.add(id);
								}
							}
						}
					}

					const seen_bits = new Set;

					if ( Array.isArray(bits) ) {
						let order;
						for(const emote of bits) {
							if ( ! emote || ! emote.id || ! emote.bitsBadgeTierSummary )
								continue;

							const id = emote.id,
								set_id = emote.setID,
								summary = emote.bitsBadgeTierSummary,
								locked = ! twitch_seen.has(id) && ! summary.self?.isUnlocked;

							// If the emote isn't unlocked, store data about that in the
							// section so we can show appropriate UI to let people know
							// that the emote isn't unlocked.
							if ( locked )
								locks[set_id] = {
									set_id,
									id: 'cheer',
									price: null,
									bits: summary.threshold,
									bits_remaining: summary.self?.numberOfBitsUntilUnlock ?? summary.threshold,
									emotes: new Set([emote.id])
								}

							const is_fav = twitch_favorites.includes(id);

							/*if ( Array.isArray(emote.modifiers) && emote.modifiers.length )
								modifiers[id] = emote.modifiers;*/

							const em = {
								provider: 'twitch',
								id,
								set_id,
								name: emote.token,
								locked,
								order: order++,
								src: getTwitchEmoteURL(id, 1, false),
								srcSet: getTwitchEmoteSrcSet(id, false),
								animSrc: getTwitchEmoteURL(id, 1, true),
								animSrcSet: getTwitchEmoteSrcSet(id, true),
								bits: true,
								bit_value: summary.threshold,
								favorite: is_fav,
								hidden: twitch_hidden.includes(id)
							};

							emotes.push(em);

							if ( ! locked && is_fav && ! twitch_seen.has(id) )
								favorites.push(em);

							seen_bits.add(id);
							twitch_seen.add(id);
						}
					}

					if ( bits_unlocked.length ) {
						for(const emote of bits_unlocked) {
							if ( seen_bits.has(emote.id) )
								continue;

							emotes.push(emote);
						}
					}

					if ( emotes.length ) {
						emotes.sort(sort_emotes);
						channel.push(section);
					}
				}

				let wants_resub_info = false,
					wants_plan_info = false,
					has_new_effects = false;

				const unlocked_effects = [...t.settings.provider.get('unlocked-effects', [])];

				// Finally, emotes added by FrankerFaceZ.
				if ( t.chat.context.get('chat.emotes.enabled') > 1 ) {
					const me = t.site.getUser();

					const use_effect_tab = t.chat.context.get('chat.emote-menu.effect-tab');

					const ffz_room = t.emotes.getRoomSetsWithSources(me?.id, me?.login, props.channel_id, null),
						ffz_subs = t.emotes.getSubSetsWithSources(),
						ffz_global = t.emotes.getGlobalSetsWithSources(me?.id, me?.login),
						seen_sets = new Set(),
						seen_favorites = {};

					let grouped_sets = {};

					for(const [emote_set, provider] of ffz_room) {
						if ( seen_sets.has(emote_set) )
							continue;
						seen_sets.add(emote_set);

						const section = this.processFFZSet(emote_set, provider, favorites, seen_favorites, grouped_sets);
						if ( section ) {
							section.emotes.sort(sort_emotes);

							if ( ! channel.includes(section) )
								channel.push(section);
						}
					}

					grouped_sets = {};

					const global_set_ids = ffz_global.map(x => x?.[0]?.id);

					for(const [emote_set, provider] of ffz_subs) {
						if ( seen_sets.has(emote_set) )
							continue;
						seen_sets.add(emote_set);

						const locked = ! global_set_ids.includes(emote_set.id);

						wants_resub_info = true;

						const section = this.processFFZSet(emote_set, provider, favorites, seen_favorites, grouped_sets, locked, state);
						if ( section ) {
							section.emotes.sort(sort_emotes);

							if ( use_effect_tab && ! effects.includes(section) && section.has_effects ) {
								has_new_effects = this.checkNewEffects(section.emotes, unlocked_effects) || has_new_effects;
								effects.push(section);
							} else if ( ! all.includes(section) )
								all.push(section);
						}
					}

					grouped_sets = {};

					for(const [emote_set, provider] of ffz_global) {
						if ( seen_sets.has(emote_set) )
							continue;
						seen_sets.add(emote_set);

						const section = this.processFFZSet(emote_set, provider, favorites, seen_favorites, grouped_sets);
						if ( section ) {
							section.emotes.sort(sort_emotes);

							if ( use_effect_tab && ! effects.includes(section) && section.has_effects ) {
								has_new_effects = this.checkNewEffects(section.emotes, unlocked_effects) || has_new_effects;
								effects.push(section);

							} else if ( ! all.includes(section) )
								all.push(section);

							if ( ! channel.includes(section) && maybe_call(section.force_global, this, emote_set, props.channel_data && props.channel_data.user, me) )
								channel.push(section);
						}
					}
				}

				// Load FFZ sub data.
				state.wants_resub_info = wants_resub_info;
				state.wants_plan_info = wants_plan_info;

				if ( this.props.visible ) {
					if ( state.tab === 'effects' )
						has_new_effects = false;

					if ( wants_plan_info )
						this.loadFFZPlanData();
					if ( wants_resub_info )
						this.loadFFZSubData();
				}

				// Sort Sets
				channel.sort(sort_sets);
				effects.sort(sort_sets);
				all.sort(sort_sets);

				state.has_channel_tab = channel.length > 0;
				state.has_effect_tab = effects.length > 0;
				state.hasNewEffects = effects.length > 0 && has_new_effects;
				state.unlockedEffects = unlocked_effects;

				return this.buildEmoji(state);
			}


			checkNewEffects(emotes, unlocked) {
				let added = false;
				for(const emote of emotes) {
					if ( emote && ! emote.locked && emote.id && emote.provider === 'ffz' && ! unlocked.includes(emote.id) ) {
						added = true;
						unlocked.push(emote.id);
					}
				}
				return added;
			}


			processFFZSet(emote_set, provider, favorites, seen_favorites, grouped_sets, locked = false, state) { // eslint-disable-line class-methods-use-this
				if ( ! emote_set || ! emote_set.emotes )
					return null;

				const fav_key = emote_set.source || 'ffz',
					known_favs = t.emotes.getFavorites(fav_key),
					known_hidden = t.emotes.getHidden(fav_key),
					seen_favs = seen_favorites[fav_key] = seen_favorites[fav_key] || new Set;

				const key = `${emote_set.merge_source || fav_key}-${emote_set.merge_id || emote_set.id}`,
					pdata = t.emotes.providers.get(provider),
					source = pdata && pdata.name ?
						(pdata.i18n_key ?
							t.i18n.t(pdata.i18n_key, pdata.name, pdata) :
							pdata.name) :
						emote_set.source || 'FFZ',

					title = provider === 'main' ?
						t.i18n.t('emote-menu.main-set', 'Channel Emotes') :
						(emote_set.title || t.i18n.t('emote-menu.unknown-set', `Set #{set_id}`, {set_id: emote_set.id}));

				let sort_key = pdata && pdata.sort_key || emote_set.sort;
				if ( sort_key == null )
					sort_key = emote_set.title.toLowerCase().includes('global') ? 100 : 0;

				let section, emotes, locks;

				if ( grouped_sets[key] ) {
					section = grouped_sets[key];
					emotes = section.emotes;

					if ( key === `${fav_key}-${emote_set.id}` )
						Object.assign(section, {
							sort_key,
							image: emote_set.icon,
							title,
							source,
							force_global: emote_set.force_global
						});

				} else {
					emotes = [];
					section = grouped_sets[key] = {
						sort_key,
						key,
						image: emote_set.icon,
						icon: 'zreknarf',
						title,
						source,
						emotes,
						force_global: emote_set.force_global,
						all_locked: true
					}
				}

				// Try to get resub info.
				const resub = (state || this.state)?.ffz_sub_data?.sets?.[emote_set.id];
				if ( resub ) {
					section.renews = resub.next_bill_date;
					section.ends = resub.expires_at;
				}

				if ( locked ) {
					section.locks = section.locks || {};
					section.locks[emote_set.id] = {
						set_id: emote_set.id,
						id: 'subwoofer',
						is_ffz: true,
						price: 'More Info',
						url: 'https://www.frankerfacez.com/subscribe',
						emotes: locks = new Set()
					}
				} else
					section.all_locked = false;

				for(const emote of Object.values(emote_set.emotes))
					if ( ! emote.hidden ) {
						const is_fav = known_favs.includes(emote.id),
							em = {
								provider: 'ffz',
								id: emote.id,
								set_id: emote_set.id,
								src: emote.src,
								srcSet: emote.srcSet,
								animSrc: emote.animSrc,
								animSrcSet: emote.animSrcSet,
								effects: emote.modifier ? emote.modifier_flags : 0,
								name: emote.name,
								favorite: is_fav,
								locked: locked,
								hidden: known_hidden.includes(emote.id),
								height: emote.height,
								width: emote.width
							};

						emotes.push(em);

						if ( ! locked && is_fav && ! seen_favs.has(emote.id) ) {
							favorites.push(em);
							seen_favs.add(emote.id);
						}

						if ( locked )
							locks.add(emote.id);

						if ( emote.modifier && emote.modifier_flags )
							section.has_effects = true;
					}

				if ( emotes.length )
					return section;
			}


			rebuildData() {
				const state = this.buildState(this.props, this.state);
				this.setState(this.filterState(state.filter, state));
			}


			componentDidUpdate(old_props) {
				if ( this.props.visible && ! old_props.visible ) {
					this.loadData();

					if ( this.state.wants_plan_info )
						this.loadFFZPlanData();
					if ( this.state.wants_resub_info )
						this.loadFFZSubData();
				}

				if ( ! this.props.visible && old_props.visible ) {
					if ( this.state.clearSearch ) {
						this.setState(this.filterState('', this.state));
						return;
					}
				}

				const cd = this.props.channel_data,
					old_cd = old_props.channel_data,
					cd_diff = cd?.user !== old_cd?.user || cd?.channel !== old_cd?.channel,

					// emote_data is rebuilt by Twitch a lot so we can't
					// rely on object equality. Use a deep equality check. It's
					// going to be slower, but it's still faster than rebuilding
					// our entire data structure when nothing actually changed.
					ed = this.props.emote_data,
					old_ed = old_props.emote_data,
					ed_diff = ! deep_equals(ed?.emoteSets, old_ed?.emoteSets) ||
						! deep_equals(ed?.emoteMap, old_ed?.emoteMap);

				if ( cd_diff || ed_diff ||
						this.props.user_id !== old_props.user_id ||
						this.props.channel_id !== old_props.channel_id ||
						this.props.loading !== old_props.loading ||
						this.props.error !== old_props.error ) {
					t.log.debug('Updating emote menu data. cd', cd_diff, ', ed', ed_diff);
					this.rebuildData();
				}
			}

			renderError() {
				return (<div class="tw-align-center tw-pd-1">
					<div class="tw-mg-b-1">
						<div class="tw-mg-2">
							<img
								src="//cdn.frankerfacez.com/emoticon/26608/2"
								srcSet="//cdn.frankerfacez.com/emoticon/26608/2 1x, //cdn.frankerfacez.com/emoticon/26608/4 2x"
							/>
						</div>
						{t.i18n.t('emote-menu.error', 'There was an error rendering this menu.')}
					</div>
					<button class="tw-button" onClick={this.forceUpdate}>
						<span class="tw-button__text">
							{t.i18n.t('error.try-again', 'Try Again')}
						</span>
					</button>
				</div>)
			}

			renderEmpty() { // eslint-disable-line class-methods-use-this
				return (<div class="tw-align-center tw-pd-1">
					<div class="tw-mg-2">
						<img
							src="//cdn.frankerfacez.com/emoticon/26608/2"
							srcSet="//cdn.frankerfacez.com/emoticon/26608/2 1x, //cdn.frankerfacez.com/emoticon/26608/4 2x"
						/>
					</div>
					{this.state.filtered ?
						t.i18n.t('emote-menu.empty-search', 'There are no matching emotes.') :
						this.state.tab === 'fav' ?
							t.i18n.t('emote-menu.empty-favs', "You don't have any favorite emotes. To favorite an emote, find it and {hotkey}-Click it.", {hotkey: IS_OSX ? '⌘' : 'Ctrl'}) :
							t.i18n.t('emote-menu.empty', "There's nothing here.")}
				</div>)
			}

			renderLoading() { // eslint-disable-line class-methods-use-this
				return (<div class="tw-align-center tw-pd-1">
					<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
					{t.i18n.t('emote-menu.loading', 'Loading...')}
				</div>)
			}

			render() {
				if ( ! this.props.visible && (! this.state.stayLoaded || ! this.loadedOnce) )
					return null;

				const loading = this.state.loading || this.props.loading,
					padding = this.state.reducedPadding, //t.chat.context.get('chat.emote-menu.reduced-padding'),
					no_tabs = this.state.combineTabs; //t.chat.context.get('chat.emote-menu.combine-tabs');

				if ( ! loading )
					this.loadedOnce = true;

				let tab, sets, is_emoji, is_favs, is_effect;

				if ( no_tabs ) {
					sets = [
						this.state.filtered_fav_sets,
						this.state.filtered_channel_sets,
						this.state.filtered_effect_sets,
						this.state.filtered_all_sets,
						this.state.filtered_emoji_sets
					].flat();

				} else {
					tab = this.state.tab || t.chat.context.get('chat.emote-menu.default-tab');
					if ( (tab === 'effect' && ! this.state.has_effect_tab) || (tab === 'channel' && ! this.state.has_channel_tab) || (tab === 'emoji' && ! this.state.has_emoji_tab) )
						tab = 'all';

					is_emoji = tab === 'emoji';
					is_favs = tab === 'fav';
					is_effect = tab === 'effect';

					switch(tab) {
						case 'fav':
							sets = this.state.filtered_fav_sets;
							break;
						case 'channel':
							sets = this.state.filtered_channel_sets;
							break;
						case 'effect':
							sets = this.state.filtered_effect_sets;
							break;
						case 'emoji':
							sets = this.state.filtered_emoji_sets;
							break;
						case 'all':
						default:
							sets = this.state.filtered_all_sets;
							break;
					}
				}

				const visibility = this.state.visibility_control,
					whisper = this.props.source === 'whisper';

				return (<div class={`tw-block${this.props.visible ? '' : ' tw-hide'}`} style={{display: this.props.visible ? null : 'none !important'}}>
					<div class="tw-absolute ffz-attached ffz-attached--right ffz-attached--up">
						<div
							class={`ffz-balloon ffz-balloon--auto tw-inline-block tw-border-radius-large tw-c-background-base tw-c-text-inherit tw-elevation-2 ffz--emote-picker${this.state.tall ? ' ffz--emote-picker__tall' : ''}${padding ? ' reduced-padding' : ''}`}
							data-a-target="emote-picker"
							role="dialog"
						>
							<div class={`emote-picker${whisper ? '__whisper' : ''}`}>
								<div class="tw-flex">
									<div
										class={`emote-picker__tab-content${whisper ? '-whisper' : ''} tw-full-width scrollable-area scrollable-area--suppress-scroll-x`}
										data-test-selector="scrollable-area-wrapper"
										data-simplebar
									>
										<div ref={this.saveScrollRef} class="simplebar-scroll-content">
											<div class="simplebar-content">
												{loading && this.renderLoading()}
												{!loading && sets && sets.map((data,idx) => data && (! visibility || (! data.emoji && ! data.is_favorites)) && createElement(
													data.emoji ? t.EmojiSection : t.MenuSection,
													{
														key: data.key,
														idx,
														data,
														ffz_sub_data: this.state.ffz_sub_data,
														emote_modifiers: this.state.emote_modifiers,
														animated: this.state.animated,
														combineTabs: this.state.combineTabs,
														showHeading: this.state.showHeading,
														filtered: this.state.filtered,
														visibility_control: visibility,
														onClickToken: this.props.onClickToken,
														addSection: this.addSection,
														removeSection: this.removeSection,
														startObserving: this.startObserving,
														stopObserving: this.stopObserving
													}
												))}
												{! loading && (! sets || ! sets.length) && this.renderEmpty()}
											</div>
										</div>
									</div>
									{(! loading && this.state.quickNav && ! is_favs) && (<div class={`emote-picker__nav_content${whisper ? '-whisper' : ''} tw-block tw-border-radius-none tw-c-background-alt-2`}>
										<div
											class={`emote-picker__nav-content-overflow${whisper ? '-whisper' : ''} scrollable-area scrollable-area--suppress-scroll-x`}
											data-test-selector="scrollable-area-wrapper"
											data-simplebar
										>
											<div ref={this.saveNavRef} class="simplebar-scroll-content">
												<div class="simplebar-content">
													{!loading && sets && sets.map(data => {
														if ( ! data || (visibility && (data.is_favorites || data.emoji)) )
															return null;

														const active = this.state.active_nav === data.key;

														return (<button
															key={data.key}
															class={`${active ? 'emote-picker-tab-item-wrapper__active ' : ''}${padding ? 'tw-mg-y-05' : 'tw-mg-y-1'} tw-c-text-inherit tw-interactable ffz-interactive ffz-interactable--hover-enabled ffz-interactable--default tw-block tw-full-width ffz-tooltip ffz-tooltip--no-mouse`}
															data-key={data.key}
															data-title={`${data.i18n ? t.i18n.t(data.i18n, data.title) : data.title}\n${data.source_i18n ? t.i18n.t(data.source_i18n, data.source) : data.source}`}
															data-tooltip-side="left"
															onClick={this.clickSideNav}
														>
															<div class={`tw-align-items-center tw-flex tw-justify-content-center ${padding ? '' : 'tw-pd-x-05 '}tw-pd-y-05${active ? ' emote-picker-tab-item-avatar__active tw-c-text-link' : ''}`}>
																{data.image ? <figure class="ffz-avatar ffz-avatar--size-20">
																	<img
																		class="tw-block tw-border-radius-rounded tw-img tw-image-avatar"
																		src={data.image}
																		srcSet={data.image_set}
																	/>
																</figure> : <figure class={`ffz-emote-picker--nav-icon ffz-i-${data.icon || 'zreknarf'}`} />}
															</div>
														</button>);
													})}
													{no_tabs && <div class="tw-mg-y-1 tw-mg-x-05 tw-border-t" />}
													{no_tabs && (<button
														class="tw-mg-y-1 tw-c-text-inherit tw-interactable ffz-interactive ffz-interactable--hover-enabled ffz-interactable--default tw-block tw-full-width ffz-tooltip ffz-tooltip--no-mouse"
														data-title={t.i18n.t('emote-menu.settings', 'Open Settings')}
														data-tooltip-side="left"
														onClick={this.clickSettings}
													>
														<div class={`tw-align-items-center tw-flex tw-justify-content-center ${padding ? '' : 'tw-pd-x-05 '}tw-pd-y-05`}>
															<figure class="ffz-emote-picker--nav-icon ffz-i-cog" />
														</div>
													</button>)}
												</div>
											</div>
										</div>
									</div>)}
								</div>
								<div class="emote-picker__controls-container tw-relative">
									{(is_emoji || this.state.showSearch) && (<div class="tw-border-t tw-pd-1">
										<div class="tw-flex">
											<input
												type="text"
												class="tw-block tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05"
												placeholder={
													is_emoji ?
														t.i18n.t('emote-menu.search-emoji', 'Search for Emoji') :
														t.i18n.t('emote-menu.search', 'Search for Emotes')
												}
												value={this.state.filter}
												autoFocus
												autoCapitalize="off"
												autoCorrect="off"
												onChange={this.handleFilterChange}
												onKeyDown={this.handleKeyDown}
											/>
											{(no_tabs || is_emoji) && ! visibility && this.state.has_emoji_tab && <t.EmojiTonePicker
												tone={this.state.tone}
												choices={this.state.tone_emoji}
												pickTone={this.pickTone}
											/>}
											{(no_tabs || ! is_emoji) && <div class="tw-relative ffz-il-tooltip__container tw-mg-l-1">
												<button
													class={`tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon--primary ffz-core-button tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative${this.state.visibility_control ? ' ffz-core-button--primary' : ' tw-button-icon'}`}
													onClick={this.toggleVisibilityControl}
												>
													<span class="tw-button-icon__icon tw-mg-x-05">
														<figure class={this.state.visibility_control ? 'ffz-i-eye-off' : 'ffz-i-eye'} />
													</span>
												</button>
												<div class="ffz-il-tooltip ffz-il-tooltip--up ffz-il-tooltip--align-right">
													{this.state.visibility_control ?
														t.i18n.t('emote-menu.toggle-hide.on', 'Exit Emote Visibility Control') :
														t.i18n.t('emote-menu.toggle-hide.off', 'Emote Visibility Control')
													}
													<div class="tw-mg-t-1 ffz--tooltip-explain">
														{t.i18n.t('emote-menu.toggle-hide.info', 'Emote Visibility Control allows you to hide emotes from your emote menu, either individually or by set. With Emote Visibility Control enabled, just click an emote to hide or unhide it. Please note that you will still see the emotes in chat if someone uses them, but they won\'t appear in your emote menu.')}
													</div>
												</div>
											</div>}
										</div>
									</div>)}
									{(no_tabs && this.state.quickNav) ? null : (<div class="emote-picker__tab-nav-container tw-flex tw-border-t tw-c-background-alt">
										{! visibility && <div class={`emote-picker-tab-item${tab === 'fav' ? ' emote-picker-tab-item--active' : ''} tw-relative`}>
											<button
												class={`ffz-tooltip tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive${tab === 'fav' ? ' ffz-interactable--selected' : ''}`}
												id="emote-picker__fav"
												data-tab="fav"
												data-tooltip-type="html"
												data-title={t.i18n.t('emote-menu.favorites', 'Favorites')}
												onClick={this.clickTab}
											>
												<div class="tw-inline-flex tw-pd-x-1 tw-pd-y-05 tw-font-size-4">
													<figure class="ffz-i-star" />
												</div>
											</button>
										</div>}
										{this.state.has_channel_tab && <div class={`emote-picker-tab-item${tab === 'channel' ? ' emote-picker-tab-item--active' : ''} tw-relative`}>
											<button
												class={`ffz-tooltip tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive${tab === 'channel' ? ' ffz-interactable--selected' : ''}`}
												id="emote-picker__channel"
												data-tab="channel"
												data-tooltip-type="html"
												data-title={t.i18n.t('emote-menu.channel', 'Channel')}
												onClick={this.clickTab}
											>
												<div class="tw-inline-flex tw-pd-x-1 tw-pd-y-05 tw-font-size-4">
													<figure class="ffz-i-camera" />
												</div>
											</button>
										</div>}
										{this.state.has_effect_tab && <div class={`emote-picker-tab-item${tab === 'effect' ? ' emote-picker-tab-item--active' : ''} tw-relative`}>
											<button
												class={`ffz-tooltip tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive${tab === 'effect' ? ' ffz-interactable--selected' : ''}`}
												id="emote-picker__effect"
												data-tab="effect"
												data-tooltip-type="html"
												data-title={t.i18n.t('emote-menu.effects', 'Emote Effects')}
												onClick={this.clickTab}
											>
												{this.state.hasNewEffects && (<div class="ffz-new-indicator" />)}
												<div class="tw-inline-flex tw-pd-x-1 tw-pd-y-05 tw-font-size-4">
													<figure class="ffz-i-fx" />
												</div>
											</button>
										</div>}
										<div class={`emote-picker-tab-item${tab === 'all' ? ' emote-picker-tab-item--active' : ''} tw-relative`}>
											<button
												class={`ffz-tooltip tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive${tab === 'all' ? ' ffz-interactable--selected' : ''}`}
												id="emote-picker__all"
												data-tab="all"
												data-tooltip-type="html"
												data-title={t.i18n.t('emote-menu.my-emotes', 'My Emotes')}
												onClick={this.clickTab}
											>
												<div class="tw-inline-flex tw-pd-x-1 tw-pd-y-05 tw-font-size-4">
													<figure class="ffz-i-channels" />
												</div>
											</button>
										</div>
										{! visibility && this.state.has_emoji_tab && <div class={`emote-picker-tab-item${tab === 'emoji' ? ' emote-picker-tab-item--active' : ''} tw-relative`}>
											<button
												class={`ffz-tooltip tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive${tab === 'emoji' ? ' ffz-interactable--selected' : ''}`}
												id="emote-picker__emoji"
												data-tab="emoji"
												data-tooltip-type="html"
												data-title={t.i18n.t('emote-menu.emoji', 'Emoji')}
												onClick={this.clickTab}
											>
												<div class="tw-inline-flex tw-pd-x-1 tw-pd-y-05 tw-font-size-4">
													<figure class="ffz-i-smile" />
												</div>
											</button>
										</div>}
										<div class="tw-flex-grow-1" />
										<div class="emote-picker-tab-item tw-relative">
											<button
												class="ffz-tooltip tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
												data-tooltip-type="html"
												data-title={t.i18n.t('emote-menu.settings', 'Open Settings')}
												onClick={this.clickSettings}
											>
												<div class="tw-inline-flex tw-pd-x-1 tw-pd-y-05 tw-font-size-4">
													<figure class="ffz-i-cog" />
												</div>
											</button>
										</div>
									</div>)}
								</div>
							</div>
						</div>
					</div>
				</div>);
			}
		}

		this.fine.wrap('ffz-emote-menu', this.MenuComponent);
	}


	async getFFZSubPrices() {
		let result;
		try {
			result = await fetch(`${this.staging.api}/payment/plans`)
				.then(r => r.ok ? r.json() : null);
		} catch(err) {
			this.log.error('Unable to load subscription prices from server.', err);
			result = null;
		}

		// We only care about:
		// 1. What collections are granted by the available plan.
		// 2. How much they cost.

		const out = {
			sets: {}
		};

		for(const plan of Object.values(result.plans)) {
			if ( ! Array.isArray(plan.temporary_collections) )
				continue;

			let prices;
			for(const gw_plan of Object.values(result.gateway_plans)) {
				if ( gw_plan.plan_id === plan.id && gw_plan.months === 1 ) {
					prices = gw_plan.prices;
					break;
				}
			}

			if ( prices )
				for(const set_id of plan.temporary_collections) {
					out.sets[set_id] = {
						plan_id: plan.id,
						prices
					}
				}
		}

		return out;
	}


	async getFFZSubData() {
		const me = this.resolve('site').getUser();
		if ( ! me )
			return null;

		const token = await this.resolve('socket').getBareAPIToken();
		if ( ! token )
			return null;

		let result;
		try {
			result = await fetch(`${this.staging.api}/v2/subscription/status?include=plan`, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			})
				.then(r => r.ok ? r.json() : null);
		} catch(err) {
			this.log.error('Unable to load subscription status from server.', err);
			result = null;
		}

		// We only care about:
		// 1. If the user has a free sub available
		// 2. What collections can expire/renew
		// 3. When they expire/renew

		if ( ! result )
			return {error: true};

		const out = {
			has_free_sub: result.user?.bonus_month_eligible ?? false,
			sets: {}
		};

		if ( result.user?.active_subs )
			for(const entry of Object.values(result.user.active_subs)) {
				const plan = result.plans?.[entry.id];
				if ( Array.isArray(plan?.temporary_collections) ) {
					for(const set_id of plan.temporary_collections)
						out.sets[set_id] = {
							plan_id: entry.id,
							expires_at: entry.expires_at
								? new Date(entry.expires_at)
								: null,
							next_bill_date: entry.next_bill_date
								? new Date(entry.next_bill_date)
								: null
						};
				}
			}

		return out;
	}


	async getData(sets, force, cursor = null, nodes = []) {
		if ( this._data ) {
			if ( ! force && set_equals(sets, this._data_sets) )
				return this._data;
			else {
				this._data = null;
				this._data_sets = null;
			}
		}

		let data;
		try {
			data = await this.apollo.client.query({
				query: SUB_STATUS,
				variables: {
					first: 75,
					after: cursor,
					criteria: {
						filter: 'ALL'
					}
				},
				fetchPolicy: force ? 'network-only' : 'cache-first'
			});

		} catch(err) {
			this.log.warn('Error fetching additional emote menu data.', err);
			return this._data = null;
		}

		const out = {},
			curr_nodes = get('data.currentUser.subscriptionBenefits.edges.@each.node', data),
			has_next_page = get('data.currentUser.subscriptionBenefits.pageInfo.hasNextPage', data),
			curr_cursor = get('data.currentUser.subscriptionBenefits.edges.@last.cursor', data);

		nodes = nodes.concat(curr_nodes);

		if (has_next_page) {
			return this.getData(sets, force, curr_cursor, nodes);
		}

		if ( nodes && nodes.length )
			for(const node of nodes) {
				const product = node && node.product,
					set_id = product && product.emoteSetID;

				if ( ! set_id )
					continue;

				out[set_id] = {
					ends: maybe_date(node.endsAt),
					renews: maybe_date(node.renewsAt),
					prime: node.purchasedWithPrime,
					set_id,
					type: product.type,
					gift: node.gift?.isGift
				};
			}

		this._data_sets = sets;
		return this._data = out;
	}
}


EmoteMenu.getData = once(EmoteMenu.getData);
EmoteMenu.getFFZSubData = once(EmoteMenu.getFFZSubData);
EmoteMenu.getFFZSubPrices = once(EmoteMenu.getFFZSubPrices);
