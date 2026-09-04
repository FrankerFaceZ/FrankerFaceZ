'use strict';

// ============================================================================
// Chat Lines
//
// Kick renders each message with plain React function components, which
// FFZ can't wrap the way it wraps Twitch's class components. So lines are
// re-rendered at the DOM level instead. For every message row in the chat's
// virtual list, the message is read from the props React keeps on the row
// element (always current, unlike the fiber), run through FFZ's tokenizers,
// and rendered into a span placed right after Kick's own message span,
// which is hidden. React keeps managing its span; ours is checked again
// whenever the row changes and redone if Kick swapped the message out.
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';
import {split_chars} from 'utilities/object';
import {RERENDER_SETTINGS, UPDATE_BADGE_SETTINGS, UPDATE_TOKEN_SETTINGS} from 'utilities/constants';


const EMOTE_PATTERN = /\[emote:(\d+):([^\]]*)\]/g;

// Put on Kick's own message span while ours stands in for it.
const HIDDEN_CLASS = 'ffz--kick-hidden';

// The key React stores a host element's current props under. The suffix
// is random per page load, so it is found on the first row seen.
let props_key = null;

// Parts of a message body. Moderators get a row of mod-action buttons at
// the front of the body, so nothing here goes by position: Kick marks the
// timestamp with its display variable and the name button with an
// attribute of its own.
function findTimestamp(body) {
	return body.querySelector(':scope > span[style*="--chatroom-timestamps-display"]');
}

function findName(body) {
	return body.querySelector(':scope > div > button[data-prevent-expand]')
		|| body.querySelector(':scope > div:not([style*="--chatroom-mod-actions-display"]) > button');
}

function getRowProps(row) {
	if ( ! props_key || ! (props_key in row) ) {
		props_key = null;
		for(const key in row)
			if ( key.startsWith('__reactProps$') ) {
				props_key = key;
				break;
			}

		if ( ! props_key )
			return null;
	}

	// The row's only child is the message component; its props carry
	// the chat entry, the channel slug and the viewer's username.
	return row[props_key]?.children?.props ?? null;
}


export default class Line extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');

		this.inject('chat');
		this.inject('site.elemental');

		this.rows = new WeakMap;
		this._self = null;
		this._rerender_timer = null;

		// Message rows in the chat's virtual list. Their children are
		// watched too, since Kick re-renders a row in place (hover
		// actions, deletion), and our span has to be checked against
		// what is there now.
		this.ChatLine = this.elemental.define(
			'chat-line', '#chatroom-messages [data-index]',
			null, {childList: true, subtree: true}, 0, 0
		);
	}

	onEnable() {
		this.ChatLine.on('mount', this.checkRow, this);
		this.ChatLine.on('mutate', this.checkRow, this);
		this.ChatLine.on('unmount', this.cleanup, this);
		this.ChatLine.each(row => this.checkRow(row));

		this.on('chat.overrides:changed', id => this.updateLinesByUser(id, null), this);
		this.on('chat:update-lines-by-user', this.updateLinesByUser, this);
		this.on('chat:update-line', this.updateLineById, this);
		this.on('chat:update-lines', this.rerenderLines, this);
		this.on('chat:rerender-lines', this.rerenderLines, this);
		this.on('chat:update-line-tokens', this.rerenderLines, this);
		this.on('chat:update-line-badges', this.rerenderLines, this);
		this.on('i18n:update', this.rerenderLines, this);

		for(const setting of [...RERENDER_SETTINGS, ...UPDATE_TOKEN_SETTINGS, ...UPDATE_BADGE_SETTINGS])
			this.chat.context.on(`changed:${setting}`, this.rerenderLines, this);

		// Rows already on screen when the page loads are rendered before
		// FFZ's emote sets and emoji data have arrived. Redo them once
		// they have, coalescing the bursts of sets loading together.
		this.on('chat.emotes:loaded', this.scheduleRerender, this);
		this.on('chat.emotes:update-default-sets', this.scheduleRerender, this);
		this.on('chat.emotes:update-room-sets', this.scheduleRerender, this);
		this.on('chat.emoji:populated', this.scheduleRerender, this);
		this.on('load_tracker:complete:chat-data', this.scheduleRerender, this);

		// The FFZ room standing in for the channel changed (see the parent
		// module); every line's emotes come from it.
		this.on('site.chat:room-changed', this.scheduleRerender, this);

		this.on('chat:get-messages', (include_chat, include_whisper, include_video, messages) => {
			if ( ! include_chat )
				return;

			for(const row of this.ChatLine.instances) {
				const state = this.rows.get(row);
				if ( state?.msg )
					messages.push({
						message: state.msg,
						_instance: row,
						update: () => this.render(row, true)
					});
			}
		});
	}

	onDisable() {
		if ( this._rerender_timer ) {
			clearTimeout(this._rerender_timer);
			this._rerender_timer = null;
		}

		this.ChatLine.off('mount', this.checkRow, this);
		this.ChatLine.off('mutate', this.checkRow, this);
		this.ChatLine.off('unmount', this.cleanup, this);

		for(const row of this.ChatLine.instances)
			this.cleanup(row);
	}


	// ========================================================================
	// Updates
	// ========================================================================

	checkRow(row) {
		this.render(row, false);
	}

	rerenderLines() {
		for(const row of this.ChatLine.instances)
			this.render(row, true);
	}

	scheduleRerender() {
		if ( this._rerender_timer )
			return;

		this._rerender_timer = setTimeout(() => {
			this._rerender_timer = null;
			this.rerenderLines();
		}, 250);
	}

	updateLinesByUser(id, login) {
		for(const row of this.ChatLine.instances) {
			const user = this.rows.get(row)?.msg?.user;
			if ( user && ((id && id == user.id) || (login && login == user.login)) )
				this.render(row, true);
		}
	}

	updateLineById(id) {
		for(const row of this.ChatLine.instances) {
			const msg = this.rows.get(row)?.msg;
			if ( msg && msg.id === id ) {
				this.render(row, true);
				return;
			}
		}
	}


	// ========================================================================
	// Rendering
	// ========================================================================

	render(row, force = false) {
		const props = getRowProps(row),
			entry = props?.chatEntry,
			data = entry?.data;

		// The "New messages" divider is marked so it can be hidden by CSS,
		// and rows are marked even or odd for alternating backgrounds.
		row.classList.toggle('ffz--kick-divider', entry?.type === 'divider');
		row.classList.toggle('ffz--kick-even', (Number(row.dataset.index) & 1) === 0);

		// Dividers, system entries and anything without a message body
		// are left to Kick.
		if ( ! data || typeof data.content !== 'string' || ! data.sender )
			return this.cleanup(row);

		// The message body is the span after the ": " separator.
		const body = row.querySelector('div[style*="--chatroom-font-size"]'),
			original = body?.querySelector(':scope > span[aria-hidden="true"] + span');

		if ( ! original )
			return this.cleanup(row);

		const key = `${entry.id}\n${data.content}`,
			state = this.rows.get(row);

		if ( ! force && state && state.key === key && state.original === original && state.el.previousSibling === original && original.classList.contains(HIDDEN_CLASS) ) {
			// Kick may have rebuilt the name button or timestamp; keep them
			// ours.
			this.colorUsername(body, state.msg, this.getSelf(props));
			this.formatTimestamp(body, state.msg);
			return;
		}

		this.cleanup(row);

		this.parent.updateContext(props.channelSlug, data.chat_id ?? data.chatroom_id);

		let msg, el;
		try {
			msg = this.standardizeMessage(entry, props);
			const tokens = msg.ffz_tokens = this.chat.tokenizeMessage(msg, this.getSelf(props));

			el = createElement('span', {
				className: `${original.className} ffz--kick-message`
			}, this.chat.renderTokens(tokens, createElement));

		} catch(err) {
			this.log.error('Error rendering chat line.', err);
			return;
		}

		if ( this.chat.context.get('chat.emotes.animated') === 2 ) {
			el.addEventListener('mouseover', this.chat.emotes.animHover);
			el.addEventListener('mouseout', this.chat.emotes.animLeave);
		}

		// Kick listens for double-clicks on its span. Pass ours along.
		el.addEventListener('dblclick', evt => {
			original.dispatchEvent(new MouseEvent('dblclick', evt));
		});

		original.classList.add(HIDDEN_CLASS);
		original.after(el);
		this.colorUsername(body, msg, this.getSelf(props));
		this.formatTimestamp(body, msg);
		this.highlightLine(body, msg);

		this.rows.set(row, {key, original, el, msg, body});
	}

	// Kick's timestamp is the first span of the body, shown or hidden by
	// a variable the appearance module sets. With FFZ timestamps on, its
	// text is replaced with FFZ's format.
	formatTimestamp(body, msg) {
		const span = findTimestamp(body);
		if ( ! span )
			return;

		if ( this.settings.get('kick.chat.timestamps') !== 1 ) {
			// Back to Kick's own text, if we replaced it.
			if ( span.dataset.ffzOriginal != null ) {
				span.textContent = span.dataset.ffzOriginal;
				delete span.dataset.ffzOriginal;
			}
			return;
		}

		if ( ! msg.timestamp )
			return;

		const text = this.chat.formatTime(msg.timestamp);
		if ( span.textContent !== text ) {
			if ( span.dataset.ffzOriginal == null )
				span.dataset.ffzOriginal = span.textContent;
			span.textContent = text;
		}
	}

	// Lines that mention the viewer, or match a highlight term or user,
	// get a background when mention highlighting is on: the line's own
	// color, adjusted for readability, or the one the chat-mention-bg
	// tweak provides.
	highlightLine(body, msg) {
		const mentioned = !! msg.mentioned && this.chat.context.get('chat.filtering.highlight-mentions'),
			bg = mentioned && msg.mention_color
				? this.parent.inverse_colors.process(msg.mention_color)
				: null;

		body.classList.toggle('ffz-mentioned', mentioned);
		body.classList.toggle('ffz-custom-color', !! bg);
		body.style.backgroundColor = bg || '';
	}

	// The username is Kick's own button, colored inline. Kick's React only
	// rewrites that style when the color prop changes, so a color set here
	// sticks until the row is rebuilt, which brings us back here.
	colorUsername(body, msg, self) {
		const button = findName(body);
		if ( ! button )
			return;

		const color = this.parent.getUserColor(msg.user, self);
		if ( color && button.style.color !== color )
			button.style.color = color;
	}

	cleanup(row) {
		const state = this.rows.get(row);
		if ( ! state )
			return;

		this.rows.delete(row);
		state.el.remove();
		state.original.classList.remove(HIDDEN_CLASS);

		if ( state.body ) {
			state.body.classList.remove('ffz-mentioned', 'ffz-custom-color');
			state.body.style.backgroundColor = '';

			const span = findTimestamp(state.body);
			if ( span?.dataset?.ffzOriginal != null ) {
				span.textContent = span.dataset.ffzOriginal;
				delete span.dataset.ffzOriginal;
			}
		}
	}


	// ========================================================================
	// Messages
	// ========================================================================

	// The viewer, for mention highlighting.
	getSelf(props) {
		const name = props.selfUsername;
		if ( ! name )
			return null;

		if ( this._self?.displayName !== name )
			this._self = {
				login: name.toLowerCase(),
				displayName: name
			};

		return this._self;
	}

	standardizeMessage(entry, props) {
		const data = entry.data,
			sender = data.sender || {},
			identity = sender.identity || {},
			{message, emotes} = this.parseContent(data.content);

		// Live messages carry the channel's id as chat_id; ones loaded
		// from history carry the chatroom's id instead.
		const room_id = data.chat_id ?? data.chatroom_id;

		// The FFZ room is the Twitch channel standing in for this one; the
		// Kick channel itself is kept under its own names.
		const room = this.parent.room;

		const msg = {
			id: data.id,
			kick_entry: entry.id,
			type: data.type,
			timestamp: data.created_at ? Date.parse(data.created_at) : Date.now(),

			user: {
				id: sender.id != null ? `${sender.id}` : null,
				login: sender.slug || null,
				displayName: sender.username || sender.slug || null,
				color: identity.color || null
			},

			// Kick's badges stay Kick's for now; FFZ's own are looked up
			// by the shared standardization below.
			badges: {},

			roomID: room?.id ?? null,
			roomLogin: room?.login ?? null,

			kick_channel_id: room_id != null ? `${room_id}` : null,
			kick_channel: props.channelSlug || null,

			message,
			kick_emotes: emotes,

			// Already handled; keeps the shared code from looking for
			// Twitch-style emote data.
			ffz_emotes: {}
		};

		this.chat.standardizeMessage(msg);
		return msg;
	}

	// Turns "[emote:123:Name]" markup into plain text, keeping track of
	// where each emote's name lands so the tokenizer can find it. Offsets
	// count characters the way the tokenizers do.
	parseContent(content) {  
		const emotes = [];
		let out = '',
			idx = 0,
			last = 0;

		for(const match of content.matchAll(EMOTE_PATTERN)) {
			const before = content.slice(last, match.index);
			if ( before.length ) {
				out += before;
				idx += split_chars(before).length;
			}

			const name = match[2] || `emote${match[1]}`,
				length = split_chars(name).length;

			emotes.push({
				id: match[1],
				name,
				start: idx,
				end: idx + length
			});

			out += name;
			idx += length;
			last = match.index + match[0].length;
		}

		out += content.slice(last);

		return {message: out, emotes};
	}
}
