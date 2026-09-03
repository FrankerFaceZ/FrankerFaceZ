'use strict';

import {sanitize, createElement} from 'utilities/dom';

import {NoContent} from 'utilities/tooltip';
import {NEW_LINK_REGEX} from './constants';

// ============================================================================
// Links
// ============================================================================

function datasetBool(value) {
	return value == null ? null : value === 'true';
}

export const Links = {
	type: 'link',
	priority: 50,

	component: () => import(/* webpackChunkName: 'vue-chat' */ '../components/chat-link.vue'),

	render(token, createElement) {
		return (<a
			class="ffz-tooltip link-fragment"
			data-tooltip-type="link"
			data-url={token.url}
			data-is-mail={token.is_mail}
			rel="noopener noreferrer"
			target="_blank"
			href={token.url}
			onClick={this.handleLinkClick}
		>{token.text}</a>);
	},

	tooltip(target, tip) {
		if ( ! this.context.get('tooltip.rich-links') && ! target.dataset.forceTooltip )
			return NoContent;

		if ( target.dataset.isMail === 'true' )
			return [this.i18n.t('tooltip.email-link', 'E-Mail {address}', {address: target.textContent})];

		const url = target.dataset.url || target.href,
			show_images = datasetBool(target.dataset.forceMedia) ?? this.context.get('tooltip.link-images'),
			show_unsafe = datasetBool(target.dataset.forceUnsafe) ?? this.context.get('tooltip.link-nsfw-images');

		return Promise.all([
			import(/* webpackChunkName: 'rich_tokens' */ 'utilities/rich_tokens'),
			this.get_link_info(url)
		]).then(([rich_tokens, data]) => {
			if ( ! data || (data.v || 1) > rich_tokens.VERSION )
				return '';

			const ctx = {
				tList: (...args) => this.i18n.tList(...args),
				i18n: this.i18n,

				fragments: data.fragments,
				i18n_prefix: data.i18n_prefix,

				tooltip: true,

				allow_media: show_images,
				allow_unsafe: show_unsafe,
				onload: () => requestAnimationFrame(() => tip.update())
			};

			let content;
			if ( tip.element ) {
				tip.element.classList.add('ffz-rich-tip');
				tip.element.classList.add('tw-align-left');
			}

			if ( tip.outer && data.accent ) {
				tip.outer.classList.add('ffz-accent-tip');
				tip.outer.style.setProperty('--ffz-color-accent', data.accent);
			}

			if ( data.full ) {
				content = rich_tokens.renderTokens(data.full, createElement, ctx);

			} else if ( data.mid ) {
				content = rich_tokens.renderTokens(data.mid, createElement, ctx);

			} else if ( data.short ) {
				content = rich_tokens.renderTokens(data.short, createElement, ctx);

			} else
				content = this.i18n.t('card.empty', 'No data was returned.');

			if ( ! data.urls )
				return content;

			const url_table = [];
			for(let i=0; i < data.urls.length; i++) {
				const url = data.urls[i];

				url_table.push(<tr>
					<td>{this.i18n.formatNumber(i + 1)}.</td>
					<td class="tw-c-text-alt-2 tw-pd-x-05 tw-word-break-all">{url.url}</td>
					<td>{url.flags ? url.flags.map(flag => <span class="ffz-pill">{flag.toLowerCase()}</span>) : null}</td>
				</tr>);
			}

			let url_notice;
			if ( data.unsafe ) {
				const reasons = Array.from(new Set(data.urls.map(url => url.flags).flat())).join(', ');
				url_notice = (<div class="ffz-i-attention">
					{this.i18n.tList(
						'tooltip.link-unsafe',
						'Caution: This URL is has been flagged as potentially harmful by: {reasons}',
						{reasons: reasons.toLowerCase()}
					)}
				</div>);
			} else if ( data.urls.length > 1 )
				url_notice = this.i18n.t('tooltip.link-destination', 'Destination: {url}', {
					url: data.urls[data.urls.length-1].url
				});

			content = (<div>
				<div class="ffz--shift-hide">
					{content}
					{url_notice ? <div class="tw-mg-t-05 tw-border-t tw-pd-t-05 tw-align-center">
						{url_notice}
						<div class=" ffz-font-size-8">
							{this.i18n.t('tooltip.shift-detail', '(Shift for Details)')}
						</div>
					</div> : null}
				</div>
				<div class="ffz--shift-show tw-align-left">
					<div class="tw-semibold tw-mg-b-05 tw-align-center">
						{this.i18n.t('tooltip.link.urls', 'Visited URLs')}
					</div>
					<table>{url_table}</table>
				</div>
			</div>);

			return content;

		}).catch(error => {
			console.error(error);
			return sanitize(this.i18n.t('tooltip.error', 'An error occurred. ({error})', {error}))
		});
	},

	process(tokens) {
		if ( ! tokens || ! tokens.length )
			return;

		const out = [];
		for(const token of tokens) {
			if ( token.type !== 'text' ) {
				out.push(token);
				continue;
			}

			NEW_LINK_REGEX.lastIndex = 0;
			const text = token.text;
			let idx = 0, match;

			while((match = NEW_LINK_REGEX.exec(text))) {
				const nix = match.index;
				if ( idx !== nix )
					out.push({type: 'text', text: text.slice(idx, nix)});

				let url = match[0];
				if ( url.endsWith(')') ) {
					let open = 1, i = url.length - 1;
					while(i--) {
						const chr = url[i];
						if ( chr === ')' )
							open++;
						else if ( chr === '(' )
							open--;

						if ( ! open )
							break;
					}

					if ( open )
						url = url.slice(0, url.length - 1);
				}

				out.push({
					type: 'link',
					url: `${match[1] ? '' : 'https://'}${url}`,
					is_mail: false,
					text: url
				});

				idx = nix + url.length;
			}

			if ( idx < text.length )
				out.push({type: 'text', text: text.slice(idx)});
		}

		return out;
	}
}

Links.tooltip.interactive = function(target) {
	if ( ! this.context.get('tooltip.rich-links') || ! this.context.get('tooltip.link-interaction') || target.dataset.isMail === 'true' )
		return false;

	const info = this.get_link_info(target.dataset.url, true);
	return info && info.interactive;
};

Links.tooltip.delayHide = function(target) {
	if ( ! this.context.get('tooltip.rich-links') || target.dataset.isMail === 'true' )
		return 0;

	return 64;
};
