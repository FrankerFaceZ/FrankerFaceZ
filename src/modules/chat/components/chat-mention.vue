<template>
	<strong
		:class="{'ffz--mention-me': $attrs.token.me}"
		class="chat-line__message-mention"
	>
		{{ $attrs.token.text }}
	</strong>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
