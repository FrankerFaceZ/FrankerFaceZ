import type SettingsManager from ".";
import type { FilterData } from "../utilities/filtering";
import type Logger from "../utilities/logging";
import type { PathNode } from "../utilities/path-parser";
import type { ExtractKey, ExtractSegments, ExtractType, JoinKeyPaths, ObjectKeyPaths, OptionalPromise, OptionallyCallable, PartialPartial, RecursivePartial, SettingsTypeMap } from "../utilities/types";
import type SettingsContext from "./context";
import type SettingsProfile from "./profile";
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


// Usable Definitions

export type OptionalSettingDefinitionKeys = 'type';
export type ForbiddenSettingDefinitionKeys = '__source' | 'ui';

export type SettingDefinition<T> = Omit<
	PartialPartial<FullSettingDefinition<T>, OptionalSettingDefinitionKeys>,
	ForbiddenSettingDefinitionKeys
> & {
	ui: SettingUiDefinition<T>;
};

export type OptionalSettingUiDefinitionKeys = 'key' | 'path_tokens' | 'i18n_key';
export type ForbiddenSettingUiDefinitionKeys = never;

export type SettingUiDefinition<T> = PartialPartial<FullSettingUiDefinition<T>, OptionalSettingUiDefinitionKeys>;


// Definitions

export type FullSettingDefinition<T> = {

	default: ((ctx: SettingsContext) => T) | T,
	type?: string;

	equals?: 'requirements' | ((new_value: T, old_value: T | undefined, cache: Map<SettingsKeys, unknown>, old_cache: Map<SettingsKeys, unknown>) => boolean);

	process?(ctx: SettingsContext, val: T, meta: SettingMetadata): T;

	// Dependencies
	required_by?: string[];
	requires?: string[];

	always_inherit?: boolean;
	inherit_default?: boolean;

	// Tracking
	__source?: string | null;

	// UI Stuff
	ui?: SettingUiDefinition<T>;

	// Reactivity
	changed?: (value: T) => void;

};


// UI Definitions

export type SettingUi_Basic = {
	key: string;
	path: string;
	path_tokens: PathNode[];

	no_filter?: boolean;
	force_seen?: boolean;

	title: string;
	i18n_key: string;

	description?: string;
	desc_i18n_key?: string;

	// Whether to show up in simple view
	simple?: boolean;
	// Optional alternate setting placement for simple view
	simple_path?: string;

	/**
	 * Optional. If present, this method will be used to retrieve an array of
	 * additional search terms that can be used to search for this setting.
	 */
	getExtraTerms?: () => string[];

};

// ============================================================================
// Each built-in settings component has a type with extra data definitions.
// ============================================================================

// Text Box
// ============================================================================

export type SettingUi_TextBox = SettingUi_Basic & {
	component: 'setting-text-box';
} & (SettingUi_TextBox_Process_Number | SettingUi_TextBox_Process_Other);


// Processing

export type SettingUi_TextBox_Process_Other = {
	process?: Exclude<string, 'to_int' | 'to_float'>;
}

export type SettingUi_TextBox_Process_Number = {
	process: 'to_int' | 'to_float';

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
}


// Check Box
// ============================================================================

export type SettingUi_CheckBox = SettingUi_Basic & {
	component: 'setting-check-box';
};


// Select Box
// ============================================================================

export type SettingUi_Select<T> = SettingUi_Basic & {
	component: 'setting-select-box';

	data: OptionallyCallable<[profile: SettingsProfile, current: T], SettingUi_Select_Entry<T>[]>;

}

export type SettingUi_Select_Entry<T> = {
	value: T;
	title: string;
};


// ============================================================================
// Combined Definitions
// ============================================================================

export type SettingTypeUiDefinition<T> = SettingUi_TextBox | SettingUi_CheckBox | SettingUi_Select<T>;


// We also support other components, if the component doesn't match.
export type SettingOtherUiDefinition = SettingUi_Basic & {
	component: Exclude<string, ExtractKey<SettingTypeUiDefinition<any>, 'component'>>;
}

// The final combined definition.
export type FullSettingUiDefinition<T> = SettingTypeUiDefinition<T> | SettingOtherUiDefinition;


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


// Type Handlers

export type SettingsTypeHandler = {

	default?(input: any, definition: SettingDefinition<any>, log: Logger): any;

	get(
		key: string,
		profiles: SettingsProfile[],
		definition: SettingDefinition<any>,
		log: Logger,
		ctx: SettingsContext
	): [unknown, number[]] | null | undefined;

}



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
