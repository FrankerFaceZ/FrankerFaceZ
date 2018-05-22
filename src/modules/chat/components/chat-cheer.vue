<template functional>
	<span
		:data-prefix="props.token.prefix"
		:data-amount="props.token.amount"
		:data-tier="props.token.tier"
		:data-individuals="JSON.stringify(props.token.individuals || null)"
		:alt="props.token.text"
		class="ffz-cheer ffz-tooltip"
		data-tooltip-type="cheer"
	/>
</template>