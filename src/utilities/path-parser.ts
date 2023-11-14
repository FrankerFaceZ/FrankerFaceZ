'use strict';

export function parse(path: string) {
	return parseAST({
		path,
		i: 0
	});
}

type ParseContext = {
	path: string;
	i: number;
}

export type PathNode = {
	title: string;
	key: string;
	page: boolean;
	tab: boolean;
}

function parseAST(ctx: ParseContext) {
	const path = ctx.path,
		length = path.length,
		out = [];

	let token: PathNode | null = null,
		raw: string | null = null;

	let old_tab = false,
		old_page = false;

	while ( ctx.i < length ) {
		const start = ctx.i,
			char = path[start],
			next = path[start + 1];

		if ( ! token )
			token = {} as PathNode;

		if ( ! raw )
			raw = '';

		// JSON
		if ( char === '@' && next === '{') {
			ctx.i++;
			const tag = parseJSON(ctx);
			if ( tag )
				Object.assign(token, tag);

			continue;
		}

		// Segment End?
		const tab = char === `~` && next === '>',
			page = char === '>' && next === '>',
			segment = ! page && char === '>';

		if ( ! segment && ! page && ! tab ) {
			raw += char;
			ctx.i++;
			continue;
		}

		// We're at the end of a segment, so push
		// the token out.
		if ( tab || page )
			ctx.i++;

		token.title = raw.trim();
		token.key = token.title.toSnakeCase();

		token.page = old_page;
		token.tab = old_tab;

		old_page = page;
		old_tab = tab;

		out.push(token);
		token = raw = null;
		ctx.i++;
	}

	if ( token && raw ) {
		token.title = raw.trim();
		token.key = token.title.toSnakeCase();
		token.page = old_page;
		token.tab = old_tab;
		out.push(token);
	}

	return out;
}

function parseJSON(ctx: ParseContext) {
	const path = ctx.path,
		length = path.length,

		start = ctx.i;

	ctx.i++;

	const stack = ['{'];
	let string: string | boolean = false;

	while ( ctx.i < length && stack.length ) {
		const start = ctx.i,
			char = path[start];

		if ( string ) {
			if ( char === '\\' ) {
				ctx.i++;
				continue;
			}

			if ( (char === '"' || char === "'") && char === string ) {
				stack.pop();
				string = false;
			}

		} else {
			if ( char === '"' || char === "'" ) {
				string = char;
				stack.push(char);
			}

			if ( char === '{' || char === '[' )
				stack.push(char);

			if ( char === ']' ) {
				if ( stack.pop() !== '[' )
					throw new SyntaxError('Invalid JSON');
			}

			if ( char === '}' ) {
				if ( stack.pop() !== '{' )
					throw new SyntaxError('Invalid JSON');
			}
		}

		ctx.i++;
	}

	return JSON.parse(path.slice(start, ctx.i));
}