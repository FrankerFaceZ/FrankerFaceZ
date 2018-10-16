import { deep_copy } from "./object";

'use strict';

// ============================================================================
// GraphQL Document Manipulation
// ============================================================================

export const MERGE_METHODS = {
	Document: (a, b) => {
		if ( a.definitions && b.definitions )
			a.definitions = mergeList(a.definitions, b.definitions);
		else if ( b.definitions )
			a.definitions = b.definitions;

		return a;
	},

	Field: (a, b) => {
		if ( a.name && (! b.name || b.name.value !== a.name.value) )
			return a;

		// TODO: arguments
		// TODO: directives

		if ( a.selectionSet && b.selectionSet )
			a.selectionSet = merge(a.selectionSet, b.selectionSet);
		else if ( b.selectionSet )
			a.selectionSet = b.selectionSet;

		return a;
	},

	OperationDefinition: (a, b) => {
		if ( a.operation !== b.operation )
			return a;

		// TODO: variableDefinitions
		// TODO: directives

		if ( a.selectionSet && b.selectionSet )
			a.selectionSet = merge(a.selectionSet, b.selectionSet);
		else if ( b.selectionSet )
			a.selectionSet = b.selectionSet;

		return a;
	},

	FragmentDefinition: (a, b) => {
		if ( a.typeCondition && b.typeCondition ) {
			if ( a.typeCondition.kind !== b.typeCondition.kind )
				return a;

			if ( a.typeCondition.name.value != b.typeCondition.name.value )
				return a;
		}

		// TODO: directives

		if ( a.selectionSet && b.selectionSet )
			a.selectionSet = merge(a.selectionSet, b.selectionSet);
		else if ( b.selectionSet )
			a.selectionSet = b.selectionSet;

		return a;
	},

	SelectionSet: (a, b) => {
		if ( a.selections && b.selections )
			a.selections = mergeList(a.selections, b.selections);
		else if ( b.selections )
			a.selections = b.selections;

		return a;
	}
}


export function mergeList(a, b) {
	const a_names = {};
	for(const item of a) {
		if ( ! item || ! item.name || item.name.kind !== 'Name' )
			continue;

		a_names[item.name.value] = item;
	}

	for(const item of b) {
		if ( ! item || ! item.name || item.name.kind !== 'Name' )
			continue;

		const name = item.name.value,
			idx = a_names[name] ? a.indexOf(a_names[name]) : -1;

		if ( idx !== -1 )
			a[idx] = merge(a[idx], item);
		else
			a.push(item);
	}

	return a;
}


export default function merge(a, b) {
	if ( a.kind !== b.kind )
		return a;

	if ( MERGE_METHODS[a.kind] )
		return MERGE_METHODS[a.kind](a, b);

	return a;
}