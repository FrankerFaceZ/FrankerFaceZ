'use strict';

// ============================================================================
// Clearable Settings
// ============================================================================

export const Experiments = {
	label: 'Experiment Overrides',
	keys: [
		'exp-lock',
		'experiment-overrides'
	]
};

export const HiddenEmotes = {
	label: 'Hidden Emotes',
	keys(provider) {
		const keys = ['emote-menu.hidden-sets'];
		for(const key of provider.keys())
			if ( key.startsWith('hidden-emotes.') )
				keys.push(key);

		return keys;
	}
};

export const FavoriteEmotes = {
	label: 'Favorited Emotes',
	keys(provider) {
		const keys = [];
		for(const key of provider.keys())
			if ( key.startsWith('favorite-emotes.') )
				keys.push(key);

		return keys;
	}
};

export const Overrides = {
	label: 'Name and Color Overrides',
	keys: [
		'overrides.colors',
		'overrides.names'
	]
};

export const Profiles = {
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

export const Everything = {
	label: 'Absolutely Everything',
	async clear(provider, settings) {
		provider.clear();
		if ( provider.supportsBlobs )
			await provider.clearBlobs();

		settings.loadProfiles();
	}
};
