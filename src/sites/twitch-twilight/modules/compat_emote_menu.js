'use strict';

/* global emoteMenu: false */

// ============================================================================
// Compatibility Layer
// Emote Menu for Twitch (BTTV Emote Menu)
// ============================================================================

import Module from 'utilities/module';
import {has, sleep} from 'utilities/object';

export default class CompatEmoteMenu extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.chat');
		this.inject('chat.emotes');
	}

	onEnable() {
		this.hookEmoteMenu();
	}

	async hookEmoteMenu() {
		const em = await this.findEmoteMenu();
		if ( ! em )
			return this.log.info('Emote Menu for Twitch was not found after 60 seconds.');

		em.registerEmoteGetter('FrankerFaceZ', () => {
			// We get literally no information about the current context,
			// so we need to look up everything.
			const cont = this.chat.ChatContainer.first,
				props = cont && cont.props;

			if ( ! props )
				return;

			const sets = this.emotes.getSets(props.userID, props.currentUserLogin, props.channelID, props.channelLogin),
				chat = this.resolve('chat'),
				anim = (chat?.context || this.settings)?.get?.('chat.emotes.animated') > 0,
				emotes = [];

			for(const set of sets) {
				if ( ! set || ! set.emotes )
					continue;

				for(const emote_id in set.emotes)
					if ( has(set.emotes, emote_id) ) {
						const emote = set.emotes[emote_id];
						if ( emote.hidden )
							continue;

						emotes.push({
							text: emote.name,
							url: anim && emote.animated?.[1] || emote.urls[1],
							channel: `${set.source || 'FrankerFaceZ'} ${set.title}`,
							badge: set.icon || '//cdn.frankerfacez.com/script/devicon.png'
						});
					}
			}

			return emotes;
		});
	}

	async findEmoteMenu(delay = 0) {
		if ( window.emoteMenu && emoteMenu.registerEmoteGetter )
			return emoteMenu;

		if ( delay >= 60000 )
			return null;

		await sleep(100);
		return this.findEmoteMenu(delay + 100);
	}
}