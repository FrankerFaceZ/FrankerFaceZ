import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// Mirrors the aliases in tsconfig.json / rspack.config.js.
const alias = {
	res: path.resolve(root, 'res'),
	styles: path.resolve(root, 'styles'),
	root,
	src: path.resolve(root, 'src'),
	utilities: path.resolve(root, 'src/utilities'),
	site: path.resolve(root, 'src/sites/twitch-twilight')
};

export default defineConfig({
	resolve: {
		alias
	},

	// JSX in this project compiles to createElement from utilities/dom.
	oxc: {
		jsx: {
			runtime: 'classic',
			pragma: 'createElement',
			pragmaFrag: 'Fragment'
		}
	},

	// Build-time constants normally injected by rspack's DefinePlugin.
	define: {
		__version_major__: '0',
		__version_minor__: '0',
		__version_patch__: '0',
		__version_prerelease__: '[]',
		__version_build__: 'null',
		__git_commit__: '"test"',
		__extension__: 'false',
		__webpack_hash__: '"test"'
	},

	test: {
		// utilities/constants reads localStorage and document at import
		// time, so even the pure utilities need a DOM.
		environment: 'happy-dom',
		setupFiles: ['./tools/vitest.setup.ts'],
		include: ['src/**/*.test.{ts,tsx,js,jsx}'],
		globals: false
	}
});
