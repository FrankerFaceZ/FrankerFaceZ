'use strict';

// ============================================================================
// Emote Menu
//
// A picker beside Kick's own emote button, listing the emotes FFZ knows
// for this chat (FFZ's and 7TV's sets, then Kick's own) in a searchable
// panel. Clicking one puts it in the chat box; holding Shift keeps the
// panel open for more.
// ============================================================================

import Module, {type GenericModule} from 'utilities/module';
import {createElement, setChildren, ClickOutside} from 'utilities/dom';

import type SettingsManager from 'src/settings';
import type TranslationManager from 'src/i18n';
import type Elemental from 'utilities/compat/elemental';

import type Input from './input';
import type {MenuEmote} from '../types';


export default class EmoteMenu extends Module<'site.chat.emote_menu'> {

	// Dependencies
	settings: SettingsManager = null as any;
	i18n: TranslationManager = null as any;
	elemental: Elemental = null as any;
	input: Input = null as any;

	// State
	/** Kick's emote button, which ours goes next to. */
	KickButton: ReturnType<Elemental['define']>;

	menu: HTMLElement | null;
	body: HTMLElement | null;
	query: string;

	private _outside: ClickOutside | null;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.inject('settings');
		this.inject('i18n');
		this.inject('site.elemental');
		this.inject('..input');

		this.settings.add('kick.chat.emote-menu', {
			default: true,
			ui: {
				path: 'Chat > Emote Menu >> General',
				title: 'Add an FFZ emote picker beside Kick\'s.',
				description: 'Lists FFZ, 7TV and Kick emotes. Click one to put it in the chat box; hold Shift to add several.',
				component: 'setting-check-box'
			}
		});

		this.KickButton = this.elemental.define(
			'emote-button', '#chatroom-footer button:has(svg[data-ds-icon="Smile"])',
			null, null, 1, 0
		);

		this.menu = null;
		this.body = null;
		this.query = '';
		this._outside = null;

		this.onKeyDown = this.onKeyDown.bind(this);
	}

	onEnable() {
		this.KickButton.on('mount', this.addButton, this);
		this.KickButton.each(button => this.addButton(button));

		this.settings.getChanges('kick.chat.emote-menu', enabled => {
			if ( enabled )
				this.KickButton.each(button => this.addButton(button));
			else
				this.removeButtons();
		});

		this.on('site.chat.input:update-emotes', this.refresh, this);
		this.on('chat.emotes:loaded', this.refresh, this);
		this.on('chat.emotes:update-room-sets', this.refresh, this);
		this.on('chat.emotes:update-default-sets', this.refresh, this);
	}

	onDisable() {
		this.KickButton.off('mount', this.addButton, this);
		this.close();
		this.removeButtons();
	}


	// ========================================================================
	// The Button
	// ========================================================================

	addButton(kick_button: HTMLElement) {
		if ( ! this.settings.get('kick.chat.emote-menu') )
			return;

		if ( kick_button.previousElementSibling?.classList.contains('ffz--kick-emote-button') )
			return;

		const button = createElement('button', {
			className: 'ffz--kick-emote-button ffz-tooltip',
			type: 'button',
			'data-title': this.i18n.t('emote-menu.title', 'FrankerFaceZ Emotes'),
			onClick: () => this.toggle()
		}, createElement('figure', {className: 'ffz-i-zreknarf'}));

		kick_button.before(button);
	}

	removeButtons() {
		for(const el of document.querySelectorAll('.ffz--kick-emote-button'))
			el.remove();
	}


	// ========================================================================
	// The Panel
	// ========================================================================

	toggle() {
		if ( this.menu )
			this.close();
		else
			this.open();
	}

	open() {
		const button = document.querySelector<HTMLElement>('.ffz--kick-emote-button');
		if ( ! button )
			return;

		this.query = '';

		const search = createElement('input', {
			className: 'ffz--kick-emote-menu__search',
			type: 'search',
			placeholder: this.i18n.t('emote-menu.search', 'Search Emotes'),
			autocomplete: 'off',
			spellcheck: false,
			onInput: () => {
				this.query = search.value.trim().toLowerCase();
				this.renderSections();
			}
		});

		this.body = createElement('div', {className: 'ffz--kick-emote-menu__body'});

		const menu = this.menu = createElement('div', {
			className: 'ffz--kick-emote-menu'
		}, [
			createElement('div', {className: 'ffz--kick-emote-menu__header'}, search),
			this.body
		]);

		document.body.appendChild(menu);
		this.position(button, menu);
		this.renderSections();

		// A click on our button toggles the panel itself.
		this._outside = new ClickOutside(menu, event => {
			if ( ! (event.target as HTMLElement | null)?.closest?.('.ffz--kick-emote-button') )
				this.close();
		});
		document.addEventListener('keydown', this.onKeyDown);
		search.focus();
	}

	close() {
		if ( this._outside ) {
			this._outside.destroy();
			this._outside = null;
		}

		document.removeEventListener('keydown', this.onKeyDown);

		if ( this.menu ) {
			this.menu.remove();
			this.menu = null;
			this.body = null;
		}
	}

	onKeyDown(event: KeyboardEvent) {
		if ( event.key === 'Escape' )
			this.close();
	}

	// Above the button, shrunk to fit; below it when there isn't room.
	position(button: HTMLElement, menu: HTMLElement) {
		const rect = button.getBoundingClientRect(),
			above = rect.top - 16,
			below = window.innerHeight - rect.bottom - 16,
			style = menu.style;

		style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

		if ( above >= 240 || above >= below ) {
			style.bottom = `${window.innerHeight - rect.top + 8}px`;
			style.top = '';
			style.maxHeight = `${Math.min(440, above)}px`;
		} else {
			style.top = `${rect.bottom + 8}px`;
			style.bottom = '';
			style.maxHeight = `${Math.min(440, below)}px`;
		}
	}

	refresh() {
		if ( this.menu )
			this.renderSections();
	}

	renderSections() {
		if ( ! this.body )
			return;

		const query = this.query,
			sections: HTMLElement[] = [];

		for(const set of this.input.getSets()) {
			const emotes = query
				? set.emotes.filter(emote => emote.name.toLowerCase().includes(query))
				: set.emotes;

			if ( ! emotes.length )
				continue;

			sections.push(createElement('section', {className: 'ffz--kick-emote-menu__section'}, [
				createElement('h4', {className: 'ffz--kick-emote-menu__section-title'}, `${set.title} (${emotes.length})`),
				createElement('div', {className: 'ffz--kick-emote-menu__grid'}, emotes.map(emote =>
					createElement('button', {
						className: 'ffz--kick-emote-menu__emote',
						type: 'button',
						title: emote.name,
						onClick: (event: MouseEvent) => this.pick(emote, event)
					}, createElement('img', {src: emote.src, alt: emote.name, loading: 'lazy'}))
				))
			]));
		}

		if ( ! sections.length )
			sections.push(createElement('div', {className: 'ffz--kick-emote-menu__empty'},
				this.i18n.t('emote-menu.empty', 'No emotes match.')));

		setChildren(this.body, sections);
	}

	pick(emote: MenuEmote, event?: MouseEvent) {
		this.input.insertText(`${emote.name} `);
		if ( ! event?.shiftKey )
			this.close();
	}
}
