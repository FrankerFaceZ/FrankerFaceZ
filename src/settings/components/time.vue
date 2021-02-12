<template>
	<section class="tw-flex-grow-1 tw-align-self-start tw-flex tw-align-items-center">
		<div class="tw-flex tw-align-items-center">
			<div class="tw-mg-r-1">
				{{ t(type.i18n, type.title) }}
			</div>

			<label :for="'start-time$' + id" class="tw-mg-l-1">
				{{ t('settings.filter.time.start', 'Start:') }}
			</label>

			<input
				:id="'start-time$' + id"
				v-model="value.data[0]"
				type="time"
				class="ffz-min-width-unset tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-mg-x-1 tw-pd-x-1 tw-pd-y-05 ffz-input"
			>

			<label :for="'end-time$' + id" class="tw-mg-l-1">
				{{ t('settings.filter.time.end', 'End:') }}
			</label>

			<input
				:id="'end-time$' + id"
				v-model="value.data[1]"
				type="time"
				class="ffz-min-width-unset tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 tw-mg-x-1 ffz-input"
			>
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