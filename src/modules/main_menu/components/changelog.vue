<template lang="html">
	<div class="ffz--changelog tw-border-t tw-pd-t-1">
		<div class="tw-align-center">
			<h3 v-if="addon" class="tw-mg-b-1 tw-flex tw-align-items-center tw-justify-content-center ffz-font-size-3">
				<figure
					v-if="addon.icon"
					class="ffz-avatar ffz-avatar--size-30 tw-mg-r-05"
				>
					<img
						:src="addon.icon"
						class="tw-block tw-image tw-image-avatar"
					>
				</figure>
				{{ t('setting.add_ons.specific-changelog', '{name} Changelog', {
					name: addon.name
				}) }}
			</h3>
			<h3 v-else-if="addons" class="tw-mg-b-1 ffz-font-size-3">
				{{ t('setting.add_ons.changelog.title', 'Add-Ons Changelog') }}
			</h3>
			<h3 v-else class="tw-mg-b-1 ffz-font-size-3">
				{{ t('home.changelog', 'Changelog') }}
			</h3>
		</div>

		<div v-if=" ! addons" class="tw-mg-b-1 tw-flex tw-align-items-center">
			<div class="tw-flex-grow-1" />
			<div class="ffz-checkbox tw-relative ffz-il-tooltip__container">
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

				<div class="ffz-il-tooltip ffz-balloon--md ffz-il-tooltip--wrap ffz-il-tooltip--down ffz-il-tooltip--align-right">
					{{ t('home.changelog.about-nonversioned', 'Non-versioned commits are commits to the FrankerFaceZ repository not associated with a release build. They typically represent maintenance or contributions from the community that will be included in a subsequent release.') }}
				</div>
			</div>
		</div>

		<ul>
			<li v-for="commit of display" :key="commit.sha" class="tw-mg-b-2">
				<div class="tw-flex tw-align-items-center tw-border-b tw-mg-b-05">
					<div v-if="! addons && commit.active" class="ffz-pill tw-mg-r-05">
						{{ t('home.changelog.current', 'Current Version') }}
					</div>
					<figure
						v-if="commit.icon"
						class="ffz-avatar ffz-avatar--size-20 tw-mg-r-05"
					>
						<img
							:src="commit.icon"
							class="tw-block tw-image tw-image-avatar"
						>
					</figure>
					<a
						v-if="commit.title && commit.title_nav"
						class="ffz-font-size-5 ffz-link ffz-link--inherit"
						href="#"
						@click.prevent="titleNav(commit.title_nav)"
					>
						{{ commit.title }}
					</a>
					<div v-else-if="commit.title" class="ffz-font-size-5">
						{{ commit.title }}
					</div>
					<div v-if="commit.version" class="ffz-font-size-4 tw-mg-l-05">
						<span class="tw-c-text-alt-2">v</span>{{ commit.version }}
					</div>
					<div v-if="commit.author" class="tw-mg-l-05">
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
									class="tw-inline-flex tw-align-items-center ffz-link ffz-link--inherit tw-mg-x-05 ffz-tooltip"
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
						class="ffz-font-size-8 tw-c-text-alt-2"
					>
						@<a :href="commit.link" target="_blank" rel="noopener noreferrer" class="ffz-link ffz-link--inherit ffz-tooltip" data-tooltip-type="link">{{ commit.hash }}</a>
					</div>
					<time
						v-if="commit.date"
						:datetime="commit.date"
						class="tw-align-right tw-flex-grow-1 tw-c-text-alt-2"
					>({{ formatDate(commit.date) }})</time>
				</div>
				<markdown :source="commit.message" />
				<div v-for="entry in commit.segments" class="ffz--changelog-segment">
					<strong>{{ entry.key }}</strong>
					<markdown :source="entry.value" />
				</div>
			</li>
		</ul>

		<div class="tw-align-center tw-pd-1">
			<div v-if="error">
				{{ t('home.changelog.error', 'An error occurred loading changes from GitHub.') }}
			</div>
			<h1 v-else-if="loading" class="tw-mg-5 ffz-i-zreknarf loading ffz-font-size-1" />
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

const TITLE_MATCH = /^(.+?)?\s*v?(\d+\.\d+\.\d+(?:\-[a-z0-9-]+)?)$/i,
	SETTING_REGEX = /\]\(~([^)]+)\)/g,
	CHANGE_REGEX = /^\*\s*([^:]+?):\s*(.+)$/i,
	ISSUE_REGEX = /(^|\s)#(\d+)\b/g;


function linkify(text, repo) {
	text = text.replace(SETTING_REGEX, (_, link) => {
		return `](~${link})`
	});

	return text.replace(ISSUE_REGEX, (_, space, number) => {
		return `${space}[#${number}](https://github.com/FrankerFaceZ/${repo}/issues/${number})`;
	});
}


export default {
	props: ['item', 'context'],

	data() {
		return {
			error: false,
			addon: this.item.addon,
			addons: this.item.addons,
			nonversioned: false,
			loading: false,
			more: true,
			commits: []
		}
	},

	computed: {
		display() {
			window.thing = this;

			const out = [],
				addons = this.addons ? this.item.getFFZ().resolve('addons') : null,
				old_commit = this.t('home.changelog.nonversioned', 'Non-Versioned Commit');

			for(const commit of this.commits) {
				const input = commit.commit.message;
				let title = old_commit,
					title_nav = null,
					icon = null,
					version = null,
					author = null,
					sections = {},
					description = [];

				if ( /\bskiplog\b/i.test(input) && ! this.nonversion )
					continue;

				const lines = input.split(/\r?\n/),
					first = lines.shift(),
					match = first ? TITLE_MATCH.exec(first) : null;

				const date = new Date(commit.commit.author.date),
					active = commit.sha === window.FrankerFaceZ.version_info.commit,
					has_content = lines.length && match;

				if ( ! this.nonversion && ! has_content )
					continue;

				let last_bit = null;

				if ( match ) {
					title = match[1];
					version = match[2];
				}

				if ( has_content )
					for(const line of lines) {
						const trimmed = line.trim();
						if ( ! trimmed.length ) {
							if ( ! last_bit && description.length )
								description.push(line);
							continue;
						}

						const m = CHANGE_REGEX.exec(trimmed);
						if ( ! m ) {
							if ( ! last_bit )
								description.push(line);
							else
								last_bit.push(trimmed);

						} else {
							const section = sections[m[1]] = sections[m[1]] || [];
							last_bit = [m[2]];
							section.push(last_bit);
						}
					}

				else {
					lines.unshift(first);
					description = lines;
				}

				let message = description.join('\n').trim();

				const segments = [];

				for(const [key, val] of Object.entries(sections)) {
					if ( ! val?.length )
						continue;

					const bit = val.map(x => `* ${x.join(' ')}`).join('\n').trim();

					segments.push({
						key,
						value: linkify(bit, this.addons ? 'add-ons' : 'frankerfacez')
					});
				}

				if ( this.addons ) {
					author = commit.author;

					if ( title ) {
						const ltitle = title.toLowerCase();

						if ( addons?.addons )
							for(const addon of Object.values(addons.addons)) {
								if ((addon.short_name && addon.short_name.toLowerCase() === ltitle) ||
									(addon.name && addon.name.toLowerCase() === ltitle) ||
									(addon.id && addon.id.toLowerCase() === ltitle)
								) {
									icon = addon.icon;

									title_nav = [`add_ons.changelog.${addon.id}`];
									if ( addon.short_name )
										title_nav.push(`add_ons.changelog.${addon.short_name.toSnakeCase()}`);
									if ( addon.name )
										title_nav.push(`add_ons.changelog.${addon.name.toSnakeCase()}`);

									break;
								}
							}

						// Default Icon
						if ( ! icon )
							icon = 'https://cdn.frankerfacez.com/badge/2/4/solid';
					}
				}

				if ( this.addon ) {
					icon = null;
					title = null;
				}

				out.push({
					icon,
					title,
					title_nav,
					version,
					author,
					message,
					segments,
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
		titleNav(nav) {
			if ( Array.isArray(nav) )
				this.$emit('navigate', ...nav);
		},

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

			const url = new URL(`https://api.github.com/repos/frankerfacez/${this.addons ? 'add-ons' : 'frankerfacez'}/commits`);
			if ( until )
				url.searchParams.append('until', until);

			if ( this.addon )
				url.searchParams.append('path', `src/${this.addon.id}`);

			try {
				const resp = await fetch(url),
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
