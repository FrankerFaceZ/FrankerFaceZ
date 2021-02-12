'use strict';

// ============================================================================
// Advanced Filter System
// ============================================================================

export function createTester(rules, filter_types, inverted = false, or = false, rebuild) {
	if ( ! Array.isArray(rules) || ! filter_types )
		return inverted ? () => false : () => true;

	const tests = [],
		names = [];

	let i = 0;
	for(const rule of rules) {
		if ( ! rule || ! rule.type )
			continue;

		const type = filter_types[rule.type];
		if ( ! type ) {
			// Default to false if we cannot find a rule type.
			// Just to be safe.
			i++;
			tests.push(() => false);
			names.push(`f${i}`);
			continue;
		}

		i++;
		tests.push(type.createTest(rule.data, filter_types, rebuild));
		names.push(`f${i}`);
	}

	if ( ! tests.length )
		return inverted ? () => false : () => true;

	if ( tests.length === 1 )
		return inverted ? ctx => ! tests[0](ctx) : tests[0];

	return new Function(...names, 'ctx',
		`return ${inverted ? `!(` : ''}${names.map(name => `${name}(ctx)`).join(or ? ' || ' : ' && ')}${inverted ? ')' : ''};`
	).bind(null, ...tests);
}