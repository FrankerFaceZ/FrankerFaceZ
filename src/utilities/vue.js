'use strict';

// ============================================================================
// Vue Library
// Loads Vue + Translation Shim
// ============================================================================

import Module from 'utilities/module';
import {has} from 'utilities/object';
import {DEBUG} from 'utilities/constants';


export class Vue extends Module {
	constructor(...args) {
		super(...args);
		this._components = {};
		this.inject('i18n');
	}

	async onLoad() {
		const Vue = window.ffzVue = this.Vue = (await import(/* webpackChunkName: "vue" */ 'vue')).default,
			components = this._components;

		const [
			ObserveVisibility,
			Clickaway,
			//RavenVue,
			Components

		] = await Promise.all([
			import(/* webpackChunkName: "vue" */ 'vue-observe-visibility'),
			import(/* webpackChunkName: "vue" */ 'vue-clickaway'),
			//import(/* webpackChunkName: "vue" */ 'raven-js/plugins/vue'),
			import(/* webpackChunkName: "vue" */ 'src/std-components/index.js')
		]);

		this.component(Components.default);

		Vue.use(ObserveVisibility);
		Vue.mixin(Clickaway.mixin);

		/*if ( ! DEBUG && this.root.raven )
			this.root.raven.addPlugin(RavenVue, Vue);*/

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
					tNumber_(val, format) {
						this.locale;
						return t.i18n.formatNumber(val, format);
					},

					tDate_(val, format) {
						this.locale;
						return t.i18n.formatDate(val, format);
					},

					tTime_(val, format) {
						this.locale;
						return t.i18n.formatTime(val, format);
					},

					tDateTime_(val, format) {
						this.locale;
						return t.i18n.formatDateTime(val, format);
					},

					t_(key, phrase, options) {
						this.locale && this.phrases[key];
						return t.i18n.t(key, phrase, options);
					},

					tList_(key, phrase, options) {
						this.locale && this.phrases[key];
						return t.i18n.tList(key, phrase, options);
					},

					tNode_(node, data) {
						this.locale;
						return t.i18n.formatNode(node, data);
					},

					setLocale(locale) {
						t.i18n.locale = locale;
					}
				}
			});

			this.on('i18n:transform', () => {
				this._vue_i18n.locale = this.i18n.locale;
				this._vue_i18n.phrases = {};
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

		vue.component('t-list', {
			props: {
				tag: {
					required: false
				},
				phrase: {
					type: String,
					required: true
				},
				default: {
					type: String,
					required: true
				},
				data: {
					type: Object,
					required: false
				}
			},

			render(createElement) {
				return createElement(
					this.tag || 'span',
					this.$i18n.tList_(
						this.phrase,
						this.default,
						Object.assign({}, this.data, this.$scopedSlots)
					).map(out => {
						if ( typeof out === 'function' )
							return out();
						return out;
					})
				);
			}
		})

		vue.mixin({
			methods: {
				reactNavigate(url, event) {
					const router = t.resolve('site.router');
					if ( router && router.history ) {
						if ( event ) {
							event.preventDefault();
							event.stopPropagation();
						}
						router.history.push(url);
					}
				},
				getReactURL(route, data, opts, ...args) {
					const router = t.resolve('site.router');
					return router.getURL(route, data, opts, ...args);
				},
				getI18n() {
					return t.i18n;
				},
				t(key, phrase, options) {
					return this.$i18n.t_(key, phrase, options);
				},
				tList(key, phrase, options) {
					return this.$i18n.tList_(key, phrase, options);
				},
				tNode(node, data) {
					return this.$i18n.tNode_(node, data);
				},
				tNumber(val, format) {
					return this.$i18n.tNumber_(val, format);
				},
				tDate(val, format) {
					return this.$i18n.tDate_(val, format);
				},
				tTime(val, format) {
					return this.$i18n.tTime_(val, format);
				},
				tDateTime(val, format) {
					return this.$i18n.tDateTime_(val, format);
				}
			}
		});
	}
}

export default Vue;