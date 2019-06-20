<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<header>
			{{ t(type.i18n, type.title) }}
		</header>

		<filter-editor
			v-model="value.data"
			:filters="filters"
			:context="context"
			:max-rules="type.maxRules"
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