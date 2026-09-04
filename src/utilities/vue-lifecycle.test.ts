import { describe, expect, it } from 'vitest';
import Vue from 'vue';
import { installLifecycleShim } from './vue-lifecycle';

describe('installLifecycleShim', () => {
	it('installs on Vue 2 and runs the new hook names on destroy, once each', () => {
		expect(installLifecycleShim(Vue as any)).toBe(true);

		const calls: string[] = [];
		const mixin = {
			beforeUnmount() { calls.push('mixin:before'); },
			unmounted() { calls.push('mixin:after'); }
		};

		const vm = new Vue({
			mixins: [mixin],
			beforeUnmount() { calls.push('component:before'); },
			unmounted() { calls.push('component:after'); },
			render: (h: (tag: string) => unknown) => h('div')
		// Vue 2's option types do not know the new hook names.
		} as any);

		vm.$mount();
		expect(calls).toEqual([]);

		vm.$destroy();
		expect(calls).toEqual(['mixin:before', 'component:before', 'mixin:after', 'component:after']);
	});

	it('does nothing on Vue 3', () => {
		let mixins = 0;
		const fake = {
			version: '3.5.0',
			config: {optionMergeStrategies: {}},
			mixin() { mixins++; }
		};
		expect(installLifecycleShim(fake)).toBe(false);
		expect(mixins).toBe(0);
	});
});
