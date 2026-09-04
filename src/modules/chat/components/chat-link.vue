<template>
	<a
		:href="$attrs.token.url"
		:data-url="$attrs.token.url"
		:data-is-mail="$attrs.token.is_mail"
		class="ffz-tooltip"
		data-tooltip-type="link"
		rel="noopener noreferrer"
		target="_blank"
	>
		{{ $attrs.token.text }}
	</a>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
