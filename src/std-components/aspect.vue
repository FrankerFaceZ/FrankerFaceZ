<template functional>
	<div
		:class="`tw-aspect--align-${props.align||'top'}`"
		class="tw-aspect"
	>
		<div
			:style="{paddingBottom: (props.padding ? props.padding : (100 * (1 / (props.ratio || 1)))) + '%'}"
			class="tw-aspect__spacer"
		/>
		<slot />
	</div>
</template>