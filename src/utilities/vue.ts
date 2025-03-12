'use strict';

// ============================================================================
// Vue Library
// Loads Vue + Translation Shim
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import {has} from 'utilities/object';
import type TranslationManager from '../i18n';
import type { VueConstructor } from 'vue';
import type Vue from 'vue';
import type { CombinedVueInstance } from 'vue/types/vue';
import type { MessageNode } from '@ffz/icu-msgparser';

declare global {
	interface Window {
		ffzVue: VueConstructor<Vue>;
	}
}

declare module 'utilities/types' {
	interface ModuleEventMap {

	}
	interface ModuleMap {
		vue: VueModule
	}
}


export class VueModule extends Module<'vue'> {

	private _components: Record<string, any> | null;

	Vue: VueConstructor<Vue> | null = null;

	i18n: TranslationManager = null as any;

	_vue_i18n?: CombinedVueInstance<any, any, any, any, any> | null;

	key: string;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);
		this.key = 'ffz-stuff';

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

		Vue.use(ObserveVisibility as any);
		Vue.mixin(Clickaway.mixin);

		/*if ( ! DEBUG && this.root.raven )
			this.root.raven.addPlugin(RavenVue, Vue);*/

		for(const key in components)
			if ( has(components, key) )
				Vue.component(key, components[key]);

		this._components = null;
		Vue.use(this);
	}

	component(id: string | any, constructor?: any) {
		if ( typeof id === 'function' ) {
			for(const key of id.keys())
				this.component(key.slice(2, key.length - 4), id(key).default);

		} else if ( typeof id === 'object' ) {
			for(const key in id)
				if ( has(id, key) )
					this.component(key, id[key]);

		} else if ( this.Vue )
			this.Vue.component(id, constructor);

		else if ( this._components )
			this._components[id] = constructor;
	}

	install(vue: typeof Vue) {
		// This is a mess. I'm sure there's an easier way to tie the systems
		// together. However, for now, this works.

		const t = this;
		if ( ! this._vue_i18n ) {
			this._vue_i18n = new vue({
				data() {
					return {
						locale: t.i18n.locale,
						phrases: {}
					}
				},

				methods: {
					tNumber_(val: number, format?: string) {
						this.locale;
						return t.i18n.formatNumber(val, format);
					},

					tDate_(val: string | Date, format?: string) {
						this.locale;
						return t.i18n.formatDate(val, format);
					},

					tTime_(val: string | Date, format?: string) {
						this.locale;
						return t.i18n.formatTime(val, format);
					},

					tDateTime_(val: string | Date, format?: string) {
						this.locale;
						return t.i18n.formatDateTime(val, format);
					},

					t_(key: string, phrase: string, options: any) {
						// Access properties to trigger reactivity.
						this.locale && (this as any).phrases[key];
						return t.i18n.t(key, phrase, options);
					},

					tList_(key: string, phrase: string, options: any) {
						// Access properties to trigger reactivity.
						this.locale && (this as any).phrases[key];
						return t.i18n.tList(key, phrase, options);
					},

					tNode_(node: MessageNode, data: any) {
						// Access properties to trigger reactivity.
						this.locale;
						return t.i18n.formatNode(node, data);
					},

					setLocale(locale: string) {
						t.i18n.locale = locale;
					}
				}
			});

			// On i18n events, update values for reactivity.
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
					(this as any).$i18n.tList_(
						this.phrase,
						this.default,
						Object.assign({}, this.data, this.$scopedSlots)
					).map((out: any) => {
						if ( typeof out === 'function' )
							return out();
						return out;
					})
				);
			}
		});

		vue.mixin({
			methods: {
				reactNavigate(url, event, state) {
					const router = t.resolve('site.router');
					if ( router ) {
						if ( event ) {
							event.preventDefault();
							event.stopPropagation();
						}
						router.push(url, state ?? undefined);
					}
				},
				getReactURL(route, data, opts, ...args) {
					const router = t.resolve('site.router')!;
					return router.getURL(route, data, opts, ...args);
				},
				getI18n() {
					return t.i18n;
				},
				t(key, phrase, options) {
					return (this as any).$i18n.t_(key, phrase, options);
				},
				tList(key, phrase, options) {
					return (this as any).$i18n.tList_(key, phrase, options);
				},
				tNode(node, data) {
					return (this as any).$i18n.tNode_(node, data);
				},
				tNumber(val, format) {
					return (this as any).$i18n.tNumber_(val, format);
				},
				tDate(val, format) {
					return (this as any).$i18n.tDate_(val, format);
				},
				tTime(val, format) {
					return (this as any).$i18n.tTime_(val, format);
				},
				tDateTime(val, format) {
					return (this as any).$i18n.tDateTime_(val, format);
				}
			}
		});
	}
}

export default VueModule;
