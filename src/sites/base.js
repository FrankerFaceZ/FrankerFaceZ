'use strict';

import Module from 'utilities/module';

let last_site = 0;
let last_call = 0;

export default class BaseSite extends Module {
	constructor(...args) {
		super(...args);
		this._id = `_ffz$${last_site++}`;

		//this.inject('settings');

		this.log.info(`Using: ${this.constructor.name}`);
	}


	// ========================================================================
	// DOM Manipulation
	// ========================================================================

	awaitElement(selector, parent, timeout = 60000) {
		if ( ! parent )
			parent = document.documentElement;

		const el = parent.querySelector(selector);
		if ( el )
			return Promise.resolve(el);

		return new Promise((resolve, reject) => {
			const observer_name = `${this._id}$observer`,
				data = parent[observer_name],
				call_id = last_call++,

				timer = timeout && setTimeout(() => {
					const data = parent[observer_name];
					if ( ! data )
						return;

					const [observer, selectors] = data;

					for(let i=0; i < selectors.length; i++) {
						const d = selectors[i];
						if ( d[0] === call_id ) {
							selectors.splice(i, 1);
							d[3]('Timed out');
							break;
						}
					}

					if ( ! selectors.length ) {
						observer.disconnect();
						parent[observer_name] = null;
					}
				}, timeout);

			if ( data ) {
				data[1].push([call_id, selector, resolve, reject, timer]);
				return;
			}

			const observer = new MutationObserver(() => {
				const data = parent[observer_name];
				if ( ! data ) {
					observer.disconnect();
					return;
				}

				const selectors = data[1];
				for(let i=0; i < selectors.length; i++) {
					const d = selectors[i];
					const el = parent.querySelector(d[1]);
					if ( el ) {
						selectors.splice(i, 1);
						i--;

						if ( d[4] )
							clearTimeout(d[4]);

						d[2](el);
					}
				}

				if ( ! selectors.length ) {
					observer.disconnect();
					parent[observer_name] = null;
				}
			});

			parent[observer_name] = [observer, [[call_id, selector, resolve, reject, timer]]];
			observer.observe(parent, {
				childList: true,
				attributes: true,
				characterData: true,
				subtree: true
			});
		});
	}
}