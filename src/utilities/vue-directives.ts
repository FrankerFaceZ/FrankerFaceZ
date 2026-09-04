'use strict';

// ============================================================================
// Vue Directives
//
// Replacements for two Vue 2-only packages: vue-clickaway (v-on-clickaway)
// and vue-observe-visibility (v-observe-visibility). Both are registered
// globally by the Vue bridge, so add-ons that render through FFZ's Vue keep
// the same directive names. Each directive carries Vue 2's hook names and
// Vue 3's; whichever version is running uses its own and ignores the rest.
// ============================================================================

type Binding<T> = {
	value: T;
	oldValue?: T;
	expression?: string;
};

// ----------------------------------------------------------------------------
// v-on-clickaway="handler"
// Calls the handler for a click anywhere outside the element. The click that
// caused the element to appear is still in flight when the directive binds,
// so clicks are ignored until the current task has ended.
// ----------------------------------------------------------------------------

type ClickawayHandler = (event: MouseEvent) => void;
type ClickawayElement = HTMLElement & {_ffz_clickaway?: (event: MouseEvent) => void};

function bindClickaway(el: ClickawayElement, binding: Binding<ClickawayHandler>) {
	unbindClickaway(el);

	const callback = binding.value;
	if ( typeof callback !== 'function' )
		return;

	let armed = false;
	setTimeout(() => { armed = true; }, 0);

	el._ffz_clickaway = event => {
		if ( ! armed )
			return;

		// composedPath tells us whether the element was under the pointer
		// when the click happened, not merely whether it contains the target
		// now that the event has bubbled up.
		const path = typeof event.composedPath === 'function' ? event.composedPath() : null;
		const inside = path ? path.includes(el) : el.contains(event.target as Node);
		if ( ! inside )
			callback(event);
	};

	document.documentElement.addEventListener('click', el._ffz_clickaway, false);
}

function updateClickaway(el: ClickawayElement, binding: Binding<ClickawayHandler>) {
	if ( binding.value !== binding.oldValue )
		bindClickaway(el, binding);
}

function unbindClickaway(el: ClickawayElement) {
	if ( el._ffz_clickaway ) {
		document.documentElement.removeEventListener('click', el._ffz_clickaway, false);
		delete el._ffz_clickaway;
	}
}

export const clickaway = {
	// Vue 2
	bind: bindClickaway,
	update: updateClickaway,
	unbind: unbindClickaway,
	// Vue 3
	beforeMount: bindClickaway,
	updated: updateClickaway,
	unmounted: unbindClickaway
};


// ----------------------------------------------------------------------------
// v-observe-visibility="callback" or "{callback, once, throttle, intersection}"
// Calls the callback with (visible, entry) whenever the element enters or
// leaves the viewport, as vue-observe-visibility did.
// ----------------------------------------------------------------------------

type VisibilityCallback = (visible: boolean, entry: IntersectionObserverEntry) => void;

type VisibilityOptions = {
	callback: VisibilityCallback;
	once?: boolean;
	throttle?: number;
	intersection?: IntersectionObserverInit;
};

type VisibilityState = {
	observer: IntersectionObserver;
	timer: ReturnType<typeof setTimeout> | null;
};

type VisibilityElement = HTMLElement & {_ffz_visibility?: VisibilityState};

function normalizeVisibility(value: VisibilityCallback | VisibilityOptions | null | undefined): VisibilityOptions | null {
	if ( typeof value === 'function' )
		return {callback: value};

	if ( value && typeof value.callback === 'function' )
		return value;

	return null;
}

function bindVisibility(el: VisibilityElement, binding: Binding<VisibilityCallback | VisibilityOptions | null>) {
	unbindVisibility(el);

	const options = normalizeVisibility(binding.value);
	if ( ! options || typeof IntersectionObserver === 'undefined' )
		return;

	const threshold = typeof options.intersection?.threshold === 'number' ? options.intersection.threshold : 0;

	const state: VisibilityState = {
		observer: new IntersectionObserver(entries => {
			// Only the latest entry matters when several are batched.
			const entry = entries[entries.length - 1];
			if ( ! entry )
				return;

			const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
			const fire = () => {
				options.callback(visible, entry);
				if ( visible && options.once )
					unbindVisibility(el);
			};

			if ( options.throttle ) {
				if ( state.timer )
					clearTimeout(state.timer);
				state.timer = setTimeout(fire, options.throttle);
			} else
				fire();
		}, options.intersection),
		timer: null
	};

	el._ffz_visibility = state;
	state.observer.observe(el);
}

function updateVisibility(el: VisibilityElement, binding: Binding<VisibilityCallback | VisibilityOptions | null>) {
	if ( binding.value !== binding.oldValue )
		bindVisibility(el, binding);
}

function unbindVisibility(el: VisibilityElement) {
	const state = el._ffz_visibility;
	if ( ! state )
		return;

	if ( state.timer )
		clearTimeout(state.timer);
	state.observer.disconnect();
	delete el._ffz_visibility;
}

export const observeVisibility = {
	// Vue 2
	bind: bindVisibility,
	update: updateVisibility,
	unbind: unbindVisibility,
	// Vue 3
	beforeMount: bindVisibility,
	updated: updateVisibility,
	unmounted: unbindVisibility
};
