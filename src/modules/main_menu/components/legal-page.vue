<template lang="html">
	<div class="ffz--home tw-border-t tw-pd-y-1">
		<markdown :source="md" />
	</div>
</template>

<script>

import LEGAL_MD from '../legal.md';

export default {
	props: ['item', 'context'],

	data() {
		return {
			md: LEGAL_MD
		}
	}
}
</script>