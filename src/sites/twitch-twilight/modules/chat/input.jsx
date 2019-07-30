'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
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


		this.messageHistory = [];
		this.messageHistoryPos = 0;
	}

	async onEnable() {
		this.chat.context.on('changed:chat.actions.room', () => this.ChatInput.forceUpdate());
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
					if ( ! out || ! out.props || ! Array.isArray(out.props.children) )
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
							displayName: props.channelDisplayName
						}

					const actions = t.actions.renderRoom(t.chat.context.get('context.chat.showModIcons'), u, r, createElement);
					if ( actions )
						out.props.children.unshift(actions);

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

		inst.onKeyDown = function(event) {
			const code = event.charCode || event.keyCode;
            
			if (code === 38) { // Arrow up
				if (inst.chatInputRef.selectionStart === 0) {
					if (!t.messageHistory.length) {
						return;
					}
					
					if (t.messageHistoryPos > 0) {
						t.messageHistoryPos--;
					}
					
					inst.chatInputRef.value = t.messageHistory[t.messageHistoryPos];
				}
			}
			else if (code === 40) { // Arrow down
				if (inst.chatInputRef.selectionStart == inst.chatInputRef.value.length) {
					if (!t.messageHistory.length) {
						return;
					}

					if (t.messageHistoryPos < t.messageHistory.length - 1) {
						t.messageHistoryPos++;
					}

					inst.chatInputRef.value = t.messageHistory[t.messageHistoryPos];
				}
			}
			else {
				originalOnKeyDown.call(this, event);
			}
		}

		inst.onMessageSend = function(event) {
			t.messageHistory.push(inst.chatInputRef.value);
			t.messageHistoryPos = t.messageHistory.length;

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
			if ( limitResults && results.length >= 25 )
				return results.slice(0, 25);

			if ( t.chat.context.get('chat.tab-complete.ffz-emotes') ) {
				const ffz_emotes = t.getEmoteSuggestions(input, this);
				if ( Array.isArray(ffz_emotes) && ffz_emotes.length )
					results = results.concat(ffz_emotes);
			}

			if ( limitResults && results.length >= 25 )
				return results.slice(0, 25);

			if ( ! t.chat.context.get('chat.tab-complete.emoji') )
				return results;

			const emoji = t.getEmojiSuggestions(input, this);
			if ( Array.isArray(emoji) && emoji.length )
				results = Array.isArray(results) ? results.concat(emoji) : emoji;

			return limitResults && results.length > 25 ? results.slice(0, 25) : results;
		}

		const React = this.web_munch.getModule('react'),
			createElement = React && React.createElement;

		inst.renderFFZEmojiSuggestion = function(data) {
			return (<React.Fragment>
				<div class="tw-pd-r-05">
					<img
						class="emote-autocomplete-provider__image ffz-emoji"
						src={data.src}
						srcSet={data.srcset}
					/>
				</div>
				<div>
					{data.token}
				</div>
			</React.Fragment>);
		}
	}


	// eslint-disable-next-line class-methods-use-this
	getTwitchEmoteSuggestions(input, inst) {
		const hydratedEmotes = inst.hydrateEmotes(inst.props.emotes);
		if (!Array.isArray(hydratedEmotes)) {
			return [];
		}

		const startingResults = [], otherResults = [];
		const search = input.startsWith(':') ? input.slice(1) : input;
		for (const set of hydratedEmotes) {
			if (set && Array.isArray(set.emotes)) {
				for (const emote of set.emotes) {
					if (inst.doesEmoteMatchTerm(emote, search)) {
						const element = {
							current: input,
							replacement: emote.token,
							element: inst.renderEmoteSuggestion(emote)
						};

						if (emote.token.toLowerCase().startsWith(search)) {
							startingResults.push(element);
						}
						else {
							otherResults.push(element);
						}
					}
				}
			}
		}

		startingResults.sort((a, b) => a.replacement < b.replacement ? -1 : a.replacement > b.replacement ? 1 : 0);
		otherResults.sort((a, b) => a.replacement < b.replacement ? -1 : a.replacement > b.replacement ? 1 : 0);

		return startingResults.concat(otherResults);
	}


	getEmojiSuggestions(input, inst) {
		if (!input.startsWith(':')) {
			return [];
		}

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
							srcSet: this.emoji.getFullImageSet(source.image, style)
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
			const parent = this.fine.searchParent(inst, 'chat-input', 50);
			if ( parent )
				this.updateEmoteCompletion(parent, inst);

			if ( ! channel_login )
				return [];
		}

		const search = input.startsWith(':') ? input.slice(1) : input,
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
