<template functional>
	<div class="tw-relative tw-tooltip__container">
		<slot />
		<div
			:class="`tw-tooltip--align-${props.align||'center'} tw-tooltip--${props.above ? 'up' : 'down'}`"
			class="tw-tooltip"
		>
			<slot name="tooltip" />
		</div>
	</div>
</template>