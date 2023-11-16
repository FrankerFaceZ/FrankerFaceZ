'use strict';

import type { SettingUiDefinition, SettingValidator } from "./types";


function do_number(value: any, definition: SettingUiDefinition<number>) {
	if ( typeof value !== 'number' || isNaN(value) || ! isFinite(value) )
		return false;

	const bounds = definition.bounds;
	if ( Array.isArray(bounds) ) {
		if ( bounds.length >= 3 ) {
			// [low, inclusive, high, inclusive]
			if ( (bounds[1] ? (value < bounds[0]) : (value <= bounds[0])) ||
					(bounds[3] ? (value > (bounds as any)[2]) : (value >= (bounds as any)[2])) )
				return false;

		} else if ( bounds.length === 2 ) {
			// [low, inclusive] or [low, high] ?
			if ( typeof bounds[1] === 'boolean' ) {
				if ( bounds[1] ? value < bounds[0] : value <= bounds[0] )
					return false;
			} else if ( value < bounds[0] || value > bounds[1] )
				return false;
		} else if ( bounds.length === 1 && value < bounds[0] )
			return false;
	}

	return true;
}

export const process_to_int: SettingValidator<number> = (
	value,
	definition
) => {
	if ( typeof value === 'string' && /^-?\d+$/.test(value) )
		value = parseInt(value, 10);
	else if ( typeof value !== 'number' )
		return false;

	return do_number(value, definition);
}

export const process_to_float: SettingValidator<number> = (
	value,
	definition
) => {
	if ( typeof value === 'string' && /^-?[\d.]+$/.test(value) )
		value = parseFloat(value);
	else if ( typeof value !== 'number' )
		return false;

	return do_number(value, definition);
}
