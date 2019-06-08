<template lang="html">
	<div class="ffz--icon-picker">
		<div class="tw-full-width">
			<div class="tw-search-input">
				<label :for="'icon-search$' + id" class="tw-hide-accessible">
					{{ t('setting.icon.search', 'Search for Icon') }}
				</label>
				<div class="tw-relative tw-mg-t-05">
					<div class="tw-absolute tw-align-items-center tw-c-text-alt-2 tw-flex tw-full-height tw-input__icon tw-justify-content-center tw-left-0 tw-top-0 tw-z-default">
						<figure class="ffz-i-search" />
					</div>
					<input
						:id="'icon-search$' + id"
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

			<simplebar classes="tw-c-background-alt-2 tw-border-l tw-border-r tw-border-b ffz--icon-picker__list tw-mg-b-05">
				<div v-if="visible.length" role="radiogroup" class="tw-pd-1 tw-flex tw-flex-wrap tw-justify-content-between" >
					<div
						v-for="i of visible"
						:key="i[0]"
						:aria-checked="value === i[0]"
						:class="{'tw-interactable--selected': value === i[0]}"
						:data-title="i[1]"
						class="ffz-tooltip ffz-icon tw-interactable tw-interactable--inverted"
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

let id = 0;

import {escape_regex, deep_copy} from 'utilities/object';
import {load, ICONS as FA_ICONS, ALIASES as FA_ALIASES} from 'utilities/font-awesome';

const FFZ_ICONS = [
	'cancel',
	'zreknarf',
	'search',
	'clock',
	'star',
	'star-empty',
	'down-dir',
	'right-dir',
	'attention',
	'ok',
	'cog',
	'plus',
	'folder-open',
	'download',
	'upload',
	'floppy',
	'crown',
	'verified',
	'heart',
	'heart-empty',
	'tag',
	'tags',
	'retweet',
	'thumbs-up',
	'thumbs-down',
	'bell',
	'pencil',
	'info',
	'help',
	'calendar',
	'left-dir',
	'inventory',
	'lock',
	'lock-open',
	'arrows-cw',
	'ignore',
	'block',
	'pin',
	'pin-outline',
	'gift',
	'discord',
	'eye',
	'eye-off',
	'views',
	'conversations',
	'channels',
	'camera',
	'cw',
	'up-dir',
	'up-big',
	'link-ext',
	'twitter',
	'github',
	'gauge',
	'download-cloud',
	'upload-cloud',
	'smile',
	'keyboard',
	'calendar-empty',
	'ellipsis-vert',
	'twitch',
	'bell-off',
	'trash',
	'eyedropper',
	'user-secret',
	'window-maximize',
	'window-minimize',
	'window-restore',
	'window-close'
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
			id: id++,
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

		this.$nextTick(() => {
			if ( this.value ) {
				const el = this.$el.querySelector('.tw-interactable--selected');
				if ( el )
					el.scrollIntoViewIfNeeded();
			}
		});
	},

	methods: {
		change(val) {
			this.value = val;
			this.$emit('input', this.value);
		}
	}
}

</script>