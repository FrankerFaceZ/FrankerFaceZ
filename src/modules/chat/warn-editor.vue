<template>
	<div class="ffz-override-editor tw-c-background-base tw-c-text-base tw-pd-05 tw-pd-l-1">
		<div class="tw-flex tw-align-items-center tw-pd-b-05 tw-border-b tw-mg-b-05">
			<div class="tw-flex-grow-1">
				{{ t('chat.warn.editing', 'Warn {user.login}...', {user}) }}
			</div>
			<button
				class="tw-mg-l-05 tw-button tw-button--text"
				@click="close"
			>
				<span class="tw-button__text ffz-i-window-close" />
			</button>
		</div>

		<div class="tw-flex tw-align-items-center">
			<label for="warn-reason" class="tw-mg-r-1">
				{{ t('chat.warn.reason', 'Reason') }}
			</label>

			<input
				id="warn-reason"
				ref="reason"
				v-model="reason"
				:disabled="sending"
				:placeholder="t('chat.warn.reason-placeholder', 'Enter a reason...')"
				class="tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input tw-flex-grow-1"
				maxlength="500"
				type="text"
				@keydown.enter="doWarn"
			>

			<button
				class="tw-mg-l-05 tw-button"
				:disabled="sending || ! reason.trim().length"
				@click="doWarn"
			>
				<span class="tw-button__text">
					{{ t('chat.warn.send', 'Warn') }}
				</span>
			</button>
		</div>
	</div>
</template>

<script>

export default {
	data() {
		return Object.assign(this.$vnode.data, {
			reason: '',
			sending: false,
		});
	},

	mounted() {
		this.$nextTick(() => {
			if ( this.$refs.reason )
				this.$refs.reason.focus();
		});
	},

	methods: {
		async doWarn() {
			const reason = this.reason.trim();
			if ( ! reason.length || this.sending )
				return;

			this.sending = true;
			try {
				await this.warn(reason);
				this.close();
			} catch(err) {
				this.sending = false;
			}
		}
	}
}

</script>