'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
import Twilight from 'site';
import {has} from 'utilities/object';

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

	async onEnable() {
		const React = await this.web_munch.findModule('react'),
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
			old_get_matched = inst.getMatchedEmotes,
			compareStrings = (a, b) => {
				if (a.charAt(0) === ':') return b.charAt(0) === ':' ? a.localeCompare(b) : 1;
				return b.charAt(0) === ':' ? -1 : a.localeCompare(b);
			};

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

		inst.renderEmoteSuggestion = function(emote) {
			const favorite = emote.favorite || t.emotes.isFavorite('twitch', parseInt(emote.id, 10));
			return [
				<div key={`emote-img-${emote.id}`} favorite={favorite} class="tw-relative tw-pd-r-05">
					<img
						class="emote-autocomplete-provider__image"
						srcSet={emote.srcSet}
					/>
					{favorite && <figure class="ffz--favorite ffz-i-star" />}
				</div>,
				<div key={`emote-token-${emote.id}`}>
					{emote.token}
				</div>
			];
		}

		inst.getMatchedEmotes = function(input) {
			let results = old_get_matched.call(this, input);

			if ( t.chat.context.get('chat.tab-complete.ffz-emotes') )
				results = results.concat(t.getEmoteSuggestions(input, this));

			if ( ! t.chat.context.get('chat.tab-complete.emoji') )
				return results;

			results = results.concat(t.getEmojiSuggestions(input, this)).sort((a, b) => {
				const a_props = a.element[0].props,
					b_props = b.element[0].props,
					
					a_fav = a_props.favorite,
					b_fav = b_props.favorite,

					a_str = a_props.code || a.replacement,
					b_str = b.element[0].props.code || b.replacement;

				if (a_fav) {
					return b_fav ? compareStrings(a_str, b_str) : -1;
				} else if (b_fav) {
					return 1;
				} else {
					return compareStrings(a_str, b_str);
				}
			});

			return results;
		}

		const React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		inst.renderFFZEmojiSuggestion = function(data) {
			return [
				<div key={`emote-img-${data.id}`} favorite={data.favorite} code={data.token} class="tw-pd-r-05">
					<img
						class="emote-autocomplete-provider__image ffz-emoji"
						src={data.src}
						srcSet={data.srcset}
					/>
					{data.favorite && <figure class="ffz--favorite ffz-i-star" />}
				</div>,
				<div key={`emote-token-${data.id}`}>
					{data.token}
				</div>
			]
		}
	}


	getEmojiSuggestions(input, inst) {
		let search = input.slice(1).toLowerCase();
		const style = this.chat.context.get('chat.emoji.style'),
			tone = this.settings.provider.get('emoji-tone', null),
			results = [],
			has_colon = search.endsWith(':');

		if ( has_colon )
			search = search.slice(0,-1);

		for(const name in this.emoji.names)
			if ( has_colon ? name === search : name.startsWith(search) ) {
				const emoji = this.emoji.emoji[this.emoji.names[name]],
					toned = emoji.variants && emoji.variants[tone],
					source = toned || emoji;

				if ( emoji && (style === 0 || source.has[style]) )
					results.push({
						current: input,
						replacement: source.raw,
						element: inst.renderFFZEmojiSuggestion({
							token: `:${name}:`,
							id: `emoji-${emoji.code}`,
							src: this.emoji.getFullImage(source.image, style),
							srcSet: this.emoji.getFullImageSet(source.image, style),
							favorite: this.emotes.isFavorite('emoji', emoji.code)
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
			emoteSets = this.emotes.getSets(
				user && user.id,
				user && user.login,
				channel_id,
				channel_login
			),
			tempEmotes = {};

		for(const set of emoteSets)
			if ( set && set.emotes )
				for(const emote of Object.values(set.emotes))
					if ( emote && ! has(tempEmotes, emote.name) )
						if ( inst.doesEmoteMatchTerm(emote, search) )
							results.push(tempEmotes[emote.name] = {
								current: input,
								replacement: emote.name,
								element: inst.renderEmoteSuggestion({
									token: emote.name,
									id: `${emote.token.provider}-${emote.id}`,
									srcSet: emote.srcSet,
									provider: set.source || 'ffz',
									favorite: this.emotes.isFavorite(set.source || 'ffz', emote.id)
								})
							});

		return results;
	}
}
