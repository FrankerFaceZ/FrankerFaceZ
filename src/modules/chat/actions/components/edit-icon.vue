<template lang="html">
	<div class="tw-flex tw-align-items-start">
		<label class="tw-mg-y-05">
			{{ t('setting.actions.icon', 'Icon') }}
		</label>

		<div class="tw-full-width">
			<div class="tw-search-input">
				<label for="icon-search" class="tw-hide-accessible">
					{{ t('setting.actions.icon.search', 'Search for Icon') }}
				</label>
				<div class="tw-relative tw-mg-t-05">
					<div class="tw-absolute tw-align-items-center tw-c-text-alt-2 tw-flex tw-full-height tw-input__icon tw-justify-content-center tw-left-0 tw-top-0 tw-z-default">
						<figure class="ffz-i-search" />
					</div>
					<input
						id="icon-search"
						:placeholder="t('setting.actions.icon.search', 'Search for Icon')"
						v-model="search"
						type="search"
						class="tw-block tw-border-radius-medium tw-font-size-6 tw-full-width tw-input tw-pd-l-3 tw-pd-r-1 tw-pd-y-05"
						autocapitalize="off"
						autocorrect="off"
						autocomplete="off"
					>
				</div>
			</div>

			<simplebar classes="tw-c-background-alt-2 tw-border-l tw-border-r tw-border-b ffz-icon-picker tw-mg-b-05">
				<div v-if="visible.length" role="radiogroup" class="tw-pd-1 tw-flex tw-flex-wrap" >
					<div
						v-for="i of visible"
						:key="i[0]"
						:aria-checked="value.icon === i[0]"
						:class="{'tw-interactable--selected': value.icon === i[0]}"
						class="ffz-icon tw-interactable tw-interactable--inverted"
						role="radio"
						tabindex="0"
						@keydown.space.stop.prevent=""
						@keyup.space="change(i[0])"
						@keyup.enter="change(i[0])"
						@click="change(i[0])"
					>
						<figure :class="`tw-mg-y-05 tw-mg-x-1 ${i[0]}`" />
					</div>
				</div>
				<div v-else class="tw-align-center tw-pd-1 tw-c-text-alt-2">
					{{ t('setting.actions.empty-search', 'no results') }}
				</div>
			</simplebar>
		</div>
	</div>
</template>

<script>

import {escape_regex, deep_copy} from 'utilities/object';
import {load, ICONS as FA_ICONS, ALIASES as FA_ALIASES} from 'utilities/font-awesome';

const FFZ_ICONS = [
	'zreknarf',
	'crown',
	'verified',
	'inventory',
	'ignore',
	'pin-outline',
	'pin',
	'block',
	'ok',
	'clock',
	'eye',
	'eye-off',
	'trash',
	'discord',
	'star',
	'star-empty',
	'twitch',
	'twitter',
	'download',
	'upload',
	'download-cloud',
	'upload-cloud',
	'tag',
	'tags',
	'retweet',
	'thumbs-up',
	'thumbs-down',
	'bell',
	'bell-off',
	'pencil',
	'info',
	'help',
	'calendar',
	'lock',
	'lock-open',
	'arrows-cw',
	'gift',
	'eyedropper',
	'github',
	'user-secret'
];

const FFZ_ALIASES = {
	'block': ['ban', 'block'],
	'ok': ['ok', 'unban', 'untimeout', 'checkmark'],
	'clock': ['clock', 'clock-o', 'timeout']
};


const ICONS = FFZ_ICONS
	.map(x => [`ffz-i-${x}`, FFZ_ALIASES[x] ? FFZ_ALIASES[x].join(' ') : x])
	.concat(FA_ICONS.filter(x => ! FFZ_ICONS.includes(x)).map(x => [`ffz-fa fa-${x}`, FA_ALIASES[x] ? FA_ALIASES[x].join(' ') : x]));


export default {
	props: ['value'],

	data() {
		return {
			search: '',
			icons: deep_copy(ICONS)
		}
	},

	computed: {
		visible() {
			if ( ! this.search || ! this.search.length )
				return this.icons;

			const search = this.search.toLowerCase().replace(' ', '-'),
				reg = new RegExp('(?:^|-| )' + escape_regex(search), 'i');

			return this.icons.filter(x => reg.test(x[1]));
		}
	},

	mounted() {
		load();
	},

	methods: {
		change(val) {
			this.value.icon = val;
			this.$emit('input', this.value);
		}
	}
}

</script>

<style lang="scss" scoped>
	.ffz-icon-picker {
		max-height: 15rem;
		font-size: 1.6rem;

		.ffz-icon {
			width: auto !important;
		}
	}
</style>