<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<div class="tw-flex tw-align-items-center">
			<label :for="'label$' + id">
				{{ t(type.i18n, type.title) }}
			</label>

			<select
				:id="'label$' + id"
				v-model="value.data.label"
				class="tw-flex-grow-1 tw-mg-l-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-select"
			>
				<template v-for="mon in monitors">
					<option :value="mon.label">
						{{ mon.label }} ({{ mon.width }}&times;{{ mon.height }})
					</option>
				</template>
			</select>
		</div>
	</section>
</template>

<script>

let last_id = 0;

export default {
	props: ['value', 'type', 'filters', 'context'],

	data() {
		return {
			id: last_id++,
			has_monitors: true,
			monitors: []
		}
	},

	created() {
		this.detectMonitors();
	},

	methods: {
		async detectMonitors() {
			let data;
			try {
				data = await window.getScreenDetails();
			} catch(err) {
				console.error('Unable to get screen details', err);
				this.has_monitors = false;
				this.monitors = [];
				return;
			}

			this.monitors = [];
			for(const mon of data.screens)
				this.monitors.push({
					label: mon.label,
					width: mon.width,
					height: mon.height
				});
		}
	}
}

</script>