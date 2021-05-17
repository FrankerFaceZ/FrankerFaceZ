<template functional>
	<div class="tw-relative ffz-il-tooltip__container">
		<slot />
		<div
			:class="`ffz-il-tooltip--align-${props.align||'center'} ffz-il-tooltip--${props.above ? 'up' : 'down'}`"
			class="ffz-il-tooltip"
		>
			<slot name="tooltip" />
		</div>
	</div>
</template>