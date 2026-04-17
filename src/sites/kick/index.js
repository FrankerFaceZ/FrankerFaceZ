'use strict';

// ============================================================================
// Site Support: Kick (scaffold)
// ============================================================================
//
// This is an intentionally thin stub. It registers a BaseSite subclass so the
// FFZ core can boot on kick.com and exposes hooks where Kick-specific modules
// (chat, channel, emote rendering, React/webpack interception) will go.
//
// What still needs to be built, at minimum:
//   - A Kick equivalent of utilities/compat/webmunch that knows Kick's
//     webpack chunk-loading globals.
//   - Fine predicates for Kick's React component tree (chat line, chat input,
//     channel header, etc.).
//   - A chat module that understands Kick's Pusher-based chat protocol
//     rather than Twitch's IRC-style event stream.
//   - A KickData module paralleling utilities/twitch-data for profile /
//     channel / emote lookups against Kick's API.
//
// Reference implementation: src/sites/twitch-twilight/index.js

import BaseSite from '../base';

export default class Kick extends BaseSite {
	constructor(...args) {
		super(...args);

		this.log.info('Kick site scaffold loaded. Integration is not yet functional.');
	}

	async onLoad() {
		// Future: inject WebMunch/Fine/Router equivalents and populate
		// Kick-specific modules via require.context, mirroring Twilight.
	}

	onEnable() {
		this.settings = this.resolve('settings');

		const update_size = () => this.settings.updateContext({
			size: {
				height: window.innerHeight,
				width: window.innerWidth
			}
		});

		window.addEventListener('resize', update_size);
		update_size();

		this.settings.updateContext({
			route: {
				name: 'kick-root',
				parts: [location.pathname],
				domain: location.hostname
			},
			route_data: [location.pathname]
		});
	}

	getSession() { return null; }
	getUser() { return null; }
	getCore() { return null; }
}

Kick.CHAT_ROUTES = [];
