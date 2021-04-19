'use strict';

import MD from 'markdown-it';
import MILA from 'markdown-it-link-attributes';
import {parse as parse_path} from 'utilities/path-parser';

let _md;

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

export default function getMD() {
	if ( ! _md ) {
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

