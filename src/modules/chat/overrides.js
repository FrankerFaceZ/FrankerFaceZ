'use strict';

// ============================================================================
// Name and Color Overrides
// ============================================================================

import Module from 'utilities/module';


export default class Overrides extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.color_cache = null;
		this.name_cache = null;
	}

	onEnable() {
		this.settings.provider.on('changed', this.onProviderChange, this);
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