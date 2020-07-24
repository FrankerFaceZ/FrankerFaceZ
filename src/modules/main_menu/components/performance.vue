<template>
	<div>
		<pre>{{ JSON.stringify(events, null, '\t') }}</pre>
	</div>
</template>

<script>

import {deep_copy} from 'utilities/object';

export default {
	props: ['item', 'context'],

	data() {
		return {
			events: deep_copy(this.item.getEvents())
		}
	},

	computed: {
		initial_time() {
			const event = this.events[0];
			return event ? event.ts : 0;
		}
	},

	created() {
		this.onEvent = this.onEvent.bind(this);
		this.item.setListener(this.onEvent);
	},

	destroyed() {
		this.onEvent = null;
		this.item.setListener(null);
	},

	methods: {
		onEvent(event) {
			this.events.push(deep_copy(event));
		}
	}
}

</script>