<template lang="html">
<div class="ffz--home flex flex--nowrap">
	<div class="flex-grow-1">
		<div class="align-center">
			<h1 class="ffz-i-zreknarf ffz-i-pd-1">FrankerFaceZ</h1>
			<span class="c-text-alt">
				{{ t('home.tag-line', 'The Twitch Enhancement Suite') }}
			</span>
		</div>

		<section class="pd-t-1 border-t mg-t-1">
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

			<ul class="mg-b-2">
				<li>Settings from the old version are not being imported.</li>
				<li>Settings cannot be searched.</li>
				<li>FFZ badges do not display.</li>
				<li>Oh god everything is missing.</li>
				<li>FFZ:AP is broken.</li>
				<li>Uptime breaks occasionally.</li>
			</ul>

			<p>And the biggest features still under development:</p>

			<ul class="mg-b-2">
				<li>Dark Theme (Pls No Purple)</li>
				<li>Badge Customization</li>
				<li>Emoji Rendering</li>
				<li>Emotes Menu</li>
				<li>Chat Filtering (Highlighted Words, etc.)</li>
				<li>Room Status Indicators</li>
				<li>Custom Mod Cards</li>
				<li>Custom Mod Actions</li>
				<li>Chat Room Tabs</li>
				<li>Recent Highlights</li>
				<li>More Channel Metadata</li>
				<li>Disable Hosting</li>
				<li>Portrait Mode</li>
				<li>Hiding stuff in the directory</li>
				<li>Directory Host Stacking</li>
				<li>Basically anything to do with the directory</li>
				<li>Importing and exporting settings</li>
				<li>User Aliases</li>
				<li>Rich Content in Chat (aka Clip Embeds)</li>
			</ul>

			<p>
				For a possibly more up-to-date list of what I'm working on,
				please consult <a href="https://trello.com/b/LGcYPFwi/frankerfacez-v4" target="_blank">this Trello board</a>.
			</p>

		</section>


	</div>
	<div class="mg-l-1 flex-shrink-0 tweet-column">
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
			onLoad: () => el.parentElement.removeChild(el)
		}));

	}
}
</script>