'use strict';

// ============================================================================
// Add-On System
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import { EXTENSION, SERVER_OR_EXT } from 'utilities/constants';
import { createElement } from 'utilities/dom';
import { timeout, has, deep_copy, fetchJSON } from 'utilities/object';
import { getBuster } from 'utilities/time';
import type SettingsManager from './settings';
import type TranslationManager from './i18n';
import type LoadTracker from './load_tracker';
import type FrankerFaceZ from './main';
import type { AddonInfo } from 'utilities/types';

declare global {
	interface Window {
		ffzAddonsWebpackJsonp: unknown;
	}
}

declare module 'utilities/types' {
	interface ModuleMap {
		addons: AddonManager;
	}
	interface ModuleEventMap {
		addons: AddonManagerEvents;
	}
	interface SettingsTypeMap {
		'addons.dev.server': boolean;
	}
};

type AddonManagerEvents = {
	':ready': [];
	':data-loaded': [];
	':reload-required': [];

	':added': [id: string, info: AddonInfo];
	':addon-loaded': [id: string];
	':addon-enabled': [id: string];
	':addon-disabled': [id: string];
	':fully-unload': [id: string];
};


// ============================================================================
// AddonManager
// ============================================================================

export default class AddonManager extends Module<'addons'> {

	// Dependencies
	i18n: TranslationManager = null as any;
	load_tracker: LoadTracker = null as any;
	settings: SettingsManager = null as any;

	// State
	has_dev: boolean;
	reload_required: boolean;
	target: string;

	addons: Record<string, AddonInfo | string[]>;
	enabled_addons: string[];

	private _loader?: Promise<void>;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.should_enable = true;

		this.inject('settings');
		this.inject('i18n');
		this.inject('load_tracker');

		this.load_requires = ['settings'];

		this.target = (this.parent as unknown as FrankerFaceZ).flavor || 'unknown';

		this.has_dev = false;
		this.reload_required = false;
		this.addons = {};
		this.enabled_addons = [];

		this.load_tracker.schedule('chat-data', 'addon-initial');
	}

	onLoad() {
		// We don't actually *wait* for this, we just start it.
		this._loader = this.loadAddonData();
	}

	onEnable() {
		this.settings.addUI('add-ons', {
			path: 'Add-Ons @{"description": "Add-Ons are additional modules, often written by other people, that can be loaded automatically by FrankerFaceZ to add new capabilities and behaviors to the extension and Twitch.", "profile_warning": false}',
			component: 'addon-list',
			title: 'Add-Ons',
			no_filter: true,

			getExtraTerms: () => Object.values(this.addons).map(addon => addon.search_terms),

			getFFZ: () => this,
			isReady: () => this.enabled,
			getAddons: () => Object.values(this.addons),
			hasAddon: (id: string) => this.hasAddon(id),
			getVersion: (id: string) => this.getVersion(id),
			doesAddonTarget: (id: string) => this.doesAddonTarget(id),
			isAddonEnabled: (id: string) => this.isAddonEnabled(id),
			isAddonExternal: (id: string) => this.isAddonExternal(id),
			enableAddon: (id: string) => this.enableAddon(id),
			disableAddon: (id: string) => this.disableAddon(id),
			reloadAddon: (id: string) => this.reloadAddon(id),
			canReloadAddon: (id: string) => this.canReloadAddon(id),
			isReloadRequired: () => this.reload_required,
			refresh: () => window.location.reload(),

			on: (...args: Parameters<typeof this.on>) => this.on(...args),
			off: (...args: Parameters<typeof this.off>) => this.off(...args)
		});

		if ( ! EXTENSION )
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

		this._loader?.then(() => {
			this.enabled_addons = this.settings.provider.get('addons.enabled', []);

			// We do not await enabling add-ons because that would delay the
			// main script's execution.
			for(const id of this.enabled_addons)
				if ( this.hasAddon(id) && this.doesAddonTarget(id) )
					this._enableAddon(id).catch(err => {
						this.log.error(`An error occured while enabling the add-on "${id}":` , err);
						this.log.capture(err);
					});

			this.load_tracker.notify('chat-data', 'addon-initial');
			this.emit(':ready');
		});
	}


	doesAddonTarget(id: string) {
		const data = this.getAddon(id);
		if ( ! data )
			return false;

		const targets = data.targets ?? ['main'];
		if ( ! Array.isArray(targets) )
			return false;

		return targets.includes(this.target);
	}


	generateLog() {
		const out = ['Known'];
		for(const [id, addon] of Object.entries(this.addons)) {
			if ( Array.isArray(addon) )
				continue;
			out.push(`${id} | ${this.isAddonEnabled(id) ? 'enabled' : 'disabled'} | ${addon.dev ? 'dev | ' : ''}${this.isAddonExternal(id) ? 'external | ' : ''}${addon.short_name} v${addon.version}`);
		}

		out.push('');
		out.push('Modules');
		for(const [key, module] of Object.entries((this as any).__modules as Record<string, GenericModule>)) {
			if ( module )
				out.push(`${module.loaded ? 'loaded  ' : module.loading ? 'loading ' : 'unloaded'} | ${module.enabled ? 'enabled ' : module.enabling ? 'enabling' : 'disabled'} | ${key}`)
		}

		return out.join('\n');
	}

	onProviderChange(key: string, value: unknown) {
		if ( key != 'addons.enabled' )
			return;

		const val: string[] = Array.isArray(value) ? value : [],
			old_enabled = [...this.enabled_addons];

		// Add-ons to disable
		for(const id of old_enabled)
			if ( ! val.includes(id) )
				this.disableAddon(id, false);

		// Add-ons to enable
		for(const id of val)
			if ( ! old_enabled.includes(id) )
				this.enableAddon(id, false);
	}

	async loadAddonData() {
		const [cdn_data, local_data] = await Promise.all([
			fetchJSON(`${SERVER_OR_EXT}/addons.json?_=${getBuster(30)}`),

			// Do not attempt to load local add-ons if using the extension, as
			// loading external code is against the policy of basically everyone.
			(! EXTENSION && this.settings.get('addons.dev.server'))
				? fetchJSON(`https://localhost:8001/script/addons.json?_=${getBuster()}`)
				: null
		]);

		if ( Array.isArray(cdn_data) ) {
			// We need to handle relative URLs for addon logos.
			const base_path = `${SERVER_OR_EXT}/addons/`;

			for(const addon of cdn_data ) {
				if ( addon.icon )
				addon.icon = (new URL(addon.icon, base_path)).toString();
				this.addAddon(addon, false);
			}
		}

		if ( Array.isArray(local_data) ) {
			this.has_dev = true;
			for(const addon of local_data)
				this.addAddon(addon, true);
		}

		this.settings.updateContext({
			addonDev: this.has_dev
		});

		this.rebuildAddonSearch();
		this.emit(':data-loaded');
	}

	addAddon(addon: AddonInfo, is_dev: boolean = false) {
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

		if ( ! old )
			this.settings.addUI(`addon-changelog.${addon.id}`, {
				path: `Add-Ons > Changelog > ${addon.name}`,
				component: 'changelog',
				force_seen: true,
				addons: true,
				addon: deep_copy(addon),
				getFFZ: () => this
			});

		this.emit(':added', addon.id, addon);
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

	isAddonEnabled(id: string) {
		if ( this.isAddonExternal(id) )
			return true;

		return this.enabled_addons.includes(id);
	}

	getAddon(id: string) {
		const addon = this.addons[id];
		return Array.isArray(addon) ? null : addon;
	}

	hasAddon(id: string) {
		return this.getAddon(id) != null;
	}

	getVersion(id: string) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		const module = this.resolve(`addon.${id}`);
		if ( module ) {
			if ( 'version' in module ) // has(module, 'version') )
				return module.version;
			else if ( module.constructor && 'version' in module.constructor ) // has(module.constructor, 'version') )
				return module.constructor.version;
		}

		return addon.version;
	}

	isAddonExternal(id: string) {
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
		return (module as any).external || (module.constructor as any)?.external;
	}

	canReloadAddon(id: string) {
		// Obviously we can't reload it if we don't have it.
		if ( ! this.hasAddon(id) )
			throw new Error(`Unknown add-on id: ${id}`);

		// If the module isn't available, we can't reload it.
		let module = this.resolve(`addon.${id}`);
		if ( ! module )
			return false;

		// If the module cannot be disabled, or it cannot be unloaded, then
		// we can't reload it.
		if ( ! module.canDisable() || ! module.canUnload() )
			return false;

		// Check each child.
		if ( module.children )
			for(const child of Object.values(module.children))
				if ( ! child.canDisable() || ! child.canUnload() )
					return false;

		// If we got here, we might be able to reload it.
		return true;
	}

	async fullyUnloadModule(module: GenericModule) {
		if ( ! module || ! module.addon_id )
			return;

		if ( module.children )
			for(const child of Object.values(module.children))
				await this.fullyUnloadModule(child);

		await module.disable();
		await module.unload();

		// Clean up parent references.
		if ( module.parent instanceof Module && module.parent.children[module.name] === module )
			delete module.parent.children[module.name];

		// Clean up all individual references.
		for(const entry of module.references) {
			const other = this.resolve(entry[0]),
				name = entry[1];
			if ( (other as any)[name] === module )
				(other as any)[name] = null;
		}

		// Send off a signal for other modules to unload related data.
		this.emit(':fully-unload', module.addon_id);

		// Clean up the global reference.
		if ( (this as any).__modules[(module as any).__path] === module )
			delete (this as any).__modules[(module as any).__path]; /* = [
				module.dependents,
				module.load_dependents,
				module.references
			];*/

		// Remove any events we didn't unregister.
		this.off(undefined, undefined, module);

		// Do the same for settings.
		for(const ctx of this.settings.__contexts)
			ctx.off(undefined, undefined, module);

		// Clean up all settings.
		for(const [key, def] of Array.from(this.settings.definitions.entries())) {
			if ( ! Array.isArray(def) && def?.__source === module.addon_id ) {
				this.settings.remove(key);
			}
		}

		// Clean up the logger too.
		(module as any).__log = null;
	}

	async reloadAddon(id: string) {
		const addon = this.getAddon(id),
			button = this.resolve('site.menu_button');
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		const start = performance.now();

		// Yeet the module into the abyss.
		// This will also yeet all children.
		let module = this.resolve(`addon.${id}`);
		if ( module )
			try {
				await this.fullyUnloadModule(module);
			} catch(err) {
				if ( button )
					button.addToast({
						title_i18n: 'addons.reload.toast-error',
						title: 'Error Reloading Add-On',
						text_i18n: 'addons.reload.toast-error.unload',
						text: 'Unable to unload existing modules for add-on "{addon_id}":\n\n{error}',
						icon: 'ffz-i-attention',
						addon_id: id,
						error: String(err)
					});

				throw err;
			}

		// Is there a script tab?
		let el = document.querySelector(`script#ffz-loaded-addon-${addon.id}`);
		if ( el )
			el.remove();

		// Do unnatural things to webpack.
		if ( window.ffzAddonsWebpackJsonp )
			window.ffzAddonsWebpackJsonp = undefined;

		// Now, reload it all~
		try {
			await this._enableAddon(id);
		} catch(err) {
			if ( button )
				button.addToast({
					title_i18n: 'addons.reload.toast-error',
					title: 'Error Reloading Add-On',
					text_i18n: 'addons.reload.toast-error.reload',
					text: 'Unable to load new module for add-on "{addon_id}":\n\n{error}',
					error: String(err),
					icon: 'ffz-i-attention',
					addon_id: id
				});
			throw err;
		}

		const end = performance.now();

		if ( button )
			button.addToast({
				title_i18n: 'addons.reload.toast',
				title: 'Reloaded Add-On',
				text_i18n: 'addons.reload.toast.text',
				text: 'Successfully reloaded add-on "{addon_id}" in {duration}ms.',
				icon: 'ffz-i-info',
				addon_id: id,
				timeout: 5000,
				duration: Math.round(100 * (end - start)) / 100
			});
	}

	private async _enableAddon(id: string) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		if ( Array.isArray(addon.load_events) )
			for(const event of addon.load_events)
				this.load_tracker.schedule(event, `addon.${id}`);

		await this.loadAddon(id);

		const module = this.resolve(`addon.${id}`);
		if ( module && ! module.enabled )
			await module.enable();

		if ( Array.isArray(addon.load_events) )
		for(const event of addon.load_events)
			this.load_tracker.notify(event, `addon.${id}`, false);
	}

	async loadAddon(id: string) {
		const addon = this.getAddon(id);
		if ( ! addon )
			throw new Error(`Unknown add-on id: ${id}`);

		await this.i18n.loadChunk(`addon.${id}`);

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
			src: addon.src || `${addon.dev ? 'https://localhost:8001/script' : SERVER_OR_EXT}/addons/${addon.id}/script.js?_=${getBuster(30)}`,
			crossorigin: 'anonymous'
		}));

		// Error if this takes more than 5 seconds.
		await timeout(this.waitFor(`addon.${id}:registered` as any), 60000);

		module = this.resolve(`addon.${id}`);
		if ( module && ! module.loaded )
			await module.load();

		this.emit(':addon-loaded', id);
	}

	unloadAddon(id: string) {
		const module = this.resolve(`addon.${id}`);
		if ( module )
			return module.unload();
	}

	enableAddon(id: string, save: boolean = true) {
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
			this._enableAddon(id).catch(err => {
				this.log.error(`An error occured while enabling the add-on "${id}":` , err);
				this.log.capture(err);
			});
	}

	async disableAddon(id: string, save: boolean = true) {
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
