<template lang="html">
	<div
		:class="{ maximized: maximized || exclusive, exclusive, faded }"
		class="ffz-dialog tw-elevation-3 tw-c-background-alt tw-c-text-base tw-border tw-flex tw-flex-nowrap tw-flex-column"
	>
		<header class="tw-c-background-base tw-full-width tw-align-items-center tw-flex tw-flex-nowrap" @dblclick="resize">
			<h3 class="ffz-i-zreknarf ffz-i-pd-1">{{ t('i18n.ui.title', 'Translation Tester') }}</h3>
			<div class="tw-flex-grow-1 tw-pd-x-2">
				<div class="tw-search-input">
					<label for="ffz-main-menu.search" class="tw-hide-accessible">{{ t('i18n.ui.search', 'Search Strings') }}</label>
					<div class="tw-relative">
						<div class="tw-absolute tw-align-items-center tw-c-text-alt-2 tw-flex tw-full-height ffz-input__icon tw-justify-content-center tw-left-0 tw-top-0 tw-z-default">
							<figure class="ffz-i-search" />
						</div>
						<input
							id="ffz-main-menu.search"
							v-model="query"
							:placeholder="t('i18n.ui.search', 'Search Strings')"
							type="search"
							class="tw-block tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-l-3 tw-pd-r-1 tw-pd-y-05"
							autocapitalize="off"
							autocorrect="off"
							autocomplete="off"
							spellcheck="false"
						>
					</div>
				</div>
			</div>
			<button class="tw-button-icon tw-mg-x-05 tw-relative tw-tooltip__container" @click="saveBlob">
				<span class="tw-button-icon__icon">
					<figure class="ffz-i-floppy" />
				</span>
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('i18n.ui.save', 'Generate Change Blob') }}
				</div>
			</button>
			<button v-if="can_upload" class="tw-button-icon tw-mg-x-05 tw-relative tw-tooltip__container" @click="uploadBlob">
				<span class="tw-button-icon__icon">
					<figure class="ffz-i-upload-cloud" />
				</span>
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('i18n.ui.upload', 'Upload Changes') }}
				</div>
			</button>
			<button class="tw-button-icon tw-mg-x-05 tw-relative tw-tooltip__container" @click="requestKeys">
				<span class="tw-button-icon__icon">
					<figure class="ffz-i-arrows-cw" />
				</span>
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('i18n.ui.refresh', 'Refresh Strings') }}
				</div>
			</button>
			<button v-if="!maximized && !exclusive" class="tw-button-icon tw-mg-x-05" @click="faded = ! faded">
				<span class="tw-button-icon__icon">
					<figure :class="faded ? 'ffz-i-eye-off' : 'ffz-i-eye'" />
				</span>
			</button>
			<button v-if="!exclusive" class="tw-button-icon tw-mg-x-05 tw-relative tw-tooltip__container" @click="popout">
				<span class="tw-button-icon__icon">
					<figure class="ffz-i-link-ext" />
				</span>
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-center">
					{{ t('i18n.ui.popout', 'Open the Translation Editor in a New Window') }}
				</div>
			</button>
			<button v-if="!exclusive" class="tw-button-icon tw-mg-x-05" @click="resize">
				<span class="tw-button-icon__icon">
					<figure :class="{'ffz-i-window-maximize': !maximized, 'ffz-i-window-restore': maximized}" />
				</span>
			</button>
			<button v-if="!exclusive" class="tw-button-icon tw-mg-x-05" @click="close">
				<span class="tw-button-icon__icon">
					<figure class="ffz-i-window-close" />
				</span>
			</button>
		</header>
		<section class="tw-border-t tw-full-height tw-full-width tw-flex tw-flex-column tw-overflow-hidden">
			<header class="tw-border-b tw-pd-05 tw-c-background-base tw-flex tw-align-items-center">
				<button class="tw-border-radius-medium tw-pd-x-05 ffz-core-button ffz-core-button--text tw-c-text-base tw-interactive tw-relative tw-tooltip__container" @click="prevPage">
					<span class="tw-button-icon__icon">
						<figure class="ffz-i-left-dir" />
					</span>
					<div class="tw-tooltip tw-tooltip--down">
						{{ t('page.previous', 'Previous Page') }}
					</div>
				</button>
				<button
					v-if="! page_open"
					class="tw-border-radius-medium tw-pd-x-05 ffz-core-button ffz-core-button--text tw-c-text-base tw-interactive"
					@click="openPage"
				>
					{{ t('i18n.ui.pages', 'Page {current,number} of {total,number}', {
						current: page,
						total: pages
					}) }}
				</button>
				<input
					v-if="page_open"
					ref="pager"
					:value="page"
					:max="pages"
					class="tw-block tw-border-radius-medium tw-font-size-6 ffz-input tw-pd-x-1 tw-pd-y-05"
					type="number"
					min="1"
					@keydown.enter="closePage"
					@blur="closePage"
				>
				<button class="tw-border-radius-medium tw-pd-x-05 ffz-core-button ffz-core-button--text tw-c-text-base tw-interactive tw-relative tw-tooltip__container" @click="nextPage">
					<span class="tw-button-icon__icon">
						<figure class="ffz-i-right-dir" />
					</span>
					<div class="tw-tooltip tw-tooltip--down">
						{{ t('page.next', 'Next Page') }}
					</div>
				</button>
				<div class="tw-flex-grow-1" />
				<button
					class="tw-border-radius-medium tw-pd-x-05 ffz-core-button tw-c-text-base tw-interactive tw-relative tw-tooltip__container"
					:class="[mode === 0 ? 'ffz-core-button--primary' : 'ffz-core-button--text']"
					@click="mode = 0"
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<figure class="ffz-i-search" />
						<div class="tw-mg-l-05">
							{{ total }}
						</div>
					</div>
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('i18n.ui.all', 'All Strings') }}
					</div>
				</button>
				<button
					v-if="existing != total"
					class="tw-mg-l-05 tw-border-radius-medium tw-pd-x-05 ffz-core-button tw-c-text-base tw-interactive tw-relative tw-tooltip__container"
					:class="[mode === 1 ? 'ffz-core-button--primary' : 'ffz-core-button--text']"
					@click="mode = 1"
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<figure class="ffz-i-star-empty" />
						<div class="tw-mg-l-05">
							{{ existing }}
						</div>
					</div>
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('i18n.ui.existing', 'Existing Strings') }}
					</div>
				</button>
				<button
					v-if="added"
					class="tw-mg-l-05 tw-border-radius-medium tw-pd-x-05 ffz-core-button tw-c-text-base tw-interactive tw-relative tw-tooltip__container"
					:class="[mode === 2 ? 'ffz-core-button--primary' : 'ffz-core-button--text']"
					@click="mode = 2"
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<figure class="ffz-i-star" />
						<div class="tw-mg-l-05">
							{{ added }}
						</div>
					</div>
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('i18n.ui.added', 'New Strings') }}
					</div>
				</button>
				<button
					v-if="changed"
					class="tw-mg-l-05 tw-border-radius-medium tw-pd-x-05 ffz-core-button tw-c-text-base tw-interactive tw-relative tw-tooltip__container"
					:class="[mode === 3 ? 'ffz-core-button--primary' : 'ffz-core-button--text']"
					@click="mode = 3"
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<figure class="ffz-i-floppy" />
						<div class="tw-mg-l-05">
							{{ changed }}
						</div>
					</div>
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('i18n.ui.changed', 'Changed Strings') }}
					</div>
				</button>
				<button
					v-if="pending"
					class="tw-mg-l-05 tw-border-radius-medium tw-pd-x-05 ffz-core-button tw-c-text-base tw-interactive tw-relative tw-tooltip__container"
					:class="[mode === 4 ? 'ffz-core-button--primary' : 'ffz-core-button--text']"
					@click="mode = 4"
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<figure class="ffz-i-upload-cloud" />
						<div class="tw-mg-l-05">
							{{ pending }}
						</div>
					</div>
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('i18n.ui.pending', 'Pending Strings') }}
					</div>
				</button>
				<button
					v-if="invalid"
					class="tw-mg-l-05 tw-border-radius-medium tw-pd-x-05 ffz-core-button tw-c-text-base tw-interactive tw-relative tw-tooltip__container"
					:class="[mode === 5 ? 'ffz-core-button--primary' : 'ffz-core-button--text']"
					@click="mode = 5"
				>
					<div class="tw-align-items-center tw-flex tw-flex-grow-0">
						<figure class="ffz-i-attention" />
						<div class="tw-mg-l-05">
							{{ invalid }}
						</div>
					</div>
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
						{{ t('i18n.ui.invalid', 'Invalid Strings') }}
					</div>
				</button>
			</header>
			<simplebar classes="tw-flex-grow-1">
				<i18n-entry
					v-for="phrase in paged"
					:key="phrase.key"
					:entry="phrase"
					:get-i18n="getI18n"
					@update="update(phrase, $event)"
					@update-context="updateContext(phrase, $event)"
				/>
			</simplebar>
		</section>
	</div>
</template>

<script>

import displace from 'displacejs';
import Parser from '@ffz/icu-msgparser';
import { saveAs } from 'file-saver';

import { deep_equals, deep_copy, sleep } from 'utilities/object';

const parser = new Parser();
const PER_PAGE = 20;

export default {
	data() {
		const data = this.$vnode.data;

		data.mode = 0;

		data.page = 1;
		data.page_open = false;

		data.can_upload = false;
		data.uploading = false;

		return data;
	},

	computed: {
		filter() {
			return this.query.toLowerCase()
		},

		filtered() {
			const mode = this.mode,
				query = this.query,
				has_query = query?.length > 0;

			if ( mode === 0 && ! has_query )
				return this.phrases;

			return this.phrases.filter(entry => {
				if ( has_query ) {
					if (! (entry.key && entry.key.toLowerCase().includes(query)) &&
						! (entry.phrase && entry.phrase.toLowerCase().includes(query)) &&
						! (entry.translation && entry.translation.toLowerCase().includes(query)) )
						return false;
				}

				if ( mode === 1 )
					return entry.known && ! entry.different;

				if ( mode === 2 )
					return ! entry.known;

				if ( mode === 3 )
					return entry.different;

				if ( mode === 4 )
					return ! entry.known || entry.different || entry.context_changed;

				if ( mode === 5 )
					return ! entry.valid;

				return true;
			})
		},

		total() {
			return this.phrases.length;
		},

		invalid() {
			return this.phrases.filter(entry => ! entry.valid).length;
		},

		existing() {
			return this.total - (this.added + this.changed);
		},

		added() {
			return this.phrases.filter(entry => ! entry.known).length;
		},

		changed() {
			return this.phrases.filter(entry => entry.different).length;
		},

		pending() {
			return this.phrases.filter(entry => ! entry.known || entry.different || entry.context_changed).length;
		},

		pages() {
			return Math.ceil(this.filtered.length / PER_PAGE);
		},

		paged() {
			const offset = (this.page - 1) * PER_PAGE;
			return this.filtered.slice(offset, offset + PER_PAGE);
		}
	},

	watch: {
		pages() {
			if ( this.pages == 0 )
				this.page = 1;
			else if ( this.page > this.pages )
				this.page = this.pages;
		},

		maximized() {
			this.updateDrag();
		}
	},

	created() {
		this.checkUpload();
		this.requestKeys();
		this.grabKeys();

		this.listen('i18n:got-keys', this.grabKeys, this);
		this.listen('i18n:loaded', this.grabKeys, this);
		this.listen('i18n:strings-loaded', this.grabKeys, this);
	},

	mounted() {
		this.updateDrag();

		this._on_resize = this.handleResize.bind(this);
		window.addEventListener('resize', this._on_resize);
	},

	beforeDestroy() {
		this.destroyDrag();

		if ( this._on_resize ) {
			window.removeEventListener('resize', this._on_resize);
			this._on_resize = null;
		}

		this.unlisten('i18n:got-keys', this.grabKeys, this);
		this.unlisten('i18n:loaded', this.grabKeys, this);
		this.unlisten('i18n:strings-loaded', this.grabKeys, this);
	},

	methods: {
		getBlob() {
			const out = [];

			for(const entry of this.phrases) {
				if ( entry.known && ! entry.different && ! entry.context_changed )
					continue;

				out.push({
					key: entry.key,
					calls: entry.calls,
					options: entry.options,
					phrase: entry.translation
				});
			}

			return out;
		},

		saveBlob() {
			const out = this.getBlob();

			try {
				const blob = new Blob([JSON.stringify(out, null, '\t')], {type: 'application/json;charset=utf-8'});
				saveAs(blob, 'ffz-strings.json');
			} catch(err) {
				alert('Unable to save: ' + err); // eslint-disable-line
			}
		},

		async uploadBlob() {
			if ( this.uploading || ! this.can_upload )
				return;

			const blob = JSON.stringify(this.getBlob());
			const socket = this.getI18n().resolve('socket');
			if ( ! socket )
				return;

			this.uploading = true;
			const token = await socket.getAPIToken();
			if ( ! token?.token )
				return;

			const data = await fetch(`https://api-test.frankerfacez.com/v2/i18n/strings`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token.token}`
				},
				body: blob
			}).then(r => r.json());

			alert(`Uploaded ${data?.added || 0} new strings and ${data?.changed || 0} changed strings.`); // eslint-disable-line no-alert
			this.uploading = false;
			this.getI18n().loadStrings(true);
		},

		async checkUpload() {
			this.can_upload = false;
			const socket = this.getI18n().resolve('socket');
			if ( ! socket )
				return;

			const token = await socket.getAPIToken();
			if ( ! token?.token )
				return;

			const data = await fetch(`https://api-test.frankerfacez.com/v2/user/${token.id}/role/strings_upload`, {
				headers: {
					Authorization: `Bearer ${token.token}`
				}
			}).then(r => r.json());
			if ( ! data?.has_role )
				return;

			this.can_upload = true;
		},

		openPage() {
			this.page_open = true;
			this.$nextTick(() => {
				this.$refs.pager.focus();
				this.$refs.pager.select();
			});
		},

		closePage() {
			if ( ! this.page_open )
				return;

			try {
				this.page = parseInt(this.$refs.pager.value, 10);
				if ( this.page < 1 )
					this.page = 1;
				else if ( this.page > this.pages )
					this.page = this.pages;
			} catch(err) { /* no-op */ }

			this.page_open = false;
		},

		prevPage() {
			if ( this.page > 1 )
				this.page--;
		},

		nextPage() {
			if ( this.page < this.pages )
				this.page++;
		},

		grabKeys() {
			this.phrases = [];
			for(const phrase of this.getKeys()) {
				try {
					parser.parse(phrase.translation);
					phrase.valid = true;
				} catch(err) {
					phrase.valid = false;
				}

				phrase.original_opts = deep_copy(phrase.options);
				phrase.context_changed = false;

				this.phrases.push(phrase);
			}

			this.phrases.sort((a, b) => a.key.localeCompare(b.key));
		},

		update(entry, phrase) {
			entry.translation = phrase;
			try {
				parser.parse(phrase);
				entry.valid = true;
			} catch(err) {
				entry.valid = false;
			}

			this.updatePhrase(entry.key, phrase);
		},

		updateContext(entry, context) {
			if ( context && Object.keys(context).length === 0 )
				context = null;

			entry.options = context;
			entry.context_changed = ! deep_equals(entry.options, entry.original_opts);
		},

		updateDrag() {
			if ( this.maximized )
				this.destroyDrag();
			else
				this.createDrag();
		},

		destroyDrag() {
			if ( this.displace ) {
				this.displace.destroy();
				this.displace = null;
			}
		},

		createDrag() {
			this.$nextTick(() => {
				if ( ! this.maximized )
					this.displace = displace(this.$el, {
						handle: this.$el.querySelector('header'),
						highlightInputs: true,
						constrain: true
					});
			})
		},

		handleResize() {
			if ( this.displace )
				this.displace.reinit();
		},
	}
}
</script>