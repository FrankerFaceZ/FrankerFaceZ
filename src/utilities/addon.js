import Module from 'utilities/module';

export class Addon extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
	}

	static register(name) {
		FrankerFaceZ.get().register(`addon.${name}`, this).enable();
	}

	addSetting(key, definition) {
		this.settings.add(`${this.name}.${key}`, definition);
	}

	getSetting(key) {
		return this.settings.get(`${this.name}.${key}`);
	}
}

export class AddonManager extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');

		this.settings.addUI('add-ons', {
			path: 'Add-Ons',
			component: 'add-ons',
			
			getAddons: () => this.addons,
			isAddonEnabled: id => this.isAddonEnabled(id),
			enableAddon: id => this.enableAddon(id),
			disableAddon: id => this.disableAddon(id),
		});

		this.enabledAddons = this.settings.provider.get('addons.enabled') || [];
		this.log.info('Enabled addons:', this.enabledAddons.join(', '));
	}

	async onEnable() {
		const res = await fetch('https://cors-anywhere.herokuapp.com/https://lordmau5.com/ffz_addons.json');
		if (!res.ok) return;

		this.addons = await res.json();

		for (const id of this.enabledAddons) {
			this.loadAddon(id);
		}
	}

	isAddonEnabled(id) {
		return this.enabledAddons.includes(id);
	}

	getAddon(id) {
		return this.addons.find(addon => addon.id === id);
	}

	loadAddon(id) {
		const addon = this.getAddon(id);
		if (!addon || !addon.url) return;

		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = addon.url;
		document.head.appendChild(script);
	}

	enableAddon(id) {
		if (this.enabledAddons.includes(id)) return;

		const addon = this.getAddon(id),
			requires = addon && addon.requires || [];

		for (const requiredID of requires) {
			this.enableAddon(requiredID);
		}

		this.loadAddon(id);

		this.enabledAddons.push(id);
		this.settings.provider.set('addons.enabled', this.enabledAddons);

		this.log.info('Enabled addon', id, this.enabledAddons);
	}

	disableAddon(id) {
		if (!this.enabledAddons.includes(id)) return;

		const requires = this.enabledAddons.filter(addonID => {
			const addon = this.getAddon(addonID);
			return addon.requires && addon.requires.includes(id);
		});

		for (const requiredID of requires) {
			this.disableAddon(requiredID);
		}

		this.enabledAddons = this.enabledAddons.filter(addonID => addonID !== id);
		this.settings.provider.set('addons.enabled', this.enabledAddons);

		this.log.info('Disabled addon', id, this.enabledAddons);
	}
}

export default AddonManager;