/* globals module */
module.exports = {
	'env': {
		'browser': true,
		'es6': true
	},
	'extends': [
		'eslint:recommended',
		'plugin:vue/recommended'
	],
	'plugins': [
		'vue',
		'react'
	],
	'parserOptions': {
		'parser': 'babel-eslint',
		'ecmaVersion': 8,
		'sourceType': 'module',
		'ecmaFeatures': {
			'jsx': true
		}
	},
	'settings': {
		'react': {
			'pragma': 'createElement'
		}
	},
	'globals': {
		'import': false,
		'require': false,
		'__webpack_hash__': false,
		'__git_commit__': false,
		'__version_major__': false,
		'__version_minor__': false,
		'__version_patch__': false,
		'__version_prerelease__': false,
		'FrankerFaceZ': false
	},
	'rules': {
		'require-atomic-updates': 'off',
		'accessor-pairs': ['error'],
		'block-scoped-var': ['error'],
		'class-methods-use-this': ['error'],
		'for-direction': ['error'],
		'guard-for-in': ['warn'],
		'no-alert': ['error'],
		'no-await-in-loop': ['error'],
		'no-caller': ['error'],
		'no-catch-shadow': ['error'],
		'no-invalid-this': ['error'],
		'no-iterator': ['error'],
		'no-labels': ['error'],
		'no-lone-blocks': ['error'],
		'no-octal-escape': ['error'],
		'no-proto': ['warn'],
		'no-return-await': ['error'],
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
		'valid-jsdoc': ['warn'],
		'yoda': ['warn'],

		'arrow-body-style': ['warn', 'as-needed'],
		'arrow-parens': ['warn', 'as-needed'],
		'arrow-spacing': ['warn'],
		'generator-star-spacing': ['warn'],
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
		'rest-spread-spacing': ['error', 'never'],
		'yield-star-spacing': ['warn'],

		'indent': [
			'warn',
			'tab',
			{
				'SwitchCase': 1
			}
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single',
			{
				'avoidEscape': true,
				'allowTemplateLiterals': true
			}
		],

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

		'jsx-quotes': ['error', 'prefer-double'],
		'react/jsx-boolean-value': 'error',
		'react/jsx-closing-bracket-location': ['error', 'line-aligned'],
		//'react/jsx-closing-tag-location': 'error' -- stupid rule that doesn't allow line-aligned
		'react/jsx-equals-spacing': 'error',
		'react/jsx-filename-extension': 'error',
		'react/jsx-first-prop-new-line': ['error', 'multiline-multiprop'],
		'react/jsx-indent': ['warn', 'tab'],
		'react/jsx-indent-props': ['warn', 'tab'],
		//'react/jsx-key': 'warn',
		'react/jsx-no-bind': 'error',
		'react/jsx-no-comment-textnodes': 'error',
		'react/jsx-no-duplicate-props': 'error',
		'react/jsx-no-target-blank': 'error',
		'react/jsx-sort-props': ['error', {
			'callbacksLast': true,
			'reservedFirst': true,
			'noSortAlphabetically': true
		}],
		'react/jsx-tag-spacing': ['error', {
			'beforeClosing': 'never'
		}],
		'react/jsx-uses-react': 'error',
		'react/jsx-wrap-multilines': 'error'
	}
};