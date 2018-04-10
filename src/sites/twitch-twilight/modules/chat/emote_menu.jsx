'use strict';

// ============================================================================
// Chat Emote Menu
// ============================================================================

import {has, get, once, set_equals} from 'utilities/object';
import {IS_OSX, KNOWN_CODES, TWITCH_EMOTE_BASE, REPLACEMENT_BASE, REPLACEMENTS} from 'utilities/constants';

import Twilight from 'site';
import Module from 'utilities/module';

import SUB_STATUS from './sub_status.gql';

function maybe_date(val) {
	if ( ! val )
		return val;

	try {
		return new Date(val);
	} catch(err) {
		return null;
	}
}


const EMOTE_SORTERS = [
	function id_asc(a, b) {
		return a.id - b.id;
	},
	function id_desc(a, b) {
		return b.id - a.id;
	},
	function name_asc(a, b) {
		const a_n = a.name.toLowerCase(),
			b_n = b.name.toLowerCase();

		if ( a_n < b_n ) return -1;
		if ( a_n > b_n ) return 1;

		return a.id - b.id;
	},
	function name_desc(a, b) {
		const a_n = a.name.toLowerCase(),
			b_n = b.name.toLowerCase();

		if ( a_n > b_n ) return -1;
		if ( a_n < b_n ) return 1;

		return b.id - a.id;
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

		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('chat.badges');
		this.inject('chat.emotes');

		this.inject('site');
		this.inject('site.fine');
		this.inject('site.apollo');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');

		this.SUB_STATUS = SUB_STATUS;

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
			requires: ['chat.emote-menu.enabled'],
			default: false,
			process(ctx, val) {
				return ctx.get('chat.emote-menu.enabled') ? val : false
			},

			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Replace the emote menu icon with the FFZ icon for that classic feel.',
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
					{value: 'all', title: 'My Emotes'}
				]
			}
		});


		this.settings.add('chat.emote-menu.sort-emotes', {
			default: 0,
			ui: {
				path: 'Chat > Emote Menu >> Sorting',
				title: 'Sort Emotes By',
				component: 'setting-select-box',
				data: [
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
			n => n.subscriptionProductHasEmotes,
			Twilight.CHAT_ROUTES
		)


		this.MenuWrapper = this.fine.wrap('ffz-emote-menu');
		this.MenuSection = this.fine.wrap('ffz-menu-section');
		this.MenuEmote = this.fine.wrap('ffz-menu-emote');
	}

	onEnable() {
		this.on('i18n:update', () => this.EmoteMenu.forceUpdate());
		this.on('chat.emotes:update-default-sets', this.maybeUpdate, this);
		this.on('chat.emotes:update-user-sets', this.maybeUpdate, this);
		this.on('chat.emotes:update-room-sets', this.maybeUpdate, this);
		this.on('chat.emotes:change-favorite', this.maybeUpdate, this);

		this.chat.context.on('changed:chat.emote-menu.enabled', () =>
			this.EmoteMenu.forceUpdate());

		const fup = () => this.MenuWrapper.forceUpdate();
		const rebuild = () => {
			for(const inst of this.MenuWrapper.instances)
				inst.componentWillReceiveProps(inst.props);
		}

		this.chat.context.on('changed:chat.fix-bad-emotes', rebuild);
		this.chat.context.on('changed:chat.emote-menu.sort-emotes', rebuild);
		this.chat.context.on('changed:chat.emote-menu.sort-tiers-last', rebuild);

		this.chat.context.on('changed:chat.emote-menu.show-heading', fup);
		this.chat.context.on('changed:chat.emote-menu.show-search', fup);
		this.chat.context.on('changed:chat.emote-menu.reduced-padding', fup);

		this.chat.context.on('changed:chat.emote-menu.icon', val =>
			this.css_tweaks.toggle('emote-menu', val));

		this.css_tweaks.toggle('emote-menu', this.chat.context.get('chat.emote-menu.icon'));

		const t = this,
			React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		if ( ! createElement )
			return t.log.warn('Unable to get React.');

		this.defineClasses();


		this.EmoteMenu.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				if ( ! this.props || ! has(this.props, 'channelOwnerID') || ! t.chat.context.get('chat.emote-menu.enabled') )
					return old_render.call(this);

				return (<t.MenuComponent
					visible={this.props.visible}
					toggleVisibility={this.props.toggleVisibility}
					onClickEmote={this.props.onClickEmote}
					channel_data={this.props.channelData}
					emote_data={this.props.emoteSetsData}
					user_id={this.props.currentUserID}
					channel_id={this.props.channelOwnerID}
					loading={this.state.gqlLoading}
					error={this.state.gqlError}
				/>)
			}

			this.EmoteMenu.forceUpdate();
		})
	}

	maybeUpdate() {
		if ( this.chat.context.get('chat.emote-menu.enabled') )
			this.EmoteMenu.forceUpdate();
	}


	defineClasses() {
		const t = this,
			storage = this.settings.provider,
			React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		this.MenuEmote = class FFZMenuEmote extends React.Component {
			constructor(props) {
				super(props);
				this.handleClick = this.handleClick.bind(this);
			}

			handleClick(event) {
				if ( ! t.emotes.handleClick(event) )
					this.props.onClickEmote(this.props.data.name);
			}

			render() {
				const data = this.props.data,
					lock = this.props.lock,
					locked = this.props.locked,
					favorite = data.favorite,

					sellout = lock ?
						this.props.all_locked ?
							t.i18n.t('emote-menu.emote-sub', 'Subscribe for %{price} to unlock this emote.', lock) :
							t.i18n.t('emote-menu.emote-up', 'Upgrade your sub to %{price} to unlock this emote.', lock)
						: null;

				return (<button
					class={`ffz-tooltip emote-picker__emote-link${locked ? ' locked' : ''}`}
					data-tooltip-type="emote"
					data-provider={data.provider}
					data-id={data.id}
					data-set={data.set_id}
					data-no-source={this.props.source}
					data-name={data.name}
					aria-label={data.name}
					data-locked={data.locked}
					data-sellout={sellout}
					onClick={!data.locked && this.handleClick}
				>
					<figure class="emote-picker__emote-figure">
						<img
							class="emote-picker__emote-image"
							src={data.src}
							srcSet={data.srcSet}
							alt={data.name}
						/>
					</figure>
					{favorite && (<figure class="ffz--favorite ffz-i-star" />)}
					{locked && (<figure class="ffz-i-lock" />)}
				</button>);
			}
		}

		this.fine.wrap('ffz-menu-emote', this.MenuEmote);


		this.MenuSection = class FFZMenuSection extends React.Component {
			constructor(props) {
				super(props);

				const collapsed = storage.get('emote-menu.collapsed') || [];
				this.state = {collapsed: props.data && collapsed.includes(props.data.key)}

				this.clickHeading = this.clickHeading.bind(this);
				this.onMouseEnter = this.onMouseEnter.bind(this);
				this.onMouseLeave = this.onMouseLeave.bind(this);
			}

			clickHeading() {
				if ( this.props.filter )
					return;

				const collapsed = storage.get('emote-menu.collapsed') || [],
					key = this.props.data.key,
					idx = collapsed.indexOf(key),
					val = ! this.state.collapsed;

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
				const set_id = parseInt(event.currentTarget.dataset.setId,10);
				this.setState({unlocked: set_id});
			}

			onMouseLeave() {
				this.setState({unlocked: null});
			}

			render() {
				const data = this.props.data,
					filtered = this.props.filtered;

				let show_heading = ! data.is_favorites && t.chat.context.get('chat.emote-menu.show-heading');
				if ( show_heading === 2 )
					show_heading = ! filtered;
				else
					show_heading = !! show_heading;

				const collapsed = show_heading && ! filtered && this.state.collapsed;

				if ( ! data )
					return null;

				let image;
				if ( data.image )
					image = (<img class="ffz--menu-badge" src={data.image} srcSet={data.image_set} />);
				else
					image = (<figure class={`ffz--menu-badge ffz-i-${data.icon || 'zreknarf'}`} />);

				let calendar;

				const renews = data.renews && data.renews - new Date,
					ends = data.ends && data.ends - new Date;

				if ( renews > 0 ) {
					const time = t.i18n.toHumanTime(renews / 1000);
					calendar = {
						icon: 'calendar',
						message: t.i18n.t('emote-menu.sub-renews', 'This sub renews in %{time}.', {time})
					}

				} else if ( ends ) {
					const time = t.i18n.toHumanTime(ends / 1000);
					if ( data.prime )
						calendar = {
							icon: 'crown',
							message: t.i18n.t('emote-menu.sub-prime', 'This is your free sub with Twitch Prime.\nIt ends in %{time}.', {time})
						}
					else
						calendar = {
							icon: 'calendar-empty',
							message: t.i18n.t('emote-menu.sub-ends', 'This sub ends in %{time}.', {time})
						}
				}

				return (<section data-key={data.key} class={filtered ? 'filtered' : ''}>
					{show_heading ? (<heading class="tw-pd-1 tw-border-b tw-flex tw-flex-nowrap" onClick={this.clickHeading}>
						{image}
						<div class="tw-pd-l-05">
							{data.title || t.i18n.t('emote-menu.unknown', 'Unknown Source')}
							{calendar && (<span
								class={`tw-mg-x-05 ffz--expiry-info ffz-tooltip ffz-i-${calendar.icon}`}
								data-tooltip-type="html"
								data-title={calendar.message}
							/>)}
						</div>
						<div class="tw-flex-grow-1" />
						{data.source || 'FrankerFaceZ'}
						<figure class={`tw-pd-l-05 ffz-i-${collapsed ? 'left' : 'down'}-dir`} />
					</heading>) : null}
					{collapsed || this.renderBody(show_heading)}
				</section>)
			}

			renderBody(show_sources) {
				const data = this.props.data,
					filtered = this.props.filtered,
					lock = data.locks && data.locks[this.state.unlocked],
					emotes = data.filtered_emotes && data.filtered_emotes.map(emote => (! filtered || ! emote.locked) && (<t.MenuEmote
						key={emote.id}
						onClickEmote={this.props.onClickEmote}
						data={emote}
						source={show_sources}
						locked={emote.locked && (! lock || ! lock.emotes.has(emote.id))}
						all_locked={data.all_locked}
						lock={data.locks && data.locks[emote.set_id]}
					/>));

				return (<div class="tw-pd-1 tw-border-b tw-c-background-alt tw-align-center">
					{emotes}
					{!filtered && this.renderSellout()}
				</div>)
			}

			renderSellout() {
				const data = this.props.data;

				if ( ! data.all_locked || ! data.locks )
					return null;

				const lock = data.locks[this.state.unlocked];

				return (<div class="tw-mg-1 tw-border-t tw-pd-t-1 tw-mg-b-0">
					{lock ?
						t.i18n.t('emote-menu.sub-unlock', 'Subscribe for %{price} to unlock %{count} emote%{count|en_plural}', {price: lock.price, count: lock.emotes.size}) :
						t.i18n.t('emote-menu.sub-basic', 'Subscribe to unlock some emotes')}
					<div class="ffz--sub-buttons tw-mg-t-05">
						{Object.values(data.locks).map(lock => (<a
							key={lock.price}
							class="tw-button"
							href={lock.url}
							target="_blank"
							rel="noopener noreferrer"
							data-set-id={lock.set_id}
							onMouseEnter={this.onMouseEnter}
							onMouseLeave={this.onMouseLeave}
						>
							<span class="tw-button__text">
								{lock.price}
							</span>
						</a>))}
					</div>
				</div>)
			}
		}

		this.fine.wrap('ffz-menu-section', this.MenuSection);


		this.MenuComponent = class FFZEmoteMenuComponent extends React.Component {
			constructor(props) {
				super(props);

				this.state = {tab: null}
				this.componentWillReceiveProps(props);

				this.clickTab = this.clickTab.bind(this);
				this.clickRefresh = this.clickRefresh.bind(this);
				this.handleFilterChange = this.handleFilterChange.bind(this);
				this.handleKeyDown = this.handleKeyDown.bind(this);
			}

			componentDidMount() {
				window.ffz_menu = this;
			}

			componentWillUnmount() {
				if ( window.ffz_menu === this )
					window.ffz_menu = null;
			}

			clickTab(event) {
				this.setState({
					tab: event.target.dataset.tab
				});
			}

			clickRefresh(event) {
				const target = event.currentTarget,
					tt = target && target._ffz_tooltip$0;

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
			}

			handleFilterChange(event) {
				this.setState(this.filterState(event.target.value, this.state));
			}

			handleKeyDown(event) {
				if ( event.keyCode === 27 )
					this.props.toggleVisibility();
			}

			loadData(force = false, props, state) {
				state = state || this.state;
				if ( ! state )
					return false;

				props = props || this.props;

				const emote_sets = props.emote_data && props.emote_data.emoteSets,
					sets = Array.isArray(emote_sets) ? new Set(emote_sets.map(x => parseInt(x.id, 10))) : new Set;

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

			loadSets(props) { // eslint-disable-line class-methods-use-this
				const emote_sets = props.emote_data && props.emote_data.emoteSets;
				if ( ! emote_sets || ! emote_sets.length )
					return;

				for(const emote_set of emote_sets) {
					const set_id = parseInt(emote_set.id, 10);
					t.emotes.getTwitchSetChannel(set_id)
				}
			}

			filterState(input, old_state) {
				const state = Object.assign({}, old_state);

				state.filter = input;
				state.filtered = input && input.length > 0 && input !== ':' || false;

				state.filtered_channel_sets = this.filterSets(input, state.channel_sets);
				state.filtered_all_sets = this.filterSets(input, state.all_sets);
				state.filtered_fav_sets = this.filterSets(input, state.fav_sets);

				return state;
			}

			filterSets(input, sets) {
				const out = [];
				if ( ! sets || ! sets.length )
					return out;

				const filtering = input && input.length > 0 && input !== ':';

				for(const emote_set of sets) {
					const filtered = emote_set.filtered_emotes = emote_set.emotes.filter(emote =>
						! filtering || (! emote.locked && this.doesEmoteMatch(input, emote)));

					if ( filtered.length )
						out.push(emote_set);
				}

				return out;
			}

			doesEmoteMatch(filter, emote) { //eslint-disable-line class-methods-use-this
				if ( ! filter || ! filter.length )
					return true;

				const emote_lower = emote.name.toLowerCase(),
					term_lower = filter.toLowerCase();

				if ( ! filter.startsWith(':') )
					return emote_lower.includes(term_lower);

				if ( emote_lower.startsWith(term_lower.slice(1)) )
					return true;

				const idx = emote.name.indexOf(filter.charAt(1).toUpperCase());
				if ( idx !== -1 )
					return emote_lower.slice(idx+1).startsWith(term_lower.slice(2));
			}


			buildState(props, old_state) {
				const state = Object.assign({}, old_state),

					data = state.set_data || {},
					channel = state.channel_sets = [],
					all = state.all_sets = [],
					favorites = state.favorites = [];

				// If we're still loading, don't set any data.
				if ( props.loading || props.error || state.loading )
					return state;

				// If we start loading because the sets we have
				// don't match, don't set any data either.
				if ( state.set_data && this.loadData(false, props, state) )
					return state;

				// Sorters
				const sorter = EMOTE_SORTERS[t.chat.context.get('chat.emote-menu.sort-emotes')],
					sort_tiers = t.chat.context.get('chat.emote-menu.sort-tiers-last'),
					sort_emotes = (a,b) => {
						if ( a.inventory || b.inventory )
							return sorter(a,b);

						if ( ! a.locked && b.locked ) return -1;
						if ( a.locked && ! b.locked ) return 1;

						if ( sort_tiers || a.locked || b.locked ) {
							if ( a.set_id < b.set_id ) return -1;
							if ( a.set_id > b.set_id ) return 1;
						}

						return sorter(a,b);
					}

				// Start with the All tab. Some data calculated for
				// all is re-used for the Channel tab.

				const emote_sets = props.emote_data && props.emote_data.emoteSets,
					emote_map = props.emote_data && props.emote_data.emoteMap,
					twitch_favorites = t.emotes.getFavorites('twitch'),
					twitch_seen_favorites = new  Set,

					inventory = t.emotes.twitch_inventory_sets || new Set,
					grouped_sets = {},
					set_ids = new Set;

				if ( Array.isArray(emote_sets) )
					for(const emote_set of emote_sets) {
						if ( ! emote_set || ! Array.isArray(emote_set.emotes) )
							continue;

						const set_id = parseInt(emote_set.id, 10),
							is_inventory = inventory.has(set_id),
							set_data = data[set_id] || {},
							more_data = t.emotes.getTwitchSetChannel(set_id),
							image = set_data.image,
							image_set = set_data.image_set;

						set_ids.add(set_id);

						let chan = set_data && set_data.user;
						if ( ! chan && more_data && more_data.c_id )
							chan = {
								id: more_data.c_id,
								login: more_data.c_name,
								display_name: more_data.c_name,
								bad: true
							};

						let key = `twitch-set-${set_id}`,
							sort_key = 0,
							icon = 'twitch',
							title = chan && chan.display_name;

						if ( title )
							key = `twitch-${chan.id}`;

						else {
							if ( is_inventory ) {
								title = t.i18n.t('emote-menu.inventory', 'Inventory');
								key = 'twitch-inventory';
								icon = 'inventory';
								sort_key = 50;

							} else if ( more_data ) {
								title = more_data.c_name;

								if ( title === '--global--' ) {
									title = t.i18n.t('emote-menu.global', 'Global Emotes');
									sort_key = 100;

								} else if ( title === '--twitch-turbo--' || title === 'turbo' || title === '--turbo-faces--' ) {
									title = t.i18n.t('emote-menu.turbo', 'Turbo');
									sort_key = 75;

								} else if ( title === '--prime--' || title === '--prime-faces--' ) {
									title = t.i18n.t('emote-menu.prime', 'Prime');
									icon = 'crown';
									sort_key = 75;
								}
							} else
								title = t.i18n.t('emote-menu.unknown-set', 'Set #%{set_id}', {set_id})
						}

						let section, emotes;

						if ( grouped_sets[key] ) {
							section = grouped_sets[key];
							emotes = section.emotes;

							if ( chan && ! chan.bad && section.bad ) {
								section.title = title;
								section.image = image;
								section.image_set = image_set;
								section.icon = icon;
								section.sort_key = sort_key;
								section.bad = false;
							}

						} else {
							emotes = [];
							section = grouped_sets[key] = {
								sort_key,
								bad: chan ? chan.bad : true,
								key,
								image,
								image_set,
								icon,
								title,
								source: t.i18n.t('emote-menu.twitch', 'Twitch'),
								emotes,
								renews: set_data.renews,
								ends: set_data.ends,
								prime: set_data.prime
							}
						}

						for(const emote of emote_set.emotes) {
							const id = parseInt(emote.id, 10),
								name = KNOWN_CODES[emote.token] || emote.token,
								mapped = emote_map && emote_map[name],
								overridden = mapped && mapped.id != id,
								replacement = REPLACEMENTS[id],
								is_fav = twitch_favorites.includes(id);

							let src, srcSet;

							if ( replacement && t.chat.context.get('chat.fix-bad-emotes') )
								src = `${REPLACEMENT_BASE}${replacement}`;
							else {
								const base = `${TWITCH_EMOTE_BASE}${id}`;
								src = `${base}/1.0`;
								srcSet = `${src} 1x, ${base}/2.0 2x`
							}

							const em = {
								provider: 'twitch',
								id,
								set_id,
								name,
								src,
								srcSet,
								overridden: overridden ? parseInt(mapped.id,10) : null,
								inventory: is_inventory,
								favorite: is_fav
							};

							emotes.push(em);
							if ( is_fav && ! twitch_seen_favorites.has(id) ) {
								favorites.push(em);
								twitch_seen_favorites.add(id);
							}
						}

						if ( emotes.length ) {
							emotes.sort(sort_emotes);

							if ( ! all.includes(section) )
								all.push(section);
						}
					}


				// Now we handle the current Channel's emotes.

				const user = props.channel_data && props.channel_data.user,
					products = user && user.subscriptionProducts;

				if ( Array.isArray(products) ) {
					const badge = t.badges.getTwitchBadge('subscriber', '0', user.id, user.login),
						emotes = [],
						locks = {},
						section = {
							sort_key: -10,
							key: `twitch-${user.id}`,
							image: badge && badge.image1x,
							image_set: badge && `${badge.image1x} 1x, ${badge.image2x} 2x, ${badge.image4x} 4x`,
							icon: 'twitch',
							title: t.i18n.t('emote-menu.sub-set', 'Subscriber Emotes'),
							source: t.i18n.t('emote-menu.twitch', 'Twitch'),
							emotes,
							locks,
							all_locked: true
						};

					for(const product of products) {
						if ( ! product || ! Array.isArray(product.emotes) )
							continue;

						const set_id = parseInt(product.emoteSetID, 10),
							set_data = data[set_id],
							locked = ! set_ids.has(set_id);

						let lock_set;

						if ( set_data ) {
							section.renews = set_data.renews;
							section.ends = set_data.ends;
							section.prime = set_data.prime;
						}

						// If the channel is locked, store data about that in the
						// section so we can show appropriate UI to let people
						// subscribe. Also include all the already known emotes
						// in the list of emotes this product unlocks.
						if ( locked )
							locks[set_id] = {
								set_id,
								id: product.id,
								price: product.price,
								url: product.url,
								emotes: lock_set = new Set(emotes.map(e => e.id))
							}
						else
							section.all_locked = false;

						for(const emote of product.emotes) {
							const id = parseInt(emote.id, 10),
								base = `${TWITCH_EMOTE_BASE}${id}`,
								name = KNOWN_CODES[emote.token] || emote.token,
								is_fav = twitch_favorites.includes(id);

							const em = {
								provider: 'twitch',
								id,
								set_id,
								name,
								locked,
								src: `${base}/1.0`,
								srcSet: `${base}/1.0 1x, ${base}/2.0 2x`,
								favorite: is_fav
							};

							emotes.push(em);

							if ( ! locked && is_fav && ! twitch_seen_favorites.has(id) ) {
								favorites.push(em);
								twitch_seen_favorites.add(id);
							}

							if ( lock_set )
								lock_set.add(id);
						}
					}

					if ( emotes.length ) {
						emotes.sort(sort_emotes);
						channel.push(section);
					}
				}


				// Finally, emotes added by FrankerFaceZ.
				const me = t.site.getUser();
				if ( me ) {
					const ffz_room = t.emotes.getRoomSetsWithSources(me.id, me.login, props.channel_id, null),
						ffz_global = t.emotes.getGlobalSetsWithSources(me.id, me.login),
						seen_favorites = {};

					for(const [emote_set, provider] of ffz_room) {
						const section = this.processFFZSet(emote_set, provider, favorites, seen_favorites);
						if ( section ) {
							section.emotes.sort(sort_emotes);
							channel.push(section);
						}
					}

					for(const [emote_set, provider] of ffz_global) {
						const section = this.processFFZSet(emote_set, provider, favorites, seen_favorites);
						if ( section ) {
							section.emotes.sort(sort_emotes);
							all.push(section);
						}
					}
				}


				// Sort Sets
				channel.sort(sort_sets);
				all.sort(sort_sets);

				state.has_channel_tab = channel.length > 0;

				state.fav_sets = [{
					key: 'favorites',
					is_favorites: true,
					emotes: favorites
				}];

				// We use this sorter because we don't want things grouped by sets.
				favorites.sort(sorter);

				return state;
			}


			processFFZSet(emote_set, provider, favorites, seen_favorites) { // eslint-disable-line class-methods-use-this
				if ( ! emote_set || ! emote_set.emotes )
					return null;

				const fav_key = emote_set.source || 'ffz',
					known_favs = t.emotes.getFavorites(fav_key),
					seen_favs = seen_favorites[fav_key] = seen_favorites[fav_key] || new Set;

				const pdata = t.emotes.providers.get(provider),
					source = pdata && pdata.name ?
						(pdata.i18n_key ?
							t.i18n.t(pdata.i18n_key, pdata.name, pdata) :
							pdata.name) :
						emote_set.source || 'FrankerFaceZ',

					title = provider === 'main' ?
						t.i18n.t('emote-menu.main-set', 'Channel Emotes') :
						(emote_set.title || t.i18n.t('emote-menu.unknown', `Set #${emote_set.id}`));

				let sort_key = pdata && pdata.sort_key || emote_set.sort;
				if ( sort_key == null )
					sort_key = emote_set.title.toLowerCase().includes('global') ? 100 : 0;

				const emotes = [],
					section = {
						sort_key,
						key: `ffz-${emote_set.id}`,
						image: emote_set.icon,
						icon: 'zreknarf',
						title,
						source,
						emotes,
					};

				for(const emote of Object.values(emote_set.emotes))
					if ( ! emote.hidden ) {
						const is_fav = known_favs.includes(emote.id),
							em = {
								provider: 'ffz',
								id: emote.id,
								set_id: emote_set.id,
								src: emote.urls[1],
								srcSet: emote.srcSet,
								name: emote.name,
								favorite: is_fav
							};

						emotes.push(em);
						if ( is_fav && ! seen_favs.has(emote.id) ) {
							favorites.push(em);
							seen_favs.add(emote.id);
						}
					}

				if ( emotes.length )
					return section;
			}


			componentWillReceiveProps(props) {
				if ( props.visible )
					this.loadData();

				this.loadSets(props);

				const state = this.buildState(props, this.state);
				this.setState(this.filterState(state.filter, state));
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
							t.i18n.t('emote-menu.empty-favs', "You don't have any favorite emotes. To favorite an emote, find it and %{hotkey}-Click it.", {hotkey: IS_OSX ? '⌘' : 'Ctrl'}) :
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
				if ( ! this.props.visible )
					return null;

				const loading = this.state.loading || this.props.loading,
					padding = t.chat.context.get('chat.emote-menu.reduced-padding');

				let tab = this.state.tab || t.chat.context.get('chat.emote-menu.default-tab'), sets;
				if ( tab === 'channel' && ! this.state.has_channel_tab )
					tab = 'all';

				switch(tab) {
					case 'fav':
						sets = this.state.filtered_fav_sets;
						break;
					case 'channel':
						sets = this.state.filtered_channel_sets;
						break;
					case 'all':
					default:
						sets = this.state.filtered_all_sets;
						break;
				}

				return (<div
					class={`tw-balloon tw-balloon--md tw-balloon--up tw-balloon--right tw-block tw-absolute ffz--emote-picker${padding ? ' reduced-padding' : ''}`}
					data-a-target="emote-picker"
				>
					<div class="tw-border tw-elevation-1 tw-border-radius-small tw-c-background">
						<div
							class="emote-picker__tab-content scrollable-area"
							data-test-selector="scrollable-area-wrapper"
							data-simplebar
						>
							<div class="simplebar-scroll-content">
								<div class="simplebar-content">
									{loading && this.renderLoading()}
									{!loading && sets && sets.map(data => (<t.MenuSection
										key={data.key}
										data={data}
										filtered={this.state.filtered}
										onClickEmote={this.props.onClickEmote}
									/>))}
									{! loading && (! sets || ! sets.length) && this.renderEmpty()}
								</div>
							</div>
						</div>
						<div class="emote-picker__controls-container tw-relative">
							{t.chat.context.get('chat.emote-menu.show-search') && (<div class="tw-border-t tw-pd-1">
								<div class="tw-relative">
									<input
										type="text"
										class="tw-input"
										onChange={this.handleFilterChange}
										onKeyDown={this.handleKeyDown}
										placeholder={t.i18n.t('emote-menu.search', 'Search for Emotes')}
										value={this.state.filter}
										autoFocus
										autoCapitalize="off"
										autoCorrect="off"
									/>
								</div>
							</div>)}
							<div class="emote-picker__tabs-container tw-flex tw-border-t tw-c-background">
								<div
									class={`ffz-tooltip emote-picker__tab tw-pd-x-1${tab === 'fav' ? ' emote-picker__tab--active' : ''}`}
									id="emote-picker__fav"
									data-tab="fav"
									data-tooltip-type="html"
									data-title={t.i18n.t('emote-menu.favorites', 'Favorites')}
									onClick={this.clickTab}
								>
									<figure class="ffz-i-star" />
								</div>
								{this.state.has_channel_tab && <div
									class={`emote-picker__tab tw-pd-x-1${tab === 'channel' ? ' emote-picker__tab--active' : ''}`}
									id="emote-picker__channel"
									data-tab="channel"
									onClick={this.clickTab}
								>
									{t.i18n.t('emote-menu.channel', 'Channel')}
								</div>}
								<div
									class={`emote-picker__tab tw-pd-x-1${tab === 'all' ? ' emote-picker__tab--active' : ''}`}
									id="emote-picker__all"
									data-tab="all"
									onClick={this.clickTab}
								>
									{t.i18n.t('emote-menu.my-emotes', 'My Emotes')}
								</div>
								<div class="tw-flex-grow-1" />
								{!loading && (<div
									class="ffz-tooltip emote-picker__tab tw-pd-x-1 tw-mg-r-0"
									data-tooltip-type="html"
									data-title="Refresh Data"
									onClick={this.clickRefresh}
								>
									<figure class="ffz-i-arrows-cw" />
								</div>)}
							</div>
						</div>
					</div>
				</div>);
			}
		}

		this.fine.wrap('ffz-emote-menu', this.MenuComponent);
	}


	async getData(sets, force) {
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
					first: 100,
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
			nodes = get('data.currentUser.subscriptionBenefits.edges.@each.node', data);

		if ( nodes && nodes.length )
			for(const node of nodes) {
				const product = node.product,
					set_id = product && product.emoteSetID;

				if ( ! set_id )
					continue;

				const owner = product.owner || {},
					badges = owner.broadcastBadges;

				let image, image_set;
				if ( badges )
					for(const badge of badges)
						if ( badge.setID === 'subscriber' && badge.version === '0' ) {
							image = badge.imageURL;

							if ( image.endsWith('/1') ) {
								const base = image.slice(0, -2);
								image_set = `${base}/1 1x, ${base}/2 2x, ${base}/4 4x`;
							}

							break;
						}

				out[set_id] = {
					ends: maybe_date(node.endsAt),
					renews: maybe_date(node.renewsAt),
					prime: node.purchasedWithPrime,

					set_id: parseInt(set_id, 10),
					type: product.type,
					image,
					image_set,
					user: {
						id: owner.id,
						login: owner.login,
						display_name: owner.displayName
					}
				}
			}

		this._data_sets = sets;
		return this._data = out;
	}
}


EmoteMenu.getData = once(EmoteMenu.getData);