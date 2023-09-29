<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<div class="tw-flex tw-align-items-center">
			<label :for="'label$' + id">
				{{ t(type.i18n, type.title) }}
			</label>

			<select
				:id="'label$' + id"
				v-model="selected"
				class="tw-flex-grow-1 tw-mg-l-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-select"
			>
				<template v-for="(mon, idx) in monitors">
					<option :value="mon">
						{{ idx + 1 }}. {{ mon.label }} ({{ mon.width }}&times;{{ mon.height }})
					</option>
				</template>
			</select>
		</div>
		<div class="tw-c-text-alt-2">
			{{ t('setting.filter.monitor.about', 'This setting requires that this site has the Window Management permission. Please be sure that it is allowed.') }}
		</div>
	</section>
</template>

<script>

import { matchScreen } from 'utilities/object';

let last_id = 0;

export default {
	props: ['value', 'type', 'filters', 'context'],

	data() {
		return {
			id: last_id++,
			has_monitors: true,
			monitors: [],
			ready: false,
			selected: null
		}
	},

	created() {
		this.detectMonitors();
	},

	watch: {
		selected() {
			if ( ! this.ready || ! this.selected )
				return;

			const data = this.value.data = this.value.data || {};

			data.label = this.selected.label;
			data.index = this.monitors.indexOf(this.selected);
			data.top = this.selected.top;
			data.left = this.selected.left;
			data.width = this.selected.width;
			data.height = this.selected.height;
		}
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
					top: mon.top,
					left: mon.left,
					label: mon.label,
					width: mon.width,
					height: mon.height
				});

			//sortScreens(this.monitors);
			if ( this.value.data )
				this.selected = matchScreen(this.monitors, this.value.data);

			this.ready = true;

			if ( ! this.selected )
				this.selected = this.monitors[0];
		}
	}
}

</script>