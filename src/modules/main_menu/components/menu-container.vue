<template lang="html">
	<div v-if="item.contents" :class="classes">
		<header v-if="! item.no_header" class="tw-font-size-5">
			{{ t(item.i18n_key, item.title) }}
		</header>
		<section
			v-if="item.description"
			class="tw-pd-b-1 tw-c-text-alt"
		>
			<markdown :source="t(item.desc_i18n_key, item.description)" />
		</section>
		<div
			v-for="i in visibleContents"
			:key="i.full_key"
			:class="{'ffz-unmatched-item': showing && ! shouldShow(i)}"
		>
			<component
				:is="i.component"
				:context="context"
				:item="i"
				:filter="filter"
				@navigate="navigate"
			/>
		</div>
	</div>
</template>

<script>
export default {
	props: ['item', 'context', 'filter'],

	computed: {
		showing() {
			return this.shouldShow(this.item);
		},

		visibleContents() {
			if ( ! this.item || ! this.item.contents )
				return [];

			if ( ! this.context.matches_only )
				return this.item.contents;

			return this.item.contents.filter(item => this.shouldShow(item));
		},

		classes() {
			return [
				'ffz--menu-container',
				this.item.full_box ? 'tw-border' : 'tw-border-t'
			]
		}
	},

	methods: {
		navigate(...args) {
			this.$emit('navigate', ...args);
		},

		shouldShow(item, is_walking = false) {
			if ( item.no_filter )
				return true;

			if ( this.context.simple_view ) {
				for(const key of ['tabs', 'contents', 'items'])
					if ( item[key] )
						for(const thing of item[key])
							if ( this.shouldShow(thing) )
								return true;
				if ( ! item.setting || ! item.simple )
					return false;
			}

			if ( ! this.filter )
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
