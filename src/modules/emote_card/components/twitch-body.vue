<template>
	<section class="ffz-emote-card__twitch tw-pd-1">
		<section
			v-if="emote.channel_id"
			class="tw-mg-b-05 tw-flex tw-align-items-center"
		>
			<a
				:href="`https://www.twitch.tv/${emote.channel_login}`"
				rel="noopener noreferrer"
				target="_blank"
				class="tw-semibold tw-font-size-4 ffz-i-camera"
			>
				{{ emote.channel_title }}
			</a>
			<div v-if="emote.channel_live" class="tw-mg-l-1">
				<figure class="ffz-emote-card__live-indicator tw-mg-r-05" />
				{{ t('emote-card.live', 'LIVE') }}
			</div>

		</section>
		<template v-if="isSubscriptionEmote">
			<p v-if="emote.unlocked">
				{{ t('emote-card.sub.unlocked', 'You have unlocked this emote by subscribing to {user}\'s channel at Tier {tier}.', {
					tier: emote.unlock_tier,
					user: emote.channel_title
				}) }}
			</p>
			<p v-else-if="emote.unlock_tier <= 1">
				{{ t('emote-card.sub.upsell', "Subscribe to {user}'s channel to use {emote} along with {emotes, plural, one {# more emote} other {# more of their emotes} }, including:", {
					emote: emote.name,
					emotes: unlockCount,
					user: emote.channel_title
				}) }}
			</p>
			<p v-else>
				{{ t('emote-card.sub.upsell-tier', "Subscribe to {user}'s channel at Tier {tier} to use {emote} along with {emotes, plural, one {# more emote} other {# more of their emotes} }, including:", {
					emote: emote.name,
					tier: emote.unlock_tier,
					emotes: unlockCount,
					user: emote.channel_title
				}) }}
			</p>
		</template>
		<template v-else-if="isBitsEmote">
			<p v-if="emote.unlocked">
				{{ t('emote-card.bits.unlocked', 'You have unlocked this emote by using {count, plural, one {# bit} other {# bits} } in {user}\'s channel.', {
					count: emote.bits_amount,
					user: emote.channel_title
				}) }}
			</p>
			<p v-else>
				{{ t('emote-card.bits.upsell', "Use {count, plural, one {# more bit} other {# more bits} } in {user}'s channel to permanently unlock this emote reward.", {
					count: emote.bits_remain,
					user: emote.channel_title
				}) }}
			</p>
		</template>
		<template v-else-if="isFollowEmote">
			<p v-if="emote.unlocked">
				{{ t('emote-card.follow.unlocked', 'You have unlocked this emote by following {user}\'s channel.', {
					user: emote.channel_title
				}) }}
			</p>
			<p v-else>
				{{ t('emote-card.follow.upsell', "Follow {user}'s channel to use {emotes, plural, one {their emote} other {# of their emotes} }, including:", {
					emotes: unlockCount,
					user: emote.channel_title
				}) }}
			</p>
		</template>
		<div v-if="extras.length" class="ffz-emote-card__emote-list tw-mg-t-05">
			<div
				v-for="extra in extras"
				:key="extra.id"
				class="ffz-tooltip"
				data-tooltip-type="emote"
				data-provider="twitch"
				:data-id="extra.id"
				:data-name="extra.name"
				data-no-source="true"
			>
				<img :src="extra.src" :srcset="extra.srcSet" :alt="extra.name" />
			</div>
		</div>
		<div v-if="emote.channel_id" class="tw-mg-t-1 tw-flex">
			<follow-button
				:channel="emote.channel_id"
				:initial="emote.channel_followed"
			/>

			<button
				v-if="canSubscribe"
				class="tw-button tw-mg-l-1"
				@click="subscribe"
			>
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-star" />
				</span>
				<span class="tw-button__text">
					{{ t('emote-card.sub-button', 'Subscribe') }}
				</span>
				<span v-if="emote.product_price" class="ffz-button__sub-price">
					{{ emote.product_price }}
				</span>
			</button>
		</div>
	</section>
</template>

<script>

export default {

	props: [
		'emote',
		'getFFZ'
	],

	computed: {
		unlockCount() {
			if ( Array.isArray(this.emote.extra_emotes) )
				return this.emote.extra_emotes.length;

			return 0;
		},

		extras() {
			if ( Array.isArray(this.emote.extra_emotes) )
				return this.emote.extra_emotes.slice(0, 8);

			return [];
		},

		isSubscriptionEmote() {
			return this.emote.unlock_mode === 'subscribe';
		},

		isBitsEmote() {
			return this.emote.unlock_mode === 'bits';
		},

		isFollowEmote() {
			return this.emote.unlock_mode === 'follow';
		},

		canSubscribe() {
			if ( ! this.isSubscriptionEmote || this.emote.unlocked )
				return false;

			// Only show the sub button if we have a target product.
			if ( ! this.emote.channel_product )
				return false;

			const settings = this.getFFZ().resolve('settings'),
				current_channel = settings.get('context.channelID');

			// Only show the subscribe button for the current channel.
			if ( current_channel !== this.emote.channel_id )
				return false;

			// Finally, make sure we can find the right UI elements.
			const store = this.getFFZ().resolve('site')?.store,
				web_munch = this.getFFZ().resolve('site.web_munch'),
				sub_form = web_munch?.getModule?.('sub-form');

			if ( ! store?.dispatch || ! sub_form )
				return false;

			return true;
		}
	},

	methods: {
		subscribe() {
			if ( ! this.canSubscribe )
				return;

			const store = this.getFFZ().resolve('site')?.store,
				web_munch = this.getFFZ().resolve('site.web_munch'),
				sub_form = web_munch?.getModule?.('sub-form');

			if ( ! store?.dispatch || ! sub_form )
				return;

			sub_form({
				productName: this.emote.channel_product,
				trackingContext: {
					source: 'emote_card'
				}
			})(store.dispatch);

			this.$emit('close');
		}
	}

}

</script>