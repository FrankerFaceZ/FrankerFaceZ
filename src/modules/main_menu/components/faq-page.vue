<template lang="html">
	<div class="ffz--home tw-border-t tw-pd-y-1">
		<markdown :source="t('home.faq', md)" />
	</div>
</template>

<script>

import FAQ_MD from '../faq.md';

export default {
	props: ['item', 'context'],

	data() {
		return {
			md: FAQ_MD
		}
	}
}
</script>