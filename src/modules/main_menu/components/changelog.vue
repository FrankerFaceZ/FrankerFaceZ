<template lang="html">
	<div class="ffz--changelog tw-border-t tw-pd-t-1">
		<div class="tw-align-center">
			<h2>{{ t('home.changelog', 'Changelog') }}</h2>
		</div>

		<ul>
			<li v-for="commit of display" :key="commit.sha" class="tw-mg-b-2">
				<div class="tw-flex tw-align-items-center tw-border-b tw-mg-b-05">
					<div class="tw-font-size-4">
						{{ commit.title }}
					</div>
					<div
						v-if="commit.hash"
						class="tw-font-size-8 tw-c-text-alt-2"
					>
						@<a :href="commit.link" target="_blank" rel="noopener noreferrer" class="tw-link tw-link--inherit">{{ commit.hash }}</a>
					</div>
					<time
						v-if="commit.date"
						:datetime="commit.date"
						class="tw-align-right tw-flex-grow-1 tw-c-text-alt-2"
					>({{ formatDate(commit.date) }})</time>
				</div>
				<markdown :source="commit.message" />
			</li>
		</ul>

		<div class="tw-align-center tw-pd-1">
			<div v-if="error">
				{{ t('home.changelog.error', 'An error occured loading changes from GitHub.') }}
			</div>
			<h1 v-else-if="loading" class="tw-mg-5 ffz-i-zreknarf loading" />
			<div v-else-if="! more">
				{{ t('home.changelog.no-more', 'There are no more commits to load.') }}
			</div>
			<button v-else class="tw-button" @click="fetchMore">
				<div class="tw-button__text">
					{{ t('home.changelog.load', 'Load More') }}
				</div>
			</button>
		</div>
	</div>
</template>


<script>

import {get} from 'utilities/object';

const TITLE_MATCH = /^(\d+\.\d+\.\d+(?:\-[^\n]+)?)\n+/;

export default {
	props: ['item', 'context'],

	data() {
		return {
			error: false,
			loading: false,
			more: true,
			commits: []
		}
	},

	computed: {
		display() {
			const out = [],
				old_commit = this.t('home.changelog.nonversioned', 'Non-Versioned Commit');

			for(const commit of this.commits) {
				let message = commit.commit.message,
					title = old_commit;

				const match = TITLE_MATCH.exec(message);
				if ( match ) {
					title = match[1];
					message = message.slice(match[0].length);
				}

				out.push({
					title,
					message,
					hash: commit.sha && commit.sha.slice(0,7),
					link: commit.html_url,
					sha: commit.sha,
					date: new Date(commit.commit.author.date)
				});
			}

			return out;
		}
	},

	mounted() {
		this.commit_ids = new Set;
		this.fetchMore();
	},

	methods: {
		formatDate(value) {
			if ( ! value )
				return '';

			const date = value instanceof Date ? value : new Date(value),
				today = new Date,
				is_today = date.toDateString() === today.toDateString();

			if ( is_today )
				return date.toLocaleTimeString();

			return date.toLocaleDateString();
		},

		async fetchMore() {
			const last_commit = this.commits[this.commits.length - 1],
				until = last_commit && get('commit.author.date', last_commit);

			this.loading = true;

			try {
				const resp = await fetch(`https://api.github.com/repos/frankerfacez/frankerfacez/commits${until ? `?until=${until}` : ''}`),
					data = resp.ok ? await resp.json() : null;

				if ( ! data || ! Array.isArray(data) ) {
					this.more = false;
					return;
				}

				for(const commit of data) {
					if ( this.commit_ids.has(commit.sha) )
						continue;

					this.commit_ids.add(commit.sha)
					this.commits.push(commit);
				}

				this.loading = false;

			} catch(err) {
				this.error = true;
			}
		}
	}
}
</script>