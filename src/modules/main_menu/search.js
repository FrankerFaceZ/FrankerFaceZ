'use strict';

// ============================================================================
// Menu Search
// ============================================================================

const CHILD_KEYS = ['tabs', 'contents', 'items'];

/**
 * Work out, in a single pass over the menu tree, which nodes match a
 * search filter and how many matching settings sit beneath each node.
 *
 * The menu components used to answer both questions on their own, from
 * their templates, so every re-render walked the same subtrees again and
 * again. Doing it once here, when the filter changes, keeps the templates
 * to a Set lookup.
 *
 * A node is shown if it matches on its own or if anything beneath it does.
 * With the `modified` flag, only settings the current profile overrides
 * can match, so structure nodes are shown purely through their children.
 *
 * @param {Array} nodes The top-level menu nodes.
 * @param {Object} filter The parsed filter, with `query` and `flags`.
 * @param {Object} profile The current profile proxy, for the modified flag.
 * @returns {{shown: Set, counts: Map}} The matching nodes and per-node counts.
 */
export function computeMatches(nodes, filter, profile) {
	const shown = new Set,
		counts = new Map,
		query = filter.query,
		modified = filter.flags ? filter.flags.has('modified') : false;

	const walk = node => {
		let count = 0;

		for(const key of CHILD_KEYS) {
			const list = node[key];
			if ( Array.isArray(list) )
				for(const child of list)
					if ( child )
						count += walk(child);
		}

		let matches = modified
			? !! (node.setting && profile && profile.has(node.setting))
			: true;

		if ( matches && query )
			matches = typeof node.search_terms === 'string' && node.search_terms.includes(query);

		if ( matches && node.setting )
			count++;

		if ( matches || count > 0 )
			shown.add(node);

		counts.set(node, count);
		return count;
	};

	if ( Array.isArray(nodes) )
		for(const node of nodes)
			if ( node )
				walk(node);

	return {shown, counts};
}
