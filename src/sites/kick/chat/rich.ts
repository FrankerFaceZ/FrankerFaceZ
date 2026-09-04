'use strict';

// ============================================================================
// Rich Content
//
// Link previews below messages. FFZ's link resolver describes a page as a
// document of rich tokens, which utilities/rich_tokens renders with any
// createElement. On Twitch that's a React component (the Twitch site's
// rich_content.jsx); here it is plain DOM: the card is built at once with
// a loading state and filled in when the data arrives.
// ============================================================================

import {createElement, setChildren} from 'utilities/dom';
import {timeout} from 'utilities/object';

import type Chat from 'src/modules/chat';
import type TranslationManager from 'src/i18n';
import type {DomFragment} from 'utilities/types';


const ERROR_IMAGE = 'https://static-cdn.jtvnw.net/emoticons/v1/58765/2.0';
const LOAD_TIMEOUT = 5000;

/** A rich token plucked from a message (see chat.pluckRichContent). */
export type RichContent = {
	url?: string;
	timeout?: number;
	want_mid?: boolean;
	getData(refresh: boolean): RichData | Promise<RichData | null | undefined> | null | undefined;
};

/** What the link resolver returns for a page. */
type RichData = {
	error?: unknown;
	v?: number;
	unsafe?: boolean;
	accent?: string;
	title?: string;
	description?: string;
	short?: unknown;
	mid?: unknown;
	fragments?: unknown;
	i18n_prefix?: string;
};

type Tokenizer = typeof import('utilities/rich_tokens');

let tokenizer: Promise<Tokenizer> | null = null;

function loadTokenizer() {
	if ( ! tokenizer )
		tokenizer = import(/* webpackChunkName: 'rich_tokens' */ 'utilities/rich_tokens');

	return tokenizer;
}


// Builds the card for a plucked rich token and starts loading its data.
export function renderRichCard(chat: Chat, i18n: TranslationManager, rich: RichContent) {
	const body = createElement('div', {
		className: 'tw-flex tw-flex-nowrap tw-pd-05'
	}, renderBasic(i18n, null));

	let content: HTMLElement = body,
		link: HTMLAnchorElement | null = null;

	if ( rich.url )
		content = link = createElement('a', {
			className: 'tw-block tw-border-radius-medium tw-full-width ffz-interactable ffz-interactable--default ffz-interactable--hover-enabled tw-interactive',
			'data-tooltip-type': 'link',
			'data-url': rich.url,
			target: '_blank',
			rel: 'noreferrer noopener',
			href: rich.url,
			onClick: chat.handleLinkClick
		}, body);

	const card = createElement('div', {
		className: 'tw-border-radius-medium tw-elevation-1 ffz--chat-card tw-relative'
	}, createElement('div', {
		className: 'tw-border-radius-medium tw-c-background-alt tw-flex tw-full-width'
	}, content));

	load(chat, i18n, rich, body, card, link).catch(err => {
		chat.log.warn('Error rendering rich content.', err);
	});

	return card;
}


async function load(
	chat: Chat,
	i18n: TranslationManager,
	rich: RichContent,
	body: HTMLElement,
	card: HTMLElement,
	link: HTMLAnchorElement | null
) {
	let data: RichData;
	try {
		let result = rich.getData(false);
		if ( result instanceof Promise ) {
			const wait = rich.timeout ?? LOAD_TIMEOUT;
			result = wait ? await timeout(result, wait) : await result;
		}

		data = result || {
			error: {type: 'i18n', key: 'card.empty', phrase: 'No data was returned.'}
		};

	} catch(err) {
		data = {error: (err as Error)?.message === 'timeout' ? 'Timed out.' : String(err)};
	}

	if ( data.error )
		data = {
			short: {
				type: 'header',
				image: {type: 'image', url: ERROR_IMAGE},
				title: {type: 'i18n', key: 'card.error', phrase: 'An error occurred.'},
				subtitle: data.error
			}
		};

	const tokens = await loadTokenizer();

	// The card is gone if the message was re-rendered meanwhile.
	if ( ! card.isConnected )
		return;

	let doc = (rich.want_mid && data.mid) ? data.mid : data.short;
	if ( data.v && data.v > tokens.VERSION )
		doc = null;

	if ( data.unsafe )
		card.classList.add('ffz--unsafe');

	if ( data.accent ) {
		card.style.setProperty('--ffz-color-accent', data.accent);
		if ( link )
			link.classList.add('ffz-accent-card');
	}

	if ( ! doc ) {
		setChildren(body, renderBasic(i18n, data));
		return;
	}

	const ctx = {
		vue: false,
		tList: (...args: unknown[]) => i18n.tList(...args),
		i18n,

		last_player: 0,
		player_state: {},
		togglePlayer: () => {},

		link_click_handler: chat.handleLinkClick,

		fragments: data.fragments,
		i18n_prefix: data.i18n_prefix,

		allow_media: chat.context.get('tooltip.link-images'),
		allow_unsafe: chat.context.get('tooltip.link-nsfw-images')
	};

	setChildren(body, createElement('div', {
		className: 'ffz-card-rich tw-full-width tw-overflow-hidden tw-flex tw-flex-column'
	}, tokens.renderTokens(doc, createElement, ctx)));
}


// The loading and fallback states: a title and a line or two of text.
function renderBasic(i18n: TranslationManager, data: RichData | null): DomFragment {
	let title: string | undefined,
		description: string | undefined;

	if ( ! data )
		description = i18n.t('card.loading', 'Loading...');
	else {
		title = data.title;
		description = data.description;
	}

	if ( ! title && ! description )
		description = i18n.t('card.empty', 'No data was returned.');

	const lines = description
		? description.split(/\n+/).slice(0, 2).map(line => createElement('div', {
			className: 'tw-c-text-alt-2 tw-ellipsis tw-mg-x-05',
			title: line
		}, line))
		: [];

	return [
		createElement('div', {className: 'ffz--header-image'}),
		createElement('div', {
			className: 'ffz--card-text tw-full-width tw-overflow-hidden tw-flex tw-flex-column tw-justify-content-center'
		}, [
			title ? createElement('div', {className: 'chat-card__title tw-ellipsis tw-mg-x-05'},
				createElement('span', {className: 'tw-strong', title}, title)) : null,
			...lines
		])
	];
}
