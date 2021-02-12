<template lang="html">
	<div>
		<div class="tw-flex tw-align-items-center">
			<label for="edit_duration">
				{{ t('setting.actions.duration', 'Duration') }}
			</label>

			<input
				id="edit_duration"
				v-model="value.duration_rich"
				:placeholder="defaults.duration"
				class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
				type="text"
				@input="update()"
			>
		</div>

		<div class="tw-flex tw-align-items-center">
			<label for="edit_reason">
				{{ t('setting.actions.reason', 'Default Reason') }}
			</label>

			<input
				id="edit_reason"
				v-model.trim="value.reason"
				class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
				@input="$emit('input', value)"
			>
		</div>
	</div>
</template>

<script>

const DUR_MATCH = /(\d+)(mo|d|h|m|s)?/gi,
	MULTIPLIERS = {
		m: 60,
		h: 3600,
		d: 86400,
		mo: 86400 * 28,
		s: 1
	};

function durationToSeconds(dur) {
	let seconds = 0;
	let match;

	while(match = DUR_MATCH.exec(dur)) { // eslint-disable-line no-cond-assign
		const val = parseInt(match[1], 10),
			unit = (match[2] || 's').toLowerCase(),
			multiplier = MULTIPLIERS[unit] || 1;

		if ( isNaN(val) )
			return NaN;

		seconds += val * multiplier;
	}

	return seconds;
}


export default {
	props: ['value', 'defaults'],

	created() {
		if ( this.value.duration_rich == null )
			this.value.duration_rich = this.value.duration;
	},

	methods: {
		update() {
			this.value.duration = durationToSeconds(this.value.duration_rich);
			this.$emit('input', this.value);
		}
	}
}

</script>