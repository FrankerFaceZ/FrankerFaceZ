<template>
	<div class="ffz-override-editor tw-c-background-base tw-c-text-base tw-pd-05 tw-pd-l-1">
		<div class="tw-flex tw-align-items-center tw-pd-b-05 tw-border-b tw-mg-b-05">
			<div class="tw-flex-grow-1">
				{{ t('chat.overrides.editing', 'Editing {user.login}...', {user}) }}
			</div>
			<button
				class="tw-mg-l-05 tw-button tw-button--text"
				@click="close"
			>
				<span class="tw-button__text ffz-i-window-close" />
			</button>
		</div>

		<div class="tw-flex tw-align-items-center">
			<label for="user-name" class="tw-mg-r-1">
				{{ t('chat.overrides.name', 'Name') }}
			</label>

			<input
				id="user-name"
				ref="name"
				class="tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input tw-flex-grow-1"
				:value="name"
				@change="updateName"
			>

			<button
				class="tw-mg-l-05 tw-button tw-button--text tw-tooltip__container"
				:class="{'tw-button--disabled': name == null}"
				@click="clearName"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.reset', 'Reset to Default') }}
				</div>
			</button>
		</div>

		<div class="tw-flex tw-align-items-center">
			<label for="user-color" class="tw-mg-r-1">
				{{ t('chat.overrides.color', 'Color') }}
			</label>

			<color-picker
				id="user-color"
				ref="color"
				:alpha="false"
				:nullable="true"
				:value="editColor"
				@input="updateColor"
			/>

			<button
				class="tw-mg-l-05 tw-button tw-button--text tw-tooltip__container"
				:class="{'tw-button--disabled': color == null}"
				@click="clearColor"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.reset', 'Reset to Default') }}
				</div>
			</button>
		</div>
	</div>
</template>

<script>

import { debounce } from 'utilities/object';

export default {
	data() {
		return this.$vnode.data
	},

	computed: {
		editColor() {
			if ( ! this.color )
				return '';

			return this.color;
		}
	},

	created() {
		this.updateName = debounce(this.updateName, 250);
		this.updateColor = debounce(this.updateColor, 250);
	},

	updated() {
		this.updateTip();
	},

	methods: {
		clearName() {
			this.name = null;
			this.deleteName();
		},

		updateName() {
			const value = this.$refs.name.value;
			if ( value == null || ! value.length ) {
				this.clearName();
				return;
			}

			this.name = value;
			this.setName(value);
		},

		clearColor() {
			this.color = null;
			this.deleteColor();
		},

		updateColor(value) {
			if ( value == null || ! value.length ) {
				this.clearColor();
				return;
			}

			this.color = value;
			this.setColor(value);
		}
	}
}

</script>