// ============================================================================
// Kick Types
//
// The shapes the Kick site modules pass between each other: what Kick's
// React props and API responses look like, the FFZ message built from
// them, and the emote lists the chat box, tab completion and emote picker
// share. The declarations at the bottom register the site's settings,
// modules and events with FFZ's type maps.
// ============================================================================

import type Room from 'src/modules/chat/room';

import type Appearance from './appearance';
import type Badges from './badges';
import type SevenTV from './seventv';
import type Chat from './chat';
import type Line from './chat/line';
import type Input from './chat/input';
import type Completion from './chat/completion';
import type EmoteMenu from './chat/emote_menu';


// ============================================================================
// Kick's Data
// ============================================================================

/** A badge on a message's sender, as Kick sends it. */
export type KickBadge = {
	type: string;
	text?: string;
	count?: number;
};

/** The sender of a message, as Kick sends it. */
export type KickSender = {
	id?: number | string;
	slug?: string;
	username?: string;
	identity?: {
		color?: string | null;
		badges?: KickBadge[];
	};
};

/** A chat message, as Kick sends it. */
export type KickMessageData = {
	id: string;
	type?: string;
	content?: string;
	created_at?: string;
	/** The channel's id, on live messages. */
	chat_id?: number | string;
	/** The chatroom's id, on messages loaded from history. */
	chatroom_id?: number | string;
	sender?: KickSender;
};

/** An entry in Kick's chat list: a message, a divider or a system line. */
export type KickChatEntry = {
	id: string;
	type?: string;
	data?: KickMessageData;
};

/** The props of the message component on a chat row. */
export type KickRowProps = {
	chatEntry?: KickChatEntry;
	channelSlug?: string;
	selfUsername?: string;
};

/** A group of Kick's own emotes from its emotes API. */
export type KickEmoteGroup = {
	id: string | number;
	slug?: string;
	user?: {username?: string};
	emotes?: {
		id: string | number;
		name: string;
		subscribers_only?: boolean;
	}[];
};


// ============================================================================
// Messages
// ============================================================================

export type KickUser = {
	id: string | null;
	login: string | null;
	displayName: string | null;
	color: string | null;
};

/** The viewer, as far as mention highlighting is concerned. */
export type KickSelf = {
	login: string;
	displayName: string;
};

/** Where an emote's name sits in a message's text, in characters. */
export type KickEmoteSpan = {
	id: string;
	name: string;
	start: number;
	end: number;
};

/** A chat token. The shared chat module defines the kinds. */
export type ChatToken = {
	type: string;
	text?: string;
	length?: number;
	[key: string]: unknown;
};

/** A Kick message in FFZ's shape, after standardization. */
export type KickChatMessage = {
	id: string;
	kick_entry: string;
	type?: string;
	timestamp: number;

	user: KickUser;
	badges: Record<string, unknown>;

	roomID: string | null;
	roomLogin: string | null;

	kick_channel_id: string | null;
	kick_channel: string | null;

	message: string;
	kick_emotes: KickEmoteSpan[];
	ffz_emotes: Record<string, unknown>;

	// Set by the shared chat module.
	ffz_tokens?: ChatToken[];
	mentioned?: boolean;
	mention_color?: string | null;

	[key: string]: unknown;
};


// ============================================================================
// Emote Lists
// ============================================================================

/** An emote the chat box can use, from any source. */
export type MenuEmote = {
	name: string;
	src?: string;
	provider: 'ffz' | 'kick';
	/** The FFZ set the emote came from. */
	set?: string;
	modifier?: boolean;
	/** Subscriber-only, for Kick's own emotes. */
	sub?: boolean;
};

export type MenuEmoteSet = {
	id: string;
	title: string;
	emotes: MenuEmote[];
};


// ============================================================================
// Events
// ============================================================================

export type KickChatEvents = {
	/** The FFZ room standing in for the channel changed. */
	':room-changed': [room: Room | null];
};

export type KickInputEvents = {
	/** Kick's own emotes for the channel were reloaded. */
	':update-emotes': [];
};

// Events the shared chat modules emit. They are written in JavaScript and
// do not declare their events, so the ones listened for here are declared
// here. Drop these once those modules are typed.
type ChatEvents = {
	':update-lines-by-user': [id: string | null, login: string | null];
	':update-line': [id: string];
	':update-lines': [];
	':rerender-lines': [];
	':update-line-tokens': [];
	':update-line-badges': [];
	':get-messages': [include_chat: boolean, include_whisper: boolean, include_video: boolean, messages: unknown[]];
};

type EmotesEvents = {
	':loaded': [set_id: string, set: unknown];
	':update-default-sets': [provider: string, set_id: string, added: boolean];
	':update-room-sets': [provider: string, set_id: string, added: boolean];
};

type EmojiEvents = {
	':populated': [];
};


// ============================================================================
// Registration
// ============================================================================

declare module 'src/settings/types' {
	interface ConcreteContextData {
		/** Set on Kick, for settings profiles scoped to the site. */
		kick: boolean;
	}
}

declare module 'utilities/types' {
	interface ModuleMap {
		'site.appearance': Appearance;
		'site.badges': Badges;
		'site.seven_tv': SevenTV;
		'site.chat': Chat;
		'site.chat.line': Line;
		'site.chat.input': Input;
		'site.chat.completion': Completion;
		'site.chat.emote_menu': EmoteMenu;
	}

	interface ModuleEventMap {
		'site.chat': KickChatEvents;
		'site.chat.input': KickInputEvents;

		'chat': ChatEvents;
		'chat.emotes': EmotesEvents;
		'chat.emoji': EmojiEvents;
	}

	interface SettingsTypeMap {
		// Site
		'theme.is-dark': boolean;

		// Appearance
		'kick.theme.palette': number;
		'kick.theme.darker-accent': boolean;
		'kick.layout.hide-recommended': boolean;
		'kick.layout.compact-header': boolean;
		'kick.layout.hide-gift-subs': boolean;
		'kick.layout.hide-kicks': boolean;
		'kick.layout.hide-chat-banners': boolean;
		'kick.layout.hide-new-messages': boolean;
		'kick.layout.hide-quick-emotes': boolean;
		'kick.layout.hide-chat-stats': boolean;
		'kick.chat.font-size': number;
		'kick.chat.message-spacing': number;
		'kick.chat.lines.alternate': boolean;
		'kick.chat.input-style': boolean;
		'kick.chat.mod-actions': number;
		'kick.chat.mod-actions.style': number;
		'kick.chat.timestamps': number;

		// Badges
		'kick.chat.badges.hidden': Record<string, boolean>;
		'kick.chat.badges.style': number;
		'kick.chat.badges.size': number;

		// Chat
		'kick.chat.username-colors': number;
		'kick.chat.my-color': string;
		'kick.emotes.channel-source': number;

		// Input
		'kick.chat.input.tab-complete': boolean;
		'kick.chat.input.tab-complete-list': boolean;
		'kick.chat.emote-menu': boolean;

		// 7TV
		'kick.emotes.7tv': boolean;

		// Settings the shared chat and tooltip modules own. They are written
		// in JavaScript and do not declare them; these are the ones read
		// here. Drop these once those modules are typed.
		'chat.adjustment-mode': number;
		'chat.adjustment-contrast': number;
		'chat.emotes.enabled': number;
		'chat.emotes.2x': number;
		'chat.emotes.animated': number;
		'chat.filtering.highlight-mentions': boolean;
		'chat.filtering.mention-color': string;
		'tooltip.link-images': boolean;
		'tooltip.link-nsfw-images': boolean;
	}
}
