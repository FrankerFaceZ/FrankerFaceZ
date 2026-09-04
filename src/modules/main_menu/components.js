'use strict';

// ============================================================================
// Menu Components
//
// The components the menu needs to draw its frame and the pages nearly
// everyone lands on come with the main-menu chunk. The rest, the editors
// and tools behind specific pages (some of them dragging in sortablejs,
// file-saver, safe-regex and the like), are registered as async
// components and fetched together, in one chunk, on first use.
//
// The two contexts must agree: a component is eager when its name is in
// the first pattern, and lazy when it isn't. The patterns are spelled out
// twice because the bundler needs literal regular expressions.
// ============================================================================

const eager = require.context(
	'./components',
	false,
	/^\.\/(?:main-menu|menu-tree|menu-page|menu-container|home-page|md-page|changelog|recent-changes|profile-selector|setting-check-box|setting-text-box|setting-select-box|setting-combo-box|setting-radio-buttons|setting-color-box|setting-spacer|setting-text|setting-hotkey|async-text)\.vue$/
);

const lazy = require.context(
	'./components',
	false,
	/^\.\/(?!(?:main-menu|menu-tree|menu-page|menu-container|home-page|md-page|changelog|recent-changes|profile-selector|setting-check-box|setting-text-box|setting-select-box|setting-combo-box|setting-radio-buttons|setting-color-box|setting-spacer|setting-text|setting-hotkey|async-text)\.vue$)[^/]+\.vue$/,
	'lazy-once'
);

const out = {};

for(const key of eager.keys())
	out[key.slice(2, key.length - 4)] = eager(key).default;

for(const key of lazy.keys())
	out[key.slice(2, key.length - 4)] = () => lazy(key).then(mod => mod.default);

export default out;
