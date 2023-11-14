import type SettingsManager from ".";
import type { FilterData } from "../utilities/filtering";
import type { OptionalPromise, OptionallyCallable, RecursivePartial } from "../utilities/types";
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

export type ContextData = RecursivePartial<{
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

}>;


// Definitions

export type SettingsDefinition<T> = {

	default: T,
	type?: string;

	process?(this: SettingsManager, ctx: SettingsContext, val: T): T;

	// Dependencies
	required_by?: string[];
	requires?: string[];

	// Tracking
	__source?: string | null;

	// UI Stuff
	ui?: SettingsUiDefinition<T>;

	// Reactivity
	changed?: () => void;

};

export type SettingsUiDefinition<T> = {
	path: string;
	component: string;

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

export type SettingsProcessor<T> = (
	input: unknown,
	default_value: T,
	definition: SettingsUiDefinition<T>
) => T;


// Validators

export type SettingsValidator<T> = (
	value: T,
	definition: SettingsUiDefinition<T>
) => boolean;
