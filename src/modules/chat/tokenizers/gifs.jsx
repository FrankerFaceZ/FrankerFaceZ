'use strict';


// ============================================================================
// Twitch GIFs
// ============================================================================

function getStaticGifUrl(url) {
	try {
		const u = new URL(url);
		u.pathname = u.pathname.replace(/(\.\w+)$/, '_s$1');
		return u.toString();
	} catch(err) {
		return url;
	}
}

export const Gifs = {
	type: 'gif',
	priority: 1000,

	render(token, createElement) {
		const hover = token.anim === 2;

		return (<div class="ffz--gif-embed-wrapper tw-relative">
			<a
				class="ffz--gif-embed"
				rel="noopener noreferrer"
				target="_blank"
				href={token.animUrl}
				onClick={this.handleLinkClick}
			>
				<img
					class={`chat-image ffz--gif-embed__image${hover ? ' ffz-hover-emote' : ''}`}
					src={token.url}
					alt={token.title}
					data-normal-src={hover ? token.staticUrl : undefined}
					data-hover-src={hover ? token.animUrl : undefined}
					onLoad={() => this.emit('chat:image-load')}
				/>
			</a>
			<div class="ffz--gif-report-overlay">
				<button
					class="ffz-tooltip ffz--gif-report-btn"
					data-tooltip-type="html"
					data-title={this.i18n.t('chat.gif.report', 'Report GIF')}
					onClick={e => this.reportGif(e, token)}
				>
					<figure class="ffz-i-flag" />
				</button>
			</div>
		</div>);
	},

	process(tokens, msg) {
		if ( ! msg.ffz_gif )
			return;

		const gif = msg.ffz_gif,
			anim = this.context.get('chat.emotes.animated'),
			static_url = getStaticGifUrl(gif.url);

		if ( ! this.context.get('chat.gifs.enabled') )
			return [{
				type: 'gif-text',
				text: gif.title,
				staticUrl: static_url,
				animUrl: gif.url,
				anim
			}];

		return [{
			type: 'gif',
			url: anim === 0 ? static_url : gif.url,
			staticUrl: static_url,
			animUrl: gif.url,
			anim,
			title: gif.title,
			id: gif.id,
			room_id: msg.roomId,
			user_id: msg.user?.id
		}];
	}
}

export const GifText = {
	type: 'gif-text',
	priority: 1000,

	render(token, createElement) {
		return (<a
			class="ffz-tooltip ffz--gif-text-link"
			rel="noopener noreferrer"
			target="_blank"
			href={token.animUrl}
			data-tooltip-type="gif-text"
			data-gif-url={token.anim === 0 ? token.staticUrl : token.animUrl}
			data-gif-title={token.text}
			onClick={this.handleLinkClick}
		>{token.text}</a>);
	},

	tooltip(target) {
		return [(<img
			class="ffz--gif-text-preview"
			src={target.dataset.gifUrl}
			alt={target.dataset.gifTitle}
		/>)];
	}
}
