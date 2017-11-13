<template lang="html">
<ul
	v-if="modal"
	class="ffz--menu-tree"
	:role="[root ? 'group' : 'tree']"
	:tabindex="tabIndex"
	@keyup.up="prevItem"
	@keyup.down="nextItem"
	@keyup.left="prevLevel"
	@keyup.right="nextLevel"
	@keyup.*="expandAll"
>
	<li
		v-for="item in modal"
		:key="item.full_key"
		:class="[currentItem === item ? 'active' : '']"
		role="presentation"
	>
		<div
			class="flex__item flex flex--nowrap align-items-center pd-y-05 pd-r-05"

			role="treeitem"
			:aria-expanded="item.expanded"
			:aria-selected="currentItem === item"
			@click="clickItem(item)"
		>
			<span
				role="presentation"
				class="arrow"
				:class="[
					item.items ? '' : 'ffz--invisible',
					item.expanded ? 'ffz-i-down-dir' : 'ffz-i-right-dir'
				]"
			/>
			<span class="flex-grow-1">
				{{ t(item.i18n_key, item.title, item) }}
			</span>
			<span v-if="item.pill" class="pill">
				{{ item.pill_i18n_key ? t(item.pill_i18n_key, item.pill, item) : item.pill }}
			</span>
		</div>
		<menu-tree
			:root="item"
			:currentItem="currentItem"
			:modal="item.items"
			v-if="item.items && item.expanded"
			@change-item="i => $emit('change-item', i)"
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


function recursiveExpand(node) {
	node.expanded = true;
	if ( node.items )
		for(const item of node.items)
			recursiveExpand(item);
}


export default {
	props: ['root', 'modal', 'currentItem'],

	computed: {
		tabIndex() {
			return this.root ? undefined : 0;
		}
	},

	methods: {
		clickItem(item) {
			if ( ! item.expanded )
				item.expanded = true;
			else if ( this.currentItem === item )
				item.expanded = false;

			this.$emit('change-item', item);
		},

		expandAll() {
			for(const item of this.modal)
				recursiveExpand(item);
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

		nextItem(e) {
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

			if ( i.expanded && i.items )
				i.expanded = false;
			else if ( i.parent )
				this.$emit('change-item', i.parent);
		},

		nextLevel() {
			if ( this.root ) return;

			const i = this.currentItem;
			if ( i.expanded && i.items )
				this.$emit('change-item', i.items[0]);
			else
				i.expanded = true;

			if ( event.ctrlKey )
				recursiveExpand(this.currentItem);
		}
	}
}

</script>