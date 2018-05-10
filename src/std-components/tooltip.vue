<template functional>
	<div class="tw-tooltip-wrapper">
		<slot />
		<div
			:class="`tw-tooltip--align-${props.align||'center'} tw-tooltip--${props.above ? 'up' : 'down'}`"
			class="tw-tooltip"
		>
			<slot name="tooltip" />
		</div>
	</div>
</template>