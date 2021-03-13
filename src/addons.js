'use strict';

// ============================================================================
// Add-On System
// ============================================================================

import Module from 'utilities/module';
import { SERVER } from 'utilities/constants';
import { createElement } from 'utilities/dom';
import { timeout, has } from 'utilities/object';
import { getBuster } from 'utilities/time';

const fetchJSON = (url, options) => fetch(url, options).then(r => r.ok ? r.json() : null).catch(() => null);

// ============================================================================
// AddonManager
// ============================================================================

export default class AddonManager extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('i18n');

		this.load_requires = ['settings'];

		this.target = this.parent.flavor || 'unknown';

		this.has_dev = false;
		this.reload_required = false;
		this.addons = {};
		this.enabled_addons = [];
	}

	onLoad() {
		this._loader = this.loadAddonData();
	}

	onEnable() {
		this.settings.addUI('add-ons', {
			path: 'Add-Ons @{"description": "Add-Ons are additional modules, often written by other people, that can be loaded automatically by FrankerFaceZ to add new capabilities and behaviors to the extension and Twitch.", "profile_warning": false}',
			component: 'addon-list',
			title: 'Add-Ons',
			no_filter: true,

			getExtraTerms: () => Object.values(this.addons).map(addon => addon.search_terms),

			isReady: () => this.enabled,
			getAddons: () => Object.values(this.addons),
			hasAddon: id => this.hasAddon(id),
			getVersion: id => this.getVersion(id),
			doesAddonTarget: id => this.doesAddonTarget(id),
			isAddonEnabled: id => this.isAddonEnabled(id),
			isAddonExternal: id => this.isAddonExternal(id),
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

		this.on('i18n:update', this.rebuildAddonSearch, this);

		this.settings.provider.on('changed', this.onProviderChange, this);

		this._loader.then(() => {
			this.enabled_addons = this.settings.provider.get('addons.enabled', []);

			// We do not await enabling add-ons because that would delay the
			// main script's execution.
			for(const id of this.enabled_addons)
				if ( this.hasAddon(id) && this.doesAddonTarget(id) )
					this._enableAddon(id);

			this.emit(':ready');
		});
	}


	doesAddonTarget(id) {
		const data = this.addons[id];
		if ( ! data )
			return false;

		const targets = data.targets ?? ['main'];
		if ( ! Array.isArray(targets) )
			return false;

		return targets.includes(this.target);
	}


	generateLog() {
		const out = ['Known'];
		for(const [id, addon] of Object.entries(this.addons))
			out.push(`${id} | ${this.isAddonEnabled(id) ? 'enabled' : 'disabled'} | ${addon.dev ? 'dev | ' : ''}${this.isAddonExternal(id) ? 'external | ' : ''}${addon.short_name} v${addon.version}`);

		out.push('');
		out.push('Modules');
		for(const [key, module] of Object.entries(this.__modules)) {
			if ( module )
				out.push(`${module.loaded ? 'loaded  ' : module.loading ? 'loading ' : 'unloaded'} | ${module.enabled ? 'enabled ' : module.enabling ? 'enabling' : 'disabled'} | ${key}`)
		}

		return out.join('\n');
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
			fetchJSON(`${SERVER}/script/addons.json?_=${getBuster(30)}`),
			this.settings.get('addons.dev.server') ?
				fetchJSON(`https://localhost:8001/script/addons.json?_=${getBuster()}`) : null
		]);

		if ( Array.isArray(cdn_data) )
			for(const addon of cdn_data )
				this.addAddon(addon, false);

		if ( Array.isArray(local_data) ) {
			this.has_dev = true;
			for(const addon of local_data)
				this.addAddon(addon, true);
		}

		this.rebuildAddonSearch();
		this.emit(':data-loaded');
	}

	addAddon(addon, is_dev = false) {
		const old = this.addons[addon.id];
		this.addons[addon.id] = addon;

		/*addon.name_i18n = addon.name_i18n || `addon.${addon.id}.name`;
		addon.short_name_i18n = addon.short_name_i18n || `addon.${addon.id}.short_name`;
		addon.author_i18n = addon.author_i18n || `addon.${addon.id}.author`;*/

		addon.dev = is_dev;
		addon.requires = addon.requires || [];
		addon.required_by = Array.isArray(old) ? old : old && old.required_by || [];

		if ( addon.updated )
			addon.updated = new Date(addon.updated);

		if ( addon.created )
			addon.created = new Date(addon.created);

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

		this.emit(':added');
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
				if ( addon.name_i18n )
					terms.add(this.i18n.t(addon.name_i18n, addon.name));

				if ( addon.short_name_i18n )
					terms.add(this.i18n.t(addon.short_name_i18n, addon.short_name));

				if ( addon.author_i18n )
					terms.add(this.i18n.t(addon.author_i18n, addon.author));

				if ( addon.description_i18n )
					terms.add(this.i18n.t(addon.description_i18n, addon.description));
			}

			addon.search_terms = [...terms].map(term => term ? term.toLocaleLowerCase() : '').join('\n');
		}
	}

	isAddonEnabled(id) {
		if ( this.isAddonExternal(id) )
			return true;

		return this.enabled_addons.includes(id);
	}

	getAddon(id) {
		const addon = this.addons[id];
		return Array.isArray(addon) ? null : addon;
	}

	hasAddon(id) {
		return this.getAddon(id) != null;
	}

	getVersion(id) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		const module = this.resolve(`addon.${id}`);
		if ( module ) {
			if ( has(module, 'version') )
				return module.version;
			else if ( module.constructor && has(module.constructor, 'version') )
				return module.constructor.version;
		}

		return addon.version;
	}

	isAddonExternal(id) {
		if ( ! this.hasAddon(id) )
			throw new Error(`Unknown add-on id: ${id}`);

		const module = this.resolve(`addon.${id}`);
		// If we can't find it, assume it isn't.
		if ( ! module )
			return false;

		// Check for one of our script tags. If we didn't load
		// it ourselves, then it's external.
		const script = document.head.querySelector(`script#ffz-loaded-addon-${id}`);
		if ( ! script )
			return true;

		// Finally, let the module flag itself as external.
		return module.external || (module.constructor && module.constructor.external);
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
			id: `ffz-loaded-addon-${addon.id}`,
			type: 'text/javascript',
			src: addon.src || `${addon.dev ? 'https://localhost:8001' : SERVER}/script/addons/${addon.id}/script.js?_=${getBuster(30)}`,
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
		if ( this.doesAddonTarget(id) )
			this._enableAddon(id);
	}

	async disableAddon(id, save = true) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		if ( this.isAddonExternal(id) )
			throw new Error(`Cannot disable external add-on with id: ${id}`);

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
