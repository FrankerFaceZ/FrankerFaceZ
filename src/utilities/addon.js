import Module from 'utilities/module';

const EXTRACTOR = /^addon\.([^.]+)(?:\.|$)/i;

function extractAddonId(path) {
	const match = EXTRACTOR.exec(path);
	if ( match )
		return match[1];
}

export class Addon extends Module {
	constructor(...args) {
		super(...args);

		this.addon_id = extractAddonId(this.__path);
		this.addon_root = this;

		this.inject('i18n');
		this.inject('settings');
	}

	static register(id, info) {
		if ( typeof id === 'object' ) {
			info = id;
			id = info.id || undefined;
		}

		if ( ! id ) {
			if ( this.name )
				id = this.name.toSnakeCase();
			else
				throw new Error(`Unable to register module without ID.`);
		}

		if ( ! info && this.info )
			info = this.info;

		const ffz = FrankerFaceZ.get();
		if ( info ) {
			info.id = id;
			ffz.addons.addAddon(info);
		}

		try {
			ffz.register(`addon.${id}`, this);
		} catch(err) {
			if ( err.message && err.message.includes('Name Collision for Module') ) {
				const module = ffz.resolve(`addon.${id}`);
				if ( module )
					module.external = true;
			}

			throw err;
		}
	}
}