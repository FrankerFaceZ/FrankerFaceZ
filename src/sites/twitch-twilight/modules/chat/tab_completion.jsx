'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
import Twilight from 'site';

export default class TabCompletion extends Module {
	constructor(...args) {
		super(...args);

		this.inject('chat');
		this.inject('chat.emotes');
		this.inject('chat.emoji');
		this.inject('i18n');
		this.inject('settings');

		this.inject('site.fine');
		this.inject('site.web_munch');


		// Settings

		this.settings.add('chat.tab-complete.ffz-emotes', {
			default: true,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Allow tab-completion of FrankerFaceZ emotes.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.tab-complete.emoji', {
			default: true,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Allow tab-completion of emoji.',
				component: 'setting-check-box'
			}
		});


		// Components

		this.ChatInput = this.fine.define(
			'chat-input',
			n => n && n.setChatInputRef && n.setAutocompleteInputRef,
			Twilight.CHAT_ROUTES
		);


		this.EmoteSuggestions = this.fine.define(
			'tab-emote-suggestions',
			n => n && n.getMatchedEmotes,
			Twilight.CHAT_ROUTES
		);
	}

	onEnable() {
		const React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		if ( ! createElement )
			return this.log.warn('Unable to get React.');

		this.ChatInput.ready((cls, instances) => {
			for(const inst of instances)
				this.updateEmoteCompletion(inst);
		});

		this.EmoteSuggestions.ready((cls, instances) => {
			for(const inst of instances)
				this.overrideEmoteMatcher(inst);
		});

		this.ChatInput.on('update', this.updateEmoteCompletion, this);
		this.EmoteSuggestions.on('mount', this.overrideEmoteMatcher, this);
	}


	updateEmoteCompletion(inst, child) {
		if ( ! child )
			child = this.fine.searchTree(inst, 'tab-emote-suggestions');
		if ( ! child )
			return;

		child._ffz_user = inst.props.sessionUser;
		child._ffz_channel_id = inst.props.channelID;
		child._ffz_channel_login = inst.props.channelLogin;
	}


	overrideEmoteMatcher(inst) {
		if ( inst._ffz_override )
			return;

		const t = this,
			old_get_matched = inst.getMatchedEmotes;

		inst.doesEmoteMatchTerm = function(emote, term) {
			const emote_name = emote.name || emote.token,
				emote_lower = emote_name.toLowerCase(),
				term_lower = term.toLowerCase();

			if (emote_lower.startsWith(term_lower))
				return true;

			const idx = emote_name.indexOf(term.charAt(0).toUpperCase());
			if (idx !== -1)
				return emote_lower.slice(idx + 1).startsWith(term_lower.slice(1));
		}

		inst.getMatchedEmotes = function(input) {
			let results = old_get_matched.call(this, input);

			if ( t.chat.context.get('chat.tab-complete.ffz-emotes') )
				results = results.concat(t.getEmoteSuggestions(input, this));

			if ( ! t.chat.context.get('chat.tab-complete.emoji') )
				return results;

			return results.concat(t.getEmojiSuggestions(input, this));
		}

		const React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		inst.renderFFZEmojiSuggestion = function(data) {
			return [
				<div class="tw-pd-r-05">
					<img
						class="emote-autocomplete-provider__image ffz-emoji"
						src={data.src}
						srcSet={data.srcset}
					/>
				</div>,
				<div>
					{data.token}
				</div>
			]
		}
	}


	getEmojiSuggestions(input, inst) {
		const search = input.slice(1).toLowerCase(),
			style = this.chat.context.get('chat.emoji.style'),
			results = [];

		for(const name in this.emoji.names)
			if ( name.startsWith(search) ) {
				const emoji = this.emoji.emoji[this.emoji.names[name]];
				if ( emoji && (style === 0 || emoji.has[style]) )
					results.push({
						current: input,
						replacement: emoji.raw,
						element: inst.renderFFZEmojiSuggestion({
							token: `:${name}:`,
							id: `emoji-${emoji.code}`,
							src: this.emoji.getFullImage(emoji.image, style),
							srcSet: this.emoji.getFullImageSet(emoji.image, style)
						})
					});
			}

		return results;
	}


	getEmoteSuggestions(input, inst) {
		const user = inst._ffz_user,
			channel_id = inst._ffz_channel_id,
			channel_login = inst._ffz_channel_login;

		if ( ! channel_login ) {
			const parent = this.fine.searchParent(inst, 'chat-input');
			if ( parent )
				this.updateEmoteCompletion(parent, inst);

			if ( ! channel_login )
				return [];
		}

		const search = input.slice(1),
			results = [],
			emotes = this.emotes.getEmotes(
				user && user.id,
				user && user.login,
				channel_id,
				channel_login
			);

		for(const emote of Object.values(emotes))
			if ( inst.doesEmoteMatchTerm(emote, search) )
				results.push({
					current: input,
					replacement: emote.name,
					element: inst.renderEmoteSuggestion({
						token: emote.name,
						id: `${emote.token.provider}-${emote.id}`,
						srcSet: emote.srcSet
					})
				});

		return results;
	}
}
