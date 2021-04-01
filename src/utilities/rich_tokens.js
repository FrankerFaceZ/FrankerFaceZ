'use strict';

// ============================================================================
// Rich Content Tokens
// ============================================================================

import {has} from 'utilities/object';
import Markdown from 'markdown-it';
import MILA from 'markdown-it-link-attributes';

export const TOKEN_TYPES = {};

const validate = (input, valid) => valid.includes(input) ? input : null;

const VALID_WEIGHTS = ['regular', 'bold', 'semibold'],
	VALID_COLORS = ['base', 'alt', 'alt-2', 'link'],
	VALID_SIZES = ['1', '2,' ,'3','4','5','6','7','8'],
	VALID_WRAPS = ['nowrap', 'pre-wrap'],

	VALID_PADDING = {
		small: '05',
		normal: '1',
		large: '2',
		huge: '3'
	};


// ============================================================================
// Markdown
// ============================================================================

const md = new Markdown({
	html: false,
	linkify: true
}).disable('image');

md.use(MILA, {
	attrs: {
		class: 'ffz-tooltip',
		target: '_blank',
		rel: 'noopener',
		'data-tooltip-type': 'link'
	}
});


// ============================================================================
// Render Tokens
// ============================================================================

function applySpacing(term, token, classes, styles) {
	for(const mode of ['', '-x','-y','-t','-r','-b','-l']) {
		const key = `${term}${mode}`,
			value = token[key];
		if ( value ) {
			if ( VALID_PADDING[value] )
				classes.push(`tw-${term}${mode}-${VALID_PADDING[value]}`);
			else if ( styles ) {
				const thing = term === 'pd' ? 'padding' : 'margin';
				if ( mode === '' )
					styles[thing] = value;
				if ( mode === 'x' || mode === 'l' )
					styles[`${thing}-left`] = value;

				if ( mode === 'x' || mode === 'r' )
					styles[`${thing}-right`] = value;

				if ( mode === 'y' || mode === 't' )
					styles[`${thing}-top`] = value;

				if ( mode === 'y' || mode === 'b' )
					styles[`${thing}-bottom`] = value;
			}
		}
	}
}


export function getRoundClass(value) {
	let klass;
	if ( value === -1 )
		klass = 'rounded';
	else if ( value === 1 )
		klass = 'small';
	else if ( value === 2 )
		klass = 'medium';
	else if ( value === 3 )
		klass = 'large';
	return klass ? `tw-border-radius-${klass}` : '';
}


// TODO: Mess with this more.
// (It's a function for wrapping React's createElement in a function
// that accepts the same input as Vue's createElement, letting us
// deduplicate a ton of code in here.)
/*export function wrapReactCreate(createElement) {
	return (tag, opts, children) => {
		if ( typeof tag !== 'string' )
			throw new Error('invalid tag');

		if ( opts ) {
			if ( opts.class ) {
				if ( typeof opts.class === 'string' )
					opts.className = opts.class;
				else if ( Array.isArray(opts.class) )
					opts.className = opts.class.join(' ');
				else if ( typeof opts.class === 'object' ) {
					const bits = [];
					for(const [key, val] of Object.entries(opts.class))
						if ( val )
							bits.push(key);

					opts.className = bits.join(' ');
				}

				opts.class = undefined;
			}

			if ( opts.attrs ) {
				for(const [key, val] of Object.entries(opts.attrs) )
					opts[key] = val;

				opts.attrs = undefined;
			}

			if ( opts.props )
				throw new Error('props unsupported');

			if ( opts.domProps )
				throw new Error('domProps unsupported');

			if ( opts.nativeOn )
				throw new Error('nativeOn unsupported');

			if ( opts.on ) {
				for(const [key, val] of Object.entries(opts.on) )
					opts[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = val;

				opts.on = undefined;
			}

			if ( opts.style && typeof opts.style !== 'object' )
				opts.style = undefined;
		}

		return createElement(tag, opts, children);
	}
}*/


export function renderWithCapture(tokens, createElement, ctx, markdown) {
	const old_capture = ctx.text_capture, old_markdown = ctx.markdown;
	ctx.text_capture = [];

	if ( markdown )
		ctx.markdown = true;

	const content = renderTokens(tokens, createElement, ctx);

	let title = ctx.text_capture.join('').trim();
	if ( ! title.length )
		title = null;

	ctx.text_capture = old_capture;
	ctx.markdown = old_markdown;

	return {
		content,
		title
	}
}

export function renderTokens(tokens, createElement, ctx, markdown) {
	if ( tokens == null )
		return null;

	const old_markdown = ctx.markdown;
	if ( markdown )
		ctx.markdown = true;

	let out = [];
	if ( ! Array.isArray(tokens) )
		tokens = [tokens];

	for(const token of tokens) {
		if ( token == null )
			continue;

		else if ( Array.isArray(token) )
			out = out.concat(renderTokens(token, createElement, ctx));

		else if ( typeof token !== 'object' ) {
			const val = String(token);
			if ( ctx.text_capture )
				ctx.text_capture.push(val);

			if ( ctx.markdown ) {
				const content = md.render(val);
				if ( content === val )
					out.push(val);
				else if ( ctx.vue )
					out.push(createElement('span', {
						domProps: {
							innerHTML: content
						}
					}));
				else
					out.push(createElement('span', {
						dangerouslySetInnerHTML: {
							__html: content
						}
					}));

			} else
				out.push(val);
		}

		else {
			const type = token.type,
				handler = TOKEN_TYPES[type];

			if ( ! handler ) {
				console.warn('Skipping unknown token type', type, token);
				continue;
			}

			const result = handler(token, createElement, ctx);
			if ( Array.isArray(result) )
				out = out.concat(result);
			else if ( result )
				out.push(result);
		}
	}

	ctx.markdown = old_markdown;
	if ( ! out.length )
		return null;

	return out;
}

export default renderTokens;


// ============================================================================
// Token Type: Box
// ============================================================================

TOKEN_TYPES.box = function(token, createElement, ctx) {
	const classes = [], style = {};

	if ( VALID_WRAPS.includes(token.wrap) )
		classes.push(`tw-white-space-${token.wrap}`);

	if ( token.ellipsis )
		classes.push('tw-ellipsis');

	if ( token.lines ) {
		classes.push('ffz--line-clamp');
		style['--ffz-lines'] = token.lines;
	}

	applySpacing('pd', token, classes, style);
	applySpacing('mg', token, classes, style);

	const capture = token.ellipsis || token.lines,
		markdown = token.markdown;
	let content, title = null;

	if ( capture ) {
		const out = renderWithCapture(token.content, createElement, ctx, markdown);
		content = out.content; title = out.title;
	} else
		content = renderTokens(token.content, createElement, ctx, markdown);

	if ( ctx.vue )
		return createElement('div', {class: classes, style, attrs: {title}}, content);

	return createElement('div', {className: classes.join(' '), style, title}, content);
}



// ============================================================================
// Token Type: Conditional
// ============================================================================

TOKEN_TYPES.conditional = function(token, createElement, ctx) {
	let passed = true;

	if ( has(token, 'media') && token.media != ctx.allow_media )
		passed = false;

	if ( token.nsfw && ! ctx.allow_unsafe )
		passed = false;

	if ( passed )
		return renderTokens(token.content, createElement, ctx);

	return renderTokens(token.alternative, createElement, ctx);
}


// ============================================================================
// Token Type: Fieldset
// ============================================================================

TOKEN_TYPES.fieldset = function(token, createElement, ctx) {
	if ( ! Array.isArray(token.fields) )
		return null;

	const fields = [];
	for(const field of token.fields) {
		if ( ! field )
			continue;


		const name = renderTokens(field.name, createElement, ctx, token.markdown),
			value = renderTokens(field.value, createElement, ctx, token.markdown);

		if ( name == null || value == null )
			continue;

		if ( ctx.vue )
			fields.push(createElement('div', {
				class: [
					'ffz--field',
					field.inline ? 'ffz--field-inline' : false
				]
			}, [
				createElement('div', {
					class: 'ffz--field__name tw-semibold'
				}, name),
				createElement('div', {
					class: 'ffz--field__value tw-c-text-alt'
				}, value)
			]));
		else
			fields.push(createElement('div', {
				className: `ffz--field ${field.inline ? 'ffz--field-inline' : ''}`
			}, [
				createElement('div', {className: 'ffz--field__name tw-semibold'}, name),
				createElement('div', {className: 'ffz--field__value tw-c-text-alt'}, value)
			]));
	}

	if ( ! fields.length )
		return null;

	if ( ctx.vue )
		return createElement('div', {
			class: 'ffz--fields'
		}, fields);

	return createElement('div', {
		className: 'ffz--fields'
	}, fields);
}


// ============================================================================
// Token Type: Flex
// ============================================================================

const ALIGNMENTS = ['start', 'end', 'center', 'between', 'around'];

TOKEN_TYPES.flex = function(token, createElement, ctx) {
	const classes = [], style = {};

	if ( token.inline )
		classes.push('tw-flex-inline');
	else
		classes.push('tw-flex');

	const overflow = validate(token.overflow, ['hidden', 'auto']);
	if ( overflow )
		classes.push(`tw-overflow-${overflow}`);

	const direction = validate(token.direction, ['column', 'row', 'column-reverse', 'row-reverse']);
	if ( direction )
		classes.push(`tw-flex-${direction}`);

	const wrap = validate(token.wrap, ['wrap', 'nowrap', 'wrap-reverse']);
	if ( wrap )
		classes.push(`tw-flex-${wrap}`);

	let align = validate(token['align-content'], ALIGNMENTS)
	if ( align )
		classes.push(`tw-align-content-${align}`);

	align = validate(token['justify-content'], ALIGNMENTS);
	if ( align )
		classes.push(`tw-justify-content-${align}`);

	align = validate(token['align-items'], ALIGNMENTS)
	if ( align )
		classes.push(`tw-align-items-${align}`);

	align = validate(token['align-self'], ALIGNMENTS)
	if ( align )
		classes.push(`tw-align-self-${align}`);

	applySpacing('pd', token, classes, style);
	applySpacing('mg', token, classes, style);

	const content = renderTokens(token.content, createElement, ctx, token.markdown);
	if ( ctx.vue )
		return createElement('div', {class: classes, style}, content);

	return createElement('div', {className: classes.join(' '), style}, content);
}

// ============================================================================
// Token Type: Format
// ============================================================================

TOKEN_TYPES.format = function(token, createElement, ctx) {
	const type = token.format, val = token.value, opt = token.options;

	let out;

	if ( type === 'date' )
		out = ctx.i18n.formatDate(val, opt);
	else if ( type === 'time' )
		out = ctx.i18n.formatTime(val, opt);
	else if ( type === 'datetime' )
		out = ctx.i18n.formatDateTime(val, opt)
	else if ( type === 'relative' )
		out = ctx.i18n.toRelativeTime(val, opt);
	else if ( type === 'duration' )
		out = ctx.i18n.formatDuration(val, opt);
	else if ( type === 'number' )
		out = ctx.i18n.formatNumber(val, opt);
	else {
		console.warn('Unknown format type:', type);
		out = String(val);
	}

	if ( ctx.text_capture )
		ctx.text_capture.push(out);

	return out;
}


// ============================================================================
// Token Type: Gallery
// ============================================================================

TOKEN_TYPES.gallery = function(token, createElement, ctx) {
	if ( ! token.items )
		return null;

	let items = token.items.map(item => renderTokens(item, createElement, ctx)).filter(x => x);
	if ( ! items.length )
		return null;

	if ( items.length > 4 )
		items = items.slice(0, 4);

	const divisions = [],
		count = items.length < 4 ? 1 : 2;

	divisions.push(ctx.vue ?
		createElement('div', {
			class: 'ffz--gallery-column',
			attrs: {
				'data-items': count
			}
		}, items.slice(0, count)) :
		createElement('div', {
			className: 'ffz--gallery-column',
			'data-items': count
		}, items.slice(0, count))
	);

	if ( items.length > 1 )
		divisions.push(ctx.vue ?
			createElement('div', {
				class: 'ffz--gallery-column',
				attrs: {
					'data-items': items.length - count
				}
			}, items.slice(count)) :
			createElement('div', {
				className: 'ffz--gallery-column',
				'data-items': items.length - count
			}, items.slice(count))
		);

	if ( ctx.vue )
		return createElement('div', {
			class: 'ffz--rich-gallery',
			attrs: {
				'data-items': items.length
			}
		}, divisions);

	return createElement('div', {
		className: 'ffz--rich-gallery',
		'data-items': items.length
	}, divisions);
}


// ============================================================================
// Token Type: Heading
// ============================================================================

function header_vue(token, h, ctx) {
	let content = [];

	if ( token.title ) {
		const out = renderWithCapture(token.title, h, ctx, token.markdown);
		content.push(h('div', {
			class: 'tw-ellipsis tw-semibold tw-mg-x-05',
			attrs: {
				title: out.title
			}
		}, out.content));
	}

	if ( token.subtitle ) {
		const out = renderWithCapture(token.subtitle, h, ctx, token.markdown);
		content.push(h('div', {
			class: 'tw-ellipsis tw-c-text-alt-2 tw-mg-x-05',
			attrs: {
				title: out.title
			}
		}, out.content));
	}

	if ( token.extra ) {
		const out = renderWithCapture(token.extra, h, ctx, token.markdown);
		content.push(h('div', {
			class: 'tw-ellipsis tw-c-text-alt-2 tw-mg-x-05',
			attrs: {
				title: out.title
			}
		}, out.content));
	}

	content = h('div', {
		class: [
			'tw-flex tw-full-width tw-overflow-hidden',
			token.compact ? 'ffz--rich-header ffz--compact-header tw-align-items-center' : 'tw-justify-content-center tw-flex-column tw-flex-grow-1'
		]
	}, content);

	if ( token.image ) {
		const aspect = token.image.aspect;

		let image = render_image({
			...token.image,
			aspect: undefined
		}, h, ctx);
		const right = token.image_side === 'right';

		if ( image ) {
			image = h('div', {
				class: [
					'ffz--header-image tw-flex-shrink-0 tw-mg-x-05',
					aspect ? 'ffz--header-aspect' : null
				],
				style: {
					width: aspect ? `${aspect * (token.compact ? 2.4 : 4.8)}rem` : null
				}
			}, [image]);

			if ( token.compact ) {
				if ( right )
					content.children.push(image);
				else
					content.children.unshift(image);

			} else {
				content = h('div', {
					class: 'tw-flex ffz--rich-header'
				}, [
					right ? content : null,
					image,
					right ? null : content
				])
			}

		} else if ( ! token.compact )
			content = h('div', {
				class: 'tw-flex ffz--rich-header'
			}, [
				h('div', {class: 'ffz--header-image tw-mg-x-05'}),
				content
			]);

	} else if ( ! token.compact )
		content = h('div', {
			class: 'tw-flex ffz--rich-header'
		}, [
			h('div', {class: 'ffz--header-image tw-mg-x-05'}),
			content
		]);

	return content;
}

function header_normal(token, createElement, ctx) {
	let content = [];

	if ( token.title ) {
		const out = renderWithCapture(token.title, createElement, ctx, token.markdown);
		content.push(createElement('div', {
			className: `tw-ellipsis tw-semibold ${token.compact ? 'tw-mg-r-1' : ''}`,
			title: out.title
		}, out.content));
	}

	if ( token.subtitle ) {
		const out = renderWithCapture(token.subtitle, createElement, ctx, token.markdown);
		content.push(createElement('div', {
			className: `tw-ellipsis tw-c-text-alt-2`,
			title: out.title
		}, out.content));
	}

	if ( token.extra ) {
		const out = renderWithCapture(token.extra, createElement, ctx, token.markdown);
		content.push(createElement('div', {
			className: 'tw-ellipsis tw-c-text-alt-2',
			title: out.title
		}, out.content));
	}

	content = createElement('div', {
		className: `tw-flex tw-full-width tw-overflow-hidden ${token.compact ? 'ffz--rich-header ffz--compact-header tw-align-items-center' : 'tw-justify-content-center tw-flex-column tw-flex-grow-1'}`
	}, content);

	if ( token.image ) {
		const aspect = token.image.aspect;

		let image = render_image({
			...token.image,
			aspect: undefined
		}, createElement, ctx);
		const right = token.image_side === 'right';

		if ( image ) {
			image = createElement('div', {
				className: `ffz--header-image tw-flex-shrink-0 tw-mg-x-05${aspect ? ' ffz--header-aspect' : ''}`,
				style: {
					width: aspect ? `${aspect * (token.compact ? 2.4 : 4.8)}rem` : null
				}
			}, image);

			if ( token.compact ) {
				// We need to do some weird pushy stuff~
				// This varies if we're running with React or native.
				if ( content instanceof Node ) {
					if ( right )
						content.appendChild(image);
					else
						content.insertBefore(image, content.firstChild);
				} else {
					console.warn('Add React support!');
					console.log(content);
				}

			} else {
				content = createElement('div', {
					className: 'tw-flex ffz--rich-header'
				}, [right ? content : null, image, right ? null : content])
			}
		} else if ( ! token.compact )
			content = createElement('div', {
				className: 'tw-flex ffz--rich-header'
			}, [
				createElement('div', {className: 'ffz--header-image tw-mg-x-05'}),
				content
			]);

	} else if ( ! token.compact )
		content = createElement('div', {
			className: 'tw-flex ffz--rich-header'
		}, [
			createElement('div', {className: 'ffz--header-image tw-mg-x-05'}),
			content
		]);

	return content;

}

TOKEN_TYPES.header = function(token, createElement, ctx) {
	if ( ! token.title && ! token.subtitle && ! token.image && ! token.extra )
		return null;

	return ctx.vue ?
		header_vue(token, createElement, ctx) :
		header_normal(token, createElement, ctx);
}


// ============================================================================
// Token Type: Icon
// ============================================================================

TOKEN_TYPES.icon = function(token, createElement, ctx) {
	if ( ! token.name )
		return null;

	return ctx.vue ?
		createElement('span', {class: `ffz-i-${token.name}`}) :
		createElement('span', {className: `ffz-i-${token.name}`});
}


// ============================================================================
// Token Type: Image
// ============================================================================

function render_image(token, createElement, ctx) {
	if ( ! token.url || (has(token, 'sfw') && ! token.sfw && ! ctx.allow_unsafe) )
		return null;

	const round = getRoundClass(token.rounding);
	let aspect;
	if ( token.aspect )
		aspect = token.aspect
	else if ( token.height > 0 && token.width > 0 )
		aspect = token.width / token.height;

	if ( ctx.vue ) {
		const stuff = {
			class: [
				token.class,
				round
			],

			style: {
				width: token.width,
				height: token.height
			},

			attrs: {
				src: token.url,
				title: token.title
			}
		};

		if ( ctx.onload )
			stuff.on = {load: ctx.onload};

		const image = createElement('img', stuff);

		if ( ! aspect )
			return image;

		return createElement('aspect', {
			props: {
				ratio: aspect,
				align: 'center'
			}
		}, [image]);
	}

	const image = createElement('img', {
		className: `${token.class || ''} ${round}`,
		src: token.url,
		title: token.title || '',
		onLoad: ctx.onload
	});

	if ( ! aspect )
		return image;

	return createElement('div', {
		className: 'ffz-aspect ffz-aspect--align-center'
	}, [
		createElement('div', {
			className: 'ffz-aspect__spacer',
			style: {
				paddingTop: `${100 * (1 / (aspect || 1))}%`
			}
		}),
		image
	]);
}

TOKEN_TYPES.image = render_image;


// ============================================================================
// Token Type: I18n
// ============================================================================

TOKEN_TYPES.i18n = function(token, createElement, ctx) {
	if ( ! token.phrase ) {
		console.warn('Skipping i18n tag with no phrase');
		return null;
	}

	return renderTokens(
		ctx.i18n.tList(token.key, token.phrase, token.content),
		createElement,
		ctx,
		token.markdown
	);
}


// ============================================================================
// Token Type: Link
// ============================================================================

TOKEN_TYPES.link = function(token, createElement, ctx) {
	const content = renderTokens(token.content, createElement, ctx, token.markdown);

	const klass = [];
	if ( token.interactive )
		klass.push(`ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive`);

	if ( token.tooltip !== false )
		klass.push('ffz-tooltip');

	if ( token.embed )
		klass.push(`tw-block tw-border tw-border-radius-large tw-mg-y-05 tw-pd-05`);

	if ( token.no_color )
		klass.push(`ffz-link--inherit`);

	if ( ctx.vue )
		return createElement('a', {
			class: klass,
			attrs: {
				rel: 'noopener noreferrer',
				target: '_blank',
				'data-tooltip-type': 'link',
				href: token.url
			}
		}, content);

	return createElement('a', {
		className: klass.join(' '),
		rel: 'noopener noreferrer',
		target: '_blank',
		'data-tooltip-type': 'link',
		href: token.url
	}, content);
}


// ============================================================================
// Token Type: Overlay
// ============================================================================

TOKEN_TYPES.overlay = function(token, createElement, ctx) {
	const content = renderTokens(token.content, createElement, ctx, token.markdown);
	if ( ! content )
		return null;

	const corners = [];
	for(const corner of ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']) {
		const stuff = renderTokens(token[corner], createElement, ctx, token.markdown);
		if ( stuff )
			corners.push(ctx.vue ?
				createElement('div', {class: `ffz--overlay__bit`, attrs:{'data-side':corner}}, stuff) :
				createElement('div', {className: `ffz--overlay__bit`, 'data-side':corner}, stuff)
			);
	}

	const classes = ['ffz--overlay'];
	const style = {};

	if ( token.background ) {
		if ( VALID_COLORS.includes(token.background) )
			classes.push(`tw-c-background-${token.background}`);
		else
			style.backgroundColor = token.background;
	}

	if ( token.color ) {
		if ( VALID_COLORS.includes(token.color) )
			classes.push(`tw-c-text-${token.color}`);
		else
			style.color = token.color;
	}

	if ( ctx.vue )
		return createElement('div', {
			class: classes,
			style
		}, [
			createElement('div', {class: 'ffz--overlay__content'}, content),
			...corners
		]);

	return createElement('div', {
		className: classes.join(' '),
		style
	}, [
		createElement('div', {className: 'ffz--overlay__content'}, content),
		...corners
	]);
}


// ============================================================================
// Token Type: Style
// ============================================================================

TOKEN_TYPES.style = function(token, createElement, ctx) {
	const classes = [], style = {};

	if ( token.weight ) {
		if ( VALID_WEIGHTS.includes(token.weight) )
			classes.push(`tw-${token.weight}`);
		else
			style.weight = token.weight;
	}

	if ( token.italic )
		classes.push('tw-italic');

	if ( token.strike )
		classes.push('tw-strikethrough');

	if ( token.underline )
		classes.push('tw-underline');

	if ( token.tabular )
		classes.push('tw-tabular-nums');

	if ( token.size ) {
		if ( typeof token.size === 'string' ) {
			if ( VALID_SIZES.includes(token.size) )
				classes.push(`tw-font-size-${token.size}`);
			else
				style.fontSize = token.size;
		} else
			style.fontSize = `${token.size}px`;
	}

	if ( token.color ) {
		if ( VALID_COLORS.includes(token.color) )
			classes.push(`tw-c-text-${token.color}`);
		else
			style.color = token.color;
	}

	if ( VALID_WRAPS.includes(token.wrap) )
		classes.push(`tw-white-space-${token.wrap}`);

	if ( token.ellipsis )
		classes.push('tw-ellipsis');

	applySpacing('pd', token, classes, style);
	applySpacing('mg', token, classes, style);

	const capture = token.ellipsis;
	let content, title = null;

	if ( capture ) {
		const out = renderWithCapture(token.content, createElement, ctx, token.markdown);
		content = out.content; title = out.title;
	} else
		content = renderTokens(token.content, createElement, ctx, token.markdown);

	if ( ctx.vue )
		return createElement('span', {class: classes, style, attrs: {title}}, content);

	return createElement('span', {className: classes.join(' '), style, title}, content);
}


// ============================================================================
// Token Type: Tag (Deprecated)
// ============================================================================

export const ALLOWED_TAGS = [
	'a', 'abbr', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'blockquote', 'br',
	'caption', 'code', 'col', 'colgroup', 'data', 'dd', 'div', 'dl', 'dt', 'em',
	'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
	'hr', 'i', 'img', 'li', 'main', 'nav', 'ol', 'p', 'picture', 'pre', 's', 'section',
	'source', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot',
	'th', 'thead', 'time', 'tr', 'track', 'u', 'ul', 'video', 'wbr'
];

export const ALLOWED_ATTRS = {
	a: ['href'],
	audio: ['autoplay', 'controls', 'loop', 'muted', 'preload', 'src'],
	bdo: ['dir'],
	col: ['span'],
	colgroup: ['span'],
	data: ['value'],
	img: ['alt', 'height', 'sizes', 'src', 'srcset', 'width'],
	source: ['src', 'srcset', 'type', 'media', 'sizes'],
	td: ['colspan', 'headers', 'rowspan'],
	th: ['abbr', 'colspan', 'headers', 'rowspan', 'scope'],
	time: ['datetime'],
	track: ['default', 'kind', 'label', 'src', 'srclang'],
	video: ['autoplay', 'controls', 'height', 'loop', 'muted', 'poster', 'preload', 'src', 'width'],
};

export const PROPS = [
	'muted'
];

export const GLOBAL_ATTRS = ['style', 'title'];


TOKEN_TYPES.tag = function(token, createElement, ctx) {
	const tag = String(token.tag || 'span').toLowerCase();
	if ( ! ALLOWED_TAGS.includes(tag) ) {
		console.warn('Skipping disallowed tag:', tag);
		return null;
	}

	const attrs = {}, props = {};
	if ( token.attrs ) {
		const allowed = ALLOWED_ATTRS[tag] || [];
		for(const [key, val] of Object.entries(token.attrs)) {
			if ( ! allowed.includes(key) && ! key.startsWith('data-') && ! GLOBAL_ATTRS.includes(key) )
				console.warn(`Skipping disallowed attribute for tag ${tag}:`, key);
			else if ( ctx.vue && PROPS.includes(key) )
				props[key] = val;
			else
				attrs[key] = val;
		}
	}

	if ( tag === 'img' || tag === 'picture' )
		attrs.onload = ctx.onload;

	if ( tag === 'video' || tag === 'audio' )
		attrs.loadedmetadata = ctx.onload;

	const content = renderTokens(token.content, createElement, ctx, token.markdown);

	if ( ctx.vue )
		return createElement(tag, {
			class: token.class || '',
			domProps: props,
			attrs
		}, content);

	return createElement(tag, {
		...attrs,
		className: token.class || ''
	}, content);
}