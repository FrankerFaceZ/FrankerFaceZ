import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickaway, observeVisibility } from './vue-directives';

const binding = <T>(value: T, oldValue?: T) => ({value, oldValue});

function click(target: EventTarget) {
	const event = new MouseEvent('click', {bubbles: true, composed: true});
	target.dispatchEvent(event);
}

describe('clickaway', () => {
	let outer: HTMLElement, inner: HTMLElement, elsewhere: HTMLElement;

	beforeEach(() => {
		vi.useFakeTimers();
		outer = document.createElement('div');
		inner = document.createElement('span');
		elsewhere = document.createElement('div');
		outer.appendChild(inner);
		document.body.append(outer, elsewhere);
	});

	afterEach(() => {
		clickaway.unbind(outer);
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	it('ignores clicks until the opening task has ended', () => {
		const handler = vi.fn();
		clickaway.bind(outer, binding(handler));

		click(elsewhere);
		expect(handler).not.toHaveBeenCalled();

		vi.runAllTimers();
		click(elsewhere);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('does not fire for clicks inside the element', () => {
		const handler = vi.fn();
		clickaway.bind(outer, binding(handler));
		vi.runAllTimers();

		click(inner);
		click(outer);
		expect(handler).not.toHaveBeenCalled();
	});

	it('swaps handlers on update and stops on unbind', () => {
		const first = vi.fn(), second = vi.fn();
		clickaway.bind(outer, binding(first));
		clickaway.update(outer, binding(second, first));
		vi.runAllTimers();

		click(elsewhere);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);

		clickaway.unbind(outer);
		click(elsewhere);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('ignores non-function values', () => {
		clickaway.bind(outer, binding('nope' as any));
		vi.runAllTimers();
		expect(() => click(elsewhere)).not.toThrow();
	});
});

describe('observeVisibility', () => {
	let observers: FakeObserver[];

	class FakeObserver {
		callback: IntersectionObserverCallback;
		options?: IntersectionObserverInit;
		observed: Element[] = [];
		disconnected = false;

		constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
			this.callback = callback;
			this.options = options;
			observers.push(this);
		}
		observe(el: Element) { this.observed.push(el); }
		disconnect() { this.disconnected = true; }
		emit(isIntersecting: boolean, intersectionRatio = isIntersecting ? 1 : 0) {
			this.callback([{isIntersecting, intersectionRatio} as IntersectionObserverEntry], this as any);
		}
	}

	beforeEach(() => {
		observers = [];
		vi.stubGlobal('IntersectionObserver', FakeObserver);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('reports visibility changes to a plain callback', () => {
		const el = document.createElement('div'), cb = vi.fn();
		observeVisibility.bind(el, binding(cb));

		expect(observers).toHaveLength(1);
		expect(observers[0].observed).toEqual([el]);

		observers[0].emit(true);
		observers[0].emit(false);
		expect(cb.mock.calls.map(c => c[0])).toEqual([true, false]);
	});

	it('honours once, a threshold and throttling', () => {
		const el = document.createElement('div'), cb = vi.fn();
		observeVisibility.bind(el, binding({callback: cb, once: true, throttle: 100, intersection: {threshold: 0.5}}));

		observers[0].emit(true, 0.2);
		vi.advanceTimersByTime(100);
		expect(cb).toHaveBeenLastCalledWith(false, expect.anything());

		observers[0].emit(true, 0.9);
		vi.advanceTimersByTime(100);
		expect(cb).toHaveBeenLastCalledWith(true, expect.anything());
		expect(observers[0].disconnected).toBe(true);
	});

	it('does nothing without a callback or without IntersectionObserver', () => {
		const el = document.createElement('div');
		observeVisibility.bind(el, binding(null));
		expect(observers).toHaveLength(0);

		vi.stubGlobal('IntersectionObserver', undefined);
		observeVisibility.bind(el, binding(vi.fn() as any));
		expect(observers).toHaveLength(0);
	});
});
