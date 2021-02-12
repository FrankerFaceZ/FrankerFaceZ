<template lang="html">
	<div class="ffz--example-report tw-relative ">
		<div v-if="canUpload" class="tw-absolute ffz--report-upload">
			<div v-if="uploading">
				<button
					class="tw-button tw-button--disabled"
					disabled
				>
					<span class="tw-button__icon tw-button__icon--left">
						<figure class="ffz-i-upload-cloud" />
					</span>
					<span class="tw-button__text">
						{{ t('async-text.uploading', 'Uploading...') }}
					</span>
				</button>
			</div>
			<div v-else-if="url">
				<input
					ref="url_box"
					:value="url"
					class="tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
					type="text"
					readonly
					@focusin="selectURL"
				>
			</div>
			<div v-else>
				<button
					class="tw-button"
					@click="upload"
				>
					<span class="tw-button__icon tw-button__icon--left">
						<figure class="ffz-i-upload-cloud" />
					</span>
					<span class="tw-button__text">
						{{ t('async-text.upload', 'Upload') }}
					</span>
				</button>
			</div>
		</div>
		<div class="tw-c-background-alt-2 tw-font-size-5 tw-pd-y-05 tw-pd-x-1 tw-border-radius-large">
			<div v-if="loading" class="tw-align-center">
				<h1 class="tw-mg-5 ffz-i-zreknarf loading" />
			</div>
			<code v-else>{{ text }}</code>
		</div>
	</div>
</template>

<script>

export default {
	props: ['item', 'context'],

	data() {
		return {
			uploading: false,
			url: null,

			loading: false,
			text: null
		}
	},

	computed: {
		canUpload() {
			return ! this.loading && this.text;
		}
	},

	created() {
		this.refresh();

		const ctx = this.context.context;
		for(const key of this.item.watch)
			ctx.on(`changed:${key}`, this.refresh, this);
	},

	destroyed() {
		const ctx = this.context.context;
		for(const key of this.item.watch)
			ctx.off(`changed:${key}`, this.refresh, this);
	},

	methods: {
		selectURL() {
			if ( this.$refs && this.$refs.url_box )
				this.$refs.url_box.select();
		},

		async upload() {
			if ( this.uploading || this.url || this.text == null )
				return;

			this.uploading = true;
			const response = await fetch('https://putco.de', {
				method: 'PUT',
				body: this.text
			});

			if ( ! response.ok ) {
				this.uploading = false;
				this.url = 'An error occurred.';
			}

			this.url = await response.text();
			if ( this.url.startsWith('http://') )
				this.url = `https://${this.url.slice(7)}`;

			this.uploading = false;
		},

		async refresh() {
			this.uploading = false;
			this.url = null;
			this.loading = true;
			this.text = await this.item.data();
			this.loading = false;
		}
	}
}

</script>