'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const vue = require('eslint-plugin-vue');
const react = require('eslint-plugin-react');
const stylistic = require('@stylistic/eslint-plugin');

// Globals injected by webpack's EsbuildPlugin define step (see webpack.config.js).
const BUILD_GLOBALS = {
	'import': 'readonly',
	'require': 'readonly',
	'__webpack_hash__': 'readonly',
	'__git_commit__': 'readonly',
	'__version_major__': 'readonly',
	'__version_minor__': 'readonly',
	'__version_patch__': 'readonly',
	'__version_prerelease__': 'readonly',
	'__extension__': 'readonly',
	'FrankerFaceZ': 'readonly'
};

module.exports = [
	{
		ignores: [
			'dist/**',
			'typedist/**',
			'dev_cdn/**',
			'socketserver/**',
			'**/*.disabled',
			'**/*.off'
		]
	},

	js.configs.recommended,

	// Build tooling runs under Node, not in the browser.
	{
		files: ['*.config.js', 'bin/**/*.js', 'tools/**/*.js'],
		languageOptions: {
			sourceType: 'commonjs',
			globals: {
				...globals.node
			}
		}
	},

	// This project is on Vue 2.7, so use the Vue 2 rule set.
	...vue.configs['flat/vue2-recommended'],

	{
		files: ['**/*.{js,jsx,vue}'],

		plugins: {
			react,
			'@stylistic': stylistic
		},

		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: {
					jsx: true
				}
			},
			globals: {
				...globals.browser,
				...globals.es2021,
				...BUILD_GLOBALS
			}
		},

		settings: {
			react: {
				// JSX in this project compiles to utilities/dom createElement,
				// not React. This keeps react/jsx-uses-react marking it as used.
				pragma: 'createElement'
			}
		},

		rules: {
			'require-atomic-updates': 'off',
			// ESLint 9 started reporting unused catch parameters by default.
			// Keep the previous behaviour for now; flip this when cleaning up.
			'no-unused-vars': ['error', {'caughtErrors': 'none'}],
			'accessor-pairs': ['error'],
			'block-scoped-var': ['error'],
			'class-methods-use-this': ['error'],
			'for-direction': ['error'],
			'guard-for-in': ['warn'],
			'no-alert': ['error'],
			'no-await-in-loop': ['error'],
			'no-caller': ['error'],
			'no-invalid-this': ['error'],
			'no-iterator': ['error'],
			'no-labels': ['error'],
			'no-lone-blocks': ['error'],
			'no-octal-escape': ['error'],
			'no-proto': ['warn'],
			'no-self-compare': ['error'],
			'no-sequences': ['error'],
			'no-shadow-restricted-names': ['error'],
			'no-template-curly-in-string': ['warn'],
			'no-throw-literal': ['error'],
			'no-undef-init': ['error'],
			'no-unmodified-loop-condition': ['error'],
			'no-use-before-define': ['error', {
				'functions': false,
				'classes': false
			}],
			'no-useless-call': ['warn'],
			'no-useless-concat': ['warn'],
			'no-useless-return': ['warn'],
			'no-void': ['error'],
			'no-warning-comments': ['warn'],
			'no-with': ['error'],
			'radix': ['error'],
			'require-await': ['warn'],
			'yoda': ['warn'],

			'arrow-body-style': ['warn', 'as-needed'],
			'no-duplicate-imports': ['error'],
			'no-useless-computed-key': ['error'],
			'no-useless-constructor': ['error'],
			'no-useless-rename': ['error'],
			'no-var': ['error'],
			'no-cond-assign': ['warn'],
			'object-shorthand': ['warn'],
			'prefer-arrow-callback': ['warn', {'allowUnboundThis': true}],
			'prefer-const': ['warn', {'ignoreReadBeforeAssign': true}],
			'prefer-rest-params': ['warn'],
			'prefer-spread': ['error'],
			'prefer-template': ['warn'],

			// Formatting rules were removed from ESLint core (and the JSX ones
			// from eslint-plugin-react no longer run on ESLint 10). They live
			// in @stylistic now, with the same options as before.
			'@stylistic/arrow-parens': ['warn', 'as-needed'],
			'@stylistic/arrow-spacing': ['warn'],
			'@stylistic/generator-star-spacing': ['warn'],
			'@stylistic/rest-spread-spacing': ['error', 'never'],
			'@stylistic/yield-star-spacing': ['warn'],
			'@stylistic/indent': [
				'warn',
				'tab',
				{
					'SwitchCase': 1
				}
			],
			'@stylistic/linebreak-style': [
				'error',
				'unix'
			],
			'@stylistic/quotes': [
				'error',
				'single',
				{
					'avoidEscape': true,
					'allowTemplateLiterals': 'always'
				}
			],
			'@stylistic/jsx-quotes': ['error', 'prefer-double'],
			'@stylistic/jsx-closing-bracket-location': ['error', 'line-aligned'],
			'@stylistic/jsx-equals-spacing': 'error',
			'@stylistic/jsx-first-prop-new-line': ['error', 'multiline-multiprop'],
			'@stylistic/jsx-indent-props': ['warn', 'tab'],
			'@stylistic/jsx-tag-spacing': ['error', {
				'beforeClosing': 'never'
			}],
			'@stylistic/jsx-wrap-multilines': 'error',

			'vue/html-indent': [
				'warn',
				'tab'
			],
			'vue/valid-template-root': 'off',
			'vue/max-attributes-per-line': 'off',
			'vue/require-prop-types': 'off',
			'vue/require-default-prop': 'off',
			'vue/html-closing-bracket-newline': [
				'error',
				{
					'singleline': 'never',
					'multiline': 'always'
				}
			],

			// Semantic JSX rules stay on eslint-plugin-react.
			'react/jsx-boolean-value': 'error',
			'react/jsx-no-bind': 'error',
			'react/jsx-no-comment-textnodes': 'error',
			'react/jsx-no-duplicate-props': 'error',
			'react/jsx-no-target-blank': 'error',
			'react/jsx-sort-props': ['error', {
				'callbacksLast': true,
				'reservedFirst': true,
				'noSortAlphabetically': true
			}],
			'react/jsx-uses-react': 'error'
			// Dropped: react/jsx-filename-extension (crashes on ESLint 10),
			// valid-jsdoc (removed in ESLint 9), no-catch-shadow and
			// no-return-await (deprecated as obsolete).
		}
	}
];
