<template lang="html">
	<div class="ffz--color-widget">
		<div v-if="showInput" class="tw-relative tw-full-width tw-mg-y-05">
			<input
				v-if="showInput"
				ref="input"
				v-model="color"
				v-bind="$attrs"
				type="text"
				class="tw-block tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-y-05"
				autocapitalize="off"
				autocorrect="off"
				autocomplete="off"
				@input="onChange"
			>

			<button
				class="ffz-color-preview tw-absolute tw-top-0 tw-bottom-0 tw-right-0 tw-border-l tw-z-default"
				@click="togglePicker"
			>
				<figure v-if="! valid" class="ffz-i-attention tw-c-text-alert" />
				<figure v-else-if="color" :style="`background-color: ${color}`" />
				<figure v-else class="ffz-i-eyedropper" />
			</button>
			<div
				v-if="open"
				v-on-clickaway="closePicker"
				:class="{'ffz-bottom-100': openUp}"
				class="tw-absolute tw-z-above tw-right-0"
			>
				<chrome-picker :disable-alpha="! alpha" :value="colors" @input="onPick" />
			</div>
		</div>
		<div
			v-else
			:class="{'tw-tooltip__container': hasTooltip}"
			class="tw-relative"
		>
			<button
				class="tw-button tw-button--text ffz-color-preview"
				@click="togglePicker"
				@contextmenu.prevent="maybeResetColor"
			>
				<figure v-if="! valid" class="ffz-i-attention tw-c-text-alert" />
				<figure v-else-if="color" :style="`background-color: ${color}`">
					&nbsp;
				</figure>
				<figure v-else class="ffz-i-eyedropper" />
			</button>
			<div
				v-if="open"
				v-on-clickaway="closePicker"
				:class="{'ffz-bottom-100': openUp}"
				class="tw-absolute tw-z-above tw-tooltip--down tw-tooltip--align-right"
			>
				<chrome-picker :disable-alpha="! alpha" :value="colors" @input="onPick" />
			</div>
			<div
				v-if="! open && hasTooltip"
				class="tw-tooltip tw-tooltip--down tw-tooltip--align-right"
			>
				{{ tooltip }}
				<div v-if="nullable" class="tw-regular">
					{{ t('setting.color.nullable', 'Right-Click to Reset') }}
				</div>
			</div>
		</div>
	</div>
</template>

<script>

import {Color} from 'utilities/color';

import {Sketch} from 'vue-color';

export default {
	components: {
		'chrome-picker': Sketch
	},

	props: {
		value: String,
		alpha: {
			type: Boolean,
			default: true
		},
		default: {
			type: String,
			default: '#000'
		},
		nullable: {
			type: Boolean,
			default: false
		},
		validate: {
			type: Boolean,
			default: true
		},
		showInput: {
			type: Boolean,
			default: true
		},
		tooltip: {
			type: String,
			default: null
		},
		openUp: {
			type: Boolean,
			default: false
		}
	},

	data() {
		return {
			color: '',
			valid: false,
			open: false
		}
	},

	computed: {
		hasTooltip() {
			return this.tooltip?.length > 0 || this.nullable
		},

		colors() {
			try {
				return Color.RGBA.fromCSS(this.color || this.default)
			} catch(err) {
				return {
					hex: this.default
				}
			}
		}
	},

	watch: {
		value(val) {
			this.color = val;
		}
	},

	mounted() {
		this.color = this.value;
		this._validate();
	},

	methods: {
		maybeResetColor() {
			if ( this.open )
				return this.open = false;

			if ( this.nullable ) {
				this.color = '';
				this._validate();
				this.emit();
			}
		},

		openPicker() {
			this.open = true;
		},

		closePicker() {
			this.open = false;
		},

		togglePicker() {
			this.open = ! this.open;
		},

		onPick(color) {
			const old_val = this.color;

			if ( color.rgba.a == 1 )
				this.color = color.hex;
			else {
				const c = color.rgba;
				this.color = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
			}

			if ( old_val !== this.color ) {
				this._validate();
				this.emit();
			}
		},

		_validate() {
			this.valid = true;
			if ( ! this.color || ! this.color.length || ! this.validate )
				return;

			try {
				Color.RGBA.fromCSS(this.color);
			} catch(err) {
				this.valid = false;
			}
		},

		emit() {
			if ( this.valid )
				this.$emit('input', this.color);
		},

		onChange() {
			this._validate();
			this.emit();
		}
	}
}

</script>