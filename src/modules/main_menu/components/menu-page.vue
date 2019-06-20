<template lang="html">
	<div class="ffz--menu-page">
		<header class="tw-mg-b-1">
			<span v-for="i in breadcrumbs" :key="i.full_key">
				<a v-if="i !== item" href="#" @click="$emit('change-item', i, false)">{{ t(i.i18n_key, i.title, i) }}</a>
				<strong v-if="i === item">{{ t(i.i18n_key, i.title, i) }}</strong>
				<template v-if="i !== item">&raquo; </template>
			</span>
		</header>
		<section v-if="! context.currentProfile.live && item.profile_warning !== false" class="tw-border-t tw-pd-t-1 tw-pd-b-2">
			<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1">
				<h3 class="ffz-i-attention">
					{{ t('setting.profiles.inactive', "This profile isn't active.") }}
				</h3>

				{{ t('setting.profiles.inactive.description',
					"This profile's rules don't match the current context and it therefore isn't currently active, so you " +
						"won't see changes you make here reflected on Twitch.")
				}}
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
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description, item)" />
		</section>
		<template v-if="! item.contents || ! item.contents.length">
			<ul class="tw-border-t tw-pd-y-1">
				<li
					v-for="i in item.items"
					:key="i.full_key"
					:class="{'ffz-unmatched-item': ! shouldShow(i)}"
					class="tw-pd-x-1"
				>
					<a href="#" @click="$emit('change-item', i, false)">
						{{ t(i.i18n_key, i.title, i) }}
						<span v-if="i.unseen" class="tw-pill">{{ i.unseen }}</span>
					</a>
				</li>
			</ul>
		</template>
		<div
			v-for="i in item.contents"
			:key="i.full_key"
			:class="{'ffz-unmatched-item': ! shouldShow(i)}"
		>
			<component
				:is="i.component"
				ref="children"
				:context="context"
				:item="i"
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
	props: ['item', 'context', 'filter'],

	computed: {
		breadcrumbs() {
			const out = [];
			let current = this.item;
			while(current) {
				out.unshift(current);
				current = current.parent;
			}

			return out;
		}
	},

	methods: {
		shouldShow(item) {
			if ( ! this.filter || ! this.filter.length || ! item.search_terms )
				return true;

			return item.no_filter || item.search_terms.includes(this.filter);
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