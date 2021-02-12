'use strict';

// ============================================================================
// CSS Tweaks for Twitch Twilight
// ============================================================================

import Module from 'utilities/module';
import {ManagedStyle} from 'utilities/dom';
import {has} from 'utilities/object';


const CLASSES = {
	'player-ext': '.video-player .extension-taskbar,.video-player .extension-container,.video-player .extensions-dock__layout,.video-player .extensions-notifications,.video-player .extensions-video-overlay-size-container,.video-player .extensions-dock__layout',
	'player-ext-hover': '.video-player__overlay[data-controls="false"] .extension-taskbar,.video-player__overlay[data-controls="false"] .extension-container,.video-player__overlay[data-controls="false"] .extensions-dock__layout,.video-player__overlay[data-controls="false"] .extensions-notifications,.video-player__overlay[data-controls="false"] .extensions-video-overlay-size-container',
};


export default class CSSTweaks extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');

		this.style = new ManagedStyle;
		this.chunks = {};
		this.chunks_loaded = false;
	}


	toggleHide(key, val) {
		const k = `hide--${key}`;
		if ( ! val ) {
			this.style.delete(k);
			return;
		}

		if ( ! has(CLASSES, key) )
			throw new Error(`cannot find class for "${key}"`);

		this.style.set(k, `${CLASSES[key]} { display: none !important }`);
	}


	async toggle(key, val) {
		if ( ! val ) {
			this.style.delete(key);
			return;
		}

		if ( ! this.chunks_loaded )
			await this.populate();

		if ( ! has(this.chunks, key) )
			throw new Error(`cannot find chunk "${key}"`);

		this.style.set(key, this.chunks[key]);
	}


	set(key, val) { return this.style.set(key, val) }
	delete(key) { return this.style.delete(key) }

	setVariable(key, val, scope = 'body') {
		this.style.set(`var--${key}`, `${scope} { --ffz-${key}: ${val}; }`);
	}

	deleteVariable(key) { this.style.delete(`var--${key}`) }


	populate() {
		if ( this.chunks_loaded )
			return;

		return new Promise(async r => {
			const raw = (await import(/* webpackChunkName: "player-css-tweaks" */ './styles.js')).default;
			for(const key of raw.keys()) {
				const k = key.slice(2, key.length - (key.endsWith('.scss') ? 5 : 4));
				this.chunks[k] = raw(key).default;
			}

			this.chunks_loaded = true;
			r();
		})
	}
}
