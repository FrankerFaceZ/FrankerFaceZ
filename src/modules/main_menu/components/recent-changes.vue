<template lang="html">
	<div class="ffz--recent-changes tw-border tw-border-radius-medium tw-c-background-alt tw-pd-1">
		<h4 class="tw-mg-b-05 ffz-font-size-4">
			{{ t('home.recent-changes', 'Recent Changes') }}
		</h4>

		<div v-if="error" class="tw-c-text-alt">
			{{ t('home.recent-changes.error', 'Unable to load recent changes from GitHub.') }}
		</div>
		<div v-else-if="loading" class="tw-align-center">
			<h1 class="tw-mg-2 ffz-i-zreknarf loading ffz-font-size-2" />
		</div>
		<div v-else-if="! entries.length" class="tw-c-text-alt">
			{{ t('home.recent-changes.none', 'There are no recent changes.') }}
		</div>
		<ul v-else>
			<li
				v-for="entry of entries"
				:key="entry.sha"
				class="tw-mg-b-1"
			>
				<div class="tw-flex tw-align-items-start">
					<div class="tw-flex-grow-1 tw-strong">
						{{ entry.summary }}
					</div>
					<div v-if="entry.active" class="ffz-pill tw-mg-l-05 tw-flex-shrink-0">
						{{ t('home.changelog.current', 'Current Version') }}
					</div>
				</div>
				<div class="tw-c-text-alt-2 ffz-font-size-7">
					<span v-if="entry.version" class="tw-mg-r-05">
						v{{ entry.version }}
					</span>
					<a
						:href="entry.link"
						target="_blank"
						rel="noopener noreferrer"
						class="ffz-link ffz-link--inherit tw-mg-r-05"
					>
						{{ entry.hash }}
					</a>
					<time v-if="entry.date" :datetime="entry.date.toISOString()">
						{{ t('home.recent-changes.when', '{when,humantime}', {when: entry.date}) }}
					</time>
				</div>
			</li>
		</ul>

		<div class="tw-mg-t-05">
			<a
				href="#"
				class="ffz-link"
				@click.prevent="item.requestPage('home.changelog')"
			>
				{{ t('home.recent-changes.all', 'View the full changelog') }}
			</a>
		</div>
	</div>
</template>

<script>

import { fetchRecentCommits, findActiveSha, parseCommit } from '../changelog';

const LIMIT = 6;

export default {
	props: ['item', 'context'],

	data() {
		return {
			loading: true,
			error: false,
			entries: []
		}
	},

	created() {
		this.load();
	},

	methods: {
		async load() {
			this.loading = true;
			this.error = false;

			let data;
			try {
				data = await fetchRecentCommits();
			} catch(err) {
				data = null;
			}

			if ( ! data ) {
				this.error = true;
				this.loading = false;
				return;
			}

			const parsed = data.map(commit => parseCommit(commit)).filter(x => x),
				active_sha = findActiveSha(parsed, window.FrankerFaceZ.version_info.commit),
				entries = [];

			for(const entry of parsed) {
				if ( entry.auto_merge )
					continue;

				entries.push({
					sha: entry.sha,
					hash: entry.hash,
					link: entry.link,
					date: entry.date,
					version: entry.version,
					summary: entry.summary,
					active: entry.sha === active_sha
				});

				if ( entries.length >= LIMIT )
					break;
			}

			this.entries = entries;
			this.loading = false;
		}
	}
}
</script>
