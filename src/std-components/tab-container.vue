<template lang="html">
	<div
		v-if="item.tabs"
		class="ffz--tab-container"
		@keyup.alt.page-up.stop="focusPrevTab"
		@keyup.alt.page-down.stop="focusNextTab"
	>
		<header
			class="tw-flex"
			tabindex="0"
			role="tablist"
			@keyup.home="firstTab"
			@keyup.end="lastTab"
			@keyup.page-up="prevTab"
			@keyup.up="prevTab"
			@keyup.left="prevTab"
			@keyup.page-down="nextTab"
			@keyup.right="nextTab"
			@keyup.down="nextTab"
		>
			<div
				v-for="(i, idx) in visibleTabs"
				:id="'tab-for-' + i.full_key"
				:key="i.full_key"
				:aria-selected="selected === idx"
				:aria-controls="'tab-panel-' + i.full_key"
				:class="{'active': selected === idx, 'ffz-unmatched-item': showing && ! shouldShow(i)}"
				role="tab"
				class="tab tw-pd-y-05 tw-pd-x-1"
				@click="select(idx)"
			>
				{{ t(i.i18n_key, i.title) }}
				<span v-if="filter" class="ffz-pill ffz-pill--overlay">{{ countMatches(i) }}</span>
				<span v-else-if="i.unseen" class="ffz-pill ffz-pill--overlay">{{ i.unseen }}</span>
			</div>
		</header>
		<section
			:id="'tab-panel-' + tab.full_key"
			:aria-labelledby="'tab-for-' + tab.full_key"
			class="tw-border"
			role="tabpanel"
			aria-hidden="false"
			aria-expanded="true"
		>
			<section v-if="tab.description" class="tw-pd-b-1">
				{{ t(tab.desc_i18n_key, tab.description) }}
			</section>
			<div
				v-for="i in visibleContents"
				:key="i.full_key"
				:class="{'ffz-unmatched-item': showing && ! shouldShow(i)}"
			>
				<component
					:is="i.component"
					:current-profile="currentProfile"
					:profiles="profiles"
					:context="context"
					:item="i"
					:filter="filter"
				/>
			</div>
		</section>
	</div>
</template>

<script>
export default {
	props: ['item', 'profiles', 'currentProfile', 'context', 'filter'],

	data() {
		return {
			selected: 0
		}
	},

	computed: {
		showing() {
			return this.shouldShow(this.item)
		},

		tab() {
			return this.item.tabs[this.selected];
		},

		visibleTabs() {
			if ( ! this.item || ! this.item.tabs )
				return [];

			//if ( ! this.context.matches_only )
				return this.item.tabs;

			//return this.item.tabs.filter(tab => this.shouldShow(tab));
		},

		visibleContents() {
			if ( ! this.tab || ! this.tab.contents )
				return [];

			if ( ! this.context.matches_only )
				return this.tab.contents;

			return this.tab.contents.filter(item => this.shouldShow(item));
		}
	},

	created() {
		if ( ! this.item._component )
			this.item._component = this;
	},

	mounted() {
		this.markSeen()
	},

	destroyed() {
		if ( this.item._component === this )
			this.item._component = null;
	},

	methods: {
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

		focus() {
			this.$el.querySelector('header').focus();
		},

		focusNextTab() {
			this.focus();
			this.nextTab();
		},

		focusPrevTab() {
			this.focus();
			this.prevTab();
		},

		focusFirstTab() {
			this.focus();
			this.firstTab();
		},

		focusLastTab() {
			this.focus();
			this.lastTab();
		},

		markSeen() {
			this.$emit('mark-seen', this.item.tabs[this.selected]);
		},

		firstTab() {
			this.selected = 0;
			this.markSeen();
		},

		lastTab() {
			this.selected = this.item.tabs.length - 1;
			this.markSeen();
		},

		prevTab() {
			if ( this.selected > 0 ) {
				this.selected--;
				this.markSeen();
			}
		},

		select(idx) {
			/*const selected = this.visibleTabs[idx];
			if ( this.item.tabs[idx] !== selected )
				for(let i = 0; i < this.item.tabs.length; i++) {
					if ( selected === this.item.tabs[i] ) {
						idx = i;
						break;
					}
				}*/

			this.selected = idx;
			this.markSeen();
		},

		nextTab() {
			if ( this.selected + 1 < this.item.tabs.length ) {
				this.selected++;
				this.markSeen();
			}
		},

		shouldShow(item, is_walking = false) {
			if ( ! this.filter || item.no_filter )
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
		}
	}
}
</script>