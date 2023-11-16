'use strict';

import type { DefinitionNode, DocumentNode, FieldNode, FragmentDefinitionNode, OperationDefinitionNode, SelectionNode, SelectionSetNode } from 'graphql';


// ============================================================================
// GraphQL Document Manipulation
// ============================================================================

export const MERGE_METHODS: Record<string, (a: any, b: any) => any> = {
	Document: (a: DocumentNode, b: DocumentNode) => {
		if ( a.definitions && b.definitions )
			(a as any).definitions = mergeList(a.definitions as DefinitionNode[], b.definitions as any);
		else if ( b.definitions )
			(a as any).definitions = b.definitions;

		return a;
	},

	Field: (a: FieldNode, b: FieldNode) => {
		if ( a.name && (! b.name || b.name.value !== a.name.value) )
			return a;

		// TODO: arguments
		// TODO: directives

		if ( a.selectionSet && b.selectionSet )
			(a as any).selectionSet = merge(a.selectionSet, b.selectionSet);
		else if ( b.selectionSet )
			(a as any).selectionSet = b.selectionSet;

		return a;
	},

	OperationDefinition: (a: OperationDefinitionNode, b: OperationDefinitionNode) => {
		if ( a.operation !== b.operation )
			return a;

		// TODO: variableDefinitions
		// TODO: directives

		if ( a.selectionSet && b.selectionSet )
			(a as any).selectionSet = merge(a.selectionSet, b.selectionSet);
		else if ( b.selectionSet )
			(a as any).selectionSet = b.selectionSet;

		return a;
	},

	FragmentDefinition: (a: FragmentDefinitionNode, b: FragmentDefinitionNode) => {
		if ( a.typeCondition && b.typeCondition ) {
			if ( a.typeCondition.kind !== b.typeCondition.kind )
				return a;

			if ( a.typeCondition.name.value != b.typeCondition.name.value )
				return a;
		}

		// TODO: directives

		if ( a.selectionSet && b.selectionSet )
			(a as any).selectionSet = merge(a.selectionSet, b.selectionSet);
		else if ( b.selectionSet )
			(a as any).selectionSet = b.selectionSet;

		return a;
	},

	SelectionSet: (a: SelectionSetNode, b: SelectionSetNode) => {
		if ( a.selections && b.selections )
			a.selections = mergeList(a.selections as SelectionNode[], b.selections as any);
		else if ( b.selections )
			a.selections = b.selections;

		return a;
	}
}

// TODO: Type safe this
export function mergeList(a: any[], b: any[]) {
	let has_operation = false;
	const a_names: Record<string, any> = {};
	for(const item of a) {
		if ( ! item || ! item.name || item.name.kind !== 'Name' )
			continue;

		if ( item.operation )
			has_operation = true;

		a_names[item.name.value] = item;
	}

	for(const item of b) {
		if ( ! item || ! item.name || item.name.kind !== 'Name' )
			continue;

		const name = item.name.value,
			idx = a_names[name] ? a.indexOf(a_names[name]) : -1;

		if ( idx !== -1 ) {
			if ( a[idx].operation && item.operation && a[idx].operation !== item.operation )
				continue;

			a[idx] = merge(a[idx], item);
			if ( a[idx].operation )
				has_operation = true;

		} else {
			if ( has_operation && item.operation )
				continue;

			a.push(item);
		}
	}

	return a;
}


export default function merge(a: any, b: any) {
	if ( a.kind !== b.kind )
		return a;

	if ( MERGE_METHODS[a.kind] )
		return MERGE_METHODS[a.kind](a, b);

	return a;
}
