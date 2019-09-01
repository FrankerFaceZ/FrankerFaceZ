'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
import { findReactFragment } from 'utilities/dom';
import Twilight from 'site';

export default class Input extends Module {
	constructor(...args) {
		super(...args);

		this.inject('chat');
		this.inject('chat.actions');
		this.inject('chat.emotes');
		this.inject('chat.emoji');
		this.inject('i18n');
		this.inject('settings');

		this.inject('site.fine');
		this.inject('site.web_munch');


		// Settings

		this.settings.add('chat.mru.enabled', {
			default: true,
			ui: {
				path: 'Chat > Input >> Recent Messages',
				title: 'Allow pressing up and down to recall previously sent chat messages.',
				component: 'setting-check-box'
			}
		});

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

		this.settings.add('chat.tab-complete.emotes-without-colon', {
			default: false,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Allow tab-completion of emotes without typing a colon. (:)',
				description: 'This will prevent the tab-completion of usernames without the @ prefix.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.tab-complete.limit-results', {
			default: true,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Limit tab-completion results to 25.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.tab-complete.prioritize-favorites', {
			default: false,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Prioritize favorite emotes at the top.',
				component: 'setting-check-box'
			}
		});


		// Components

		this.ChatInput = this.fine.define(
			'chat-input',
			n => n && n.setChatInputRef && n.setLocalAutocompleteInputRef,
			Twilight.CHAT_ROUTES
		);


		this.EmoteSuggestions = this.fine.define(
			'tab-emote-suggestions',
			n => n && n.getMatchedEmotes,
			Twilight.CHAT_ROUTES
		);


		this.MentionSuggestions = this.fine.define(
			'tab-mention-suggestions',
			n => n && n.getMentions && n.renderMention,
			Twilight.CHAT_ROUTES
		);

		// Implement Twitch's unfinished emote usage object for prioritizing sorting
		this.EmoteUsageCount = {
			TriHard: 196568036,
			Kappa: 192158118,
			'4Head': 155758710,
			PogChamp: 151485090,
			cmonBruh: 146352878,
			BibleThump: 56472964,
			WutFace: 45069031,
			Kreygasm: 41387580,
			DansGame: 38097659,
			SMOrc: 34734484,
			KappaPride: 34262839,
			VoHiYo: 27886434,
			SwiftRage: 24561900,
			ResidentSleeper: 24438298,
			EleGiggle: 19891526,
			FailFish: 19118343,
			NotLikeThis: 18802905,
			Keepo: 18351415,
			BabyRage: 18220906,
			MingLee: 18026207,
			HeyGuys: 14851569,
			ANELE: 14648986,
			PJSalt: 14438861
		};
	}

	async onEnable() {
		this.chat.context.on('changed:chat.actions.room', () => this.ChatInput.forceUpdate());
		this.chat.context.on('changed:chat.actions.room-above', () => this.ChatInput.forceUpdate());
		this.chat.context.on('changed:chat.tab-complete.emotes-without-colon', enabled => {
			for (const inst of this.EmoteSuggestions.instances)
				inst.canBeTriggeredByTab = enabled;

			for (const inst of this.MentionSuggestions.instances)
				inst.canBeTriggeredByTab = !enabled;
		});

		const React = await this.web_munch.findModule('react'),
			createElement = React && React.createElement;

		if ( ! createElement )
			return this.log.warn('Unable to get React.');

		const t = this;

		this.ChatInput.ready((cls, instances) => {
			const old_render = cls.prototype.render;

			cls.prototype.render = function() {
				const out = old_render.call(this);
				try {
					const above = t.chat.context.get('chat.actions.room-above'),
						state = t.chat.context.get('context.chat_state') || {},
						container = above ? out : findReactFragment(out, n => n.props && n.props.className === 'chat-input__buttons-container');
					if ( ! container || ! container.props || ! container.props.children )
						return out;

					const props = this.props;
					if ( ! props || ! props.channelID )
						return out;

					const u = props.sessionUser ? {
							id: props.sessionUser.id,
							login: props.sessionUser.login,
							displayName: props.sessionUser.displayName,
							mod: props.isCurrentUserModerator,
							staff: props.isStaff
						} : null,
						r = {
							id: props.channelID,
							login: props.channelLogin,
							displayName: props.channelDisplayName,
							emoteOnly: props.emoteOnlyMode,
							slowMode: props.slowMode,
							slowDuration: props.slowModeDuration,
							subsMode: props.subsOnlyMode,
							r9kMode: state.r9k,
							followersOnly: state.followersOnly,
							followersDuration: state.followersOnlyRequirement
						}

					const actions = t.actions.renderRoom(t.chat.context.get('context.chat.showModIcons'), u, r, above, createElement);
					if ( above )
						container.props.children.unshift(actions || null);
					else
						container.props.children.splice(1, 0, actions || null);

				} catch(err) {
					t.log.error(err);
					t.log.capture(err);
				}

				return out;
			}

			for(const inst of instances) {
				inst.forceUpdate();
				this.updateEmoteCompletion(inst);
				this.overrideChatInput(inst);
			}
		});

		this.EmoteSuggestions.ready((cls, instances) => {
			for(const inst of instances)
				this.overrideEmoteMatcher(inst);
		});

		this.MentionSuggestions.ready((cls, instances) => {
			for(const inst of instances)
				this.overrideMentionMatcher(inst);
		});

		this.ChatInput.on('update', this.updateEmoteCompletion, this);
		this.ChatInput.on('mount', this.overrideChatInput, this);
		this.EmoteSuggestions.on('mount', this.overrideEmoteMatcher, this);
		this.MentionSuggestions.on('mount', this.overrideMentionMatcher, this);

		this.on('site.css_tweaks:update-chat-css', this.resizeInput, this);
	}

	resizeInput() {
		if ( this._resize_waiter )
			cancelAnimationFrame(this._resize_waiter);

		this._resize_waiter = requestAnimationFrame(() => this._resizeInput())
	}

	_resizeInput() {
		this._resize_waiter = null;
		for (const chat_input of this.ChatInput.instances)
			chat_input.resizeInput();
	}


	updateEmoteCompletion(inst, child) {
		if ( ! child )
			child = this.fine.searchTree(inst, 'tab-emote-suggestions', 50);
		if ( ! child )
			return;

		child._ffz_user = inst.props.sessionUser;
		child._ffz_channel_id = inst.props.channelID;
		child._ffz_channel_login = inst.props.channelLogin;
	}

	overrideChatInput(inst) {
		if ( inst._ffz_override )
			return;

		const t = this;

		const originalOnKeyDown = inst.onKeyDown,
			originalOnMessageSend = inst.onMessageSend;

		inst.messageHistory = [];
		inst.tempInput = '';
		inst.messageHistoryPos = -1;

		inst.onKeyDown = function(event) {
			try {
				if ( inst.autocompleteInputRef && t.chat.context.get('chat.mru.enabled') && ! event.shiftKey && ! event.ctrlKey && ! event.altKey ) {
					const code = event.charCode || event.keyCode;

					// Arrow Up
					if ( code === 38 && inst.chatInputRef.selectionStart === 0 ) {
						if ( ! inst.messageHistory.length )
							return;

						if ( inst.chatInputRef.value && inst.messageHistoryPos === -1 )
							inst.tempInput = inst.chatInputRef.value;

						if ( inst.messageHistoryPos < inst.messageHistory.length - 1 ) {
							inst.messageHistoryPos++;
							inst.autocompleteInputRef.setValue(inst.messageHistory[inst.messageHistoryPos]);
						}

						return;

					// Arrow Down
					} else if ( code === 40 && inst.chatInputRef.selectionStart == inst.chatInputRef.value.length ) {
						if ( ! inst.messageHistory.length )
							return;

						if ( inst.messageHistoryPos > 0 ) {
							inst.messageHistoryPos--;
							inst.autocompleteInputRef.setValue(inst.messageHistory[inst.messageHistoryPos]);

						} else if ( inst.messageHistoryPos === 0 ) {
							inst.autocompleteInputRef.setValue(inst.tempInput);
							inst.messageHistoryPos = -1;
						}

						return;
					}
				}

			} catch(err) {
				t.log.capture(err);
				t.log.error(err);
			}

			originalOnKeyDown.call(this, event);
		}

		inst.onMessageSend = function(event) {
			try {
				if ( t.chat.context.get('chat.mru.enabled') ) {
					if (! inst.messageHistory.length || inst.messageHistory[0] !== inst.chatInputRef.value) {
						inst.messageHistory.unshift(inst.chatInputRef.value);
						inst.messageHistory = inst.messageHistory.slice(0, 20);
					}
					inst.messageHistoryPos = -1;
					inst.tempInput = '';
				}

			} catch(err) {
				t.log.capture(err);
				t.log.error(err);
			}

			originalOnMessageSend.call(this, event);
		}
	}


	overrideMentionMatcher(inst) {
		if ( inst._ffz_override )
			return;

		inst.canBeTriggeredByTab = !this.chat.context.get('chat.tab-complete.emotes-without-colon');
	}


	overrideEmoteMatcher(inst) {
		if ( inst._ffz_override )
			return;

		const t = this;

		inst.canBeTriggeredByTab = this.chat.context.get('chat.tab-complete.emotes-without-colon');

		inst.getMatches = function(input, pressedTab) {
			return pressedTab
				? input.length < 2 ? null : inst.getMatchedEmotes(input)
				: input.startsWith(':') ? input.length < 3 ? null : inst.getMatchedEmotes(input) : null;
		}

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
			const limitResults = t.chat.context.get('chat.tab-complete.limit-results');
			let results = t.getTwitchEmoteSuggestions(input, this);

			if ( t.chat.context.get('chat.tab-complete.ffz-emotes') ) {
				const ffz_emotes = t.getEmoteSuggestions(input, this);
				if ( Array.isArray(ffz_emotes) && ffz_emotes.length )
					results = results.concat(ffz_emotes);
			}

			if ( t.chat.context.get('chat.tab-complete.emoji') ) {
				const emoji = t.getEmojiSuggestions(input, this);
				if ( Array.isArray(emoji) && emoji.length )
					results = Array.isArray(results) ? results.concat(emoji) : emoji;
			}

			results = t.sortFavorites(results);
			return limitResults && results.length > 25 ? results.slice(0, 25) : results;
		}

		const React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		inst.renderFFZEmojiSuggestion = function(data) {
			return (<React.Fragment>
				<div class="tw-relative tw-flex-shrink-0 tw-pd-05" title={data.token} favorite={data.favorite}>
					<img
						class="emote-autocomplete-provider__image ffz-emoji"
						src={data.src}
						srcSet={data.srcset}
					/>
					{data.favorite && <figure class="ffz--favorite ffz-i-star" />}
				</div>
				<div class="tw-ellipsis" title={data.token}>
					{data.token}
				</div>
			</React.Fragment>);
		}

		inst.renderEmoteSuggestion = function(emote) {
			return (<React.Fragment>
				<div class="tw-relative tw-flex-shrink-0 tw-pd-05" title={emote.token} favorite={emote.favorite}>
					<img
						class="emote-autocomplete-provider__image"
						srcSet={emote.srcSet}
					/>
					{emote.favorite && <figure class="ffz--favorite ffz-i-star" />}
				</div>
				<div class="tw-ellipsis" title={emote.token}>
					{emote.token}
				</div>
			</React.Fragment>);
		}
	}


	// eslint-disable-next-line class-methods-use-this
	sortFavorites(results) {
		if (!this.chat.context.get('chat.tab-complete.prioritize-favorites')) {
			return results;
		}

		return results.sort((a, b) => {
			if (a.favorite) {
				return b.favorite ? a.replacement.localeCompare(b.replacement) : -1;
			}
			else if (b.favorite) {
				return 1;
			}
			else {
				a.replacement.localeCompare(b.replacement)
			}
		});
	}


	// eslint-disable-next-line class-methods-use-this
	getTwitchEmoteSuggestions(input, inst) {
		const hydratedEmotes = inst.hydrateEmotes(inst.props.emotes);
		if (!Array.isArray(hydratedEmotes)) {
			return [];
		}

		const usageResults = [],
			startingResults = [],
			otherResults = [],
			favorites = this.emotes.getFavorites('twitch'),
			search = input.startsWith(':') ? input.slice(1) : input;

		for (const set of hydratedEmotes) {
			if (set && Array.isArray(set.emotes)) {
				for (const emote of set.emotes) {
					if (inst.doesEmoteMatchTerm(emote, search)) {
						const favorite = favorites.includes(parseInt(emote.id, 10));
						const element = {
							current: input,
							replacement: emote.token,
							element: inst.renderEmoteSuggestion({
								...emote,
								favorite
							}),
							favorite
						};

						if (this.EmoteUsageCount[emote.token]) {
							usageResults.push(element);
						}
						else if (emote.token.toLowerCase().startsWith(search)) {
							startingResults.push(element);
						}
						else {
							otherResults.push(element);
						}
					}
				}
			}
		}

		usageResults.sort((a, b) => this.EmoteUsageCount[b.replacement] - this.EmoteUsageCount[a.replacement]);
		startingResults.sort((a, b) => a.replacement.localeCompare(b.replacement));
		otherResults.sort((a, b) => a.replacement.localeCompare(b.replacement));

		return usageResults.concat(startingResults).concat(otherResults);
	}


	getEmojiSuggestions(input, inst) {
		if (!input.startsWith(':')) {
			return [];
		}

		let search = input.slice(1).toLowerCase();
		const style = this.chat.context.get('chat.emoji.style'),
			tone = this.settings.provider.get('emoji-tone', null),
			favorites = this.emotes.getFavorites('emoji'),
			results = [],
			has_colon = search.endsWith(':');

		if ( has_colon )
			search = search.slice(0,-1);

		for(const name in this.emoji.names)
			if ( has_colon ? name === search : name.startsWith(search) ) {
				const emoji = this.emoji.emoji[this.emoji.names[name]],
					toned = emoji.variants && emoji.variants[tone],
					source = toned || emoji;

				if ( emoji && (style === 0 || source.has[style]) ) {
					const favorite = favorites.includes(emoji.code);
					results.push({
						current: input,
						replacement: source.raw,
						element: inst.renderFFZEmojiSuggestion({
							token: `:${name}:`,
							id: `emoji-${emoji.code}`,
							src: this.emoji.getFullImage(source.image, style),
							srcSet: this.emoji.getFullImageSet(source.image, style),
							favorite
						}),
						favorite
					});
				}
			}

		return results;
	}


	getEmoteSuggestions(input, inst) {
		const user = inst._ffz_user,
			channel_id = inst._ffz_channel_id,
			channel_login = inst._ffz_channel_login;

		if ( ! channel_login ) {
			const parent = this.fine.searchParent(inst, 'chat-input', 50);
			if ( parent )
				this.updateEmoteCompletion(parent, inst);

			if ( ! channel_login )
				return [];
		}

		const search = input.startsWith(':') ? input.slice(1) : input,
			results = [],
			sets = this.emotes.getSets(
				user && user.id,
				user && user.login,
				channel_id,
				channel_login
			),
			added_emotes = new Set();

		for(const set of sets) {
			if ( set && set.emotes )
				for(const emote of Object.values(set.emotes))
					if ( inst.doesEmoteMatchTerm(emote, search) && !added_emotes.has(emote.name) ) {
						const favorite = this.emotes.isFavorite(set.source || 'ffz', emote.id);
						results.push({
							current: input,
							replacement: emote.name,
							element: inst.renderEmoteSuggestion({
								token: emote.name,
								id: `${set.source}-${emote.id}`,
								srcSet: emote.srcSet,
								favorite
							}),
							favorite
						});
						added_emotes.add(emote.name);
					}
		}

		return results;
	}

	pasteMessage(room, message) {
		for(const inst of this.ChatInput.instances) {
			if ( inst?.props?.channelLogin !== room )
				continue;

			if ( ! inst.autocompleteInputRef || ! inst.state )
				return;

			if ( inst.state.value )
				message = `${inst.state.value} ${message}`;

			inst.autocompleteInputRef.setValue(message);
			inst.autocompleteInputRef.componentRef?.focus?.();
		}
	}
}
