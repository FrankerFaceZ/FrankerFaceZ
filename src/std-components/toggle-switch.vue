<template>
	<fieldset
		class="toggle-switch"
	>
		<template
			v-for="item in items"
		>
			<input
				:id="item.value"
				:value="item.value"
				:name="groupName"
				type="radio"
				:checked="item.value === selectedItem"
				@click="toggle"
			>
			<label
				:for="item.value"
				type="radio"
			>
				{{ item.name }}
			</label>
		</template>
	</fieldset>
</template>

<script>
export default {
	props: {
		preselected: {
			type: String,
			required: false
		},
		items: {
			type: Array,
			required: true
		},
		modelValue: {
			type: String,
			required: false
		},
		groupName: {
			type: String,
			required: true
		},
	},
	emits: ['update:modelValue'],
	data () {
		return {
			selected: false,
			selectedItem: ''
		}
	},
	watch: {
		modelValue (val) {
			this.selectedItem = val
		},
	},
	mounted () {
		if (this.preselected)
			this.selectedItem = this.preselected
		else if (this.modelValue)
			this.selectedItem = this.modelValue
		else return;

		this.$emit('update:modelValue', this.selectedItem)
		this.$emit('input', this.selectedItem)
	},
	methods: {
		toggle (event) {
			this.selected = true
			this.selectedItem = event.target.id
			this.$emit('selected', this.selected)
			this.$emit('update:modelValue', event.target.id)
			this.$emit('input', this.selectedItem)
			this.$emit('change', {
				value: event.target.id,
				srcEvent: event
			})
		}
	}
}
</script>
