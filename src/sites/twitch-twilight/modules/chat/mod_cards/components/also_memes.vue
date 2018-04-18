<template>
	<section class="tw-background-c tw-relative">
		<img src="https://uploads.disquscdn.com/images/b9f219e02ce5db4e345911afd58899a82c07aa4877349efc74898f58d63c10ec.gif">
	</section>
</template>

<script>
import TabMixin from '../tab-mixin';

export default {
	mixins: [TabMixin],
	props: ['tab', 'user', 'room', 'currentUser']
}
</script>