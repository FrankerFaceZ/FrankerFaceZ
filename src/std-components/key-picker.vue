<template lang="html">
	<div class="ffz--key-widget">
		<div class="tw-relative tw-full-width">
			<div
				ref="input"
				v-bind="$attrs"
				class="default-dimmable tw-block tw-border-radius-medium tw-font-size-6 tw-full-width ffz-input tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
				tabindex="0"
				@click="startRecording"
				@keydown="onKey"
				@keyup="onKeyUp"
				@blur="cancelRecording"
			>
				<template v-if="active">
					{{ t('setting.record-key', 'Press a Key') }}
				</template>
				<template v-else-if="value == null">
					{{ t('setting.unset', 'Unset') }}
				</template>
				<template v-else>
					{{ value }}
				</template>
			</div>

			<button
				class="ffz-button--hollow ffz-clear-key tw-absolute tw-top-0 tw-bottom-0 tw-right-0 tw-border-l tw-z-default tw-pd-x-1 tw-tooltip__container"
				@click="clear"
			>
				<figure class="ffz-i-trash" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.clear', 'Clear') }}
				</div>
			</button>
		</div>
	</div>
</template>

<script>

import {KEYS} from 'utilities/constants';

const IGNORE_KEYS = [
	KEYS.Shift,
	KEYS.Control,
	KEYS.Alt,
	KEYS.Meta
];

const BAD_KEYS = [
	KEYS.Escape,
	KEYS.Tab
];

const KEYS_MAP = {
	Backquote: '`',
	Comma: ',',
	Period: '.',
	Slash: '/',
	Semicolon: ';',
	Quote: "'",
	BracketLeft: '[',
	BracketRight: ']',
	Backslash: '\\',
	Minus: '-',
	Equal: '=',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down'
};

for(const num of [1,2,3,4,5,6,7,8,9,0])
	KEYS_MAP[`Digit${num}`] = `${num}`;

for(const letter of 'abcdefghijklmnopqrstuvwxyz')
	KEYS_MAP[`Key${letter.toUpperCase()}`] = letter;


export default {
	props: {
		value: String
	},

	data() {
		return {
			active: false
		}
	},

	methods: {
		onKey(e) {
			if ( this.active )
				this.record(e);
		},

		onKeyUp(e) {
			if ( this.active )
				this.finishRecording(e);
			else {
				const key = e.keyCode || e.which;
				if ( key === KEYS.Enter || key === KEYS.Space )
					this.startRecording(e);
			}
		},

		stop(e) {
			e.preventDefault();
			e.stopImmediatePropagation();
			e.stopPropagation();
		},

		startRecording(e) {
			if ( e )
				this.stop(e);

			if ( this.active )
				return;

			this.active = true;
			this.key = null;
		},

		record(e) {
			const key = e.keyCode || e.which;
			if ( BAD_KEYS.includes(key) )
				return;

			this.stop(e);

			if ( IGNORE_KEYS.includes(key) )
				return;

			this.key = e;
		},

		cancelRecording() {
			this.active = false;
		},

		finishRecording(e) {
			const k = e.keyCode || e.which;
			if ( BAD_KEYS.includes(k) )
				return;

			this.stop(e);

			if ( IGNORE_KEYS.includes(k) )
				return;

			this.active = false;
			const key = this.key;
			this.key = null;
			if ( ! key )
				return;

			let code = KEYS_MAP[key.code];
			if ( ! code )
				code = key.key;

			const val = `${key.ctrlKey ? 'ctrl+' : ''}${key.altKey ? 'alt+' : ''}${key.shiftKey ? 'shift+' : ''}${code}`;
			this.$emit('input', val);
		},

		clear() {
			this.$emit('input', null);
		}
	}

}

</script>