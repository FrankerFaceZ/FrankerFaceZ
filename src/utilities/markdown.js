'use strict';

import {parse as parse_path} from 'utilities/path-parser';

let MD, MILA, waiters;
let _md;

function loadMD() {
	if ( MD )
		return Promise.resolve(MD);

	return new Promise((s,f) => {
		if ( waiters )
			return waiters.push([s,f]);

		waiters = [[s,f]];

		Promise.all([
			import(/* webpackChunkName: 'markdown' */ 'markdown-it'),
			import(/* webpackChunkName: 'markdown' */ 'markdown-it-link-attributes')
		]).then(modules => {
			console.log('loaded', modules);

			MD = modules[0]?.default;
			MILA = modules[1]?.default;

			const waited = waiters;
			waiters = null;

			for(const pair of waited)
				pair[0](MD);

		}).catch(err => {
			const waited = waiters;
			waiters = null;

			for(const pair of waited)
				pair[1](err);
		});
	});
}


function SettingsLinks(md) {
	const default_render = md.renderer.rules.link_open || this.defaultRender;

	md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
		const token = tokens[idx];
		if ( token && token.type === 'link_open' && Array.isArray(token.attrs) ) {
			let href;
			for(const attr of token.attrs) {
				if ( attr[0] === 'href' ) {
					href = attr[1];
					break;
				}
			}

			if ( href.startsWith('~') ) {
				let path;

				if ( href === '~' ) {
					// We don't have a path, make one from the bits.
					let i = idx + 1;
					let bits = [];

					while(i < tokens.length) {
						const tok = tokens[i],
							type = tok?.type;
						if ( type === 'text' )
							bits.push(tok);
						else if ( type === 'link_close' )
							break;

						i++;
					}

					bits = bits.map(x => x.content).join('');
					const toks = parse_path(bits);
					path = toks.map(x => x.key).join('.');
				} else
					path = href.slice(1);

				if ( path && path.length ) {
					for(const attr of token.attrs) {
						if ( attr[0] === 'class' ) {
							attr[1] = attr[1].replace(/ffz-tooltip/g, '');
							break;
						}
					}

					token.attrs.push([
						'data-settings-link',
						path
					]);
					token.attrs.push([
						'onclick',
						'FrankerFaceZ.get().resolve("main_menu").mdNavigate(this);return false'
					]);
				}
			}
		}

		return default_render(tokens, idx, options, env, self);
	}
}

SettingsLinks.defaultRender = function(tokens, idx, options, env, self) {
	return self.renderToken(tokens, idx, options);
}

export default async function awaitMD() {
	if ( ! _md ) {
		const MD = await loadMD();
		if ( ! MD )
			return null;

		const md = _md = new MD({
			html: false,
			linkify: true
		});

		md.use(SettingsLinks);
		md.use(MILA, {
			attrs: {
				class: 'ffz-tooltip',
				target: '_blank',
				rel: 'noopener',
				'data-tooltip-type': 'link'
			}
		});
	}

	return _md;
}

export function getMD(callback) {
	if ( _md )
		return _md;

	if ( callback )
		awaitMD().then(md => callback(md));
}