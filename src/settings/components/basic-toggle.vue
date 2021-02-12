<template>
	<section class="tw-flex-grow-1 tw-align-self-start tw-flex tw-align-items-center">
		<div class="tw-flex tw-align-items-center ffz-checkbox tw-mg-y-05">
			<input
				:id="'enabled$' + value.id"
				v-model="value.data"
				type="checkbox"
				class="ffz-checkbox__input"
			>
			<label :for="'enabled$' + value.id" class="ffz-checkbox__label">
				<span class="tw-mg-l-1">
					{{ t(type.i18n, type.title) }}
				</span>
			</label>
		</div>
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