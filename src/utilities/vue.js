'use strict';

// ============================================================================
// Vue Library
// Loads Vue + Translation Shim
// ============================================================================

import Module from 'utilities/module';
import {has} from 'utilities/object';


export class Vue extends Module {
	constructor(...args) {
		super(...args);
		this._components = {};
		this.inject('i18n');
	}

	async onLoad() {
		const Vue = this.Vue = (await import(/* webpackChunkName: "vue" */ 'vue')).default,
			components = this._components;

		this.component((await import(/* webpackChunkName: "vue" */ 'src/std-components/index.js')).default);

		for(const key in components)
			if ( has(components, key) )
				Vue.component(key, components[key]);

		this._components = null;
		Vue.use(this);
	}

	component(name, component) {
		if ( typeof name === 'function' ) {
			for(const key of name.keys())
				this.component(key.slice(2, key.length - 4), name(key).default);

		} else if ( typeof name === 'object' ) {
			for(const key in name)
				if ( has(name, key) )
					this.component(key, name[key]);

		} else if ( this.Vue )
			this.Vue.component(name, component);

		else
			this._components[name] = component;
	}

	install(vue) {
		// This is a mess. I'm sure there's an easier way to tie the systems
		// together. However, for now, this works.

		const t = this;
		if ( ! this._vue_i18n ) {
			this._vue_i18n = new this.Vue({
				data() {
					return {
						locale: t.i18n.locale,
						phrases: {}
					}
				},

				methods: {
					t_(key, phrase, options) {
						this.locale && this.phrases[key];
						return t.i18n.t(key, phrase, options);
					},

					setLocale(locale) {
						t.i18n.locale = locale;
					}
				}
			});

			this.on('i18n:changed', () => {
				this._vue_i18n.locale = this.i18n.locale;
				this._vue_i18n.phrases = {};
			});

			this.on('i18n:loaded', keys => {
				const i = this._vue_i18n,
					p = i.phrases;
				for(const key of keys)
					i.$set(p, key, (p[key]||0) + 1);
			});

			vue.prototype.$i18n = this._vue_i18n;
		}

		vue.mixin({
			methods: {
				t(key, phrase, options) {
					return this.$i18n.t_(key, phrase, options);
				}
			}
		});
	}
}

export default Vue;