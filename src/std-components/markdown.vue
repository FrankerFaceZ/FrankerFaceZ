<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div v-html="output" />
</template>

<script>

import awaitMD, {getMD} from 'utilities/markdown';

// Rendered output, keyed by source. Setting descriptions are static
// strings that come around again on every page visit, profile switch and
// menu reopen, so nearly every render after the first is a lookup.
const CACHE = new Map;
const CACHE_LIMIT = 2000;

// Anything that could be markdown syntax, an entity, or something the
// linkifier would pick up (a scheme, an e-mail, a bare domain). Sources
// without any of these are plain text and don't need the parser at all.
const NEEDS_MD = /[*_`~#>[\]()<&\\|!@-]|:\/\/|\S\.[a-z]{2,}|\n/i;

const ESCAPES = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;'
};

function escapeHTML(text) {
	return text.replace(/[&<>"]/g, chr => ESCAPES[chr]);
}

function render(md, source) {
	if ( ! source )
		return '';

	let output = CACHE.get(source);
	if ( output !== undefined )
		return output;

	if ( ! NEEDS_MD.test(source) )
		output = `<p>${escapeHTML(source)}</p>`;
	else if ( md )
		output = md.render(source);
	else
		return '';

	if ( CACHE.size >= CACHE_LIMIT )
		CACHE.clear();

	CACHE.set(source, output);
	return output;
}

export default {
	props: {
		source: String
	},

	data() {
		return {
			output: ''
		}
	},

	watch: {
		source() {
			this.rebuild();
		}
	},

	created() {
		this.md = getMD();
		this.rebuild();
	},

	methods: {
		rebuild() {
			this.output = render(this.md, this.source);

			// Plain text renders without the parser, so only wait for
			// the markdown chunk when a source actually needs it.
			if ( this.output === '' && this.source && ! this.md && ! this._waiting ) {
				this._waiting = true;
				awaitMD().then(md => {
					this.md = md;
					this._waiting = false;
					this.rebuild();
				}).catch(() => {
					this._waiting = false;
				});
			}
		}
	}
}

</script>