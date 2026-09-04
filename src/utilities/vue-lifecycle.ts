'use strict';

// ============================================================================
// Vue Lifecycle Shim
//
// Components use Vue 3's lifecycle names, beforeUnmount and unmounted. Vue 2
// does not know them, so this merges them the way it merges its own hooks
// and runs them from beforeDestroy and destroyed. Vue 3 calls the new names
// itself, so the shim installs nothing there.
// ============================================================================

type VueLike = {
	version: string;
	config: {optionMergeStrategies: Record<string, unknown>};
	mixin(mixin: Record<string, unknown>): unknown;
};

type Hook = (this: unknown) => void;

function runHooks(vm: any, name: string) {
	const hooks: Hook | Hook[] | undefined = vm.$options[name];
	if ( ! hooks )
		return;

	for(const hook of Array.isArray(hooks) ? hooks : [hooks])
		hook.call(vm);
}

/** Install the shim on a Vue constructor. Returns whether it was needed. */
export function installLifecycleShim(Vue: VueLike) {
	if ( ! Vue.version.startsWith('2.') )
		return false;

	const strategies = Vue.config.optionMergeStrategies;
	strategies.beforeUnmount = strategies.beforeDestroy;
	strategies.unmounted = strategies.destroyed;

	Vue.mixin({
		beforeDestroy() { runHooks(this, 'beforeUnmount'); },
		destroyed() { runHooks(this, 'unmounted'); }
	});

	return true;
}
