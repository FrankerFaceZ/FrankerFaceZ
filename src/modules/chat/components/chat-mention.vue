<template functional>
	<strong
		:class="{'ffz--mention-me': props.token.me}"
		class="chat-line__message-mention"
	>
		{{ props.token.text }}
	</strong>
</template>