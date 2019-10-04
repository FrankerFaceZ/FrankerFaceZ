<template lang="html">
	<div class="ffz--i18n-entry tw-pd-x-1 tw-pd-y-05 tw-border-b">
		<div class="tw-flex tw-full-width">
			<div class="ffz--i18n-sub-entry tw-mg-r-05 tw-flex-grow-1 tw-c-text-alt tw-mg-b-2">
				<div class="tw-font-size-7 tw-c-text-alt-2 tw-pd-b-05 tw-strong tw-upcase tw-ellipsis" :title="entry.key">
					{{ entry.key }}
				</div>
				<code>{{ entry.phrase }}</code>
			</div>
			<div class="ffz--i18n-sub-entry tw-flex-grow-1">
				<textarea
					v-model="value"
					:class="{'tw-textarea--error': ! valid}"
					class="tw-block tw-font-size-6 tw-full-width tw-full-height tw-textarea"
					@input="onInput"
				/>
			</div>
			<div class="ffz--i18n-sub-entry tw-mg-l-05 tw-flex-grow-1">
				<div v-if="error">
					<div class="tw-strong">{{ t('i18n.ui.error', 'Error') }}</div>
					<code class="tw-font-size-7 tw-c-text-alt-2">{{ error }}</code>
				</div>
				<div v-if="source">
					<div class="tw-strong">{{ t('i18n.ui.source', 'Source') }}</div>
					<code class="tw-font-size-7 tw-c-text-alt-2">{{ source }}</code>
				</div>
				<div v-if="context">
					<div class="tw-strong">{{ t('i18n.ui.context', 'Context') }}</div>
					<code class="tw-font-size-7 tw-c-text-alt-2">{{ context }}</code>
				</div>
			</div>
		</div>
	</div>
</template>

<script>

import Parser from '@ffz/icu-msgparser';
import { debounce } from 'utilities/object';

const parser = new Parser();

export default {
	props: ['entry'],

	data() {
		return {
			value: this.entry.translation,
			valid: true,
			error: null
		}
	},

	computed: {
		source() {
			const calls = this.entry.calls;
			if ( ! Array.isArray(calls) || ! calls.length )
				return null;

			return calls.join('\n');
		},

		context() {
			const opts = this.entry.options;
			if ( ! opts || typeof opts !== 'object' )
				return null;

			const lines = [];
			for(const [key, val] of Object.entries(opts))
				lines.push(`${key}: ${JSON.stringify(val)}`);

			return lines.join('\n');
		}
	},

	created() {
		this.validate();
		this.onInput = debounce(this.onInput, 250);
	},

	methods: {
		onInput() {
			this.validate();
			if ( this.valid )
				this.$emit('update', this.value);
		},

		validate() {
			try {
				parser.parse(this.value);
			} catch(err) {
				this.error = err;
				this.valid = false;
				return;
			}

			this.error = null;
			this.valid = true;
		}
	}
}

</script>