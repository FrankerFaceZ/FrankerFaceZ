<template lang="html">
	<div class="ffz--color-widget tw-relative tw-full-width tw-mg-y-05">
		<input
			ref="input"
			v-bind="$attrs"
			v-model="color"
			type="text"
			class="tw-input tw-pd-r-3"
			autocapitalize="off"
			autocorrect="off"
			autocomplete="off"
			@input="onChange"
		>

		<button
			class="ffz-color-preview tw-absolute tw-top-0 tw-bottom-0 tw-right-0 tw-border-l tw-z-default"
			@click="togglePicker"
		>
			<figure v-if="color" :style="`background-color: ${color}`" />
			<figure v-else class="ffz-i-eyedropper" />
		</button>
		<div v-on-clickaway="closePicker" v-if="open" class="tw-absolute tw-z-default tw-right-0">
			<chrome-picker :value="colors" @input="onPick" />
		</div>
	</div>
</template>

<script>

import {Color} from 'utilities/color';

import {Chrome} from 'vue-color';
import {mixin as clickaway} from 'vue-clickaway';

export default {
	components: {
		'chrome-picker': Chrome
	},

	mixins: [clickaway],

	props: {
		value: String,
		default: {
			type: String,
			default: '#000'
		}
	},

	data() {
		return {
			color: '',
			open: false
		}
	},

	computed: {
		colors() {
			return Color.RGBA.fromCSS(this.color || this.default)
		}
	},

	watch: {
		value(val) {
			this.color = val;
		}
	},

	mounted() {
		this.color = this.value;
	},

	methods: {
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

			if ( old_val !== this.color )
				this.$emit('input', this.color);
		},

		onChange() {
			this.$emit('input', this.color);
		}
	}
}

</script>