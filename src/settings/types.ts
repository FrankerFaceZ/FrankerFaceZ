import type SettingsManager from ".";
import type { FilterData } from "../utilities/filtering";
import type { PathNode } from "../utilities/path-parser";
import type { ExtractSegments, ExtractType, JoinKeyPaths, ObjectKeyPaths, OptionalPromise, OptionallyCallable, RecursivePartial, SettingsTypeMap } from "../utilities/types";
import type SettingsContext from "./context";
import type { SettingsProvider } from "./providers";


// Clearables

type SettingsClearableKeys = {
	keys: OptionallyCallable<[provider: SettingsProvider, manager: SettingsManager], OptionalPromise<string[]>>;
}

type SettingsClearableClear = {
	clear(provider: SettingsProvider, manager: SettingsManager): OptionalPromise<void>;
}

export type SettingsClearable = {
	label: string;
	__source?: string | null;

} & (SettingsClearableKeys | SettingsClearableClear);


// Context

export interface ConcreteContextData {
	addonDev: boolean;

	category: string;
	categoryID: string;

	chat: {

	};

	title: string;
	channel: string;
	channelColor: string;
	channelID: string;

	chatHidden: boolean;
	fullscreen: boolean;
	isWatchParty: boolean;
	moderator: boolean;

	route: {
		domain: string | null;
		name: string | null;
	};

	route_data: string[];

	size: {
		width: number;
		height: number
	};

	ui: {
		theatreModeEnabled: boolean;
		squadModeEnabled: boolean;
		theme: number;
	};

};

export type ContextData = RecursivePartial<ConcreteContextData>;

export interface ConcreteLocalStorageData {
	test: number;
}

export type LocalStorageData = Partial<ConcreteLocalStorageData>;

export type SettingsContextKeys = JoinKeyPaths<'context', ObjectKeyPaths<ConcreteContextData>>;
export type SettingsLocalStorageKeys = JoinKeyPaths<'ls', ObjectKeyPaths<ConcreteLocalStorageData>> | JoinKeyPaths<'ls.raw', ObjectKeyPaths<ConcreteLocalStorageData>>;
export type SettingsKeys = keyof SettingsTypeMap;
export type AllSettingsKeys = SettingsKeys | SettingsContextKeys | SettingsLocalStorageKeys;

export type SettingType<K extends AllSettingsKeys> =
	K extends `context.${infer Rest}`
		? ExtractType<ConcreteContextData, ExtractSegments<Rest>> | undefined
		:
	K extends `ls.raw.${infer _}`
		? string | undefined
		:
	K extends `ls.${infer Rest}`
		? Rest extends keyof LocalStorageData
			? LocalStorageData[Rest]
			: unknown
		:
	K extends keyof SettingsTypeMap
		? SettingsTypeMap[K]
		:
	unknown;

export type SettingMetadata = {
	uses: number[];
};

// Definitions

export type SettingDefinition<T> = {

	default: T,
	type?: string;

	equals?: 'requirements' | ((new_value: T, old_value: T | undefined, cache: Map<SettingsKeys, unknown>, old_cache: Map<SettingsKeys, unknown>) => boolean);

	process?(ctx: SettingsContext, val: T, meta: SettingMetadata): T;

	// Dependencies
	required_by?: string[];
	requires?: string[];

	// Tracking
	__source?: string | null;

	// UI Stuff
	ui?: SettingUiDefinition<T>;

	// Reactivity
	changed?: () => void;

};

export type SettingUiDefinition<T> = {
	i18n_key?: string;
	key: string;
	path: string;
	path_tokens?: PathNode[];

	component: string;

	no_i18n?: boolean;

	// TODO: Handle this better.
	data: any;

	process?: string;

	/**
	 * Bounds represents a minimum and maximum numeric value. These values
	 * are used by number processing and validation if the processor is set
	 * to `to_int` or `to_float`.
	 */
	bounds?:
		[low: number, low_inclusive: boolean, high: number, high_inclusive: boolean] |
		[low: number, low_inclusive: boolean, high: number] |
		[low: number, low_inclusive: boolean] |
		[low: number, high: number] |
		[low: number];

	title: string;
	description?: string;
}

// Exports

export type ExportedSettingsProfile = {
	version: 2;
	type: 'profile';
	profile: Partial<SettingsProfileMetadata>;
	toggled?: boolean;
	values: Record<string, any>;
};

export type ExportedFullDump = {
	version: 2;
	type: 'full';
	values: Record<string, any>;
};


export type ExportedBlobMetadata = {
	key: string;
	type?: string;
	name?: string;
	modified?: number;
	mime?: string;
};



// Profiles

export type SettingsProfileMetadata = {
	id: number;

	name: string;
	i18n_key?: string | null;
	hotkey?: string | null;
	pause_updates: boolean;

	ephemeral?: boolean;

	description?: string | null;
	desc_i18n_key?: string | null;

	url?: string | null;
	show_toggle: boolean;

	context?: FilterData[] | null;
};


// Processors

export type SettingProcessor<T> = (
	input: unknown,
	default_value: T,
	definition: SettingUiDefinition<T>
) => T;


// Validators

export type SettingValidator<T> = (
	value: T,
	definition: SettingUiDefinition<T>
) => boolean;
