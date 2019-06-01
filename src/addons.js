'use strict';

// ============================================================================
// Add-On System
// ============================================================================

import Module from 'utilities/module';
import { DEBUG, SERVER } from 'utilities/constants';
import { createElement } from 'utilities/dom';
import { timeout } from 'utilities/object';

const fetchJSON = (...args) => fetch(...args).then(r => r.ok ? r.json() : null).catch(() => null);

// We want to import this so that the file is included in the output.
// We don't load using this because we might want a newer file from the
// server. In the future, we'll be loading this from the API rather
// than from a flat file.
import ADDONS from 'file-loader?name=[name].[hash].[ext]!./addons.json'; // eslint-disable-line no-unused-vars

// ============================================================================
// AddonManager
// ============================================================================

export default class AddonManager extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('i18n');

		this.reload_required = false;
		this.addons = {};
		this.enabled_addons = [];

		this.settings.addUI('add-ons', {
			path: 'Add-Ons @{"description": "Add-Ons are additional modules, often written by other people, that can be loaded automatically by FrankerFaceZ to add new capabilities and behaviors to the extension and Twitch."}',
			component: 'add-ons',
			title: 'Add-Ons',
			no_filter: true,

			getExtraSearch: () => Object.values(this.addons).map(addon => addon.search_terms),

			isReady: () => this.enabled,
			getAddons: () => Object.values(this.addons),
			hasAddon: id => this.hasAddon(id),
			isAddonEnabled: id => this.isAddonEnabled(id),
			enableAddon: id => this.enableAddon(id),
			disableAddon: id => this.disableAddon(id),
			isReloadRequired: () => this.reload_required,
			refresh: () => window.location.reload(),

			on: (...args) => this.on(...args),
			off: (...args) => this.off(...args)
		});

		this.settings.add('addons.dev.server', {
			default: false,
			ui: {
				path: 'Add-Ons >> Development',
				title: 'Use Local Development Server',
				description: 'Attempt to load add-ons from local development server on port 8001.',
				component: 'setting-check-box'
			}
		});
	}

	async onEnable() {
		this.on('i18n:update', this.rebuildAddonSearch, this);

		this.settings.provider.on('changed', this.onProviderChange, this);

		await this.loadAddonData();
		this.enabled_addons = this.settings.provider.get('addons.enabled', []);

		// We do not await enabling add-ons because that would delay the
		// main script's execution.
		for(const id of this.enabled_addons)
			if ( this.hasAddon(id) )
				this._enableAddon(id);

		this.emit(':ready');
	}

	onProviderChange(key, value) {
		if ( key != 'addons.enabled' )
			return;

		if ( ! value )
			value = [];

		const old_enabled = [...this.enabled_addons];

		// Add-ons to disable
		for(const id of old_enabled)
			if ( ! value.includes(id) )
				this.disableAddon(id, false);

		// Add-ons to enable
		for(const id of value)
			if ( ! old_enabled.includes(id) )
				this.enableAddon(id, false);
	}

	async loadAddonData() {
		const [cdn_data, local_data] = await Promise.all([
			fetchJSON(DEBUG ? ADDONS : `${SERVER}/script/addons.json?_=${FrankerFaceZ.version_info}`),
			this.settings.get('addons.dev.server') ?
				fetchJSON(`https://localhost:8001/script/addons.json?_=${Date.now()}`) : null
		]);

		if ( Array.isArray(cdn_data) )
			for(const addon of cdn_data )
				this._loadAddon(addon, false);

		if ( Array.isArray(local_data) )
			for(const addon of local_data)
				this._loadAddon(addon, true);

		this.rebuildAddonSearch();
	}

	_loadAddon(addon, is_dev = false) {
		const old = this.addons[addon.id];
		this.addons[addon.id] = addon;

		addon.name_i18n = addon.name_i18n || `addon.${addon.id}.name`;
		addon.short_name_i18n = addon.short_name_i18n || `addon.${addon.id}.short_name`;
		addon.description_i18n = addon.description_i18n || `addon.${addon.id}.description`;
		addon.author_i18n = addon.author_i18n || `addon.${addon.id}.author`;

		addon.dev = is_dev;
		addon.requires = addon.requires || [];
		addon.required_by = Array.isArray(old) ? old : old && old.required_by || [];

		addon._search = addon.search_terms;

		for(const id of addon.requires) {
			const target = this.addons[id];
			if ( Array.isArray(target) )
				target.push(addon.id);
			else if ( target )
				target.required_by.push(addon.id);
			else
				this.addons[id] = [addon.id];
		}
	}

	rebuildAddonSearch() {
		for(const addon of Object.values(this.addons)) {
			const terms = new Set([
				addon._search,
				addon.name,
				addon.short_name,
				addon.author,
				addon.description,
			]);

			if ( this.i18n.locale !== 'en' ) {
				terms.add(this.i18n.t(addon.name_i18n, addon.name));
				terms.add(this.i18n.t(addon.short_name_i18n, addon.short_name));
				terms.add(this.i18n.t(addon.author_i18n, addon.author));
				terms.add(this.i18n.t(addon.description_i18n, addon.description));
			}

			addon.search_terms = [...terms].map(term => term ? term.toLocaleLowerCase() : '').join('\n');
		}
	}

	isAddonEnabled(id) {
		return this.enabled_addons.includes(id);
	}

	getAddon(id) {
		const addon = this.addons[id];
		return Array.isArray(addon) ? null : addon;
	}

	hasAddon(id) {
		return this.getAddon(id) != null;
	}

	async _enableAddon(id) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		await this.loadAddon(id);

		const module = this.resolve(`addon.${id}`);
		if ( module && ! module.enabled )
			await module.enable();
	}

	async loadAddon(id) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		let module = this.resolve(`addon.${id}`);
		if ( module ) {
			if ( ! module.loaded )
				await module.load();

			this.emit(':addon-loaded', id);
			return;
		}

		document.head.appendChild(createElement('script', {
			id: `ffz-addon-${addon.id}`,
			type: 'text/javascript',
			src: `https://${addon.dev ? 'localhost:8000' : 'cdn.ffzap.com'}/script/addons/${addon.id}/script.js`,
			crossorigin: 'anonymous'
		}));

		// Error if this takes more than 5 seconds.
		await timeout(this.waitFor(`addon.${id}:registered`), 5000);

		module = this.resolve(`addon.${id}`);
		if ( module && ! module.loaded )
			await module.load();

		this.emit(':addon-loaded', id);
	}

	unloadAddon(id) {
		const module = this.resolve(`addon.${id}`);
		if ( module )
			return module.unload();
	}

	enableAddon(id, save = true) {
		const addon = this.getAddon(id);
		if( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		if ( this.isAddonEnabled(id) )
			return;

		if ( Array.isArray(addon.requires) ) {
			for(const id of addon.requires) {
				if ( ! this.hasAddon(id) )
					throw new Error(`Unknown add-on id: ${id}`);

				this.enableAddon(id);
			}
		}

		this.emit(':addon-enabled', id);
		this.enabled_addons.push(id);

		if ( save )
			this.settings.provider.set('addons.enabled', this.enabled_addons);

		// Actually load it.
		this._enableAddon(id);
	}

	async disableAddon(id, save = true) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		if ( ! this.isAddonEnabled(id) )
			return;

		if ( Array.isArray(addon.required_by) ) {
			const promises = [];
			for(const id of addon.required_by)
				promises.push(this.disableAddon(id));

			await Promise.all(promises);
		}

		this.emit(':addon-disabled', id);
		this.enabled_addons.splice(this.enabled_addons.indexOf(id), 1);

		if ( save )
			this.settings.provider.set('addons.enabled', this.enabled_addons);

		// Try disabling loaded modules.
		try {
			const module = this.resolve(`addon.${id}`);
			if ( module )
				await module.disable();
		} catch(err) {
			this.reload_required = true;
			this.emit(':reload-required');
		}
	}
}
