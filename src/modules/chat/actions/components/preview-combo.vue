<template>
	<span :style="{color:$attrs.color}" :class="$attrs.data.icon">{{ $attrs.data.text }}</span>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
