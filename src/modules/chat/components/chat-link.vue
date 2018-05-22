<template functional>
	<a
		:href="props.token.url"
		:data-url="props.token.url"
		:data-is-mail="props.token.is_mail"
		class="ffz-tooltip"
		data-tooltip-type="link"
		rel="noopener noreferrer"
		target="_blank"
	>
		{{ props.token.text }}
	</a>
</template>