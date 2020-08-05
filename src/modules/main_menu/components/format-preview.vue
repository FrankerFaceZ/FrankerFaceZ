<template>
	<div class="tw-flex tw-align-items-start">
		<label />
		<div class="tw-c-text-alt tw-mg-b-05 tw-mg-x-05">
			<code v-if="mode === 'date'">
				{{ tDate(now, value) }}
			</code>
			<code v-else-if="mode === 'time'">
				{{ tTime(now, value) }}
			</code>
			<code v-else>
				{{ tDateTime(now, value) }}
			</code>
		</div>
	</div>
</template>

<script>
export default {
	props: ['context', 'item', 'value'],

	data() {
		return {
			mode: this.item.extra.mode,
			now: null
		}
	},

	mounted() {
		this.now = new Date;
		this.timer = setInterval(() => this.now = new Date, 1000);
	},

	beforeDestroy() {
		clearInterval(this.timer);
		this.timer = null;
	}

}
</script>