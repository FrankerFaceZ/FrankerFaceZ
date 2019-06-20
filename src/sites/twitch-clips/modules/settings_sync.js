'use strict';

// ============================================================================
// Settings Sync
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';

const VALID_KEYS = [
	'client-id',
	'profiles'
];

export default class SettingsSync extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
	}

	onEnable() {
		const frame = this.frame = createElement('iframe');
		frame.src = '//www.twitch.tv/p/ffz_bridge/';
		frame.id = 'ffz-settings-bridge';
		frame.style.width = 0;
		frame.style.height = 0;

		window.addEventListener('message', this.onMessage.bind(this));
		document.body.appendChild(frame);
	}

	send(msg) {
		try {
			this.frame.contentWindow.postMessage(msg, '*');
		} catch(err) { this.log.error('send error', err); /* no-op */ }
	}

	onMessage(event) {
		const msg = event.data;
		if ( ! msg || ! msg.ffz_type )
			return;

		if ( msg.ffz_type === 'ready' )
			this.send({ffz_type: 'load'});
		else if ( msg.ffz_type === 'loaded' )
			this.onLoad(msg.data);
		else if ( msg.ffz_type === 'change' )
			this.onChange(msg);
		else
			this.log.info('Unknown Message', msg.ffz_type, msg);
	}

	onLoad(data) {
		if ( ! data )
			return;

		const provider = this.settings.provider,
			old_keys = new Set(provider.keys());

		for(const [key, value] of Object.entries(data)) {
			old_keys.delete(key);
			if ( ! this.isValidSetting(key) || provider.get(key) === value )
				continue;

			provider.set(key, value);
			provider.emit('changed', key, value, false);
		}

		for(const key of old_keys) {
			provider.delete(key);
			provider.emit('changed', key, undefined, true);
		}
	}

	onChange(msg) {
		const key = msg.key,
			value = msg.value,
			deleted = msg.deleted;

		if ( ! this.isValidSetting(key) )
			return;

		if ( deleted )
			this.settings.provider.delete(key);
		else
			this.settings.provider.set(key, value);

		this.settings.provider.emit('changed', key, value, deleted);
	}

	isValidSetting(key) {
		if ( ! key.startsWith('p:') )
			return VALID_KEYS.includes(key);

		const idx = key.indexOf(':', 2);
		if ( idx === -1 )
			return false;

		return this.settings.definitions.has(key.slice(idx + 1));
	}
}