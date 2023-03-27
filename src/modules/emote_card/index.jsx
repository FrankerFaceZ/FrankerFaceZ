'use strict';

// ============================================================================
// Emote Cards
// ============================================================================

import {createElement, sanitize} from 'utilities/dom';
import {has, maybe_call, deep_copy, getTwitchEmoteURL} from 'utilities/object';
import { EmoteTypes } from 'utilities/constants';

import GET_EMOTE from './twitch_data.gql';

import Module from 'utilities/module';

function getEmoteTypeFromTwitchType(type) {
	if ( type === 'SUBSCRIPTIONS' )
		return EmoteTypes.Subscription;
	if ( type === 'FOLLOWER' )
		return EmoteTypes.Follower;
	if ( type === 'GLOBALS' || type === 'SMILIES' )
		return EmoteTypes.Global;
	if ( type === 'LIMITED_TIME' || type === 'MEGA_COMMERCE' )
		return EmoteTypes.LimitedTime;
	if ( type === 'BITS_BADGE_TIERS' )
		return EmoteTypes.BitsTier;
	if ( type === 'TWO_FACTOR' )
		return EmoteTypes.TwoFactor;
	if ( type === 'PRIME' )
		return EmoteTypes.Prime;
	if ( type === 'TURBO' )
		return EmoteTypes.Turbo;

	return EmoteTypes.Unknown;
}


export default class EmoteCard extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('chat');
		this.inject('chat.emotes');
		this.inject('site');
		this.inject('site.apollo');
		this.inject('site.twitch_data');

		this.vue = this.resolve('vue');

		this.last_z = 9000;
		this.open_cards = {};
		this.last_card = null;
	}

	onEnable() {

		this.on('chat.emotes:click', this.handleClick, this);

	}

	handleClick(evt) {
		if ( ! this.chat.context.get('chat.emote-dialogs') )
			return;

		evt.preventDefault();

		this.openCard({
			provider: evt.provider,
			set: evt.set,
			id: evt.id
		}, evt.source);

	}

	async loadVue() {
		if ( this._vue_loaded )
			return;

		await this.vue.enable();
		const card_component = await import('./components/card.vue');
		this.vue.component('emote-card', card_component.default);

		this._vue_loaded = true;
	}

	async loadData(emote) {
		if ( emote.provider === 'twitch' ) {
			const apollo = this.resolve('site.apollo');
			if ( ! apollo )
				throw new Error('Unable to load emote data');

			const result = await apollo.client.query({
				query: GET_EMOTE,
				variables: {
					emoteID: emote.id
				}
			});

			if ( ! result?.data?.emote )
				throw new Error('Unable to load emote data');

			const data = result.data.emote;

			const src = getTwitchEmoteURL(data.id, 2, true, true);
			const srcSet = `${src} 1x, ${getTwitchEmoteURL(data.id, 4, true, true)} 2x`;

			let source;

			//console.log("loaded data", data);

			const type = getEmoteTypeFromTwitchType(data.type);

			if ( type === EmoteTypes.Subscription ) {
				const products = data.owner?.subscriptionProducts;
				let tier;

				if ( Array.isArray(products) ) {
					for(const product of products) {
						if ( product.emotes.some(em => em.id === data.id) ) {
							tier = product.tier;
							break;
						}
					}
				}

				if ( tier === '1000' )
					tier = 1;
				else if ( tier === '2000' )
					tier = 2;
				else if ( tier === '3000' )
					tier = 3;
				else
					tier = 1;

				source = this.i18n.t('emote-card.sub', 'Tier {tier} Sub Emote ({source})', {
					tier: tier,
					source: data.owner.displayName || data.owner.login
				});

			} else if ( type === EmoteTypes.Follower )
				source = this.i18n.t('emote.follower', 'Follower Emote ({source})', {
					source: data.owner.displayName || data.owner.login
				});

			else if ( type === EmoteTypes.Global )
				source = this.i18n.t('emote.global', 'Twitch Global');

			else if ( type === EmoteTypes.LimitedTime )
				source = this.i18n.t('emote.limited', 'Limited-Time Only Emote');

			else if ( type === EmoteTypes.BitsTier ) {
				source = this.i18n.t('emote-card.bits', '{amount,number} Bits Reward ({source})', {
					amount: data.bitsBadgeTierSummary?.threshold,
					source: data.owner.displayName || data.owner.login
				});

			} else if ( type === EmoteTypes.TwoFactor )
				source = this.i18n.t('emote.2fa', 'Twitch 2FA Emote');

			else if ( type === EmoteTypes.ChannelPoints )
				source = this.i18n.t('emote.points', 'Channel Points Emote');

			else if ( type === EmoteTypes.Prime || type === EmoteTypes.Turbo )
				source = this.i18n.t('emote.prime', 'Prime Gaming');

			else
				source = data.type;

			const out = {
				//raw: data,
				id: data.id,
				more: [],
				src,
				srcSet,
				name: data.token,
				source,
				artist: data.artist
					? (data.artist.displayName || data.artist.login)
					: null,
				artistLink: data.artist
					? `https://www.twitch.tv/${data.artist.login}`
					: null
			};

			/*if ( data.owner?.id )
				out.more.push({
					type: 'link',
					icon: 'ffz-i-link-ext',
					title: 'View Channel on TwitchEmotes.com',
					href: `https://twitchemotes.com/channels/${data.owner.id}`
				});*/

			return out;
		}


		// Try to get the emote set.
		const emote_set = this.emotes.emote_sets[emote.set],
			data = emote_set?.emotes?.[emote.id];

		if ( ! data )
			throw new Error('Unable to load emote data');

		const out = {
			id: data.id,
			more: [],
			src: data.animSrc2 ?? data.src2,
			srcSet: data.animSrcSet2 ?? data.srcSet2,
			width: data.width,
			height: data.height,
			name: data.name,
			source: emote_set.source_line || (`${emote_set.source || 'FFZ'} ${emote_set.title || 'Global Emotes'}`),
			owner: data.owner
				? (data.owner.display_name || data.owner.name)
				: null,
			ownerLink: data.owner
				? `https://www.frankerfacez.com/${data.owner.name}`
				: null,
			artist: data.artist
				? (data.artist.display_name || data.artist.name)
				: null,
			artistLink: data.artist
				? `https://www.frankerfacez.com/${data.artist.name}`
				: null,
		};

		if ( ! emote_set.source ) {
			out.more.push({
				type: 'link',
				title_i18n: 'emote-card.view-on-ffz',
				title: 'View on FrankerFaceZ',
				href: `https://www.frankerfacez.com/emoticon/${data.id}-`
			});

			out.more.push({
				type: 'report-ffz',
				title_i18n: 'emote-card.report',
				title: 'Report Emote',
				icon: 'ffz-i-flag'
			});
		}

		return out;
	}


	async openCard(emote, event) {

		const card_key = `${emote.provider}::${emote.id}`,
			old_card = this.open_cards[card_key];

		if ( old_card ) {
			old_card.$el.style.zIndex = ++this.last_z;
			old_card.focus();
			return;
		}

		let pos_x = event ? event.clientX : window.innerWidth / 2,
			pos_y = event ? event.clientY + 15 : window.innerHeight / 2;

		if ( this.last_card ) {
			const card = this.last_card;

			if ( ! event ) {
				pos_x = card.$el.offsetLeft;
				pos_y = card.$el.offsetTop;
			}

			card.close();
		}

		// Start loading data. Don't await it yet, so we can
		// wait for Vue at the same time.
		const data = this.loadData(emote);

		// Now load vue.
		await this.loadVue();

		// Display the card.
		this.last_card = this.open_cards[card_key] = this.buildCard(
			pos_x,
			pos_y,
			emote,
			data
		);
	}

	buildCard(pos_x, pos_y, emote, data) {
		let child;

		const component = new this.vue.Vue({
			el: createElement('div'),
			render: h => h('emote-card', {
				props: {
					raw_emote: deep_copy(emote),
					data: data,

					getFFZ: () => this,
					getZ: () => ++this.last_z
				},

				on: {
					emit: (event, ...data) => this.emit(event, ...data),

					close: () => {
						const el = component.$el;
						el.remove();
						component.$destroy();

						if ( this.last_card === child )
							this.last_card = null;

						const card_key = `${emote.provider}::${emote.id}`;
						if ( this.open_cards[card_key] === child )
							this.open_cards[card_key] = null;

						this.emit('tooltips:cleanup');
					},

					pin: () => {
						if ( this.last_card === child )
							this.last_card = null;
					}
				}
			})
		});

		child = component.$children[0];

		const el = component.$el;
		el.style.left = `${pos_x}px`;
		el.style.top = `${pos_y}px`;

		const container = document.querySelector(this.site.constructor.DIALOG_SELECTOR ?? '#root>div>.tw-full-height,.twilight-minimal-root>.tw-full-height');
		container.appendChild(el);

		requestAnimationFrame(() => child.constrain());

		return child;
	}
}
