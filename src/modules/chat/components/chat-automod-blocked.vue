<template functional>
	<strong
		:data-text="props.token.text"
		:data-categories="JSON.stringify(props.token.categories)"
		data-tooltip-type="amterm"
		class="ffz-tooltip ffz--blocked"
	>
		&times;&times;&times;
	</strong>
</template>