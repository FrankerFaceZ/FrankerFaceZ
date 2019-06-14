<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<header>
			{{ t(type.i18n, type.title) }}
		</header>

		<filter-editor
			:filters="filters"
			:context="context"
			:max-rules="type.maxRules"
			v-model="value.data"
		/>
	</section>
</template>

<script>

let last_id = 0;

export default {
	props: ['value', 'type', 'filters', 'context'],

	data() {
		return {
			id: last_id++
		}
	}
}

</script>