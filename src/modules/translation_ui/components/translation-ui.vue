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
						<div class="tw-absolute tw-align-items-center tw-c-text-alt-2 tw-flex tw-full-height tw-input__icon tw-justify-content-center tw-left-0 tw-top-0 tw-z-default">
							<figure class="ffz-i-search" />
						</div>
						<input
							id="ffz-main-menu.search"
							v-model="query"
							:placeholder="t('i18n.ui.search', 'Search Strings')"
							type="search"
							class="tw-block tw-border-radius-medium tw-font-size-6 tw-full-width tw-input tw-pd-l-3 tw-pd-r-1 tw-pd-y-05"
							autocapitalize="off"
							autocorrect="off"
							autocomplete="off"
							spellcheck="false"
						>
					</div>
				</div>
			</div>
			<button class="tw-button-icon tw-mg-x-05 tw-relative tw-tooltip-wrapper" @click="requestKeys">
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
			<button v-if="!exclusive" class="tw-button-icon tw-mg-x-05 tw-relative tw-tooltip-wrapper" @click="popout">
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
		<section class="tw-border-t tw-full-height tw-full-width tw-flex tw-overflow-hidden">
			<simplebar classes="tw-flex-grow-1">
				<i18n-entry
					v-for="phrase in filtered"
					:key="phrase.key"
					:entry="phrase"
					@update="update(phrase.key, $event)"
				/>
			</simplebar>
		</section>
	</div>
</template>

<script>

import displace from 'displacejs';

export default {
	data() {
		return this.$vnode.data;
	},

	computed: {
		filter() {
			return this.query.toLowerCase()
		},

		filtered() {
			if ( ! this.query || ! this.query.length )
				return this.phrases;

			return this.phrases.filter(entry => {
				if ( entry.key.toLowerCase().includes(this.query) )
					return true;

				if ( entry.phrase.toLowerCase().includes(this.query) )
					return true;

				return false;
			})
		}
	},

	watch: {
		maximized() {
			this.updateDrag();
		}
	},

	created() {
		this.requestKeys();
		this.grabKeys();

		this.listen('i18n:got-keys', this.grabKeys, this);
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
	},

	methods: {
		grabKeys() {
			this.phrases = this.getKeys();
			this.phrases.sort((a, b) => {
				return a.key.localeCompare(b.key)
			});
		},

		update(key, phrase) {
			this.updatePhrase(key, phrase);
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