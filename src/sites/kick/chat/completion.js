'use strict';

// ============================================================================
// Tab Completion
//
// Tab in Kick's chat box completes the word at the caret to an emote name
// (FFZ, 7TV or Kick), Tab again cycles through the matches, Shift+Tab
// cycles back, and any other key keeps what's there. A list of the
// matches floats above the box while cycling. Kick's own handling of Tab
// is left alone when nothing matches.
// ============================================================================

import Module from 'utilities/module';
import {createElement, setChildren} from 'utilities/dom';


const LIST_SIZE = 8;
const NBSP = String.fromCharCode(160);


export default class Completion extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('..input');

		this.settings.add('kick.chat.input.tab-complete', {
			default: true,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Complete emote names with Tab.',
				description: 'FFZ, 7TV and Kick emotes. Press Tab again to cycle through the matches, Shift+Tab to cycle back.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('kick.chat.input.tab-complete-list', {
			default: true,
			ui: {
				path: 'Chat > Input >> Tab Completion',
				title: 'Show the matches while completing.',
				component: 'setting-check-box'
			}
		});

		this.current = null;
		this.list = null;

		this.onKeyDown = this.onKeyDown.bind(this);
		this.onBlur = this.onBlur.bind(this);
	}

	onEnable() {
		this.input.Editor.on('mount', this.attach, this);
		this.input.Editor.on('unmount', this.detach, this);
		this.input.Editor.each(editor => this.attach(editor));
	}

	onDisable() {
		this.input.Editor.off('mount', this.attach, this);
		this.input.Editor.off('unmount', this.detach, this);
		this.input.Editor.each(editor => this.detach(editor));
		this.close();
	}

	attach(editor) {
		// Capture, to get there before Kick's own key handling.
		editor.addEventListener('keydown', this.onKeyDown, true);
		editor.addEventListener('blur', this.onBlur);
	}

	detach(editor) {
		editor.removeEventListener('keydown', this.onKeyDown, true);
		editor.removeEventListener('blur', this.onBlur);
		if ( this.current?.editor === editor )
			this.close();
	}


	// ========================================================================
	// Keys
	// ========================================================================

	onKeyDown(event) {
		if ( ! this.settings.get('kick.chat.input.tab-complete') )
			return;

		const editor = event.currentTarget;

		if ( event.key === 'Tab' && ! event.ctrlKey && ! event.altKey && ! event.metaKey ) {
			if ( this.complete(editor, event.shiftKey ? -1 : 1) ) {
				event.preventDefault();
				event.stopImmediatePropagation();
			}
			return;
		}

		if ( ! this.current )
			return;

		if ( event.key === 'Escape' ) {
			this.close();
			event.preventDefault();
			event.stopImmediatePropagation();
			return;
		}

		// Any other key ends the cycle; what was inserted stays.
		if ( event.key !== 'Shift' )
			this.close();
	}

	onBlur() {
		// After a click on the list has had its chance.
		setTimeout(() => {
			if ( this.current && document.activeElement !== this.current.editor )
				this.close();
		}, 150);
	}


	// ========================================================================
	// Completing
	// ========================================================================

	complete(editor, direction) {
		if ( this.current?.editor === editor )
			return this.cycle(direction);

		const target = this.input.getWordAtCaret(editor);
		if ( ! target?.word )
			return false;

		const lower = target.word.toLowerCase(),
			matches = this.input.getEmotes()
				.filter(emote => ! emote.modifier && emote.name.toLowerCase().startsWith(lower))
				.sort((a, b) => a.name.localeCompare(b.name));

		if ( ! matches.length )
			return false;

		this.current = {
			editor,
			prefix: target.word,
			matches,
			index: 0,
			inserted: null
		};

		this.apply();
		return true;
	}

	cycle(direction) {
		const state = this.current;
		state.index = (state.index + direction + state.matches.length) % state.matches.length;
		this.apply();
		return true;
	}

	// Put the current match in place of the prefix or the previous match,
	// both of which end at the caret.
	apply() {
		const state = this.current,
			editor = state.editor,
			expected = state.inserted ?? state.prefix,
			before = this.input.getTextBeforeCaret(editor, expected.length);

		// A contenteditable keeps a trailing space as a non-breaking one.
		if ( ! before || before.text.split(NBSP).join(' ') !== expected ) {
			this.close();
			return;
		}

		const text = `${state.matches[state.index].name} `;
		this.input.replaceRange(editor, before, text);
		state.inserted = text;

		this.render();
	}

	pick(index) {
		if ( ! this.current )
			return;

		this.current.index = index;
		this.apply();
		this.close();
	}

	close() {
		this.current = null;
		if ( this.list ) {
			this.list.remove();
			this.list = null;
		}
	}


	// ========================================================================
	// The List
	// ========================================================================

	render() {
		const state = this.current;
		if ( ! state || ! this.settings.get('kick.chat.input.tab-complete-list') )
			return;

		if ( ! this.list ) {
			this.list = createElement('div', {className: 'ffz--kick-completions'});
			document.body.appendChild(this.list);
		}

		// A window of matches around the current one.
		const total = state.matches.length,
			start = Math.max(0, Math.min(state.index - Math.floor(LIST_SIZE / 2), total - LIST_SIZE)),
			shown = state.matches.slice(start, start + LIST_SIZE);

		setChildren(this.list, shown.map((emote, i) => {
			const index = start + i;
			return createElement('div', {
				className: `ffz--kick-completions__item${index === state.index ? ' ffz--kick-completions__item--current' : ''}`,
				onMousedown: event => event.preventDefault(),
				onClick: () => this.pick(index)
			}, [
				emote.src ? createElement('img', {src: emote.src, alt: '', loading: 'lazy'}) : createElement('span', {className: 'ffz--kick-completions__blank'}),
				createElement('span', {className: 'ffz--kick-completions__name'}, emote.name),
				createElement('span', {className: 'ffz--kick-completions__source'}, emote.provider === 'kick' ? 'Kick' : (emote.set?.startsWith('seventv') ? '7TV' : 'FFZ'))
			]);
		}));

		const anchor = document.querySelector('#chat-input-wrapper') || state.editor,
			rect = anchor.getBoundingClientRect();

		this.list.style.left = `${rect.left}px`;
		this.list.style.width = `${rect.width}px`;
		this.list.style.bottom = `${window.innerHeight - rect.top + 6}px`;

		const current = this.list.querySelector('.ffz--kick-completions__item--current');
		current?.scrollIntoView?.({block: 'nearest'});
	}
}
