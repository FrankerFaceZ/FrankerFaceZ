'use strict';

// ============================================================================
// Name and Color Overrides
// ============================================================================

import Module from 'utilities/module';
import { createElement, ClickOutside } from 'utilities/dom';
import Tooltip from 'utilities/tooltip';


export default class Overrides extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');

		this.color_cache = null;
		this.name_cache = null;

		/*this.settings.addUI('chat.overrides', {
			path: 'Chat > Overrides @{"profile_warning": false}',
			component: 'chat-overrides',

			on: (...args) => this.on(...args),
			off: (...args) => this.off(...args),

			setColor: (...args) => this.setColor(...args),
			setName: (...args) => this.setName(...args),
			deleteColor: id => this.deleteColor(id),
			deleteName: id => this.deleteName(id),

			getColors: () => this.colors,
			getNames: () => this.names
		});*/
	}

	onEnable() {
		this.settings.provider.on('changed', this.onProviderChange, this);
	}

	renderUserEditor(user, target) {
		let outside, popup, ve;

		const destroy = () => {
			const o = outside, p = popup, v = ve;
			outside = popup = ve = null;

			if ( o )
				o.destroy();

			if ( p )
				p.destroy();

			if ( v )
				v.$destroy();
		}

		const parent = document.fullscreenElement || document.body.querySelector('#root>div') || document.body;

		popup = new Tooltip(parent, [], {
			logger: this.log,
			manual: true,
			live: false,
			html: true,
			hover_events: true,
			no_update: true,
			no_auto_remove: true,

			tooltipClass: 'ffz-action-balloon ffz-balloon tw-block tw-border tw-elevation-1 tw-border-radius-small tw-c-background-base',
			arrowClass: '', //ffz-balloon__tail tw-overflow-hidden tw-absolute',
			arrowInner: '', //ffz-balloon__tail-symbol tw-border-t tw-border-r tw-border-b tw-border-l tw-border-radius-small tw-c-background-base  tw-absolute',
			innerClass: '',

			popper: {
				placement: 'bottom',
				modifiers: {
					preventOverflow: {
						boundariesElement: parent
					},
					flip: {
						behavior: ['bottom', 'top', 'left', 'right']
					}
				}
			},

			content: async (t, tip) => {
				const vue = this.resolve('vue'),
					_editor = import(/* webpackChunkName: "overrides" */ './override-editor.vue');

				const [, editor] = await Promise.all([vue.enable(), _editor]);
				vue.component('override-editor', editor.default);

				ve = new vue.Vue({
					el: createElement('div'),
					render: h => h('override-editor', {
						user,

						name: this.getName(user.id),
						color: this.getColor(user.id),

						updateTip: () => tip.update(),
						setColor: val => this.setColor(user.id, val),
						deleteColor: () => this.deleteColor(user.id),
						setName: val => this.setName(user.id, val),
						deleteName: () => this.deleteName(user.id),

						close: () => tip.hide()
					})
				});

				return ve.$el;
			},

			onShow: async (t, tip) => {
				await tip.waitForDom();
				requestAnimationFrame(() => {
					outside = new ClickOutside(tip.outer, destroy)
				});
			},

			onMove: (target, tip, event) => {
				this.emit('tooltips:mousemove', target, tip, event)
			},

			onLeave: (target, tip, event) => {
				this.emit('tooltips:leave', target, tip, event);
			},

			onHide: destroy
		});

		popup._enter(target);
	}


	onProviderChange(key) {
		if ( key === 'overrides.colors' )
			this.loadColors();
		else if ( key === 'overrides.names' )
			this.loadNames();
	}

	get colors() {
		if ( ! this.color_cache )
			this.loadColors();

		return this.color_cache;
	}

	get names() {
		if ( ! this.name_cache )
			this.loadNames();

		return this.name_cache;
	}

	loadColors() {
		let old_keys,
			loaded = true;
		if ( ! this.color_cache ) {
			loaded = false;
			this.color_cache = {};
			old_keys = new Set;
		} else
			old_keys = new Set(Object.keys(this.color_cache));

		for(const [key, val] of Object.entries(this.settings.provider.get('overrides.colors', {}))) {
			old_keys.delete(key);
			if ( this.color_cache[key] !== val ) {
				this.color_cache[key] = val;
				if ( loaded )
					this.emit(':changed', key, 'color', val);
			}
		}

		for(const key of old_keys) {
			this.color_cache[key] = undefined;
			if ( loaded )
				this.emit(':changed', key, 'color', undefined);
		}
	}

	loadNames() {
		let old_keys,
			loaded = true;
		if ( ! this.name_cache ) {
			loaded = false;
			this.name_cache = {};
			old_keys = new Set;
		} else
			old_keys = new Set(Object.keys(this.name_cache));

		for(const [key, val] of Object.entries(this.settings.provider.get('overrides.names', {}))) {
			old_keys.delete(key);
			if ( this.name_cache[key] !== val ) {
				this.name_cache[key] = val;
				if ( loaded )
					this.emit(':changed', key, 'name', val);
			}
		}

		for(const key of old_keys) {
			this.name_cache[key] = undefined;
			if ( loaded )
				this.emit(':changed', key, 'name', undefined);
		}
	}

	getColor(id) {
		if ( this.colors[id] != null )
			return this.colors[id];

		return null;
	}

	getName(id) {
		if ( this.names[id] != null )
			return this.names[id];

		return null;
	}

	setColor(id, color) {
		if ( this.colors[id] !== color ) {
			this.colors[id] = color;
			this.settings.provider.set('overrides.colors', this.colors);
			this.emit(':changed', id, 'color', color);
		}
	}

	setName(id, name) {
		if ( this.names[id] !== name ) {
			this.names[id] = name;
			this.settings.provider.set('overrides.names', this.names);
			this.emit(':changed', id, 'name', name);
		}
	}

	deleteColor(id) {
		this.setColor(id, undefined);
	}

	deleteName(id) {
		this.setName(id, undefined);
	}
}