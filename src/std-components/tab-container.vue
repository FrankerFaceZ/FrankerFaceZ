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
				v-for="(i, idx) in item.tabs"
				:key="i.full_key"
				:id="'tab-for-' + i.full_key"
				:aria-selected="selected === idx"
				:aria-controls="'tab-panel-' + i.full_key"
				:class="[selected === idx ? 'active' : '']"
				role="tab"
				class="tab tw-pd-y-05 tw-pd-x-1"
				@click="selected = idx"
			>
				{{ t(i.i18n_key, i.title, i) }}
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
				{{ t(tab.desc_i18n_key, tab.description, tab) }}
			</section>
			<component
				v-for="i in tab.contents"
				:is="i.component"
				:current-profile="currentProfile"
				:profiles="profiles"
				:context="context"
				:item="i"
				:key="i.full_key"
			/>
		</section>
	</div>
</template>

<script>
export default {
	props: ['item', 'profiles', 'currentProfile', 'context'],

	data() {
		return {
			selected: 0
		}
	},

	computed: {
		tab() {
			return this.item.tabs[this.selected];
		}
	},

	methods: {
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

		firstTab() {
			this.selected = 0;
		},

		lastTab() {
			this.selected = this.item.tabs.length - 1;
		},

		prevTab() {
			if ( this.selected > 0 )
				this.selected--;
		},

		nextTab() {
			if ( this.selected + 1 < this.item.tabs.length )
				this.selected++;
		}
	}
}
</script>