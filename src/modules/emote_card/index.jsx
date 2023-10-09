'use strict';

// ============================================================================
// Emote Cards
// ============================================================================

import {createElement} from 'utilities/dom';
import { getDialogNextZ } from 'utilities/dialog';
import {deep_copy, getTwitchEmoteURL} from 'utilities/object';
import { EmoteTypes, TWITCH_GLOBAL_SETS, TWITCH_POINTS_SETS, TWITCH_PRIME_SETS } from 'utilities/constants';

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


function tierToNumber(tier) {
	if ( tier === '1000' || tier === 'prime' )
		return 1;
	if ( tier === '2000' )
		return 2;
	if ( tier === '3000' )
		return 3;
	return 1;
}


export default class EmoteCard extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('i18n');
		this.inject('chat');
		this.inject('chat.emotes');
		this.inject('chat.emoji');
		this.inject('site');
		this.inject('site.apollo');
		this.inject('site.twitch_data');

		this.vue = this.resolve('vue');

		//this.last_z = 9000;
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
			code: evt.code,
			variant: evt.variant,
			name: evt.name,
			set: evt.set,
			id: evt.id ?? `${evt.code}::${evt.variant}`
		}, evt.modifiers, evt.source);

	}

	async loadVue() {
		if ( this._vue_loaded )
			return;

		await this.vue.enable();
		const card_component = await import(/* webpackChunkName: 'emote-cards' */ './components/card.vue');
		this.vue.component('emote-card', card_component.default);

		this._vue_loaded = true;
	}


	canReportTwitch() {
		const site = this.resolve('site'),
			core = site.getCore?.(),
			user = site.getUser(),
			web_munch = this.resolve('site.web_munch');

		let report_form;
		try {
			report_form = web_munch.getModule('user-report');
		} catch(err) {
			return false;
		}

		return !! report_form && !! user?.id && core?.store?.dispatch;
	}


	reportTwitchEmote(id, channel) {
		const site = this.resolve('site'),
			core = site.getCore(),
			user = site.getUser(),
			web_munch = this.resolve('site.web_munch');

		let report_form;
		try {
			report_form = web_munch.getModule('user-report');
		} catch(err) {
			return false;
		}

		if ( ! user?.id || ! core?.store?.dispatch )
			return false;

		core.store.dispatch({
			type: 'core.modal.MODAL_SHOWN',
			modalComponent: report_form,
			modalProps: {
				reportContext: {
					contentID: String(id),
					contentMetadata: {
						channelID: String(user.id)
					},
					contentType: 'EMOTE_REPORT',
					targetUserID: String(channel),
					trackingContext: 'emote_card'
				}
			}
		});

		return true;
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
			let body;
			let tier;

			//console.log("loaded data", data);

			let type = getEmoteTypeFromTwitchType(data.type);

			let set;
			try {
				set = parseInt(data.setID, 10);
			} catch(err) { /* no-op */ }

			if ( TWITCH_GLOBAL_SETS.includes(set) )
				type = EmoteTypes.Global;
			else if ( TWITCH_POINTS_SETS.includes(set) )
				type = EmoteTypes.ChannelPoints;
			else if ( TWITCH_PRIME_SETS.includes(set) )
				type = EmoteTypes.Prime;

			//console.log('loaded data', data, type);

			if ( type === EmoteTypes.Subscription ) {
				const products = data.owner?.subscriptionProducts;

				if ( Array.isArray(products) ) {
					for(const product of products) {
						if ( product.emotes.some(em => em.id === data.id) ) {
							tier = tierToNumber(product.tier);
							break;
						}
					}
				}

				source = this.i18n.t('emote-card.sub', 'Tier {tier} Sub Emote ({source})', {
					tier: tier,
					source: data.owner?.displayName || data.owner?.login
				});

				body = 'twitch';

			} else if ( type === EmoteTypes.Follower ) {
				source = this.i18n.t('emote.follower', 'Follower Emote ({source})', {
					source: data.owner.displayName || data.owner.login
				});
				body = 'twitch';

			} else if ( type === EmoteTypes.Global )
				source = this.i18n.t('emote.global', 'Twitch Global');

			else if ( type === EmoteTypes.LimitedTime )
				source = this.i18n.t('emote.limited', 'Limited-Time Only Emote');

			else if ( type === EmoteTypes.BitsTier ) {
				source = this.i18n.t('emote-card.bits', '{amount,number} Bits Reward ({source})', {
					amount: data.bitsBadgeTierSummary?.threshold,
					source: data.owner.displayName || data.owner.login
				});
				body = 'twitch';

			} else if ( type === EmoteTypes.TwoFactor )
				source = this.i18n.t('emote.2fa', 'Twitch 2FA Emote');

			else if ( type === EmoteTypes.ChannelPoints ) {
				source = this.i18n.t('emote.points', 'Channel Points Emote');
				body = 'twitch';

			} else if ( type === EmoteTypes.Prime || type === EmoteTypes.Turbo )
				source = this.i18n.t('emote.prime', 'Prime Gaming');

			else
				source = data.type;

			//console.log('raw data', data);

			const out = {
				//raw: data,
				id: data.id,
				fav_source: 'twitch',
				channel_id: data.owner?.id,
				more: [],
				body,
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

			if ( data.owner?.id ) {
				out.channel_title = data.owner.displayName ?? data.owner.login;
				out.channel_login = data.owner.login;
				out.channel_live = !! data.owner.stream?.id;
				out.channel_followed = !! data.owner?.self?.follower?.followedAt;

				out.more.push({
					type: 'link',
					icon: 'ffz-i-link-ext',
					title: 'View Channel on TwitchEmotes.com',
					href: `https://twitchemotes.com/channels/${data.owner.id}`
				});

				// Check if we can actually submit a report.
				if ( this.canReportTwitch() )
				out.more.push({
					type: 'report-twitch',
					title_i18n: 'emote-card.report',
					title: 'Report Emote',
					icon: 'ffz-i-flag'
				});
			}

			if ( data.bitsBadgeTierSummary?.threshold ) {
				out.unlock_mode = 'bits';
				out.unlocked = data.bitsBadgeTierSummary.self?.isUnlocked;
				out.bits_amount = data.bitsBadgeTierSummary.threshold;
				out.bits_remain = data.bitsBadgeTierSummary.self?.numberOfBitsUntilUnlock ?? out.unlock_amount;

			} else if ( type === EmoteTypes.Follower ) {
				out.unlock_mode = 'follow';
				out.unlocked = false; // out.channel_followed ?? false;
				const extras = out.extra_emotes = [];

				if ( ! out.unlocked && Array.isArray(data.owner?.channel?.localEmoteSets) )
					for(const set of data.owner.channel.localEmoteSets)
						if ( Array.isArray(set.emotes) )
							for(const em of set.emotes) {
								const src = getTwitchEmoteURL(em.id, 1, true, true);
								const srcSet = `${src} 1x, ${getTwitchEmoteURL(em.id, 2, true, true)} 2x`;

								extras.push({
									id: em.id,
									name: em.token,
									src,
									srcSet
								});
							}

			} else if ( type === EmoteTypes.Subscription ) {
				out.unlock_mode = 'subscribe';
				out.unlocked = false;
				out.unlock_tier = tier;

				out.existing_tier = 0;
				const bene = data.owner?.self?.subscriptionBenefit;
				if ( bene?.tier )
					out.existing_tier = tierToNumber(bene.tier);

				const extras = out.extra_emotes = [],
					extier = out.existing_tier;

				if ( extier >= tier )
					out.unlocked = true;
				else if ( Array.isArray(data.owner?.subscriptionProducts) )
					for(const product of data.owner.subscriptionProducts) {
						const ptier = tierToNumber(product.tier);
						if ( ptier === tier ) {
							out.channel_product = product.name;
							if ( product.priceInfo?.price && product.priceInfo.currency ) {
								const formatter = new Intl.NumberFormat(navigator.languages, {
									style: 'currency',
									currency: product.priceInfo.currency
								});

								out.product_price = formatter.format(product.priceInfo.price / 100);
							}
						}

						if ( ptier > extier && ptier <= tier && Array.isArray(product.emotes) )
							for(const em of product.emotes) {
								const src = getTwitchEmoteURL(em.id, 1, true, true);
								const srcSet = `${src} 1x, ${getTwitchEmoteURL(em.id, 2, true, true)} 2x`;

								extras.push({
									id: em.id,
									name: em.token,
									src,
									srcSet
								});
							}
					}
			}

			return out;
		}

		// Emoji
		if ( emote.provider === 'emoji' ) {
			const emoji = this.emoji.emoji[emote.code],
				style = this.chat.context.get('chat.emoji.style'),
				variant = emote.variant ? emoji.variants[emote.variant] : emoji,
				vcode = emote.variant ? this.emoji.emoji[emote.variant] : null;

			const category = emoji.category ? this.i18n.t(`emoji.category.${emoji.category.toSnakeCase()}`, this.emoji.categories[emoji.category] || emoji.category) : null;

			const out = {
				id: emote.code,
				fav_source: 'emoji',
				more: [],
				src: this.emoji.getFullImage(variant.image, style),
				srcSet: this.emoji.getFullImageSet(variant.image, style),
				width: 18,
				height: 18,
				name: `:${emoji.names[0]}:${vcode ? `:${vcode.names[0]}:` : ''}`,
				source: this.i18n.t('tooltip.emoji', 'Emoji - {category}', {category})
			};

			return out;
		}

		if ( emote.provider !== 'ffz' )
			throw new Error('Invalid provider');

		// Try to get the emote set.
		const emote_set = this.emotes.emote_sets[emote.set],
			data = emote_set?.emotes?.[emote.id];

		if ( ! data )
			throw new Error('Unable to load emote data');

		const out = {
			id: data.id,
			fav_source: emote_set.source ?? 'ffz',
			more: [],
			src: data.animSrc2 ?? data.src2,
			srcSet: data.animSrcSet2 ?? data.srcSet2,
			width: data.width,
			height: data.height,
			name: data.name,
			originalName: data.original_name,
			source: emote_set.source_line || (`${emote_set.source || 'FFZ'} ${emote_set.title || 'Global Emotes'}`),
			owner: data.owner
				? (data.owner.display_name || data.owner.name)
				: null,
			ownerLink: data.owner && ! emote_set.source
				? `https://www.frankerfacez.com/${data.owner.name}`
				: null,
			artist: data.artist
				? (data.artist.display_name || data.artist.name)
				: null,
			artistLink: data.artist && ! emote_set.source
				? `https://www.frankerfacez.com/${data.artist.name}`
				: null,
		};

		if ( ! emote_set.source ) {
			if ( data.public )
				out.body = 'manage-ffz';

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

		} else if ( data.click_url ) {
			out.more.push({
				type: 'link',
				title_i18n: 'emote-card.view-external',
				title: 'View on {source}',
				source: emote_set.source,
				href: data.click_url
			});
		}

		return out;
	}


	async openCard(emote, modifiers, event) {

		const card_key = `${emote.provider}::${emote.id}::${modifiers ?? ''}`,
			old_card = this.open_cards[card_key];

		if ( old_card ) {
			old_card.$el.style.zIndex = getDialogNextZ();
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
			modifiers,
			data
		);
	}

	buildCard(pos_x, pos_y, emote, modifiers, data) {
		let child;

		const component = new this.vue.Vue({
			el: createElement('div'),
			render: h => h('emote-card', {
				props: {
					raw_emote: deep_copy(emote),
					raw_modifiers: modifiers,
					data: data,

					getFFZ: () => this,
					reportTwitchEmote: (...args) => this.reportTwitchEmote(...args),
					getZ: getDialogNextZ
				},

				on: {
					emit: (event, ...data) => this.emit(event, ...data),

					close: () => {
						const el = component.$el;
						el.remove();
						component.$destroy();

						if ( this.last_card === child )
							this.last_card = null;

						const card_key = `${emote.provider}::${emote.id}::${modifiers ?? ''}`;
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
