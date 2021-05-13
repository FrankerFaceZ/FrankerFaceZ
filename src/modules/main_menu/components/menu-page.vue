<template lang="html">
	<div class="ffz--menu-page">
		<header class="tw-mg-b-1">
			<span v-for="i in breadcrumbs" :key="i.full_key">
				<a v-if="i !== item" href="#" @click="$emit('change-item', i, false)">{{ t(i.i18n_key, i.title) }}</a>
				<strong v-if="i === item">{{ t(i.i18n_key, i.title) }}</strong>
				<template v-if="i !== item">&raquo; </template>
			</span>
		</header>
		<section v-if="(! context.currentProfile.live || ! context.currentProfile.toggled) && item.profile_warning !== false" class="tw-border-t tw-pd-t-1 tw-pd-b-2">
			<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1">
				<h3 class="ffz-i-attention">
					{{ t('setting.profiles.inactive', "This profile is not active.") }}
				</h3>

				<span v-if="! context.currentProfile.toggled">
					{{ t('setting.profiles.disabled.description',
						"This profile has been disabled, so you won't see changes you make here reflected on Twitch.")
					}}
				</span>

				<span v-else>
					{{ t('setting.profiles.inactive.description',
						"This profile's rules don't match the current context and it therefore isn't currently active, so you " +
							"won't see changes you make here reflected on Twitch.")
					}}
				</span>
			</div>
		</section>
		<section v-if="context.currentProfile.url && ! context.currentProfile.pause_updates && item.profile_warning !== false" class="tw-border-t tw-pd-t-1 tw-pd-b-2">
			<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1">
				<h3 class="ffz-i-attention">
					{{ t('setting.profiles.updates', 'This profile will update automatically.') }}
				</h3>

				<span>
					{{ t('setting.profile.updates-about',
						'This profile is set to automatically update. When it does, any changed settings within it will be reset. Profile Rules will be reset as well.')
					}}
				</span>
			</div>
		</section>
		<section v-if="context.has_update" class="tw-border-t tw-pd-t-1 tw-pd-b-2">
			<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1">
				<h3 class="ffz-i-arrows-cw">
					{{ t('setting.update', 'There is an update available.') }}
				</h3>

				{{ t('setting.update.description',
					'Please refresh your page to receive the latest version of FrankerFaceZ.')
				}}
			</div>
		</section>
		<section
			v-if="item.description"
			class="tw-border-t tw-pd-y-1"
		>
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description)" />
		</section>
		<template v-if="! item.contents || ! item.contents.length || item.always_list_pages">
			<ul class="tw-border-t tw-pd-y-1">
				<li
					v-for="i in visibleItems"
					:key="i.full_key"
					:class="{'ffz-unmatched-item': ! shouldShow(i)}"
					class="tw-pd-x-1"
				>
					<a href="#" @click="$emit('change-item', i, false)">
						{{ t(i.i18n_key, i.title) }}
						<span v-if="filter" class="ffz-pill ffz-pill--overlay">{{ countMatches(i) }}</span>
						<span v-else-if="i.unseen" class="ffz-pill ffz-pill--overlay">{{ i.unseen }}</span>
					</a>
				</li>
			</ul>
		</template>
		<div
			v-for="i in visibleContents"
			:key="i.full_key"
			:class="{'ffz-unmatched-item': ! shouldShow(i)}"
		>
			<component
				:is="i.component"
				ref="children"
				:context="context"
				:item="i"
				:nav_keys="nav_keys"
				:filter="filter"
				@change-item="changeItem"
				@mark-seen="markSeen"
				@navigate="navigate"
			/>
		</div>
	</div>
</template>

<script>

export default {
	props: ['item', 'context', 'filter', 'nav_keys'],

	computed: {
		breadcrumbs() {
			const out = [];
			let current = this.item;
			while(current) {
				out.unshift(current);
				current = current.parent;
			}

			return out;
		},

		visibleItems() {
			if ( ! this.item || ! this.item.items )
				return [];

			if ( ! this.context.matches_only )
				return this.item.items;

			return this.item.items.filter(item => this.shouldShow(item));
		},

		visibleContents() {
			if ( ! this.item || ! this.item.contents )
				return [];

			if ( ! this.context.matches_only )
				return this.item.contents;

			return this.item.contents.filter(item => this.shouldShow(item));
		}
	},

	methods: {
		shouldShow(item) {
			if ( ! this.filter || ! this.filter.length || ! item.search_terms )
				return true;

			return item.no_filter || item.search_terms.includes(this.filter);
		},

		countMatches(item, seen) {
			if ( ! this.filter || ! this.filter.length || ! item )
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

			if ( item.setting && item.search_terms && item.search_terms.includes(this.filter) )
				count++;

			return count;
		},

		markSeen(item) {
			this.$emit('mark-seen', item);
		},

		changeItem(item) {
			this.$emit('change-item', item);
		},

		navigate(...args) {
			this.$emit('navigate', ...args);
		},

		onBeforeChange(current, new_item) {
			if ( this.$refs.children )
				for(const child of this.$refs.children)
					if ( child && child.onBeforeChange ) {
						const res = child.onBeforeChange(current, new_item);
						if ( res !== undefined )
							return res;
					}
		}
	}
}

</script>