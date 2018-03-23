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

		if ( values.length )
			return [
				Object.assign({}, ...values),
				sources
			]
	}
}


export const array_merge = {
	get(key, profiles, log) {
		const values = [],
			trailing = [],
			sources = [];

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
					if ( val.t === 'inherit' )
						is_trailing = true;
					else if ( is_trailing )
						trailing.unshift(val.v);
					else
						values.push(val.v);
				}

				// If we didn't run into an inherit, don't inherit.
				if ( ! is_trailing )
					break;
			}

		if ( values.length || trailing.length )
			return [
				values.concat(trailing),
				sources
			]
	}
}