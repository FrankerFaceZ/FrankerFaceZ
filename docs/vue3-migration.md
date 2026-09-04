# Vue 3 migration: sizing from the spike

The branch `claude/vue3-spike` builds FrankerFaceZ against Vue 3.5 through
`@vue/compat` (the migration build, MODE 2) with vue-loader 17. It is a
sizing experiment, not something to merge as-is. This records what it found
on 4 September 2026.

## Result in one line

The Control Center opens and its pages render under Vue 3 with no errors.
The migration build's deprecation warnings are the to-do list, and it is
shorter than the size of the codebase suggests.

## What the compile stage needed

22 mechanical edits, all on the spike branch:

- 18 components used `<template functional>`, which Vue 3 removed. They are
  now ordinary components reading `$attrs`, with `inheritAttrs: false`.
- 3 `<template v-for>` blocks carried their `:key` on children; it moves to
  the template tag.
- 1 set of `v-if`/`v-else-if` branches shared a key and needs distinct ones.

After that the production build compiles. The Vue runtime chunk grows from
42 KB to 351 KB with the compat layer; a finished migration on plain Vue 3
would be nearer 100 KB.

## What the runtime warned about

Collected from the Control Center: home, Add-Ons, an add-on's settings,
Chat > Actions. Each warning fires once per feature or component.

| Warning | Where it comes from | Fix |
|---|---|---|
| `OPTIONS_BEFORE_DESTROY`, `OPTIONS_DESTROYED` | 29 components using the Vue 2 lifecycle names | Rename to `beforeUnmount` / `unmounted`. Mechanical. |
| `ATTR_FALSE_VALUE` | `:aria-selected="false"`, `:aria-expanded`, `:checked`, `:selected` and similar bindings | Bind `null`/`undefined` to remove an attribute. Mechanical, template by template. |
| `ATTR_ENUMERATED_COERCION` | `:spellcheck="false"` | Bind the string `'false'`. Trivial. |
| `RENDER_FUNCTION` | 8 `render: h => h(...)` sites, mostly root instances in `utilities/vue.ts`, `translation_ui`, `overrides.ts` | Switch to `h` imported from Vue and the Vue 3 props shape. Small. |
| `GLOBAL_MOUNT`, `GLOBAL_PROTOTYPE` | The Vue bridge (`utilities/vue.ts`) uses `new Vue({el})` and `Vue.prototype` | Move to `createApp().mount()` and `app.config.globalProperties`. One module, but it is the seam every root instance goes through. |
| `GLOBAL_PRIVATE_UTIL`, `CUSTOM_DIR` | `vue-clickaway` and `vue-observe-visibility`, both Vue 2-only; the clickaway plugin says so outright | Replace: clickaway is a 20-line directive; observe-visibility has a Vue 3 release (`vue-observe-visibility@2`). |
| `faded`, `has_unseen`, `maximized`, `exclusive` rendered as attributes on `MainMenu` | Root instances pass data as a flat object that components read from `$vnode.data` (8 sites) | Declare real props and pass them as props. The one structural change. |
| Feature flags notice | The esm-bundler build wants `__VUE_OPTIONS_API__` and friends defined | Three defines in the Rspack config. Trivial. |

Not exercised by the spike: emote cards, viewer cards, the chat tester, the
translation UI, and `vue-color` and `vuedraggable` (both need their Vue 3
releases: `vue-color@3`, `vuedraggable@4`).

## What the inventory says beyond the warnings

- 123 single-file components, about 20,000 lines of template and script.
- 77 `v-model` uses. Those on native inputs are unaffected; those on
  components change their event contract (`value`/`input` becomes
  `modelValue`/`update:modelValue`) under a real Vue 3 build.
- 7 `filters:` blocks; filters are gone in Vue 3 and become methods.
- 10 `$children` and 1 `$scopedSlots` uses; both removed in Vue 3.
- Types: 49 typecheck errors from Vue 2 type names and the two Vue 2-only
  libraries.

## The decision that has to come first: add-ons

The bundler maps every `vue` import to the global `ffzVue`, which add-ons
also use to render their settings UIs. A Vue 3 core therefore changes what
add-ons get. Options:

1. Ship the migration build in production for a period, so add-ons written
   against Vue 2 keep working with warnings while they move. Cost: the
   350 KB runtime.
2. Cut over to plain Vue 3 and require add-ons to update. Cheapest for this
   repository, hardest on the ecosystem.

## Suggested order, if it goes ahead

1. Land the 22 compile fixes on master now; they are valid Vue 2 code too.
2. Rename the lifecycle hooks and fix the attribute bindings; also Vue 2
   compatible.
3. Replace clickaway and observe-visibility; move vue-color and
   vuedraggable to their Vue 3 releases.
4. Rewrite the Vue bridge on `createApp`, and turn the `$vnode.data` root
   instances into proper props.
5. Convert `filters`, `$children`, `$scopedSlots` and component `v-model`.
6. Switch from the migration build to plain Vue 3 and fix what remains.

Steps 1 and 2 shrink the warning list without committing to anything.
