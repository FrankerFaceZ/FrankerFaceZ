<template lang="html">
	<div class="ffz-input">
		<header>
			{{ t(item.i18n_key, item.title) }}
			<span v-if="unseen" class="tw-pill">{{ t('setting.new', 'New') }}</span>
		</header>
		<section
			v-if="item.description"
			class="tw-c-text-alt-2"
		>
			<markdown :source="t(item.desc_i18n_key || `${item.i18n_key}.description`, item.description)" />
		</section>
		<section v-if="item.extra">
			<component :is="item.extra.component" :context="context" :item="item" />
		</section>
		<div v-for="(i, idx) in data" :key="idx" class="tw-mg-l-1">
			<input
				:id="item.full_key + idx"
				:name="item.full_key"
				:value="i.value"
				type="radio"
				class="ffz-radio__input"
			>
			<label
				:for="item.full_key + idx"
				class="tw-pd-y-05 ffz-radio__label"
			>
				{{ t(i.i18n_key, i.title, i) }}
			</label>
		</div>
	</div>
</template>

<script>
import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context']
}
</script>