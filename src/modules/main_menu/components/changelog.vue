<template lang="html">
<div class="ffz--changelog tw-border-t tw-pd-t-1">
	<div class="tw-align-center">
		<h2>{{ t('home.changelog', 'Changelog') }}</h2>
	</div>

	<div ref="changes" />

</div>
</template>


<script>

import {SERVER} from 'utilities/constants';

export default {
	props: ['item', 'context'],

	methods: {
		fetch(url, container) {
			const done = data => {
				if ( ! data )
					data = 'There was an error loading this page from the server.';

				container.innerHTML = data;

				const btn = container.querySelector('#ffz-old-news-button');
				if ( btn )
					btn.addEventListener('click', () => {
						btn.remove();
						const old_news = container.querySelector('#ffz-old-news');
						if ( old_news )
							this.fetch(`${SERVER}/script/old_changes.html`, old_news);
					});
			}

			fetch(url)
				.then(resp => resp.ok ? resp.text() : null)
				.then(done)
				.catch(err => done(null));
		}
	},

	mounted() {
		this.fetch(`${SERVER}/script/changelog.html`, this.$refs.changes);
	}

}
</script>