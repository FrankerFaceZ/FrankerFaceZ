<template lang="html">
	<div v-on-clickaway="close" class="ffz--icon-picker tw-relative">
		<div class="tw-search-input tw-full-width">
			<label v-if="open" :for="'icon-search$' + id" class="tw-hide-accessible">{{ t('setting.icon.search', 'Search for Icon') }}</label>
			<div class="tw-relative">
				<div class="tw-absolute tw-align-items-center tw-c-text-alt-2 tw-flex tw-full-height ffz-input__icon tw-justify-content-center tw-left-0 tw-top-0 tw-z-default">
					<figure :class="[(isOpen || ! val || ! val.length) ? 'ffz-i-search' : val]" />
				</div>
				<input
					:id="'icon-search$' + id"
					ref="input"
					:placeholder="t('setting.icon.search', 'Search for Icon')"
					:value="isOpen ? search : val"
					:class="[clearable ? 'tw-pd-r-5' : 'tw-pd-r-1']"
					type="text"
					class="tw-block tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-l-3 tw-pd-y-05"
					autocapitalize="off"
					autocorrect="off"
					autocomplete="off"
					spellcheck="false"
					@input="update"
					@focus="onFocus"
					@blur="onBlur"
					@keydown.escape="open = false"
				>
				<button
					v-if="clearable"
					class="tw-absolute tw-right-0 tw-top-0 tw-button tw-button--text tw-tooltip__container"
					@click="change('', false)"
					@keydown.escape="open = false"
					@focus="onFocus(false)"
					@blur="onBlur"
				>
					<span class="tw-button__text ffz-i-trash" />
					<div class="tw-tooltip tw-tooltip--up tw-tooltip--align-right">
						{{ t('setting.icon.clear', 'Clear') }}
					</div>
				</button>
			</div>
		</div>
		<balloon v-if="open" :dir="direction" color="background-base">
			<div ref="list">
				<simplebar classes="scrollable-area--suppress-scroll-x ffz--icon-picker__list">
					<div v-if="visible.length" role="radiogroup" class="tw-pd-1 tw-flex tw-flex-wrap tw-justify-content-between">
						<div
							v-for="i of visible"
							:key="i[0]"
							:aria-checked="val === i[0]"
							:class="{'ffz-interactable--selected': val === i[0]}"
							:data-title="i[1]"
							class="ffz-tooltip ffz-icon ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
							role="radio"
							tabindex="0"
							@keydown.space.stop.prevent=""
							@keyup.space="change(i[0])"
							@keyup.enter="change(i[0])"
							@click="change(i[0])"
							@focus="onFocus(false)"
							@blur="onBlur"
						>
							<figure :class="`tw-mg-y-05 tw-mg-x-1 ${i[0]}`" />
						</div>
					</div>
					<div v-else class="tw-align-center tw-pd-1 tw-c-text-alt-2">
						{{ t('setting.actions.empty-search', 'no results') }}
					</div>
				</simplebar>
			</div>
		</balloon>
	</div>
</template>

<script>

let id = 0;

import {escape_regex, deep_copy, debounce} from 'utilities/object';
import {load, maybeLoad, ICONS as FA_ICONS, ALIASES as FA_ALIASES} from 'utilities/font-awesome';

import FFZ_ICONS from 'utilities/ffz-icons';

const FFZ_ALIASES = {
	'block': ['ban', 'block'],
	'ok': ['ok', 'unban', 'untimeout', 'checkmark'],
	'clock': ['clock', 'clock-o', 'timeout']
};


const ICONS = FFZ_ICONS
	.map(x => [`ffz-i-${x}`, FFZ_ALIASES[x] ? FFZ_ALIASES[x].join(' ') : x])
	.concat(FA_ICONS.filter(x => ! FFZ_ICONS.includes(x)).map(x => [`ffz-fa fa-${x}`, FA_ALIASES[x] ? FA_ALIASES[x].join(' ') : x]));

export default {
	props: {
		value: String,
		alwaysOpen: {
			type: Boolean,
			required: false,
			default: false
		},
		clearable: {
			type: Boolean,
			required: false,
			default: false
		},
		direction: {
			type: String,
			required: false,
			default: 'down'
		}
	},

	data() {
		return {
			id: id++,
			open: false,
			val: this.value,
			search: '',
			icons: deep_copy(ICONS)
		}
	},

	computed: {
		visible() {
			if ( ! this.search || ! this.search.length )
				return this.icons;

			const search = this.search.toLowerCase().replace(' ', '-'),
				reg = new RegExp(`(?:^|-| )${escape_regex(search)}`, 'i');

			return this.icons.filter(x => reg.test(x[1]));
		},

		isOpen() {
			return this.alwaysOpen || this.open
		}
	},

	watch: {
		value() {
			this.val = this.value;
		},

		isOpen() {
			if ( ! this.isOpen ) {
				requestAnimationFrame(() => {
					const ffz = FrankerFaceZ.get();
					if ( ffz )
						ffz.emit('tooltips:cleanup');
				});
				return;
			}

			load();

			this.$nextTick(() => {
				if ( this.val ) {
					const root = this.$refs.list,
						el = root && root.querySelector('.ffz-interactable--selected');

					if ( el )
						el.scrollIntoViewIfNeeded();
				}
			});
		}
	},

	created() {
		this.maybeClose = debounce(this.maybeClose, 10);
	},

	mounted() {
		maybeLoad(this.val);
	},

	methods: {
		update() {
			if ( this.open )
				this.search = this.$refs.input.value;
		},

		close() {
			this.open = false;
		},

		change(val, close = true) {
			this.val = val;
			this.$emit('input', this.val);
			if ( close )
				this.open = false;
		},

		onFocus(open = true) {
			this.focused = true;
			if ( open )
				this.open = true;
		},

		onBlur() {
			this.focused = false;
			this.maybeClose();
		},

		maybeClose() {
			if ( ! this.focused )
				this.open = false;
		}
	}
}

</script>