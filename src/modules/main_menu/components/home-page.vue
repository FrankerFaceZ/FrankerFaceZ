<template lang="html">
	<div class="ffz--home tw-flex tw-flex-nowrap">
		<div class="tw-flex-grow-1">
			<div class="tw-align-center">
				<h1 class="ffz-i-zreknarf ffz-i-pd-1">FrankerFaceZ</h1>
				<span class="tw-c-text-alt">
					{{ t('home.tag-line', 'The Twitch Enhancement Suite') }}
				</span>
			</div>

			<section class="tw-pd-t-1 tw-border-t tw-mg-t-1">
				<h2>Welcome to the v4.0 Beta</h2>

				<p>
					This is the initial, beta release of FrankerFaceZ v4.0 with support
					for the Twitch website rewrite.

					As you'll notice, this release is <strong>not</strong> complete.
					There are missing features. There are bugs. If you are a moderator,
					you will want to just keep opening a Legacy Chat Popout for now.
				</p>

				<p>
					FrankerFaceZ v4.0 is still under heavy development and there will
					be significant changes and improvements in the coming weeks. For
					now, here are some of the bigger issues:
				</p>

				<ul class="tw-mg-b-2">
					<li>Settings from the old version are not being imported.</li>
					<li>Advanced input (better tab completion, history) isn't available.</li>
				</ul>

				<p>And the biggest features still under development:</p>

				<ul class="tw-mg-b-2">
					<li>Chat Filtering (Highlighted Words, etc.)</li>
					<li>Room Status Indicators</li>
					<li>Custom Mod Cards</li>
					<li>Recent Highlights</li>
					<li>Portrait Mode</li>
					<li>Importing and exporting settings</li>
					<li>User Aliases</li>
				</ul>

				<p>
					For a possibly more up-to-date list of what I'm working on,
					please consult <a href="https://trello.com/b/LGcYPFwi/frankerfacez-v4" target="_blank">this Trello board</a>.
				</p>

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
				Tweets by FrankerFaceZ
			</a>
		</div>
	</div>
</template>


<script>

import {createElement as e} from 'utilities/dom';

export default {
	props: ['item', 'context'],

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