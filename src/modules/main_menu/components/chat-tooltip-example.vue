<template>
	<div class="tw-c-text-alt-2">
		{{ t('setting.tooltip-example', 'For an example, please hover this link:') }}
		<a
			:href="url"
			:data-url="url"
			class="ffz-tooltip"
			data-tooltip-type="link"
			data-force-tooltip="true"
			data-is-mail="false"
			rel="noopener noreferrer"
			target="_blank"
		>
			{{ url }}
		</a>
	</div>
</template>

<script>

const VIDEOS = [
	'https://www.youtube.com/watch?v=BFSWlDpA6C4'
];

export default {
	props: ['context', 'item'],

	data() {
		const url = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];

		return {
			url
		}
	}

}

</script>