import type ExperimentManager from "../experiments";
import type TranslationManager from "../i18n";
import type Chat from "../modules/chat";
import type Actions from "../modules/chat/actions/actions";
import type Badges from "../modules/chat/badges";
import type Emoji from "../modules/chat/emoji";
import type Emotes from "../modules/chat/emotes";
import type Overrides from "../modules/chat/overrides";
import type EmoteCard from "../modules/emote_card";
import type LinkCard from "../modules/link_card";
import type MainMenu from "../modules/main_menu";
import type TranslationUI from "../modules/translation_ui";
import type SocketClient from "../socket";
import type Apollo from "./compat/apollo";
import type WebMunch from "./compat/webmunch";
import type { NamespacedEvents } from "./events";

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
	name_i18n?: string;

	/** Optional. A human-readable shortened name for the add-on, in English. */
	short_name?: string;
	short_name_i18n?: string;

	/** The name of the add-on's author. */
	author: string;
	author_i18n?: string;

	/** The name of the person or persons maintaining the add-on, if different than the author. */
	maintainer?: string;
	maintainer_i18n?: string;

	/** A description of the add-on. This can be multiple lines and supports Markdown. */
	description: string;
	description_i18n?: string;

	/** Optional. A settings UI key. If set, a Settings button will be displayed for this add-on that takes the user to this add-on's settings. */
	settings?: string;

	/** Optional. This add-on's website. If set, a Website button will be displayed that functions as a link. */
	website?: string;

	/** Optional. List of additional terms that can be searched for to find the add-on. */
	search_terms?: string | null;

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

	/** Optional. List of load tracker events that this add-on should hold while it's being loaded. */
	load_events?: string[];

};

// These types are used by get()

export type ExtractSegments<Input extends string> =
	Input extends `${infer Match}.${infer Rest}`
		? [ Match, ...ExtractSegments<Rest> ]
		: [ Input ];

export type ArrayShift<T extends any[]> = T extends [any, ...infer Rest]
	// This is needed to avoid it returning an empty array. There's probably
	// a more elegant solution, but I don't know it.
	? Rest extends [any, ...any[]]
		? Rest
		: undefined
	: undefined;

export type ExtractType<T, Path extends string[], Key = Path[0], Rest = ArrayShift<Path>> =
	Key extends "@each"
		? ExtractEach<T, Rest>
		:
	Key extends "@last"
		? T extends any[]
			? ExtractEach<T, Rest>
			: never
		:
	Key extends keyof T
		? Rest extends string[]
			? ExtractType<T[Key], Rest>
			: T[Key]
		:
	never;

export type ExtractEach<T, Rest> =
	Rest extends string[]
		? { [K in keyof T]: ExtractType<T[K], Rest> }
		: T;


export type ExtractKey<T,K> = K extends keyof T ? T[K] : never;


export type PartialPartial<T, OptionalKeys extends keyof T> = {
	[K in keyof T as K extends OptionalKeys ? never : K]: T[K];
} & {
	[K in OptionalKeys]?: T[K];
};


export type AnyFunction = (...args: any[]) => any;

export interface ClassType<T> {
	new (...args: any[]): T;
	prototype: T;
}


export type OptionallyThisCallable<TThis, TArgs extends any[], TReturn> = TReturn | ((this: TThis, ...args: TArgs) => TReturn);
export type OptionallyCallable<TArgs extends any[], TReturn> = TReturn | ((...args: TArgs) => TReturn);

export type OptionalPromise<T> = T | Promise<T>;

export type OptionalArray<T> = T | T[];

export type UnionToIntersection<Union> = (
    Union extends any ? (k: Union) => void : never
) extends (k: infer Intersection) => void ? Intersection : never;


export type RecursivePartial<T> = {
	[K in keyof T]?: T[K] extends object
		? RecursivePartial<T[K]>
		: T[K];
};


export type JoinKeyPaths<K, P, Separator extends string = '.'> = K extends string ?
	P extends string ?
		`${K}${P extends '' ? '' : Separator}${P}`
	: never : never;

export type ObjectKeyPaths<T, Separator extends string = '.', Prefix extends string = ''> =
	T extends object ?
		(Prefix extends '' ? never : Prefix) | { [K in keyof T]-?: JoinKeyPaths<K, ObjectKeyPaths<T[K], Separator>, Separator> }[keyof T]
		: Prefix;


export type ExtractFunctionNames<T, IncludeOptional extends boolean = false> = {
	[K in keyof T]:
		T[K] extends AnyFunction
			? K
			: IncludeOptional extends true ?
				T[K] extends AnyFunction | undefined
					? K
					: never
				: never;
}[keyof T];

/**
 * Extract all of the functions from a type. If IncludeOptional is set to
 * true, then also include functions that are possibly undefined. If
 * UnwrapOptional is set to true, which it is by default, the possibly
 * undefined functions are unwrapped in the resulting type. This makes it
 * easier to extract function parameters, etc.
 */
export type ExtractFunctions<T, IncludeOptional extends boolean = false, UnwrapOptional extends boolean = true> = {
	[K in ExtractFunctionNames<T, IncludeOptional>]: T[K] extends undefined | (infer U)
		? UnwrapOptional extends true
			? U
			: T[K]
		: T[K];
};


export type MaybeParameters<T> = T extends AnyFunction ? Parameters<T> : never[];


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


export interface SettingsTypeMap {

};

export interface ProviderTypeMap {

};

export interface PubSubCommands {

};

export interface ExperimentTypeMap {
	never: unknown;
};

export interface ModuleEventMap {

};

export interface ModuleMap {
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
	'main_menu': MainMenu;
	'site.apollo': Apollo;
	'site.web_munch': WebMunch;
	'socket': SocketClient;
	'translation_ui': TranslationUI;
};


export type KnownEvents = UnionToIntersection<{
	[K in keyof ModuleEventMap]: NamespacedEvents<K, ModuleEventMap[K]>
}[keyof ModuleEventMap]>;

export type ModuleKeys = string & keyof ModuleMap;
