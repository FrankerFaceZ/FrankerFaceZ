'use strict';

// ============================================================================
// Emote Menu
// ============================================================================

import {has, get, once, set_equals} from 'utilities/object';
import {WEBKIT_CSS as WEBKIT} from 'utilities/constants';
import {IMAGE_PATHS} from 'src/modules/chat/emoji';
import {maybe_date} from './utils';
import Twilight from 'site';
import Module from 'utilities/module';
import SUB_STATUS from '../sub_status.gql';
import { createEmojiTonePicker } from './emoji-tone-picker';
import { createMenuSection } from './menu-section';
import { createEmojiSection } from './emoji-section';
import { createMenuErrorWrapper } from './menu-error-wrapper';
import { createMenuComponent } from './menu-component';

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

		this.settings.add('chat.emote-menu.tooltips', {
			default: true,
			ui: {
				path: 'Chat > Emote Menu >> Appearance',
				title: 'Display emote preview tool-tips in the FFZ Emote Menu.',
				component: 'setting-check-box',
				description: 'You may wish to disable this for performance reasons.'
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
		this.chat.context.on('changed:chat.emote-menu.tooltips', rebuild);
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
			React = await this.site.findReact(),
			createElement = React && React.createElement;

		if ( ! createElement )
			return t.log.warn('Unable to get React.');

		this.defineClasses();


		this.EmoteMenu.ready(cls => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				this._ffz_no_scan = false;

				if ( ! this.props ||
					 this.props.emotePickerSource === 'bits-rewards' ||
					 ! has(this.props, 'channelID') ||
					 ! t.chat.context.get('chat.emote-menu.enabled')
				) {
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
		const React = this.site.getReact();

		this.EmojiTonePicker = createEmojiTonePicker(this, React);
		this.MenuSection = createMenuSection(this, React);
		this.fine.wrap('ffz-menu-section', this.MenuSection);
		this.EmojiSection = createEmojiSection(this, React, this.MenuSection);
		this.MenuErrorWrapper = createMenuErrorWrapper(this, React);
		this.MenuComponent = createMenuComponent(this, React);
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
			return {error: true};

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
