import Module from 'utilities/module';
import {deep_copy} from 'utilities/object';

export class Addon extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('chat');
	}

	static register(name) {
		FrankerFaceZ.get().register(`addon.${name}`, this).enable();
	}
}

export class AddonManager extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');

		this.addons = {};
		this.enabled_addons = this.settings.provider.get('addons.enabled') || [];

		this.settings.addUI('add-ons', {
			path: 'Add-Ons',
			component: 'add-ons',
			title: 'Add-Ons',
			enabled_addons: this.enabled_addons,
			
			getAddons: () => Object.values(this.addons),
			enableAddon: id => this.enableAddon(id),
			disableAddon: id => this.disableAddon(id)
		});

		this.settings.add('addons.development', {
			default: false,
			ui: {
				path: 'Add-Ons >> Development',
				title: 'Use Local Development Server',
				description: 'Use local development server to load add-ons.',
				component: 'setting-check-box'
			}
		});
	}

	async onEnable() {
		const [cdn_data, local_data] = await Promise.all([
			fetch('https://cors-anywhere.herokuapp.com/https://lordmau5.com/addons.json').then(r => r.ok ? r.json() : null).catch(() => null),
			this.settings.get('addons.development')
				? fetch('https://localhost:8001/script/addons/addons.json').then(r => r.ok ? r.json() : null).catch(() => null)
				: null
		]);

		cdn_data && cdn_data.map(addon => this.addons[addon.id] = addon);
		local_data && local_data.map(addon => {
			addon.dev = true;
			this.addons[addon.id] = addon;
		});

		for (const id of this.enabled_addons) {
			this.loadAddon(id);
		}
	}

	isAddonEnabled(id) {
		this.log.info(`Addon Check for ${id}`);
		return this.enabled_addons.includes(id);
	}

	getAddon(id) {
		return this.addons[id];
	}

	loadAddon(id) {
		const addon = this.getAddon(id);
		if (!addon) return;

		if (!window.document.head.querySelector(`#ffz-addon-${addon.id}`)) {
			const script = document.createElement('script');
			script.id = addon.id;
			script.type = 'text/javascript';
			script.src = `https://${addon.dev ? 'localhost:8001' : 'lordmau5.com'}/script/addons/${addon.id}/script.js`;
			document.head.appendChild(script);
		}
	}

	enableAddon(id) {
		if (this.enabled_addons.includes(id)) return;

		const addon = this.getAddon(id),
			requires = addon && addon.requires || [];

		for (const required_id of requires) {
			this.enableAddon(required_id);
		}

		this.loadAddon(id);

		this.enabled_addons.push(id);
		this.settings.provider.set('addons.enabled', deep_copy(this.enabled_addons));
	}

	disableAddon(id) {
		if (!this.enabled_addons.includes(id)) return;

		const requires = this.enabled_addons.filter(addon_id => {
			const addon = this.getAddon(addon_id);
			return addon.requires && addon.requires.includes(id);
		});

		for (const required_id of requires) {
			this.disableAddon(required_id);
		}

		this.enabled_addons.splice(this.enabled_addons.indexOf(id), 1);
		this.settings.provider.set('addons.enabled', deep_copy(this.enabled_addons));
	}
}

export default AddonManager;
