'use strict';

import type { OptionalPromise, OptionallyCallable } from "./types";

// ============================================================================
// Advanced Filter System
// ============================================================================

type FilterMethod<TContext = unknown> = (ctx: TContext) => boolean;

export type FilterType<TConfig, TContext> = {
	createTest: (config: TConfig, filter_types: FilterTypeMap<TContext>, rebuild?: () => void) => FilterMethod<TContext>

	default: OptionallyCallable<[], TConfig>;

	// Editor Configuration
	editor?: OptionallyCallable<[], OptionalPromise<any>>;

	title: string;
	i18n?: string | null;
	tall?: boolean;

	maxRules?: number;
	childRules?: boolean;


}

type FilterTypeMap<TContext> = {
	[key: string]: FilterType<any, TContext>;
};


export type FilterData = {
	id?: string;
	type: string;
	data: any;
}


export function createTester<TContext, Types extends FilterTypeMap<TContext>>(
	rules: FilterData[] | null | undefined,
	filter_types: Types,
	inverted: boolean = false,
	or: boolean = false,
	rebuild?: () => void
): (ctx: TContext) => boolean {

	if ( ! Array.isArray(rules) || ! filter_types )
		return inverted ? () => false : () => true;

	const tests: FilterMethod<TContext>[] = [],
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

		// Construct the test. If no test is returned, we skip this filter.
		// This can happen depending on configuration rendering a method
		// pointless.
		const test = type.createTest(rule.data, filter_types, rebuild);
		if ( ! test )
			continue;

		i++;
		tests.push(test);
		names.push(`f${i}`);
	}

	if ( ! tests.length )
		return inverted ? () => false : () => true;

	if ( tests.length === 1 )
		return inverted ? (ctx: TContext) => ! tests[0](ctx) : tests[0];

	return new Function(...names, 'ctx',
		`return ${inverted ? `!(` : ''}${names.map(name => `${name}(ctx)`).join(or ? ' || ' : ' && ')}${inverted ? ')' : ''};`
	).bind(null, ...tests);
}
