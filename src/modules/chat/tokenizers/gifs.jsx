'use strict';


// ============================================================================
// Twitch GIFs
// ============================================================================

export const Gifs = {
	type: 'gif',
	priority: 1000,

	render(token, createElement) {
		return (<a
			class="ffz--gif-embed"
			rel="noopener noreferrer"
			target="_blank"
			href={token.url}
			onClick={this.handleLinkClick}
		>
			<img
				class="chat-image ffz--gif-embed__image"
				src={token.url}
				alt={token.title}
				style={{ maxHeight: '200px' }}
			/>
		</a>);
	},

	process(tokens, msg) {
		if ( ! msg.ffz_gif )
			return;

		return [{
			type: 'gif',
			url: msg.ffz_gif.url,
			title: msg.ffz_gif.title
		}];
	}
}
