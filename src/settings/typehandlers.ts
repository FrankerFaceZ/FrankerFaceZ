'use strict';

import type Logger from "utilities/logging";
import type SettingsProfile from "./profile";
import type { SettingDefinition, SettingsTypeHandler } from "./types";
import type SettingsContext from "./context";

// ============================================================================
// Settings Types
// ============================================================================

const DEFAULT = Symbol('default');


export const basic: SettingsTypeHandler = {
	get<T>(key: string, profiles: SettingsProfile[]) {
		for(const profile of profiles)
			if ( profile.has(key) )
				return [
					profile.get(key) as T,
					[profile.id]
				]
	}
}


export const object_merge: SettingsTypeHandler = {
	get<T>(key: string, profiles: SettingsProfile[], definition: SettingDefinition<any>, log: Logger) {
		const values: T[] = [],
			sources: number[] = [];

		for(const profile of profiles)
			if ( profile.has(key) ) {
				const val = profile.get<T>(key);
				if ( ! val || typeof val !== 'object' ) {
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


type UnwrapArray<T> = T extends Array<infer U> ? U : T;

export const basic_array_merge: SettingsTypeHandler = {
	get<T>(key: string, profiles: SettingsProfile[], definition: SettingDefinition<any>, log: Logger) {
		const values: UnwrapArray<T>[] = [],
			sources: number[] = [];

		for(const profile of profiles)
			if ( profile.has(key) ) {
				const val = profile.get<UnwrapArray<T>>(key);
				if ( ! Array.isArray(val) ) {
					log.warn(`Profile #${profile.id} has an invalid value for "${key}"`);
					continue;
				}

				sources.push(profile.id);
				for(const v of val)
					values.push(v);
			}

		if ( sources.length )
			return [
				values,
				sources
			]
	}
}


export const array_merge: SettingsTypeHandler = {
	default(val) {
		const values = [];
		for(const v of val)
			if ( v.t !== 'inherit' && v.t !== 'skip' && v.v )
				values.push(v.v);

		return values;
	},

	get<T>(
		key: string,
		profiles: SettingsProfile[],
		definition: SettingDefinition<any>,
		log: Logger,
		ctx: SettingsContext
	) {

		const values: UnwrapArray<T>[] = [],
			sources: number[] = [];
		let trailing: UnwrapArray<T>[] = [];
		let had_value = false;

		let profs: (SettingsProfile | typeof DEFAULT)[] = profiles;
		if ( definition.inherit_default )
			profs = [...profiles, DEFAULT];

		for(const profile of profs) {
			let value;
			if ( profile === DEFAULT ) {
				value = definition.default;
				if ( typeof value === 'function' )
					value = value(ctx);

			} else if ( profile.has(key) )
				value = profile.get(key);
			else
				continue;

			if ( ! Array.isArray(value) ) {
				if ( profile !== DEFAULT )
					log.warn(`Profile #${profile.id} has an invalid value for "${key}" of type ${typeof value}. Skipping.`);
				continue;
			}

			const trail: UnwrapArray<T>[] = [];

			if ( profile !== DEFAULT )
				sources.push(profile.id);

			let is_trailing = false;
			for(const val of value) {
				had_value = true;
				if ( val.t === 'inherit' )
					is_trailing = true;
				else if ( val.t === 'skip' )
					continue;
				else if ( is_trailing )
					trail.push(val.v);
				else
					values.push(val.v);
			}

			trailing = trail.concat(trailing);

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



export default {
	basic,
	object_merge,
	basic_array_merge,
	array_merge
} as Record<string, SettingsTypeHandler>;
