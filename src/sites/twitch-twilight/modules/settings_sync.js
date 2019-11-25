'use strict';

// ============================================================================
// Settings Sync
// ============================================================================

import Module from 'utilities/module';
import {createElement} from 'utilities/dom';

export default class SettingsSync extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = window.location.host !== 'www.twitch.tv';

		this.inject('settings');
	}

	onEnable() {
		const frame = this.frame = createElement('iframe');
		frame.src = '//www.twitch.tv/p/ffz_bridge/';
		frame.id = 'ffz-settings-bridge';
		frame.style.width = 0;
		frame.style.height = 0;

		this.settings.provider.on('set', this.onProviderSet, this);
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

		this.skip = true;

		for(const [key, value] of Object.entries(data)) {
			old_keys.delete(key);
			if ( provider.get(key) === value )
				continue;

			provider.set(key, value);
			provider.emit('changed', key, value, false);
		}

		for(const key of old_keys) {
			provider.delete(key);
			provider.emit('changed', key, undefined, true);
		}

		this.skip = false;
	}

	onProviderSet(key, value, deleted) {
		if ( this.skip )
			return;

		this.send({
			ffz_type: 'change',
			key,
			value,
			deleted
		});
	}

	onChange(msg) {
		const key = msg.key,
			value = msg.value,
			deleted = msg.deleted;

		this.skip = true;
		if ( deleted )
			this.settings.provider.delete(key);
		else
			this.settings.provider.set(key, value);
		this.skip = false;

		this.settings.provider.emit('changed', key, value, deleted, true);
	}
}