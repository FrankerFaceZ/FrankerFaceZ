<template lang="html">
	<div class="ffz--changelog tw-border-t tw-pd-t-1">
		<div class="tw-align-center">
			<h2 v-if="addons">
				{{ t('setting.add_ons.changelog.title', 'Add-Ons Changelog') }}
			</h2>
			<h2 v-else>
				{{ t('home.changelog', 'Changelog') }}
			</h2>
		</div>

		<div v-if=" ! addons" class="tw-mg-b-1 tw-flex tw-align-items-center">
			<div class="tw-flex-grow-1" />
			<div class="ffz-checkbox tw-relative tw-tooltip__container">
				<input
					id="nonversioned"
					ref="nonversioned"
					v-model="nonversioned"
					type="checkbox"
					class="ffz-checkbox__input"
				>

				<label for="nonversioned" class="ffz-checkbox__label">
					<span class="tw-mg-l-1">
						{{ t('home.changelog.show-nonversioned', 'Include non-versioned commits.') }}
					</span>
				</label>

				<div class="tw-tooltip ffz-balloon--md tw-tooltip--wrap tw-tooltip--down tw-tooltip--align-right">
					{{ t('home.changelog.about-nonversioned', 'Non-versioned commits are commits to the FrankerFaceZ repository not associated with a release build. They typically represent maintenance or contributions from the community that will be included in a subsequent release.') }}
				</div>
			</div>
		</div>

		<ul>
			<li v-for="commit of display" :key="commit.sha" class="tw-mg-b-2">
				<div class="tw-flex tw-align-items-center tw-border-b tw-mg-b-05">
					<div v-if="! addons && commit.active" class="tw-pill tw-mg-r-05">
						{{ t('home.changelog.current', 'Current Version') }}
					</div>
					<div v-if="commit.title" class="tw-font-size-4">
						{{ commit.title }}
					</div>
					<div v-if="commit.author">
						<t-list
							phrase="home.changelog.by-line"
							default="By: {user}"
							class="tw-inline-flex tw-align-items-center"
						>
							<template #user>
								<a
									v-if="commit.author.html_url"
									:href="commit.author.html_url"
									target="_blank"
									rel="noopener noreferrer"
									class="tw-inline-flex tw-align-items-center tw-link tw-link--inherit tw-mg-x-05 ffz-tooltip"
									data-tooltip-type="link"
								>
									<figure
										v-if="commit.author.avatar_url"
										class="ffz-avatar ffz-avatar--size-20 tw-mg-r-05"
									>
										<img
											:src="commit.author.avatar_url"
											class="tw-block tw-border-radius-rounded tw-image tw-image-avatar"
										>
									</figure>
									{{ commit.author.login }}
								</a>
								<strong v-else class="tw-mg-x-05">
									{{ commit.author.login || commit.author.name }}
								</strong>
							</template>
						</t-list>
					</div>
					<div
						v-if="commit.hash"
						class="tw-font-size-8 tw-c-text-alt-2"
					>
						@<a :href="commit.link" target="_blank" rel="noopener noreferrer" class="tw-link tw-link--inherit ffz-tooltip" data-tooltip-type="link">{{ commit.hash }}</a>
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
				{{ t('home.changelog.error', 'An error occurred loading changes from GitHub.') }}
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

const TITLE_MATCH = /^v?(\d+\.\d+\.\d+(?:-[^\n]+)?)\n+/;


export default {
	props: ['item', 'context'],

	data() {
		return {
			error: false,
			addons: this.item.addons,
			nonversioned: false,
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
					author = null,
					title = old_commit;

				if ( this.addons ) {
					title = null;
					author = commit.author;

				} else {
					const match = TITLE_MATCH.exec(message);

					if ( match ) {
						title = match[1];
						message = message.slice(match[0].length);
					} else if ( ! this.nonversioned )
						continue;
				}

				const date = new Date(commit.commit.author.date),
					active = commit.sha === window.FrankerFaceZ.version_info.commit;

				out.push({
					title,
					author,
					message,
					active,
					hash: commit.sha && commit.sha.slice(0,7),
					link: commit.html_url,
					sha: commit.sha,
					date
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
				return this.tTime(date);

			return this.tDate(date);
		},

		async fetchMore() {
			const last_commit = this.commits[this.commits.length - 1],
				until = last_commit && get('commit.author.date', last_commit);

			this.loading = true;

			try {
				const resp = await fetch(`https://api.github.com/repos/frankerfacez/${this.addons ? 'add-ons' : 'frankerfacez'}/commits${until ? `?until=${until}` : ''}`),
					data = resp.ok ? await resp.json() : null;

				if ( ! data || ! Array.isArray(data) ) {
					this.more = false;
					return;
				}

				let added = false;

				for(const commit of data) {
					if ( this.commit_ids.has(commit.sha) )
						continue;

					this.commit_ids.add(commit.sha)
					this.commits.push(commit);
					added = true;
				}

				if ( ! added )
					this.more = false;

				this.loading = false;

			} catch(err) {
				this.error = true;
			}
		}
	}
}
</script>