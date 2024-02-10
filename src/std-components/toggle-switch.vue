<template>
	<fieldset
		class="toggle-switch"
	>
		<template
			v-for="item in defaultOptions.config.items"
		>
			<input
				:id="item.value + group"
				:value="item.value"
				:disabled="defaultOptions.config.disabled || disabled"
				:name="groupname"
				:class="{ active: !defaultOptions.config.disabled || disabled}"
				type="radio"
				:checked="item.value === selectedItem"
				@click="toggle"
			>
			<label
				:class="{ active: !defaultOptions.config.disabled || disabled }"
				:for="item.value + group"
				type="radio"
			>
				{{ item.name }}
			</label>
		</template>
	</fieldset>
</template>

<script>
const rem = v => `${v}rem`

export default {
	props: {
		options: {
			type: Object,
			required: false
		},
		modelValue: {
			type: String,
			required: false
		},
		groupname: {
			type: String,
			required: true
		},
		group: {
			type: String,
			required: false,
			default: ''
		},
		disabled: {
			type: Boolean,
			required: false,
			default: false
		}
	},
	emits: ['update:modelValue'],
	data () {
		return {
			selected: false,
			selectedItem: 'unknown',
			defaultOptions: Object
		}
	},
	computed: {
		toggleSwitchStyle () {
			return {
				width: rem(this.defaultOptions.size.width),
				height: rem(this.defaultOptions.size.height)
			}
		},
		itemStyle () {
			return {
				width: rem(this.defaultOptions.size.width),
				height: rem(this.defaultOptions.size.height),
				fontFamily: this.defaultOptions.layout.fontFamily,
				fontSize: rem(this.defaultOptions.size.fontSize),
				textAlign: 'center'
			}
		},
		labelStyle () {
			return {
				padding: rem(this.defaultOptions.size.padding),
				borderColor: this.defaultOptions.layout.noBorder ? 'transparent' : this.defaultOptions.layout.borderColor,
				backgroundColor: this.defaultOptions.layout.backgroundColor,
				color: this.defaultOptions.layout.color,
				fontWeight: this.defaultOptions.layout.fontWeight
			}
		}
	},
	watch: {
		modelValue (val) {
			this.selectedItem = val
		},
		options (val) {
			if (val !== null && val !== undefined) {
				this.mergeDefaultOptionsWithProp(val)
			}
		}
	},
	mounted () {
		if (this.options !== null && this.options !== undefined) {
			this.mergeDefaultOptionsWithProp(this.options)
		}
		if (this.defaultOptions.config.preSelected !== 'unknown') {
			this.selectedItem = this.defaultOptions.config.preSelected
			this.$emit('update:modelValue', this.selectedItem)
			this.$emit('input', this.selectedItem)
		} else if (this.modelValue) {
			this.selectedItem = this.modelValue
			this.$emit('update:modelValue', this.selectedItem)
			this.$emit('input', this.selectedItem)
		}
	},
	created () {
		this.defaultOptions = {
			layout: {
				color: 'black',
				backgroundColor: 'lightgray',
				selectedColor: 'white',
				selectedBackgroundColor: 'green',
				borderColor: 'gray',
				fontFamily: 'Arial',
				fontWeight: 'normal',
				fontWeightSelected: 'bold',
				squareCorners: false,
				noBorder: false
			},
			size: {
				fontSize: 1.5,
				height: 3.25,
				padding: 0.5,
				width: 10
			},
			config: {
				preSelected: 'unknown',
				disabled: false,
				items: [
					{ name: 'Off', value: 'Off', color: 'white', backgroundColor: 'red' },
					{ name: 'On', value: 'On', color: 'white', backgroundColor: 'green' }
				]
			}
		}
	},
	methods: {
		toggle (event) {
			if (!this.defaultOptions.config.disabled) {
				this.selected = true
				this.selectedItem = event.target.id.replace(this.group, '')
				this.$emit('selected', this.selected)
				this.$emit('update:modelValue', event.target.id.replace(this.group, ''))
				this.$emit('input', this.selectedItem)
				this.$emit('change', {
					value: event.target.id.replace(this.group, ''),
					srcEvent: event
				})
			}
		},
		labelStyleSelected (color, backgroundColor) {
			return {
				padding: rem(this.defaultOptions.size.padding),
				borderColor: this.defaultOptions.layout.noBorder ? 'transparent' : this.defaultOptions.layout.borderColor,
				fontWeight: this.defaultOptions.layout.fontWeightSelected,
				backgroundColor: backgroundColor !== undefined ? backgroundColor : this.defaultOptions.layout.selectedBackgroundColor,
				color: color !== undefined ? color : this.defaultOptions.layout.selectedColor
			}
		},
		mergeDefaultOptionsWithProp (options) {
			const result = this.defaultOptions
			for (const option in options) {
				if (options[option] !== null && typeof (options[option]) === 'object') {
					for (const subOption in options[option]) {
						if (options[option][subOption] !== undefined && options[option][subOption] !== null) {
							result[option][subOption] = options[option][subOption]
						}
					}
				} else {
					result[option] = options[option]
				}
			}
		}
	}
}
</script>
