<template functional>
	<div
		:class="`ffz-aspect--align-${props.align||'top'}`"
		class="ffz-aspect"
	>
		<div
			:style="{paddingTop: (props.padding ? props.padding : (100 * (1 / (props.ratio || 1)))) + '%'}"
			class="ffz-aspect__spacer"
		/>
		<slot />
	</div>
</template>