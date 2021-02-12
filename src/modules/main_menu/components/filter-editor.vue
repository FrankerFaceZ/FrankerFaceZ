<template lang="html">
	<div class="ffz--widget ffz--filter-editor">
		<div ref="list" class="ffz--rule-list">
			<section v-if="! editing || ! editing.length" class="tw-mg-x-1 tw-mg-y-2 tw-c-text-alt-2 tw-align-center sortable-ignore">
				{{ t('setting.filters.empty', '(no filters)') }}
			</section>

			<filter-rule-editor
				v-for="rule in editing"
				:key="rule.id"
				:value="rule"
				:filters="filters"
				:context="context"
				:data-id="rule.id"
				@input="updateRule(rule.id, $event)"
				@delete="deleteRule(rule.id)"
			/>
		</div>

		<div v-if="adding || (maxRules === 1 && canAddRule)" class="tw-flex tw-align-items-center tw-mg-y-1">
			<select
				v-once
				ref="add_box"
				class="tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-select"
			>
				<option
					v-for="(filter, key) in filters"
					:key="key"
					:value="key"
				>
					{{ t(filter.i18n, filter.title) }}
				</option>
			</select>

			<button class="tw-button tw-mg-l-1" @click="addRule">
				<span class="tw-button__text ffz-i-plus">
					{{ t('setting.filters.add', 'Add') }}
				</span>
			</button>
		</div>
		<button
			v-else-if="canAddRule"
			class="tw-button ffz-button--hollow tw-mg-y-05 tw-full-width"
			@click="adding = true"
		>
			<span class="tw-button__text ffz-i-plus">
				{{ t('setting.filters.add-new', 'Add New Rule') }}
			</span>
		</button>
	</div>
</template>

<script>

import Sortable from 'sortablejs';
import {deep_copy, maybe_call, generateUUID} from 'utilities/object';
import {findSharedParent} from 'utilities/dom';

export default {
	props: {
		value: Array,
		filters: Object,
		maxRules: {
			tpye: Number,
			required: false,
			default: 0
		},
		context: {
			type: Object,
			required: false
		}
	},

	data() {
		return {
			adding: false,
			editing: this.copyValue()
		}
	},

	computed: {
		canAddRule() {
			return ! this.maxRules || (this.editing.length < this.maxRules);
		}
	},

	watch: {
		editing: {
			handler() {
				this.$emit('input', this.editing)
			},
			deep: true
		}
	},

	mounted() {
		this.sortable = Sortable.create(this.$refs.list, {
			draggable: 'section',
			filter: 'button,.sortable-ignore',
			swapThreshold: 0.33,
			group: {
				name: 'ffz-filter-editor',
				put: (to, from, dragged) => {
					if ( ! this.canAddRule )
						return false;

					// Avoid moving an element into its child list.
					if ( dragged && dragged.contains && dragged.contains(to.el) )
						return false;

					// Check to see if we have a common ancester for the two
					// draggables.
					if ( ! findSharedParent(to.el, from.el, '.ffz--rule-list') )
						return false;

					return true;
				}
			},

			setData: (data, el) => {
				const rule = this.getRule(el.dataset.id);
				if ( rule ) {
					data.setData('JSON', JSON.stringify(rule));
				}
			},

			onAdd: event => {
				if ( ! this.canAddRule ) {
					event.preventDefault();
					return;
				}

				let rule;
				try {
					rule = JSON.parse(event.originalEvent.dataTransfer.getData('JSON'));
				} catch(err) {
					event.preventDefault();
					return;
				}

				this.editing.splice(event.newDraggableIndex, 0, rule);
			},

			onRemove: event => {
				let rule;
				try {
					rule = JSON.parse(event.originalEvent.dataTransfer.getData('JSON'));
				} catch(err) {
					event.preventDefault();
					return;
				}

				this.deleteRule(rule.id);
			},

			onUpdate: event => {
				if ( event.newIndex === event.oldIndex )
					return;

				this.editing.splice(event.newIndex, 0, ...this.editing.splice(event.oldIndex, 1));
			}
		});
	},

	beforeDestroy() {
		if ( this.sortable ) {
			this.sortable.destroy();
			this.sortable = null;
		}
	},

	methods: {
		getRule(id, start) {
			if ( ! start )
				start = this.editing;

			if ( ! Array.isArray(start) )
				return null;

			for(let i=0; i < start.length; i++) {
				const rule = start[i];
				if ( ! rule )
					continue;
				else if ( rule.id === id )
					return rule;

				const type = this.filters[rule.type];
				if ( type && type.childRules ) {
					const out = this.getRule(id, rule.data);
					if ( out )
						return out;
				}
			}

			return null;
		},

		addRule() {
			this.adding = false;

			const key = this.$refs.add_box.value,
				type = this.filters[key];

			if ( ! key )
				return;

			const out = {
				id: generateUUID(),
				type: key,
				data: maybe_call(type.default, type)
			};

			this.editing.push(out);
		},

		updateRule(id, data) {
			for(let i=0; i < this.editing.length; i++) {
				if ( this.editing[i].id === id ) {
					this.editing[i] = Object.assign(this.editing[i], data);
					return;
				}
			}
		},

		deleteRule(id) {
			for(let i=0; i < this.editing.length; i++) {
				if ( this.editing[i].id === id ) {
					this.editing.splice(i, 1);
					return;
				}
			}
		},

		copyValue() {
			if ( ! Array.isArray(this.value) )
				return [];

			return deep_copy(this.value).map(rule => {
				if ( ! rule.id )
					rule.id = generateUUID();

				return rule;
			});
		}
	}
}

</script>