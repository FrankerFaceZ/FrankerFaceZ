import Module from 'utilities/module';

export class Addon extends Module {
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

		const key = `addon.${id}`;

		try {
			ffz.register(key, this);

		} catch(err) {
			if ( err.message && err.message.includes('Name Collision for Module') ) {
				const module = ffz.resolve(key);
				if ( module )
					module.external = true;
			}

			throw err;
		}
	}
}