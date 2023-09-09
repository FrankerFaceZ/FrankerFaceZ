'use strict';

// ============================================================================
// RichContent Component
// ============================================================================

import Module from 'utilities/module';
import { findReactFragment } from 'utilities/dom';
import { FFZEvent } from 'utilities/events';
import { getTwitchEmoteSrcSet, has, getTwitchEmoteURL } from 'utilities/object';
import { TWITCH_POINTS_SETS, TWITCH_GLOBAL_SETS, TWITCH_PRIME_SETS, KNOWN_CODES, REPLACEMENTS, REPLACEMENT_BASE, KEYS } from 'utilities/constants';

import Twilight from 'site';

// Prefer using these statically-allocated collators to String.localeCompare
const locale = Intl.Collator();
const localeCaseInsensitive = Intl.Collator(undefined, {sensitivity: 'accent'});

// Describes how an emote matches against a given input
// Higher values represent a more exact match
const NO_MATCH = 0;
const MATCH_ANY = 1;
const NON_PREFIX_MATCH = 2;
const CASE_INSENSITIVE_PREFIX_MATCH = 3;
const EXACT_PREFIX_MATCH = 4;

function getNodeText(node) {
	if ( ! node )
		return '';

	if ( node.type === 'emote' )
		return node.emoteName;

	if ( node.type === 'text' )
		return node.text;

	if ( Array.isArray(node.children) )
		return node.children.map(getNodeText).join('');

	return '';
}

function getNodeOffset(nodes, path) {
	let offset = 0, pidx = 0, n = nodes;

	while(pidx < path.length) {
		const p = path[pidx];

		for(let i = 0; i < p; i++)
			offset += getNodeText(n[i]).length;

		n = Array.isArray(n[p]) ? n[p] : n[p]?.children;
		pidx++;
	}

	return offset;
}

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

		this.settings.add('chat.hype.display-input', {
			default: true,
			ui: {
				path: 'Chat > Hype Chat >> Input',
				title: 'Allow the Hype Chat button to appear in the chat input element.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.inline-preview.enabled', {
			default: true,
			ui: {
				path: 'Chat > Input >> Appearance',
				title: 'Display in-line previews of FrankerFaceZ emotes when entering a chat message.',
				description: '**Note:** This feature is temperamental. It may not display all emotes, and emote effects and overlay emotes are not displayed correctly. Once this setting has been enabled, it cannot be reasonably disabled and will remain active until you refresh the page.',
				component: 'setting-check-box'
			}
		});

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

		this.settings.add('chat.tab-complete.prioritize-prefix-matches', {
			default: false,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Prioritize emotes that start with user input.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.tab-complete.matching', {
			default: 1,

			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Emote Matching Type',
				description: '1: `ppa` would match `Kappa`\n\n' +
					'2: `sip` would match `cohhSip` but not `Gossip`\n\n' +
					'3: `pasta` would match `pastaThat` but not `HoldThat`',

				component: 'setting-select-box',

				data: [
					{value: 1, title: '1: Anything (Twitch style)'},
					{value: 2, title: '2: Non-Prefix (Old FFZ style)'},
					{value: 3, title: '3: Exact (Case-Insensitive)'}
				]
			},

			changed: () => this.uncacheTabCompletion()
		});


		// Components

		this.ChatInput = this.fine.define(
			'chat-input',
			n => n && n.setLocalChatInputRef && n.setLocalAutocompleteInputRef,
			Twilight.CHAT_ROUTES
		);

		this.EmoteSuggestions = this.fine.define(
			'tab-emote-suggestions',
			n => n && n.getMatches && n.autocompleteType === 'emote',
			Twilight.CHAT_ROUTES
		);


		this.MentionSuggestions = this.fine.define(
			'tab-mention-suggestions',
			n => n && n.getMentions && n.renderMention,
			Twilight.CHAT_ROUTES
		);

		this.CommandSuggestions = this.fine.define(
			'tab-cmd-suggestions',
			n => n && n.getMatches && n.doesCommandMatchTerm,
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
		this.chat.context.on('changed:chat.hype.display-input', () => this.ChatInput.forceUpdate());
		this.chat.context.on('changed:chat.actions.room', () => this.ChatInput.forceUpdate());
		this.chat.context.on('changed:chat.actions.room-above', () => this.ChatInput.forceUpdate());
		this.chat.context.on('changed:chat.tab-complete.emotes-without-colon', enabled => {
			for (const inst of this.EmoteSuggestions.instances)
				inst.canBeTriggeredByTab = enabled;

			for (const inst of this.MentionSuggestions.instances)
				inst.canBeTriggeredByTab = !enabled;
		});

		this.use_previews = this.chat.context.get('chat.inline-preview.enabled');

		this.chat.context.on('changed:chat.inline-preview.enabled', val => {
			if ( this.use_previews )
				return;

			this.use_previews = val;
			if ( val )
				for(const inst of this.ChatInput.instances) {
					this.installPreviewObserver(inst);
					inst.ffzInjectEmotes();
					inst.forceUpdate();
					this.emit('site:dom-update', 'chat-input', inst);
				}
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
					const hide_hype = ! t.chat.context.get('chat.hype.display-input');
					if ( hide_hype ) {
						const frag = findReactFragment(out, n => n.key === 'paidPinnedMessage');
						if ( frag )
							frag.type = () => null;
					}

					const above = t.chat.context.get('chat.actions.room-above'),
						state = t.chat.context.get('context.chat_state') || {},
						container = above ? findReactFragment(out, n => n.props && Array.isArray(n.props.children))  : findReactFragment(out, n => n.props && n.props.className === 'chat-input__buttons-container');
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
				this.emit('site:dom-update', 'chat-input', inst);
				this.updateEmoteCompletion(inst);
				this.overrideChatInput(inst);
				inst.ffzInjectEmotes();
				this.installPreviewObserver(inst);
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

		this.CommandSuggestions.ready((cls, instances) => {
			for(const inst of instances)
				this.overrideCommandMatcher(inst);
		});

		this.ChatInput.on('update', this.updateEmoteCompletion, this);
		this.ChatInput.on('mount', this.overrideChatInput, this);

		this.ChatInput.on('mount', this.installPreviewObserver, this);
		this.ChatInput.on('unmount', this.removePreviewObserver, this);

		this.EmoteSuggestions.on('mount', this.overrideEmoteMatcher, this);
		this.MentionSuggestions.on('mount', this.overrideMentionMatcher, this);
		this.CommandSuggestions.on('mount', this.overrideCommandMatcher, this);

		this.chat.context.on('changed:chat.emotes.animated', this.uncacheTabCompletion, this);
		this.chat.context.on('changed:chat.emotes.enabled', this.uncacheTabCompletion, this);
		this.on('chat.emotes:change-hidden', this.uncacheTabCompletion, this);
		this.on('chat.emotes:change-set-hidden', this.uncacheTabCompletion, this);
		this.on('chat.emotes:change-favorite', this.uncacheTabCompletion, this);
		this.on('chat.emotes:update-default-sets', this.uncacheTabCompletion, this);
		this.on('chat.emotes:update-user-sets', this.uncacheTabCompletion, this);
		this.on('chat.emotes:update-room-sets', this.uncacheTabCompletion, this);
		this.on('site.css_tweaks:update-chat-css', this.resizeInput, this);
	}

	uncacheTabCompletion() {
		for(const inst of this.EmoteSuggestions.instances) {
			inst.ffz_ffz_cache = null;
			inst.ffz_twitch_cache = null;
		}

		if ( this.use_previews )
			for(const inst of this.ChatInput.instances) {
				inst.ffzInjectEmotes();
				inst.forceUpdate();
				this.emit('site:dom-update', 'chat-input', inst);
			}
	}

	updateInput() {
		for(const inst of this.ChatInput.instances) {
			if ( inst ) {
				inst.forceUpdate();
				this.emit('site:dom-update', 'chat-input', inst);
			}
		}
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


	installPreviewObserver(inst) {
		if ( inst._ffz_preview_observer || ! window.MutationObserver )
			return;

		if ( ! this.use_previews )
			return;

		const el = this.fine.getHostNode(inst),
			target = el && el.querySelector('.chat-input__textarea');
		if ( ! target )
			return;

		inst._ffz_preview_observer = new MutationObserver(mutations => {
			for(const mut of mutations) {
				//if ( mut.target instanceof Element )
				//	this.checkForPreviews(inst, mut.target);

				for(const node of mut.addedNodes) {
					if ( node instanceof Element )
						this.checkForPreviews(inst, node);
				}
			}
		});

		inst._ffz_preview_observer.observe(target, {
			childList: true,
			subtree: true,
			//attributeFilter: ['src']
		});
	}

	checkForPreviews(inst, node) {
		// We can't find the tooltip element directly (without digging into React tree at least)
		// So instead just find the relevant images in the document. This shouldn't happen TOO
		// frequently, with any luck, so the performance impact should be small.
		if ( node.querySelector?.('span[data-a-target="chat-input-emote-preview"]') ) {
			for(const target of document.querySelectorAll('.tw-tooltip-layer img.chat-line__message--emote')) {
				if ( target && target.src.startsWith('https://static-cdn.jtvnw.net/emoticons/v2/__FFZ__') )
					this.updatePreview(inst, target);
			}
		}

		// This no longer works because they removed aria-describedby
		/*for(const el of node.querySelectorAll?.('span[data-a-target="chat-input-emote-preview"][aria-describedby]') ?? []) {
			const cont = document.getElementById(el.getAttribute('aria-describedby')),
				target = cont && cont.querySelector('img.chat-line__message--emote');

			if ( target && target.src.startsWith('https://static-cdn.jtvnw.net/emoticons/v2/__FFZ__') )
				this.updatePreview(inst, target);
		}*/

		for(const target of node.querySelectorAll?.('img.chat-line__message--emote')) {
			if ( target && (target.dataset.ffzId || target.src.startsWith('https://static-cdn.jtvnw.net/emoticons/v2/__FFZ__')) )
				this.updatePreview(inst, target);
		}
	}

	updatePreview(inst, target) {
		let set_id = target.dataset.ffzSet,
			emote_id = target.dataset.ffzId;

		if ( ! emote_id ) {
			const idx = target.src.indexOf('__FFZ__', 49),
				raw_id = target.src.slice(49, idx);

			const raw_idx = raw_id.indexOf('::');
			if ( raw_idx === -1 )
				return;

			set_id = raw_id.slice(0, raw_idx);
			emote_id = raw_id.slice(raw_idx + 2);

			target.dataset.ffzSet = set_id;
			target.dataset.ffzId = emote_id;
		}

		const emote_set = this.emotes.emote_sets[set_id],
			emote = emote_set?.emotes?.[emote_id];

		if ( ! emote )
			return;

		const anim = this.chat.context.get('chat.emotes.animated') > 0;

		target.src = (anim ? emote.animSrc : null) ?? emote.src;
		target.srcset = (anim ? emote.animSrcSet : null) ?? emote.srcSet;

		const w = `${emote.width}px`;
		const h = `${emote.height}px`;

		target.style.width = w;
		target.style.height = h;

		// Find the parent.
		const cont = target.closest('.chat-image__container');
		if ( cont ) {
			cont.style.width = w;
			cont.style.height = h;

			const outer = cont.closest('.chat-line__message--emote-button');
			if ( outer ) {
				outer.style.width = w;
				outer.style.height = h;

				if ( ! outer._ffz_click_handler ) {
					outer._ffz_click_handler = this.previewClick.bind(this, emote.id, emote_set.id, emote.name);
					outer.addEventListener('click', outer._ffz_click_handler);
				}
			}
		}
	}

	previewClick(id, set, name, evt) {
		const fe = new FFZEvent({
			provider: 'ffz',
			id,
			set,
			name,
			source: evt
		});

		this.emit('chat.emotes:click', fe);
		if ( ! fe.defaultPrevented )
			return;

		evt.preventDefault();
		evt.stopImmediatePropagation();
	}

	removePreviewObserver(inst) {
		if ( inst._ffz_preview_observer ) {
			inst._ffz_preview_observer.disconnect();
			inst._ffz_preview_observer = null;
		}
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
			originalOnMessageSend = inst.onMessageSend,
			old_resize = inst.resizeInput;

		const old_componentDidUpdate = inst.componentDidUpdate;

		inst.ffzInjectEmotes = function() {
			const idx = this.props.emotes.findIndex(item => item?.id === 'FrankerFaceZWasHere'),
				data = t.createFakeEmoteSet(inst);

			if ( idx === -1 && data )
				this.props.emotes.push(data);
			else if ( idx !== -1 && data )
				this.props.emotes.splice(idx, 1, data);
			else if ( idx !== -1 && ! data )
				this.props.emotes.splice(idx, 1);
			else
				return;

			// TODO: Somehow update other React state to deal with our
			// injected changes. Making a shallow copy of the array
			// runs too frequently.
		}

		inst.componentDidUpdate = function(props, ...args) {
			try {
				if ( props.emotes !== this.props.emotes && Array.isArray(this.props.emotes) )
					inst.ffzInjectEmotes();

			} catch(err) {
				t.log.error('Error updating emote autocompletion data.', err);
			}

			if ( old_componentDidUpdate )
				old_componentDidUpdate.call(this, props, ...args);
		}

		inst.resizeInput = function(msg, ...args) {
			try {
				if ( msg ) {
					if ( inst.chatInputRef instanceof Element ) {
						const style = getComputedStyle(inst.chatInputRef),
							height = style && parseFloat(style.lineHeight || 18) || 18,
							t = height * 1 + 20.5,
							i = Math.ceil((inst.chatInputRef.scrollHeight - t) / height),
							a = Math.min(1 + i, 4);

						inst.setState({
							numInputRows: a
						});
					}
				} else
					inst.setState({
						numInputRows: 1
					});
			} catch (err) {
				t.log.error('Error in resizeInput', err);
				return old_resize.call(this, msg, ...args);
			}
		}

		inst.messageHistory = [];
		inst.tempInput = '';
		inst.messageHistoryPos = -1;

		inst.ffzGetValue = function() {
			if ( inst.chatInputRef && typeof inst.chatInputRef.value === 'string' )
				return inst.chatInputRef.value;

			if ( inst.state.value && typeof inst.state.value === 'string' )
				return inst.state.value;

			return '';
		}

		inst.ffzGetSelection = function() {
			if ( typeof inst.chatInputRef?.selectionEnd === 'number' ) {
				return [inst.chatInputRef.selectionStart, inst.chatInputRef.selectionEnd]
			}

			if ( inst.chatInputRef?.state?.slateEditor ) {
				const editor = inst.chatInputRef.state.slateEditor,
					sel = editor.selection,
					nodes = editor.children;

				if ( ! sel?.anchor?.path || ! sel?.focus?.path )
					return [0,0];

				const first = getNodeOffset(nodes, sel.anchor.path) + sel.anchor.offset,
					second = getNodeOffset(nodes, sel.focus.path) + sel.focus.offset;

				if ( first < second )
					return [first, second];
				else
					return [second, first];
			}

			return [0,0];
		}

		inst.ffzSetSelection = function(start, end) {
			if ( inst.chatInputRef?.setSelectionRange )
				inst.chatInputRef.setSelectionRange(start, end);
		}

		inst.onKeyDown = function(event) {
			try {
				const code = event.charCode || event.keyCode;

				if ( inst.onEmotePickerToggle && t.chat.context.get('chat.emote-menu.shortcut') && event.key === 'e' && event.ctrlKey && ! event.altKey && ! event.shiftKey ) {
					inst.onEmotePickerToggle();
					event.preventDefault();
					return;
				}

				const val = inst.ffzGetValue();

				if ( inst.autocompleteInputRef && inst.chatInputRef && t.chat.context.get('chat.mru.enabled') && ! event.shiftKey && ! event.ctrlKey && ! event.altKey ) {
					const sel = inst.ffzGetSelection();

					// Arrow Up
					if ( code === 38 && sel[0] === 0 && sel[1] === 0 ) {
						if ( ! inst.messageHistory.length )
							return;

						if ( val && inst.messageHistoryPos === -1 )
							inst.tempInput = val;

						if ( inst.messageHistoryPos < inst.messageHistory.length - 1 ) {
							inst.messageHistoryPos++;
							inst.autocompleteInputRef.setValue(inst.messageHistory[inst.messageHistoryPos]);
							inst.ffzSetSelection(0);
						}

						return;

					// Arrow Down
					} else if ( code === 40 && sel[0] >= val.length && sel[1] === sel[0] ) {
						if ( ! inst.messageHistory.length )
							return;

						if ( inst.messageHistoryPos > 0 ) {
							inst.messageHistoryPos--;
							inst.autocompleteInputRef.setValue(inst.messageHistory[inst.messageHistoryPos]);
							inst.ffzSetSelection(inst.messageHistory[inst.messageHistoryPos].length);

						} else if ( inst.messageHistoryPos === 0 ) {
							inst.autocompleteInputRef.setValue(inst.tempInput);
							inst.ffzSetSelection(inst.tempInput.length);
							inst.messageHistoryPos = -1;
						}

						return;
					}
				}

				// Let users close stuff with Escape.
				if ( code === KEYS.Escape && ! event.shiftKey && ! event.ctrlKey && ! event.altKey ) {
					if ( inst.props.isShowingEmotePicker )
						inst.props.closeEmotePicker();
					else if ( inst.props.tray && (! inst.state.value || ! inst.state.value.length) )
						inst.closeTray();
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
					const val = inst.ffzGetValue();
					if (val && val.length) {
						if (! inst.messageHistory.length || inst.messageHistory[0] !== val) {
							inst.messageHistory.unshift(val);
							inst.messageHistory = inst.messageHistory.slice(0, 20);
						}
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
		inst.canBeTriggeredByTab = !this.chat.context.get('chat.tab-complete.emotes-without-colon');
	}


	overrideCommandMatcher(inst) {
		if ( inst._ffz_override )
			return;

		inst._ffz_override = true;
		inst.oldCommands = inst.getCommands;

		const t = this;

		inst.getCommands = function(input) { try {
			const commands = inst.props.getCommands(inst.props.permissionLevel, {
				isEditor: inst.props.isCurrentUserEditor
			});

			const event = new FFZEvent({
				input,
				permissionLevel: inst.props.permissionLevel,
				isEditor: inst.props.isCurrentUserEditor,
				commands
			});

			t.emit('chat:get-tab-commands', event);

			if ( ! commands || ! commands.length )
				return null;

			// Trim off the starting /
			const i = input.slice(1);

			const sorted = commands.filter(cmd => inst.doesCommandMatchTerm(cmd, i)).sort(inst.sortCommands);
			const out = [];
			for(const cmd of sorted) {
				const arg = cmd.commandArgs?.[0];
				let selection;
				if ( arg?.isRequired )
					selection = `[${arg.name}]`;

				out.push({
					current: input,
					replacement: inst.determineReplacement(cmd),
					element: inst.renderCommandSuggestion(cmd, i),
					group: cmd.ffz_group ?
						(Array.isArray(cmd.ffz_group) ? t.i18n.t(...cmd.ffz_group) : cmd.ffz_group)
						: inst.determineGroup(cmd),
					selection
				});
			}

			return out;

		} catch(err) {
			console.error(err);
			return inst.oldCommands(input);
		}}
	}


	createFakeEmoteSet(inst) {
		if ( ! this.use_previews )
			return null;

		if ( ! inst._ffz_channel_login ) {
			const parent = this.fine.searchParent(inst, 'chat-input', 50);
			if ( parent )
				this.updateEmoteCompletion(parent, inst);
		}

		const user = inst._ffz_user,
			channel_id = inst._ffz_channel_id,
			channel_login = inst._ffz_channel_login;

		if ( ! channel_login )
			return null;

		const sets = this.emotes.getSets(user?.id, user?.login, channel_id, channel_login);
		if ( ! sets || ! sets.length )
			return null;

		const out = [],
			added_emotes = new Set;

		for(const set of sets) {
			if ( ! set || ! set.emotes )
				continue;

			const source = set.source || 'ffz';

			for(const emote of Object.values(set.emotes)) {
				if ( ! emote || ! emote.id || ! emote.name || added_emotes.has(emote.name) )
					continue;

				added_emotes.add(emote.name);

				out.push({
					id: `__FFZ__${set.id}::${emote.id}__FFZ__`,
					modifiers: null,
					setID: 'FrankerFaceZWasHere',
					token: emote.name
				});
			}
		}

		return {
			__typename: 'EmoteSet',
			emotes: out,
			id: 'FrankerFaceZWasHere',
			owner: null
		}
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
			const emote_name = emote.name || emote.token;
			if ( ! emote_name )
				return NO_MATCH;

			if (emote_name.startsWith(term))
				return EXACT_PREFIX_MATCH;

			let emote_lower = emote.tokenLower;
			if ( ! emote_lower )
				emote_lower = emote_name.toLowerCase();

			const term_lower = term.toLowerCase();
			if (emote_lower.startsWith(term_lower))
				return CASE_INSENSITIVE_PREFIX_MATCH;

			const idx = emote_name.indexOf(term.charAt(0).toUpperCase());
			if (idx !== -1 && emote_lower.slice(idx + 1).startsWith(term_lower.slice(1)))
				return NON_PREFIX_MATCH;

			if (emote_lower.includes(term_lower))
				return MATCH_ANY;

			return NO_MATCH;
		}

		inst.getMatchedEmotes = function(input) {
			const setting = t.chat.context.get('chat.emotes.enabled');
			const limitResults = t.chat.context.get('chat.tab-complete.limit-results');
			let results = setting ? t.getTwitchEmoteSuggestions(input, this) : [];

			if ( setting > 1 && t.chat.context.get('chat.tab-complete.ffz-emotes') ) {
				const ffz_emotes = t.getEmoteSuggestions(input, this);
				if ( Array.isArray(ffz_emotes) && ffz_emotes.length )
					results = results.concat(ffz_emotes);
			}

			if ( t.chat.context.get('chat.tab-complete.emoji') ) {
				const emoji = t.getEmojiSuggestions(input, this);
				if ( Array.isArray(emoji) && emoji.length )
					results = Array.isArray(results) ? results.concat(emoji) : emoji;
			}

			results = t.sortEmotes(results);
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
	sortEmotes(emotes) {
		const preferFavorites = this.chat.context.get('chat.tab-complete.prioritize-favorites');
		const canBeTriggeredByTab = this.chat.context.get('chat.tab-complete.emotes-without-colon');
		const prioritizePrefixMatches = this.chat.context.get('chat.tab-complete.prioritize-prefix-matches');

		return emotes.sort((a, b) => {
			const aStr = a.matched || a.replacement;
			const bStr = b.matched || b.replacement;

			// Prefer favorites over non-favorites, if enabled
			if (preferFavorites && (a.favorite ^ b.favorite))
				return 0 - a.favorite + b.favorite;

			if (prioritizePrefixMatches) {
				// Prefer emoji over emotes if tab-complete is enabled, disprefer them otherwise
				const aIsEmoji = !!a.matched;
				const bIsEmoji = !!b.matched;
				if (aIsEmoji ^ bIsEmoji) {
					if (canBeTriggeredByTab) return 0 - aIsEmoji + bIsEmoji;
					else return 0 - bIsEmoji + aIsEmoji;
				}

				// Prefer case-sensitive prefix matches
				const aStartsWithInput = (a.match_type === EXACT_PREFIX_MATCH);
				const bStartsWithInput = (b.match_type === EXACT_PREFIX_MATCH);
				if (aStartsWithInput && bStartsWithInput)
					return locale.compare(aStr, bStr);
				else if (aStartsWithInput) return -1;
				else if (bStartsWithInput) return 1;

				// Else prefer case-insensitive prefix matches
				const aStartsWithInputCI = (a.match_type === CASE_INSENSITIVE_PREFIX_MATCH);
				const bStartsWithInputCI = (b.match_type === CASE_INSENSITIVE_PREFIX_MATCH);
				if (aStartsWithInputCI && bStartsWithInputCI)
					return localeCaseInsensitive.compare(aStr, bStr);
				else if (aStartsWithInputCI) return -1;
				else if (bStartsWithInputCI) return 1;

				// Else alphabetize
				return locale.compare(aStr, bStr);
			}

			// Keep unsorted order for non-favorite items if prefix matching is not enabled.
			return 0;
		});
	}


	buildTwitchCache(emotes) {
		if ( ! Array.isArray(emotes) )
			return {emotes: [], length: 0};

		const out = [],
			seen = new Set,
			anim = this.chat.context.get('chat.emotes.animated') > 0,
			hidden_sets = this.settings.provider.get('emote-menu.hidden-sets'),
			has_hidden = Array.isArray(hidden_sets) && hidden_sets.length > 0,
			hidden_emotes = this.emotes.getHidden('twitch'),
			favorites = this.emotes.getFavorites('twitch');

		for(const set of emotes) {
			const int_id = parseInt(set.id, 10),
				owner = set.owner,
				is_points = TWITCH_POINTS_SETS.includes(int_id) || owner?.login === 'channel_points',
				channel = is_points ? null : owner;

			// Skip this set.
			if ( set.id === 'FrankerFaceZWasHere' )
				continue;

			let key = `twitch-set-${set.id}`;
			let extra = null;

			if ( channel?.login ) {
				key = `twitch-${channel.id}`;
				extra = channel.displayName || channel.login;

			} else if ( is_points )
				key = 'twitch-points';
			else if ( TWITCH_GLOBAL_SETS.includes(int_id) )
				key = 'twitch-global';
			else if ( TWITCH_PRIME_SETS.includes(int_id) )
				key = 'twitch-prime';
			else
				key = 'twitch-misc';

			if ( has_hidden && hidden_sets.includes(key) )
				continue;

			for(const emote of set.emotes) {
				if ( ! emote || ! emote.id || hidden_emotes.includes(emote.id) )
					continue;

				const id = emote.id,
					token = KNOWN_CODES[emote.token] || emote.token;

				if ( ! token || seen.has(token) )
					continue;

				seen.add(token);

				const replacement = REPLACEMENTS[id];
				let srcSet;

				if ( replacement && this.chat.context.get('chat.fix-bad-emotes') ) {
					srcSet = `${REPLACEMENT_BASE}${replacement} 1x`;
				} else
					srcSet = getTwitchEmoteSrcSet(id, anim);

				out.push({
					id,
					source: key,
					extra,
					setID: set.id,
					token,
					tokenLower: token.toLowerCase(),
					srcSet,
					favorite: favorites.includes(id)
				});
			}
		}

		return {
			emotes: out,
			length: emotes.length
		}
	}


	getTwitchEmoteSuggestions(input, inst) {
		if ( inst.ffz_twitch_cache?.length !== inst.props.emotes?.length )
			inst.ffz_twitch_cache = this.buildTwitchCache(inst.props.emotes);

		const emoteMatchingType = this.chat.context.get('chat.tab-complete.matching');

		const emotes = inst.ffz_twitch_cache.emotes;

		if ( ! emotes.length )
			return [];

		const results_usage = [],
			results_starting = [],
			results_other = [],

			search = input.startsWith(':') ? input.slice(1) : input;

		for(const emote of emotes) {
			const match_type = inst.doesEmoteMatchTerm(emote, search);
			if (match_type < emoteMatchingType)
					continue;

			const element = {
				current: input,
				emote,
				replacement: emote.token,
				element: inst.renderEmoteSuggestion(emote),
				favorite: emote.favorite,
				count: this.EmoteUsageCount[emote.token] || 0,
				match_type
			};

			if (match_type < emoteMatchingType)
				continue;

			if ( element.count > 0 )
				results_usage.push(element);
			else if ( match_type > NON_PREFIX_MATCH )
				results_starting.push(element);
			else
				results_other.push(element);
		}

		results_usage.sort((a,b) => b.count - a.count);
		results_starting.sort((a,b) => locale.compare(a.replacement, b.replacement));
		results_other.sort((a,b) => locale.compare(a.replacement, b.replacement));

		return results_usage.concat(results_starting).concat(results_other);
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

		const included = new Set;

		for(const name in this.emoji.names)
			if ( has_colon ? name === search : name.startsWith(search) ) {
				const emoji = this.emoji.emoji[this.emoji.names[name]],
					toned = emoji.variants && emoji.variants[tone],
					source = toned || emoji;

				if ( emoji && (style === 0 || source.has[style]) && ! included.has(source.raw) ) {
					included.add(source.raw);

					const srcSet = this.emoji.getFullImageSet(source.image, style);
					const matched = `:${name}:`;

					const favorite = favorites.includes(emoji.code);
					results.push({
						current: input,
						emoji: source,
						matched,
						srcSet,
						replacement: source.raw,
						element: inst.renderFFZEmojiSuggestion({
							token: matched,
							id: `emoji-${emoji.code}`,
							src: this.emoji.getFullImage(source.image, style),
							srcSet,
							favorite
						}),
						favorite
					});
				}
			}

		return results;
	}


	buildFFZCache(user_id, user_login, channel_id, channel_login) {
		const sets = this.emotes.getSets(user_id, user_login, channel_id, channel_login);
		if ( ! sets || ! sets.length )
			return {emotes: [], length: 0, user_id, user_login, channel_id, channel_login};

		const out = [],
			anim = this.chat.context.get('chat.emotes.animated') > 0,
			hidden_sets = this.settings.provider.get('emote-menu.hidden-sets'),
			has_hidden = Array.isArray(hidden_sets) && hidden_sets.length > 0,
			added_emotes = new Set;

		for(const set of sets) {
			if ( ! set || ! set.emotes )
				continue;

			const source = set.source || 'ffz',
				source_line = set.source_line || (`${set.source || 'FFZ'} ${set.title || 'Global'}`),
				key = `${set.merge_source || source}-${set.merge_id || set.id}`;

			if ( has_hidden && hidden_sets.includes(key) )
				continue;

			const hidden_emotes = this.emotes.getHidden(source),
				favorites = this.emotes.getFavorites(source);

			for(const emote of Object.values(set.emotes)) {
				if ( ! emote || ! emote.id || emote.hidden || hidden_emotes.includes(emote.id) || added_emotes.has(emote.name) )
					continue;

				if ( ! emote.name )
					continue;

				added_emotes.add(emote.name);

				out.push({
					id: `${source}-${emote.id}`,
					source,
					extra: source_line,
					token: emote.name,
					tokenLower: emote.name.toLowerCase(),
					srcSet: anim && emote.animSrcSet || emote.srcSet,
					favorite: favorites.includes(emote.id)
				});
			}
		}

		return {
			emotes: out,
			length: sets.length
		}
	}


	getEmoteSuggestions(input, inst) {
		if ( ! inst._ffz_channel_login ) {
			const parent = this.fine.searchParent(inst, 'chat-input', 50);
			if ( parent )
				this.updateEmoteCompletion(parent, inst);
		}

		const emoteMatchingType = this.chat.context.get('chat.tab-complete.matching');

		const user = inst._ffz_user,
			channel_id = inst._ffz_channel_id,
			channel_login = inst._ffz_channel_login;

		if ( ! channel_login )
			return [];

		let cache = inst.ffz_ffz_cache;
		if ( ! cache || cache.user_id !== user?.id || cache.user_login !== user?.login || cache.channel_id !== channel_id || cache.channel_login !== channel_login )
			cache = inst.ffz_ffz_cache = this.buildFFZCache(user?.id, user?.login, channel_id, channel_login);

		const emotes = cache.emotes;
		if ( ! emotes.length )
			return [];

		const search = input.startsWith(':') ? input.slice(1) : input,
			results = [];

		for(const emote of emotes) {
			const match_type = inst.doesEmoteMatchTerm(emote, search)
			if (match_type < emoteMatchingType)
				continue;

			results.push({
				current: input,
				emote,
				replacement: emote.token,
				element: inst.renderEmoteSuggestion(emote),
				favorite: emote.favorite,
				count: 0, // TODO: Count stuff?
				match_type
			});
		}

		return results;

		/*for(const set of sets) {
			if ( ! set || ! set.emotes )
				continue;

			const

			if ( set && set.emotes )
				for(const emote of Object.values(set.emotes))
					if ( inst.doesEmoteMatchTerm(emote, search) && !added_emotes.has(emote.name) && ! this.emotes.isHidden(set.source || 'ffz', emote.id) ) {
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

		return results;*/
	}

	getInput() {
		for(const inst of this.ChatInput.instances) {
			if ( ! inst.autocompleteInputRef || ! inst.state )
				continue;

			if ( inst.state.value )
				return inst.state.value;
		}

		return null;
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
