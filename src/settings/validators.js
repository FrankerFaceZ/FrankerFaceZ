'use strict';

const do_number = (val, def) => {
	if ( typeof val !== 'number' || isNaN(val) || ! isFinite(val) )
		return false;

	const bounds = def.bounds;
	if ( Array.isArray(bounds) ) {
		if ( bounds.length >= 3 ) {
			// [low, inclusive, high, inclusive]
			if ( (bounds[1] ? (val < bounds[0]) : (val <= bounds[0])) ||
					(bounds[3] ? (val > bounds[2]) : (val >= bounds[2])) )
				return false;

		} else if ( bounds.length === 2 ) {
			// [low, inclusive] or [low, high] ?
			if ( typeof bounds[1] === 'boolean' ) {
				if ( bounds[1] ? val < bounds[0] : val <= bounds[0] )
					return false;
			} else if ( val < bounds[0] || val > bounds[1] )
				return false;
		} else if ( bounds.length === 1 && val < bounds[0] )
			return false;
	}

	return true;
}

export const process_to_int = (val, def) => {
	if ( typeof val === 'string' && ! /^-?\d+$/.test(val) )
		return false;
	else
		val = parseInt(val, 10);

	return do_number(val, def);
}

export const process_to_float = (val, def) => {
	if ( typeof val === 'string' && ! /^-?[\d.]+$/.test(val) )
		return false;
	else
		val = parseFloat(val);

	return do_number(val, def);
}