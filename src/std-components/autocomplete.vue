<template>
	<div class="ffz--autocomplete tw-relative">
		<div class="tw-search-input" data-a-target="dropdown-search-input">
			<label v-if="placeholder" :for="_id" class="tw-hide-accessible">{{ placeholder }}</label>
			<div class="tw-relative">
				<div v-if="hasIcon" class="tw-absolute tw-align-items-center tw-c-text-alt-2 tw-flex tw-full-height ffz-input__icon tw-justify-content-center tw-left-0 tw-top-0 tw-z-default">
					<figure :class="icon" />
				</div>
				<input
					:id="_id"
					v-model="search"
					:placeholder="placeholder"
					:class="[hasIcon ? 'tw-pd-l-3' : 'tw-pd-l-1']"
					type="search"
					class="tw-block tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-r-1 tw-pd-y-05"
					autocapitalize="off"
					autocorrect="off"
					autocomplete="off"
					spellcheck="false"
					@focus="onFocus"
					@blur="onBlur"
					@input="onChange"
					@keydown.escape="onEscape"
					@keydown.down="onDown"
					@keydown.up="onUp"
					@keydown.enter="onEnter"
					@keydown.home="onHome"
					@keydown.end="onEnd"
				>
			</div>
		</div>
		<balloon v-if="open" :dir="direction" color="background-base">
			<div ref="list" tabindex="-1">
				<simplebar classes="scrollable-area--suppress-scroll-x">
					<div
						v-if="! hasItems && ! loading"
						class="tw-align-center tw-c-text-alt-2 tw-pd-y-05 tw-pd-x-1"
					>
						{{ t('autocomplete.empty', 'There are no results.') }}
					</div>
					<div v-else-if="! hasItems && loading" class="tw-align-center tw-c-text-alt-2 tw-pd-05">
						<h3 class="ffz-i-zreknarf loading" />
					</div>
					<button
						v-for="(item, idx) of filteredItems"
						:id="'ffz-autocomplete-item-' + id + '-' + idx"
						:key="has(item, 'id') ? item.id : idx"
						:class="{'ffz-interactable--hover' : idx === index}"
						class="tw-block tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
						tabindex="-1"
						data-selectable="true"
						@mouseenter="index = idx"
						@click="selectItem(item)"
					>
						<slot :item="item">
							<div class="tw-pd-x-1 tw-pd-y-05">
								<span :title="item.title">{{ item.displayName || item.label || item.name }}</span>
							</div>
						</slot>
					</button>
				</simplebar>
			</div>
		</balloon>
	</div>
</template>

<script>

import {has as objectHas, debounce} from 'utilities/object';

let last_id = 0;

export default {
	props: {
		inputId: {
			type: String,
			required: false
		},
		items: {
			type: [Array, Function],
			required: false,
			default: () => []
		},
		icon: {
			type: String,
			required: false,
			default: ''
		},
		placeholder: {
			type: String,
			required: false,
			default: ''
		},
		value: {
			type: String,
			required: false,
			default: ''
		},
		suggestOnFocus: {
			type: Boolean,
			required: false,
			default: false
		},
		suggestWhenEmpty: {
			type: Boolean,
			required: false,
			default: false
		},
		escapeToClear: {
			type: Boolean,
			required: false,
			default: true
		},
		clearOnSelect: {
			type: Boolean,
			required: false,
			default: false
		},
		cacheDuration: {
			type: Number,
			required: false,
			default: 5000
		},
		direction: {
			type: String,
			required: false,
			default: 'down'
		},
		logger: {
			type: Object,
			required: false
		}
	},

	data() {
		const is_fn = typeof this.items === 'function';

		return {
			id: last_id++,

			search: this.value,
			focused: false,
			open: false,
			index: 0,

			cachedFor: null,
			cachedAt: 0,
			cachedItems: is_fn ? [] : this.items,
			async: is_fn,
			loading: false,
			errored: false
		}
	},

	computed: {
		_id() {
			if ( this.inputId && this.inputId.length )
				return this.inputId;

			return `ffz-autocomplete$${this.id}`;
		},

		hasIcon() {
			return this.icon && this.icon.length > 0
		},

		hasItems() {
			return this.filteredItems && this.filteredItems.length > 0
		},

		filteredItems() {
			if ( this.errored )
				return null;

			if ( ! this.search || ! this.search.length )
				return this.cachedItems;

			const needle = this.search.toLowerCase();
			return this.cachedItems.filter(item => {
				if ( typeof item.displayName === 'string' && item.displayName.toLowerCase().includes(needle) )
					return true;

				if ( typeof item.label === 'string' && item.label.toLowerCase().includes(needle) )
					return true;

				if ( typeof item.name === 'string' && item.name.toLowerCase().includes(needle) )
					return true;

				return typeof item.value === 'string' && item.value.toLowerCase().includes(needle);
			})
		}
	},

	watch: {
		items() {
			const is_fn = typeof this.items === 'function';
			this.cachedItems = is_fn ? [] : this.items;
			this.async = is_fn;
			this.loading = false;
			this.errored = false;

			if ( this.open )
				this.updateCache();
		}
	},

	created() {
		this.maybeClose = debounce(this.maybeClose, 250);
		this.updateCache = debounce(this.updateCache, 500, 2);
	},

	methods: {
		has(thing, key) {
			return objectHas(thing, key)
		},

		updateCache() {
			if ( ! this.async )
				return;

			if ( this.search === this.cachedFor && (Date.now() - this.cachedAt) < this.cacheDuration )
				return;

			this.loading = false;
			this.errored = false;

			this.cachedFor = this.search;
			this.cachedAt = Date.now();

			let result = null;
			try {
				result = this.items(this.search);
			} catch(err) {
				if ( this.logger )
					this.logger.capture(err);
				else
					console.error(err); // eslint-disable-line no-console
			}

			if ( result instanceof Promise ) {
				this.loading = true;
				result.then(items => {
					this.loading = false;
					this.cachedItems = items;
				}).catch(err => {
					if ( this.logger )
						this.logger.capture(err);
					else
						console.error(err); // eslint-disable-line no-console

					this.loading = false;
					this.errored = true;
					this.cachedItems = [];
				});

			} else if ( Array.isArray(result) )
				this.cachedItems = result;

			else {
				this.errored = true;
				this.cachedItems = [];
			}
		},

		onFocus() {
			this.focused = true;
			this.$emit('focus');

			if ( this.open || ! this.suggestOnFocus )
				return;

			if ( ! this.suggestWhenEmpty && (! this.search || ! this.search.length) )
				return;

			this.updateCache();

			if ( ! this.open ) {
				this.open = true;
				this.index = -1;
			}
		},

		onBlur() {
			this.focused = false;
			this.$emit('blur');
			this.maybeClose();
		},

		maybeClose() {
			if ( ! this.focused )
				this.open = false;
		},

		onChange() {
			this.$emit('input', this.search);

			if ( (! this.search || ! this.search.length) && ! this.suggestWhenEmpty ) {
				this.loading = false;
				this.open = false;
				return;
			}

			this.updateCache();

			if ( ! this.open ) {
				this.open = true;
				this.index = -1;
			}
		},

		onEscape(event) {
			if ( this.open || ! this.escapeToClear )
				event.preventDefault();

			this.open = false;
		},

		onHome(event) {
			if ( event.ctrlKey || event.shiftKey || event.altKey )
				return;

			if ( ! this.open )
				return;

			event.preventDefault();
			if ( this.filteredItems )
				this.index = 0;

			this.scrollToItem();
		},

		onEnd(event) {
			if ( event.ctrlKey || event.shiftKey || event.altKey )
				return;

			if ( ! this.open )
				return;

			event.preventDefault();
			if ( this.filteredItems )
				this.index = this.filteredItems.length - 1;

			this.scrollToItem();
		},

		onUp(event) {
			if ( event.ctrlKey || event.shiftKey || event.altKey )
				return;

			if ( ! this.open )
				return;

			this.index--;
			if ( ! this.filteredItems )
				this.index = -1;
			else if ( this.index < 0 )
				this.index = 0;

			this.scrollToItem();
			event.preventDefault();
		},

		onDown(event) {
			if ( event.ctrlKey || event.shiftKey || event.altKey )
				return;

			if ( ! this.open )
				return;

			this.index++;
			if ( ! this.filteredItems )
				this.index = -1;
			else if ( this.index >= this.filteredItems.length )
				this.index = this.filteredItems.length - 1;

			this.scrollToItem();
			event.preventDefault();
		},

		scrollToItem() {
			const root = this.$refs.list,
				element = root && root.querySelector(`#ffz-autocomplete-item-${this.id}-${this.index}`);

			if ( element )
				element.scrollIntoViewIfNeeded();
		},

		onEnter(event) {
			if ( event.ctrlKey || event.shiftKey || event.altKey )
				return;

			if ( ! this.open )
				return;

			event.preventDefault();
			const item = this.filteredItems[this.index];
			if ( item )
				this.selectItem(item);
		},

		selectItem(item) {
			if ( this.clearOnSelect ) {
				this.search = '';
				if ( ! this.suggestWhenEmpty )
					this.open = false;

			} else {
				this.search = item.displayName || item.label || item.name || item.value;
				this.open = false;
			}

			this.$emit('input', this.search);
			this.$emit('selected', item);
		}
	}
}

</script>