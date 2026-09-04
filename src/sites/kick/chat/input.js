'use strict';

// ============================================================================
// Chat Input
//
// Kick's chat box is a Lexical editor: a contenteditable whose state only
// follows changes made through the browser's editing commands, which is
// how text is put into it here. This module finds the box, reads and
// replaces the word at the caret, inserts text, and keeps a catalog of
// every emote a message can use (FFZ's and 7TV's sets for the channel, and
// Kick's own) for tab completion and the emote picker.
// ============================================================================

import Module from 'utilities/module';
import {fetchJSON} from 'utilities/object';


const KICK_EMOTE_URL = 'https://files.kick.com/emotes/';

const EDITOR_SELECTOR = '#chat-input-wrapper [contenteditable="true"], #chat-input-wrapper textarea, #chat-input-wrapper input:not([type="search"])';


// React only notices a value set through the element's own setter.
function setValue(el, value) {
	const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
		setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

	if ( setter )
		setter.call(el, value);
	else
		el.value = value;

	el.dispatchEvent(new Event('input', {bubbles: true}));
}

// Where the caret is, as a text node and offset. After an editing
// command the selection may sit on the paragraph just past a text node
// rather than inside it; that counts as the end of that node.
function caretPosition(editor) {
	const sel = window.getSelection();
	if ( ! sel?.rangeCount || ! sel.isCollapsed )
		return null;

	let node = sel.anchorNode,
		offset = sel.anchorOffset;

	if ( ! node || ! editor.contains(node) )
		return null;

	if ( node.nodeType !== Node.TEXT_NODE ) {
		const child = node.childNodes[offset - 1];
		if ( child?.nodeType !== Node.TEXT_NODE )
			return null;

		node = child;
		offset = child.textContent.length;
	}

	return {node, offset};
}

function wordStart(text, end) {
	let start = end;
	while ( start > 0 && ! /\s/.test(text[start - 1]) )
		start--;
	return start;
}


export default class Input extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('chat');
		this.inject('chat.emotes');
		this.inject('site.elemental');

		// Kick's emotes for the current channel, grouped as Kick groups
		// them: the channel's, global, emojis.
		this.kick_groups = [];
		this._kick_slug = null;
		this._kick_cache = new Map;

		this.Editor = this.elemental.define('chat-input', EDITOR_SELECTOR, null, null, 1, 0);
	}

	onEnable() {
		this.on('site.chat:room-changed', this.updateKickEmotes, this);
		this.updateKickEmotes();
	}

	onDisable() {
		this.off('site.chat:room-changed', this.updateKickEmotes, this);
	}

	get editor() {
		return this.Editor.first;
	}

	// What's typed so far.
	getInput() {
		const el = this.editor;
		if ( ! el )
			return '';

		return el.isContentEditable ? el.textContent : el.value;
	}


	// ========================================================================
	// Text
	// ========================================================================

	// The word the caret sits at the end of: its text and where it is.
	getWordAtCaret(editor = this.editor) {
		if ( ! editor )
			return null;

		if ( editor.isContentEditable ) {
			const caret = caretPosition(editor);
			if ( ! caret )
				return null;

			const {node, offset: end} = caret,
				text = node.textContent,
				start = wordStart(text, end);

			return {node, start, end, word: text.slice(start, end)};
		}

		const text = editor.value,
			end = editor.selectionStart ?? text.length;

		if ( (editor.selectionEnd ?? end) !== end )
			return null;

		const start = wordStart(text, end);
		return {start, end, word: text.slice(start, end)};
	}

	// The text ending at the caret, up to a length. For checking what a
	// previous completion left there.
	getTextBeforeCaret(editor, length) {
		if ( editor.isContentEditable ) {
			const caret = caretPosition(editor);
			if ( ! caret )
				return null;

			const {node, offset: end} = caret,
				start = Math.max(0, end - length);

			return {node, start, end, text: node.textContent.slice(start, end)};
		}

		const end = editor.selectionStart ?? editor.value.length,
			start = Math.max(0, end - length);

		return {start, end, text: editor.value.slice(start, end)};
	}

	// Replace the range with text, leaving the caret after it.
	replaceRange(editor, target, text) {
		if ( editor.isContentEditable ) {
			const range = document.createRange();
			range.setStart(target.node, target.start);
			range.setEnd(target.node, target.end);

			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);

			editor.focus();
			document.execCommand('insertText', false, text);
			return;
		}

		const value = editor.value;
		setValue(editor, value.slice(0, target.start) + text + value.slice(target.end));

		const pos = target.start + text.length;
		editor.focus();
		editor.setSelectionRange(pos, pos);
	}

	// Insert text at the caret, or at the end if the box isn't focused,
	// with a space before it when it follows a word.
	insertText(text) {
		const editor = this.editor;
		if ( ! editor )
			return false;

		if ( editor.isContentEditable ) {
			// Focusing a contenteditable puts the caret at its start, so a
			// box that wasn't focused gets the text at its end instead.
			const had_focus = document.activeElement === editor;
			editor.focus();

			const sel = window.getSelection();
			if ( ! had_focus || ! sel?.rangeCount || ! editor.contains(sel.anchorNode) ) {
				const range = document.createRange();
				range.selectNodeContents(editor);
				range.collapse(false);
				sel.removeAllRanges();
				sel.addRange(range);
			}

			const at = this.getWordAtCaret(editor),
				prefix = at?.word ? ' ' : '';

			document.execCommand('insertText', false, prefix + text);
			return true;
		}

		const value = editor.value,
			start = editor.selectionStart ?? value.length,
			end = editor.selectionEnd ?? start,
			before = value.slice(0, start),
			prefix = before && ! /\s$/.test(before) ? ' ' : '';

		setValue(editor, before + prefix + text + value.slice(end));

		const pos = start + prefix.length + text.length;
		editor.focus();
		editor.setSelectionRange(pos, pos);
		return true;
	}


	// ========================================================================
	// Emotes
	// ========================================================================

	async updateKickEmotes() {
		const slug = this.parent.channel;
		if ( slug === this._kick_slug )
			return;

		this._kick_slug = slug;
		this.kick_groups = [];

		if ( ! slug )
			return;

		let groups = this._kick_cache.get(slug);
		if ( ! groups ) {
			// Kick's own API, same-origin on kick.com.
			const data = await fetchJSON(`/emotes/${encodeURIComponent(slug)}`);
			if ( this._kick_slug !== slug )
				return;

			groups = Array.isArray(data) ? data : [];
			this._kick_cache.set(slug, groups);
		}

		this.kick_groups = groups.map(group => ({
			id: `kick-${group.id}`,
			title: group.id === 'Global' ? 'Kick Global'
				: group.id === 'Emoji' ? 'Kick Emojis'
					: `Kick Channel: ${group.user?.username || group.slug || slug}`,
			emotes: (group.emotes || [])
				.filter(emote => emote?.id && emote.name)
				.map(emote => ({
					name: emote.name,
					src: `${KICK_EMOTE_URL}${emote.id}/fullsize`,
					provider: 'kick',
					sub: !! emote.subscribers_only
				}))
		})).filter(group => group.emotes.length);

		this.emit(':update-emotes');
	}

	// Every set usable in this chat, as lists of {name, src, provider}:
	// FFZ's and 7TV's for the channel, then Kick's.
	getSets() {
		const room = this.parent.room,
			out = [],
			seen = new Set;

		for(const set of this.emotes.getSets(null, null, room?.id, room?.login)) {
			if ( ! set?.emotes || seen.has(set.id) )
				continue;

			seen.add(set.id);

			const emotes = [];
			for(const emote of Object.values(set.emotes))
				if ( emote && ! emote.hidden )
					emotes.push({
						name: emote.name,
						src: emote.urls?.[1],
						provider: 'ffz',
						set: set.id,
						modifier: !! emote.modifier
					});

			if ( emotes.length )
				out.push({
					id: set.id,
					title: set.source_line || `${set.source || 'FFZ'} ${set.title || 'Global'}`,
					emotes
				});
		}

		for(const group of this.kick_groups)
			out.push(group);

		return out;
	}

	// Every emote by name, first source wins.
	getEmotes() {
		const seen = new Set,
			out = [];

		for(const set of this.getSets())
			for(const emote of set.emotes)
				if ( ! seen.has(emote.name) ) {
					seen.add(emote.name);
					out.push(emote);
				}

		return out;
	}
}
