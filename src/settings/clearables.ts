'use strict';

import { AdvancedSettingsProvider } from "./providers";
import type { SettingsClearable } from "./types";

// ============================================================================
// Clearable Settings
// ============================================================================

export const Experiments: SettingsClearable = {
	label: 'Experiment Overrides',
	keys: [
		'exp-lock',
		'experiment-overrides'
	]
};

export const HiddenEmotes: SettingsClearable = {
	label: 'Hidden Emotes',
	keys(provider) {
		const keys = ['emote-menu.hidden-sets'];
		for(const key of provider.keys())
			if ( key.startsWith('hidden-emotes.') )
				keys.push(key);

		return keys;
	}
};

export const FavoriteEmotes: SettingsClearable = {
	label: 'Favorited Emotes',
	keys(provider) {
		const keys = [];
		for(const key of provider.keys())
			if ( key.startsWith('favorite-emotes.') )
				keys.push(key);

		return keys;
	}
};

export const Overrides: SettingsClearable = {
	label: 'Name and Color Overrides',
	keys: [
		'overrides.colors',
		'overrides.names'
	]
};

export const Profiles: SettingsClearable = {
	label: 'Profiles',
	clear(provider, settings) {
		const keys = ['profiles'];
		for(const key of provider.keys())
			if ( /^p:\d+:/.test(key) )
				keys.push(key);

		for(const key of keys)
			provider.delete(key);

		settings.loadProfiles();
	}
};

export const Everything: SettingsClearable = {
	label: 'Absolutely Everything',
	async clear(provider, settings) {
		provider.clear();
		if ( provider.supportsBlobs && provider instanceof AdvancedSettingsProvider )
			await provider.clearBlobs();

		settings.loadProfiles();
	}
};
