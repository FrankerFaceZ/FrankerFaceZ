'use strict';

import type { SettingsDefinition, SettingsProcessor, SettingsUiDefinition } from "./types";

const BAD = Symbol('BAD');
type BadType = typeof BAD;

function do_number(
	input: number | BadType,
	default_value: number,
	definition: SettingsUiDefinition<number>
)  {
	if ( typeof input !== 'number' || isNaN(input) || ! isFinite(input) )
		input = BAD;

	if ( input !== BAD ) {
		const bounds = definition.bounds;
		if ( Array.isArray(bounds) ) {
			if ( bounds.length >= 3 ) {
				// [low, inclusive, high, inclusive]
				if ( (bounds[1] ? (input < bounds[0]) : (input <= bounds[0])) ||
						// TODO: Figure out why it doesn't like bounds[2] but bounds[3] is okay
						(bounds[3] ? (input > (bounds as any)[2]) : (input >= (bounds as any)[2])) )
					input = BAD;

			} else if ( bounds.length === 2 ) {
				// [low, inclusive] or [low, high] ?
				if ( typeof bounds[1] === 'boolean' ) {
					if ( bounds[1] ? input < bounds[0] : input <= bounds[0] )
						input = BAD;
				} else if ( input < bounds[0] || input > bounds[1] )
					input = BAD;
			} else if ( bounds.length === 1 && input < bounds[0] )
				input = BAD;
		}
	}

	return input === BAD ? default_value : input;
}

export const to_int: SettingsProcessor<number> = (
	value,
	default_value,
	definition
) => {
	if ( typeof value === 'string' && /^-?\d+$/.test(value) )
		value = parseInt(value, 10);
	else if ( typeof value !== 'number' )
		value = BAD;

	return do_number(value as number, default_value, definition);
}

export const to_float: SettingsProcessor<number> = (
	value: unknown,
	default_value,
	definition
) => {
	if ( typeof value === 'string' && /^-?[\d.]+$/.test(value) )
		value = parseFloat(value);
	else if ( typeof value !== 'number' )
		value = BAD;

	return do_number(value as number, default_value, definition);
}

