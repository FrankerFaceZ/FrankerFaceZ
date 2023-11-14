import type ExperimentManager from "../experiments";
import type TranslationManager from "../i18n";
import type LoadTracker from "../load_tracker";
import type { LoadEvents } from "../load_tracker";
import type Chat from "../modules/chat";
import type Actions from "../modules/chat/actions/actions";
import type Badges from "../modules/chat/badges";
import type Emoji from "../modules/chat/emoji";
import type Emotes from "../modules/chat/emotes";
import type Overrides from "../modules/chat/overrides";
import type EmoteCard from "../modules/emote_card";
import type LinkCard from "../modules/link_card";
import type MainMenu from "../modules/main_menu";
import type Metadata from "../modules/metadata";
import type TooltipProvider from "../modules/tooltips";
import type { TooltipEvents } from "../modules/tooltips";
import type TranslationUI from "../modules/translation_ui";
import type PubSub from "../pubsub";
import type { SettingsEvents } from "../settings";
import type SettingsManager from "../settings";
import type SocketClient from "../socket";
import type StagingSelector from "../staging";
import type Apollo from "./compat/apollo";
import type Elemental from "./compat/elemental";
import type Fine from "./compat/fine";
import type Subpump from "./compat/subpump";
import type { SubpumpEvents } from "./compat/subpump";
import type WebMunch from "./compat/webmunch";
import type CSSTweaks from "./css-tweaks";
import type { NamespacedEvents } from "./events";
import type TwitchData from "./twitch-data";
import type Vue from "./vue";

/**
 * AddonInfo represents the data contained in an add-on's manifest.
 */
export type AddonInfo = {

	// ========================================================================
	// System Data
	// ========================================================================

	/** The add-on's ID. This is used to identify content, including settings, modules, emotes, etc. that are associated with the add-on. */
	id: string;

	/** The add-on's version number. This should be a semantic version, but this is not enforced. */
	version: string;

	// ========================================================================
	// Metadata
	// ========================================================================

	/** The human-readable name of the add-on, in English. */
	name: string;

	/** Optional. A human-readable shortened name for the add-on, in English. */
	short_name?: string;

	/** The name of the add-on's author. */
	author: string;

	/** The name of the person or persons maintaining the add-on, if different than the author. */
	maintainer?: string;

	/** A description of the add-on. This can be multiple lines and supports Markdown. */
	description: string;

	/** Optional. A settings UI key. If set, a Settings button will be displayed for this add-on that takes the user to this add-on's settings. */
	settings?: string;

	/** Optional. This add-on's website. If set, a Website button will be displayed that functions as a link. */
	website?: string;

	/** The date when the add-on was first created. */
	created: Date;

	/** The date when the add-on was last updated. */
	updated?: Date;

	// ========================================================================
	// Runtime Requirements / State
	// ========================================================================

	/** Whether or not the add-on has been loaded from a development center. */
	dev: boolean;

	/** Whether or not the add-on has been loaded externally (outside of FFZ's control). */
	external: boolean;

	/** A list of add-ons, by ID, that require this add-on to be enabled to function. */
	required_by: string[];

	/** A list of add-ons, by ID, that this add-on requires to be enabled to function. */
	requires: string[];

	/** List of FrankerFaceZ flavors ("main", "clips", "player") that this add-on supports. */
	targets: string[];

};

export type OptionallyThisCallable<TThis, TArgs extends any[], TReturn> = TReturn | ((this: TThis, ...args: TArgs) => TReturn);
export type OptionallyCallable<TArgs extends any[], TReturn> = TReturn | ((...args: TArgs) => TReturn);

export type OptionalPromise<T> = T | Promise<T>;

export type OptionalArray<T> = T | T[];

export type RecursivePartial<T> = {
	[K in keyof T]?: T[K] extends object
		? RecursivePartial<T[K]>
		: T[K];
};


export type ClientVersion = {
	major: number;
	minor: number;
	revision: number;
	extra: number;
	commit: string | null;
	build: string;
	hash: string;
};


export type Mousetrap = {
	bind(
		keys: string | string[],
		callback: (event: KeyboardEvent, combo: string) => boolean | void
	): void;
	unbind(keys: string | string[], action?: string): void;
};


export type DomFragment = Node | string | null | undefined | DomFragment[];



// TODO: Move this event into addons.
type AddonEvent = {
	'addon:fully-unload': [addon_id: string]
};


export type KnownEvents =
	AddonEvent &
	NamespacedEvents<'load_tracker', LoadEvents> &
	NamespacedEvents<'settings', SettingsEvents> &
	NamespacedEvents<'site.subpump', SubpumpEvents> &
	NamespacedEvents<'tooltips', TooltipEvents>;


export type ModuleMap = {
	'chat': Chat;
	'chat.actions': Actions;
	'chat.badges': Badges;
	'chat.emoji': Emoji;
	'chat.emotes': Emotes;
	'chat.overrides': Overrides;
	'emote_card': EmoteCard;
	'experiments': ExperimentManager;
	'i18n': TranslationManager;
	'link_card': LinkCard;
	'load_tracker': LoadTracker;
	'main_menu': MainMenu;
	'metadata': Metadata;
	'pubsub': PubSub;
	'settings': SettingsManager;
	'site.apollo': Apollo;
	'site.css_tweaks': CSSTweaks;
	'site.elemental': Elemental;
	'site.fine': Fine;
	'site.subpump': Subpump;
	'site.twitch_data': TwitchData;
	'site.web_munch': WebMunch;
	'socket': SocketClient;
	'staging': StagingSelector;
	'tooltips': TooltipProvider;
	'translation_ui': TranslationUI;
	'vue': Vue;
};
