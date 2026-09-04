<template>
	<span :style="{color: $attrs.color}">{{ $attrs.data.text }}</span>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
