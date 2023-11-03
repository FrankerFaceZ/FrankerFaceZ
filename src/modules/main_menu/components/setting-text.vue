<template lang="html">
	<div class="ffz--setting-text" :class="classes">
		<div v-if="loading" class="tw-align-center tw-pd-05">
			<h3 class="tw-mg-1 ffz-i-zreknarf loading" />
		</div>
		<markdown v-else :source="content" />
	</div>
</template>

<script>

import {maybe_call} from 'utilities/object';

export default {
	props: ['item', 'context'],

	data() {
		let classes = maybe_call(this.item.classes, this, this.item, this.context);
		if ( classes instanceof Promise ) {
			classes.then(classes => {
				this.classes = classes;
			}).catch(err => {
				console.error('Error loading async classes:', err);
				this.classes = '';
			});

			classes = '';

		} else if ( ! classes )
			classes = '';

		const source = maybe_call(this.item.content, this, this.item, this.context);
		if ( !(source instanceof Promise) )
			return {
				loading: false,
				content: source,
				classes
			};

		source.then(content => {
			this.content = content;
			this.loading = false;
		}).catch(err => {
			console.error('Error loading async content:', err);
			this.loading = false;
			this.content = this.t('setting.error', 'An error occurred.');
		});

		return {
			loading: true,
			content: null,
			classes
		}
	}

}

</script>