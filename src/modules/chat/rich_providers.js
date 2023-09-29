'use strict';

// ============================================================================
// Rich Content Providers
// ============================================================================

// ============================================================================
// General Links
// ============================================================================

export const Links = {
	type: 'link',
	can_hide_token: true,
	priority: -10,

	test(token) {
		if ( token.type !== 'link' )
			return false;

		const url = token.url;

		// Link providers always result in embeds.
		for(const provider of this.__link_providers) {
			if ( provider.test.call(this, url) )
				return true;
		}

		return this.context.get('chat.rich.all-links') || token.force_rich;
	},

	process(token, want_mid) {
		return {
			card_tooltip: true,
			url: token.url,
			timeout: 0,
			want_mid,

			getData: async (refresh = false) => {
				let data;
				try {
					data = await this.get_link_info(token.url, false, refresh);
				} catch(err) {
					return {
						url: token.url,
						error: String(err)
					}
				}

				if ( ! data )
					return {
						url: token.url
					}

				return {
					...data,
					allow_media: this.context.get('tooltip.link-images'),
					allow_unsafe: this.context.get('tooltip.link-nsfw-images')
				};
			}
		}
	}
}
