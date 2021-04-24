'use strict';

const BAD = Symbol('BAD');

const do_number = (val, default_value, def) => {
	if ( typeof val !== 'number' || isNaN(val) || ! isFinite(val) )
		val = BAD;

	if ( val !== BAD ) {
		const bounds = def.bounds;
		if ( Array.isArray(bounds) ) {
			if ( bounds.length >= 3 ) {
				// [low, inclusive, high, inclusive]
				if ( (bounds[1] ? (val < bounds[0]) : (val <= bounds[0])) ||
						(bounds[3] ? (val > bounds[2]) : (val >= bounds[2])) )
					val = BAD;

			} else if ( bounds.length === 2 ) {
				// [low, inclusive] or [low, high] ?
				if ( typeof bounds[1] === 'boolean' ) {
					if ( bounds[1] ? val < bounds[0] : val <= bounds[0] )
						val = BAD;
				} else if ( val < bounds[0] || val > bounds[1] )
					val = BAD;
			} else if ( bounds.length === 1 && val < bounds[0] )
				val = BAD;
		}
	}

	return val === BAD ? default_value : val;
}

export const to_int = (val, default_value, def) => {
	if ( typeof val === 'string' && ! /^-?\d+$/.test(val) )
		val = BAD;
	else
		val = parseInt(val, 10);

	return do_number(val, default_value, def);
}

export const to_float = (val, default_value, def) => {
	if ( typeof val === 'string' && ! /^-?[\d.]+$/.test(val) )
		val = BAD;
	else
		val = parseFloat(val);

	return do_number(val, default_value, def);
}