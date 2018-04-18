<template>
	<section class="tw-background-c tw-relative">
		<img src="http://origin.webcdn.theblackdesertonline.net/forum/service_live/monthly_04_2017/kanna_kawai.gif.b66a65f6ef8cd4760c40e0f2be26af26.gif">
	</section>
</template>

<script>
import TabMixin from '../tab-mixin';

export default {
	mixins: [TabMixin],
	props: ['tab', 'user', 'room', 'currentUser']
}
</script>