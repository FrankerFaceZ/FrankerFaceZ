<template lang="html">
	<div v-on-clickaway="close" class="ffz--emote-picker tw-relative">
		<div class="tw-search-input tw-full-width">
			<label v-if="isOpen" :for="'emote-search$' + id" class="tw-hide-accessible">{{ t('setting.emote.search', 'Search for Emote') }}</label>
			<div class="tw-relative">
				<div class="tw-absolute tw-align-items-center tw-c-text-alt-2 tw-flex tw-full-height ffz-input__icon tw-justify-content-center tw-left-0 tw-top-0 tw-z-default">
					<figure class="tw-mg-y-05 tw-mg-x-05">
						<img v-if="val.src" class="ffz-preview-emote" :src="val.src">
					</figure>
				</div>
				<input
					:id="'emote-search$' + id"
					ref="input"
					:placeholder="t('setting.emote.search', 'Search for Emote')"
					:value="isOpen ? search : valName"
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
					class="tw-absolute tw-right-0 tw-top-0 tw-button tw-button--text ffz-il-tooltip__container"
					@click="change('', false)"
					@keydown.escape="open = false"
					@focus="onFocus(false)"
					@blur="onBlur"
				>
					<span class="tw-button__text ffz-i-trash" />
					<div class="ffz-il-tooltip ffz-il-tooltip--up ffz-il-tooltip--align-right">
						{{ t('setting.icon.clear', 'Clear') }}
					</div>
				</button>
			</div>
		</div>
		<balloon v-if="isOpen" :dir="direction" color="background-base">
			<div ref="list">
				<simplebar classes="scrollable-area--suppress-scroll-x ffz--emote-picker__list">
					<div v-if="visible.length" role="radiogroup" class="tw-pd-1 tw-flex tw-flex-wrap tw-justify-content-between">
						<div
							v-for="i of visible"
							:key="`${i.provider}:${i.id}`"
							:aria-checked="val.provider === i.provider && val.id === i.id"
							:class="{'ffz-interactable--selected': val.provider === i.provider && val.id === i.id}"
							:data-provider="i.provider"
							:data-id="i.id"
							:data-set="i.set_id"
							:data-name="i.name"
							class="ffz-tooltip ffz-icon ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
							role="radio"
							tabindex="0"
							data-tooltip-type="emote"
							@keydown.space.stop.prevent=""
							@keyup.space="change(i)"
							@keyup.enter="change(i)"
							@click="change(i)"
							@focus="onFocus(false)"
							@blur="onBlur"
						>
							<figure :class="`tw-mg-y-05 tw-mg-x-1`">
								<img :src="i.src">
							</figure>
						</div>
					</div>
					<div v-else-if="! emotes.length" class="tw-align-center tw-pd-1 tw-c-text-alt-2">
						{{ t('setting.emote.none', 'unable to load emote data') }}
						<div class="tw-mg-t-05">
							{{ t('setting.emote.none-about', 'Please make sure you have the FFZ Emote Menu enabled, and that you use this from a page that loads chat.') }}
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

import { debounce } from 'utilities/object';

let id = 0;

function readEmoteMenuEmotes(input, out, seen) {
	if ( Array.isArray(input) ) {
		for(const item of input)
			readEmoteMenuEmotes(item, out, seen);
		return;
	}

	if ( ! Array.isArray(input?.emotes) )
		return;

	for(const emote of input.emotes) {
		if ( emote.locked || seen.has(emote.name) )
			continue;

		seen.add(emote.name);

		out.push({
			provider: emote.provider,
			id: emote.id,
			set_id: emote.set_id,
			name: emote.name,
			lname: emote.name && emote.name.toLowerCase(),
			src: emote.src
		});
	}
}

export default {
	props: {
		value: Object,
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
			emotes: []
		}
	},

	computed: {
		visible() {
			if ( ! this.search || ! this.search.length )
				return this.emotes;

			const search = this.search.toLowerCase();
			return this.emotes.filter(x => x.lname && x.lname.indexOf(search) !== -1);
		},

		valName() {
			return this.val?.name;
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

			this.maybeLoadEmotes();

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

	methods: {
		maybeLoadEmotes() {
			if ( ! this.emotes || ! this.emotes.length ) {
				const emotes = [],
					seen = new Set,
					menu = window.ffz_menu,
					state = menu?.state;

				if ( menu ) {
					menu.loadData();
					readEmoteMenuEmotes(state?.channel_sets, emotes, seen);
					readEmoteMenuEmotes(state?.all_sets, emotes, seen);
				}

				this.emotes = emotes;
			}
		},

		update() {
			if ( this.isOpen )
				this.search = this.$refs.input.value;
		},

		close() {
			this.open = false;
		},

		change(val, close = true) {
			this.val = {
				type: 'emote',
				provider: val.provider,
				id: val.id,
				name: val.name,
				src: val.src
			};
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
