const transformSync = require('@babel/core').transformSync;
const type = require('@babel/types');
const traverse = require('@babel/traverse').default;

const fs = require('fs');
const glob = require('glob');

function matchesPattern(member, match, allowPartial = false) {
	if ( ! type.isMemberExpression(member) )
		return false;

	const parts = Array.isArray(match) ? match : match.split('.');
	const nodes = [];

	let node;
	for(node = member; type.isMemberExpression(node); node = node.object)
		nodes.push(node.property);

	nodes.push(node);

	if ( nodes.length < parts.length )
		return false;
	if ( ! allowPartial && nodes.length > parts.length )
		return false;

	for(let i = 0, j = nodes.length - 1; i < parts.length; i++, j--) {
		const node = nodes[j];
		let value;
		if ( type.isIdentifier(node) )
			value = node.name;
		else if ( type.isStringLiteral(node) )
			value = node.value;
		else if ( type.isThisExpression(node) )
			value = 'this';
		else
			return false;

		if ( parts[i] !== value )
			return false;
	}

	return true;
}

const babelOptions = {
	ast: true,
	parserOpts: JSON.parse(fs.readFileSync('.babelrc', 'utf8'))
};

babelOptions.parserOpts.plugins = [
	'jsx',
	'dynamicImport',
	'optionalChaining',
	'objectRestSpread'
]

function getString(node) {
	if ( type.isStringLiteral(node) )
		return node.value;

	if ( type.isTemplateLiteral(node) && (! node.expressions || ! node.expressions.length) && node.quasis && node.quasis.length === 1 )
		return node.quasis[0].value.cooked;

	return null;
}

function extractFromCode(code) {
	const { ast } = transformSync(code, babelOptions);
	const matches = [];

	traverse(ast, {
		CallExpression(path) {
			const callee = path.get('callee');
			if ( ! callee )
				return;

			if ( !( matchesPattern(callee.node, 'this.i18n.t') ||
					matchesPattern(callee.node, 'i18n.t') ||
					matchesPattern(callee.node, 't.i18n.t') ||
					matchesPattern(callee.node, 'this.i18n.tList') ||
					matchesPattern(callee.node, 'i18n.tList') ||
					matchesPattern(callee.node, 't.i18n.tList') ||
					matchesPattern(callee.node, 'this.t') ||
					matchesPattern(callee.node, 'this.tList') ))
				return;

			const key = getString(path.get('arguments.0').node);
			if ( ! key )
				return;

			matches.push({
				key,
				loc: path.node.loc.start,
				phrase: getString(path.get('arguments.1').node)
			});
		}
	})

	return matches;
}

function extractFromFiles(files) {
	const results = [];

	if ( ! Array.isArray(files) )
		files = [files];

	const scannable = new Set;
	for(const thing of files) {
		for(const file of glob.sync(thing, {}))
			scannable.add(file);
	}

	for(const file of scannable) {
		const code = fs.readFileSync(file, 'utf8');
		const matches = extractFromCode(code);
		for(const match of matches) {
			match.source = `${file}:${match.loc.line}:${match.loc.column}`;
			delete match.loc;
			results.push(match);
		}
	}

	return results;
}


const bits = extractFromFiles([
	'src/**/*.js',
	'src/**/*.jsx'
]);

const seen = new Set;
const out = [];

for(const entry of bits) {
	if ( seen.has(entry.key) )
		continue;

	seen.add(entry.key);
	if ( entry.key && entry.phrase )
		out.push({
			key: entry.key,
			phrase: entry.phrase,
			calls: [
				`/${entry.source}`
			]
		});
}

fs.writeFileSync('extracted.json', JSON.stringify(out, null, '\t'));

console.log(`Extracted ${out.length} strings.`);
