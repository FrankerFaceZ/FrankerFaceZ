<template lang="html">
	<div class="ffz--i18n-entry tw-pd-x-1 tw-pd-y-05 tw-border-b">
		<div class="tw-flex tw-full-width">
			<div class="ffz--i18n-sub-entry tw-mg-r-05 tw-c-text-alt tw-mg-b-2">
				<div class="tw-font-size-7 tw-c-text-alt-2 tw-pd-b-05 tw-strong tw-upcase tw-ellipsis" :title="entry.key">
					{{ entry.key }}
				</div>
				<code><span
					v-for="(bit, index) in diff"
					:key="index"
					:class="{
						'ffz-tooltip': bit[0] !== 0,
						'tw-c-text-base': bit[0] === 0,
						'tw-c-text-error': bit[0] === -1,
						'tw-c-text-prime': bit[0] === 1
					}"
					:data-title="getDiffTooltip(bit)"
				>{{ bit[1] }}</span></code>
			</div>
			<div class="ffz--i18n-sub-entry tw-flex-grow-1">
				<textarea
					ref="editor"
					v-model="value"
					:class="{'ffz-textarea--error': ! valid}"
					class="tw-block tw-font-size-6 tw-full-width ffz-textarea"
					@input="onInput"
					@blur="onBlur"
					@focus="open = true"
				/>
			</div>
			<div class="ffz--i18n-sub-entry tw-mg-l-05 tw-flex-grow-1">
				<div v-if="error && ! open">
					<div class="tw-strong">{{ t('i18n.ui.error', 'Error') }}</div>
					<code class="tw-font-size-7 tw-c-text-alt-2">{{ error }}</code>
				</div>
				<div v-if="source">
					<div class="tw-strong">{{ t('i18n.ui.source', 'Source') }}</div>
					<div
						v-for="(line, idx) in source"
						:key="idx"
						:title="Array.isArray(line) ? `${line[0]} (${line[1]})` : line"
						class="tw-font-size-7 tw-c-text-alt-2 tw-ellipsis tw-full-width"
					>
						<span v-if="Array.isArray(line)">
							{{ line[0] }} (<a :href="line[2]" rel="noopener noreferrer" target="_blank">{{ line[1] }}</a>)
						</span>
						<span v-else>
							{{ line }}
						</span>
					</div>
				</div>
				<div v-if="context_str && ! open">
					<div class="tw-strong">{{ t('i18n.ui.context', 'Context') }}</div>
					<code class="tw-font-size-7 tw-c-text-alt-2">{{ context_str }}</code>
				</div>
			</div>
		</div>
		<div
			v-if="open"
			class="tw-flex tw-full-width tw-mg-t-05"
		>
			<div class="ffz--i18n-sub-entry tw-mg-r-05 tw-c-text-alt tw-mg-b-2">
				<div class="tw-font-size-7 tw-c-text-alt-2 tw-pd-b-05 tw-strong tw-upcase tw-ellipsis">
					{{ t('i18n.ui.preview', 'Preview') }}
				</div>
				<code v-if="error">{{ error }}</code>
				<code v-else>{{ preview }}</code>
			</div>

			<div class="ffz--i18n-sub-entry tw-flex-grow-1">
				<div class="tw-font-size-7 tw-c-text-alt-2 tw-pd-b-05 tw-strong tw-upcase tw-ellipsis">
					{{ t('i18n.ui.context', 'Context') }}
				</div>
				<div
					v-for="val in context"
					:key="val.key"
					class="tw-flex tw-align-items-center tw-mg-b-05"
				>
					<label
						:for="`ui-ctx:${entry.key}:${val.key}`"
						class="tw-mg-r-05"
					>
						{{ val.key }}
					</label>
					<input
						:id="`ui-ctx:${entry.key}:${val.key}`"
						:type="val.is_number ? 'number' : 'text'"
						:value="val.value"
						class="tw-full-width tw-block tw-border-radius-medium tw-font-size-6 ffz-input tw-pd-x-1 tw-pd-y-05"
						@input="updateContext(val.key, $event)"
					>
				</div>
			</div>

			<button
				class="tw-button-icon tw-mg-l-05 tw-relative tw-tooltip__container"
				@click="open = false"
			>
				<span class="tw-button-icon__icon">
					<figure class="ffz-i-cancel" />
				</span>
			</button>
		</div>
	</div>
</template>

<script>

import Diff from 'text-diff';

import Parser from '@ffz/icu-msgparser';
import { has, debounce } from 'utilities/object';

const parser = new Parser();
const diff = new Diff();

function parse(text) {
	try {
		return parser.parse(text);
	} catch(err) {
		return null;
	}
}

const NUMBER_TYPES = ['number', 'plural', 'en_plural', 'selectordinal', 'duration']

function extractVariables(ast, out, vars, context) {
	for(const node of ast) {
		if ( typeof node !== 'object' || ! node.v )
			continue;

		const key = node.v,
			type = node.t;

		let value = context ? context[key] : null,
			is_number = typeof value === 'number';

		if ( ! is_number && NUMBER_TYPES.includes(type) ) {
			is_number = true;
			try {
				value = parseFloat(value);
				if ( isNaN(value) || ! isFinite(value) )
					value = 0;

			} catch(err) {
				value = 0;
			}
		}

		vars[key] = value;
		if ( ! has(out, key) )
			out[key] = {
				key,
				value,
				is_number
			};

		if ( is_number )
			out[key].is_number = true;

		if ( typeof node.o === 'object' )
			for(const subast of Object.values(node.o))
				extractVariables(subast, out, vars, context);
	}
}

export default {
	props: ['entry', 'getI18n'],

	data() {
		return {
			value: this.entry.translation,
			valid: true,
			pending: false,
			error: null,
			open: false
		}
	},

	computed: {
		diff() {
			if ( ! this.entry.different || ! this.entry.known )
				return [[0, this.entry.phrase]];

			const out = diff.main(this.entry.known, this.entry.phrase);
			diff.cleanupSemantic(out);
			return out;
		},

		source() {
			const calls = this.entry.calls;
			if ( ! Array.isArray(calls) || ! calls.length )
				return null;

			const lines = calls.join('\n').split(/\n/),
				out = [];

			for(const line of lines) {
				const match = /^(?:(.*?) \()?(\/[^:\)]+):(\d+):(\d+)\)?$/.exec(line);
				if ( match )
					out.push([
						match[1] || '???',
						`${match[2]}:${match[3]}:${match[4]}`,
						`https://www.github.com/FrankerFaceZ/FrankerFaceZ/blob/master${match[2]}#L${match[3]}`
					]);
				else
					out.push(line);
			}

			return out;
		},

		preview() {
			try {
				return this.getI18n()._.t(null, this.value, this.variables, {noCache: true, throwParse: true});
			} catch(err) {
				return err;
			}
		},

		context() {
			const out = {}, vars = {};
			let ast = parse(this.entry.phrase);
			if ( ast )
				extractVariables(ast, out, vars, this.entry.options);

			if ( this.open ) {
				ast = parse(this.value);
				if ( ast )
					extractVariables(ast, out, vars, this.entry.options);
			}

			return Object.values(out);
		},

		variables() {
			const out = {}, vars = {};
			let ast = parse(this.entry.phrase);
			if ( ast )
				extractVariables(ast, out, vars, this.entry.options);

			if ( this.open ) {
				ast = parse(this.value);
				if ( ast )
					extractVariables(ast, out, vars, this.entry.options);
			}

			return vars;
		},

		context_str() {
			const lines = [];
			for(const entry of this.context)
				lines.push(`${entry.key}: ${JSON.stringify(entry.value)}`);

			return lines.join('\n');
		}
	},

	watch: {
		'entry.translation'() {
			if ( document.activeElement !== this.$refs.editor )
				this.value = this.entry.translation;
		}
	},

	created() {
		this.validate();
		this.onInput = debounce(this.onInput, 250);
	},

	methods: {
		getDiffTooltip(diff) {
			const mode = diff[0];
			if ( mode === -1 )
				return this.t('i18n.diff.removed', 'Removed:\n{text}', {text: diff[1]});

			if ( mode === 1 )
				return this.t('i18n.diff.added', 'Added:\n{text}', {text: diff[1]});

			return '';
		},

		updateContext(key, event) {
			if ( ! this.entry.options )
				this.$set(this.entry, 'options', {});

			let val = event.target.value;
			if ( event.target.type === 'number' ) {
				try {
					val = parseFloat(val);
					if ( isNaN(val) || !isFinite(val) )
						val = 0;

				} catch(err) {
					val = 0;
				}
			}

			this.$set(this.entry.options, key, val);
			this.$emit('update-context', this.variables);
		},

		onBlur() {
			if ( this.pending )
				this.$emit('update', this.value);
		},

		onInput() {
			this.validate();
			this.pending = ! this.valid;
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