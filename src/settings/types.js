'use strict';

// ============================================================================
// Settings Types
// ============================================================================

export const basic = {
	get(key, profiles) {
		for(const profile of profiles)
			if ( profile.has(key) )
				return [
					profile.get(key),
					[profile.id]
				]
	}
}


export const object_merge = {
	get(key, profiles, log) {
		const values = [],
			sources = [];

		for(const profile of profiles)
			if ( profile.has(key) ) {
				const val = profile.get(key);
				if ( typeof val !== 'object' ) {
					log.warn(`Profile #${profile.id} has an invalid value for "${key}" of type ${typeof val}. Skipping.`);
					continue;
				}

				sources.push(profile.id);
				values.unshift(val);
			}

		if ( sources.length )
			return [
				Object.assign({}, ...values),
				sources
			]
	}
}


export const array_merge = {
	default(val) {
		const values = [];
		for(const v of val)
			if ( v.t !== 'inherit' && v.v )
				values.push(v.v);

		return values;
	},

	get(key, profiles, definition, log) {
		const values = [],
			trailing = [],
			sources = [];

		let had_value = false;

		for(const profile of profiles)
			if ( profile.has(key) ) {
				const value = profile.get(key);
				if ( ! Array.isArray(value) ) {
					log.warn(`Profile #${profile.id} has an invalid value for "${key}" of type ${typeof value}. Skipping.`);
					continue;
				}

				sources.push(profile.id);
				let is_trailing = false;
				for(const val of value) {
					had_value = true;
					if ( val.t === 'inherit' )
						is_trailing = true;
					else if ( is_trailing )
						trailing.unshift(val.v);
					else
						values.push(val.v);
				}

				// If we didn't run into an inherit, don't inherit.
				if ( ! is_trailing && ! definition.always_inherit )
					break;
			}

		if ( had_value )
			return [
				values.concat(trailing),
				sources
			]
	}
}