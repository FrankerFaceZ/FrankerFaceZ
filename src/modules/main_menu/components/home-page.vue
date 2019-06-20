<template lang="html">
	<div class="ffz--home tw-flex tw-flex-nowrap">
		<div class="tw-flex-grow-1">
			<div class="tw-align-center">
				<h1 class="ffz-i-zreknarf ffz-i-pd-1">
					FrankerFaceZ
				</h1>
				<span class="tw-c-text-alt">
					{{ t('home.tag-line', 'The Twitch Enhancement Suite') }}
				</span>
			</div>

			<section class="tw-pd-t-1 tw-border-t tw-mg-t-1">
				<markdown :source="t('home.about', md)" />
			</section>
		</div>
		<div class="tw-mg-l-1 tw-flex-shrink-0 tweet-column">
			<div class="tw-flex tw-mg-b-1">
				<a
					:data-title="t('home.website', 'FrankerFaceZ Website')"
					class="tw-flex-grow-1 tw-button ffz-tooltip ffz--ffz-button tw-mg-r-1"
					href="https://www.frankerfacez.com/"
					target="_blank"
					rel="noopener"
				>
					<span class="tw-button__icon tw-pd-05">
						<figure class="ffz-i-zreknarf tw-font-size-3" />
					</span>
				</a>
				<a
					:data-title="t('home.discord', 'Discord')"
					class="tw-flex-grow-1 tw-button ffz-tooltip ffz--discord-button tw-mg-r-1"
					href="https://discord.gg/UrAkGhT"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span class="tw-button__icon tw-pd-05-1">
						<figure class="ffz-i-discord tw-font-size-3" />
					</span>
				</a>
				<a
					:data-title="t('home.twitter', 'Twitter')"
					class="tw-flex-grow-1 tw-button ffz-tooltip ffz--twitter-button"
					href="https://twitter.com/frankerfacez"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span class="tw-button__icon tw-pd-05">
						<figure class="ffz-i-twitter tw-font-size-3" />
					</span>
				</a>
			</div>

			<a class="twitter-timeline" data-width="300" data-theme="dark" href="https://twitter.com/FrankerFaceZ?ref_src=twsrc%5Etfw">
				{{ t('home.tweets', 'Tweets by FrankerFaceZ') }}
			</a>
		</div>
	</div>
</template>


<script>

import HOME_MD from '../home.md';

import {createElement as e} from 'utilities/dom';

export default {
	props: ['item', 'context'],

	data() {
		return {
			md: HOME_MD
		}
	},

	mounted() {
		let el;
		document.head.appendChild(el = e('script', {
			id: 'ffz--twitter-widget-script',
			async: true,
			charset: 'utf-8',
			src: 'https://platform.twitter.com/widgets.js',
			onLoad: () => el.remove()
		}));

	}
}
</script>