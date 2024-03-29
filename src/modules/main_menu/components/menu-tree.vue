<template lang="html">
	<ul
		v-if="modal"
		:role="[root ? 'group' : 'tree']"
		:tabindex="tabIndex"
		class="ffz--menu-tree"
		@keyup.up="prevItem"
		@keyup.down="nextItem"
		@keyup.left="prevLevel"
		@keyup.right="nextLevel"
		@keyup.*="expandAll"
	>
		<li
			v-for="item in displayed"
			:key="item.full_key"
			:class="[(currentItem === item || item.hide_children && containsCurrent(item)) ? 'active' : '']"
			:data-key="item.full_key"
			role="presentation"
		>
			<div
				:aria-expanded="item.expanded"
				:aria-selected="currentItem === item"
				class="tw-flex__item tw-flex tw-flex-nowrap tw-align-items-center tw-pd-y-05 tw-pd-r-05"
				role="treeitem"
				@click="clickItem(item)"
			>
				<span
					:class="[
						(item.items && ! item.hide_children) ? '' : 'ffz--invisible',
						item.expanded ? 'ffz-i-down-dir' : 'ffz-i-right-dir'
					]"
					role="presentation"
					class="arrow"
				/>
				<span class="tw-flex-grow-1">
					{{ t(item.i18n_key, item.title) }}
				</span>
				<span v-if="filter" class="ffz-pill ffz-pill--overlay">
					{{ countMatches(item) }}
				</span>
				<span v-else-if="item.pill" class="ffz-pill ffz-pill--overlay">
					{{ item.pill_i18n_key ? t(item.pill_i18n_key, item.pill) : item.pill }}
				</span>
				<span v-else-if="item.unseen" class="ffz-pill ffz-pill--overlay">
					{{ item.unseen }}
				</span>
			</div>
			<menu-tree
				v-if="item.items && item.expanded && ! item.hide_children"
				:root="item"
				:current-item="currentItem"
				:modal="item.items"
				:context="context"
				:filter="filter"
				@change-item="i => $emit('change-item', i)"
				@mark-seen="i => $emit('mark-seen', i)"
				@mark-expanded="i => $emit('mark-expanded', i)"
			/>
		</li>
	</ul>
</template>

<script>

function findLastVisible(node) {
	if ( node.expanded && node.items )
		return findLastVisible(node.items[node.items.length - 1]);

	return node;
}


function findNextVisible(node, modal) {
	const items = node.parent ? node.parent.items : modal,
		idx = items.indexOf(node);

	if ( items[idx + 1] )
		return items[idx+1];

	if ( node.parent )
		return findNextVisible(node.parent, modal);

	return null;
}


function recursiveExpand(node, vue) {
	if ( ! node.expanded ) {
		node.expanded = true;
		if ( vue )
			vue.$emit('mark-expanded', node);
	}

	if ( node.items )
		for(const item of node.items)
			recursiveExpand(item, vue);
}


export default {
	props: ['root', 'modal', 'currentItem', 'filter', 'context'],

	computed: {
		tabIndex() {
			return this.root ? undefined : 0;
		},

		displayed() {
			return this.modal.filter(item => this.shouldShow(item));
		}
	},

	methods: {
		shouldShow(item, is_walking = false) {
			if ( ! this.filter || this.containsCurrent(item) )
				return true;

			if ( this.filter.flags ) {
				if ( this.filter.flags.has('modified') ) {
					// We need to tree walk for this one.
					if ( ! is_walking ) {
						for(const key of ['tabs', 'contents', 'items'])
							if ( item[key] )
								for(const thing of item[key])
									if ( this.shouldShow(thing) )
										return true;
					}

					if ( ! item.setting || ! this.context.currentProfile.has(item.setting) )
						return false;
				}
			}

			if ( this.filter.query ) {
				if ( ! item.search_terms || ! item.search_terms.includes(this.filter.query) )
					return false;
			}

			return true;
		},

		countMatches(item, seen) {
			if ( ! this.filter || ! item )
				return 0;

			if ( seen && seen.has(item) )
				return 0;

			if ( ! seen )
				seen = new Set;

			seen.add(item);

			let count = 0;

			for(const key of ['tabs', 'contents', 'items'])
				if ( item[key] )
					for(const thing of item[key])
						count += this.countMatches(thing, seen);

			if ( item.setting && this.shouldShow(item, true) )
				count++;

			return count;
		},

		containsCurrent(item) {
			let i = this.currentItem;
			while ( i ) {
				if ( item === i )
					return true;

				i = i.parent;
			}

			return false;
		},

		clickItem(item) {
			if ( ! item.expanded )
				item.expanded = true;
			else if ( this.currentItem === item )
				item.expanded = false;

			this.$emit('mark-expanded', item);
			this.$emit('change-item', item);
		},

		expandAll() {
			for(const item of this.modal)
				recursiveExpand(item, this);
		},

		prevItem() {
			if ( this.root ) return;

			const i = this.currentItem,
				items = i.parent ? i.parent.items : this.modal,
				idx = items.indexOf(i);

			if ( idx > 0 )
				this.$emit('change-item', findLastVisible(items[idx-1]));

			else if ( i.parent )
				this.$emit('change-item', i.parent);
		},

		nextItem() {
			if ( this.root ) return;

			const i = this.currentItem;
			let target;

			if ( i.expanded && i.items )
				target = i.items[0];

			else
				target = findNextVisible(i, this.modal);

			if ( target )
				this.$emit('change-item', target);
		},

		prevLevel() {
			if ( this.root ) return;

			const i = this.currentItem;

			if ( i.expanded && i.items ) {
				i.expanded = false;
				this.$emit('mark-expanded', i);
			} else if ( i.parent )
				this.$emit('change-item', i.parent);
		},

		nextLevel() {
			if ( this.root ) return;

			const i = this.currentItem;
			if ( i.expanded && i.items )
				this.$emit('change-item', i.items[0]);
			else {
				i.expanded = true;
				this.$emit('mark-expanded', i);
			}

			if ( event.ctrlKey )
				recursiveExpand(this.currentItem, this);
		}
	}
}

</script>