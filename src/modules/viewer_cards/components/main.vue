<template>
	<section class="viewer-card__actions tw-bottom-0">
		<div
			v-for="(actions, idx) in display"
			:key="idx"
			:class="[idx === 0 ? 'tw-c-background-alt tw-pd-y-1' : 'tw-c-background-alt-2 tw-pd-y-05']"
			class="tw-full-width tw-flex tw-flex-row tw-pd-x-05"
		>
			<action
				v-for="(act, idx) in actions"
				:key="idx"
				:act="act"
				:renderers="renderers"
			/>
		</div>
	</section>
</template>

<script>

import TabMixin from '../tab-mixin';
import {deep_copy} from 'utilities/object';

export default {
	components: {
		action: {
			functional: true,
			render(createElement, {props}) {
				const {act, renderers} = props;

				if ( act.type === 'space' )
					return createElement('div', {
						class: 'tw-flex-grow-1'
					});

				else if ( act.type === 'space-small' )
					return createElement('div', {
						class: 'tw-mg-x-1'
					});

				const disp = act.appearance,
					renderer = disp && renderers[disp.type];

				if ( ! renderer || ! renderer.component )
					return null;

				const content = createElement(renderer.component, {
					attrs: {
						color: '',
						data: disp
					}
				});

				if ( disp.button )
					return createElement('button', {
						class: 'tw-interactive tw-button'
					}, [
						createElement('span', {
							class: 'tw-button__text'
						}, [
							content
						])
					]);

				return createElement('button', {
					class: 'tw-interactive tw-button-icon'
				}, [
					createElement('span', {
						class: 'tw-button-icon__icon'
					}, [
						content
					])
				]);
			}
		}
	},

	mixins: [TabMixin],
	props: ['tab', 'channel', 'user', 'self', 'getFFZ'],

	data() {
		this._chat = this.getFFZ().resolve('chat');
		this._actions = this.getFFZ().resolve('chat.actions');

		return {
			renderers: deep_copy(this._actions.renderers),
			actions: deep_copy(this._chat.context.get('chat.actions.viewer-card'))
		}
	},

	computed: {
		display() {
			const out = [];
			let current = [];

			for(const val of this.actions) {
				if ( ! val )
					continue;

				const type = val.type;
				if ( type === 'new-line' ) {
					out.push(current);
					current = [];

				} else if ( this.displayAction(val) )
					current.push(val);
			}

			if ( current.length )
				out.push(current);

			return out;
		}
	},

	mounted() {
		window.tab = this;

		this._chat.context.on('changed:chat.actions.viewer-card', this.updateSetting, this);
	},

	destroyed() {
		this._chat.context.off('changed:chat.actions.viewer-card', this.updateSetting, this);
	},

	methods: {
		displayAction(action) { // eslint-disable-line no-unused-vars
			return true;
		},

		updateSetting() {
			this.actions = deep_copy(this._chat.context.get('chat.actions.viewer-card'));
		}
	},
}

</script>