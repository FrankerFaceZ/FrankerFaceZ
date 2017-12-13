<template lang="html">
<div class="ffz--menu-page">
<header class="tw-mg-b-1">
	<template v-for="i in breadcrumbs">
		<a v-if="i !== item" href="#" @click="$emit('change-item', i, false)">{{ t(i.i18n_key, i.title, i) }}</a>
		<strong v-if="i === item">{{ t(i.i18n_key, i.title, i) }}</strong>
		<template v-if="i !== item">&raquo; </template>
	</template>
</header>
<section v-if="! context.currentProfile.live && item.profile_warning !== false" class="tw-border-t tw-pd-t-1 tw-pd-b-2">
	<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1">
		<h3 class="ffz-i-attention">
			{{ t('setting.profiles.inactive', "This profile isn't active.") }}
		</h3>

		{{ t(
			'setting.profiles.inactive.description',
			"This profile's rules don't match the current context and it therefore isn't currently active, so you " +
			"won't see changes you make here reflected on Twitch."
			) }}
	</div>
</section>
<section
	v-if="item.description"
	class="tw-border-t tw-pd-y-1"
	v-html="t(item.desc_i18n_key || item.i18n_key + '.description', item.description, item)"
	/>
</section>
<template v-if="! item.contents">
	<ul class="tw-border-t tw-pd-y-1">
		<li class="tw-pd-x-1" v-for="i in item.items">
			<a href="#" @click="$emit('change-item', i, false)">
				{{ t(i.i18n_key, i.title, i) }}
			</a>
		</li>
	</ul>
</template>
<component
	v-for="i in item.contents"
	v-bind:is="i.component"
	ref="children"
	:context="context"
	:item="i"
	:key="i.full_key"
	@change-item="changeItem"
	@navigate="navigate"
	/>
</div>
</template>

<script>

export default {
	props: ['item', 'context'],

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