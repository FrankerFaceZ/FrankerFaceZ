import Module from 'utilities/module';

export class Addon extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
	}

	static register(id, info) {
		const ffz = FrankerFaceZ.get();
		ffz.register(`addon.${id}`, this);

		if ( info ) {
			info.id = id;
			ffz.addons.addAddon(info);
		}
	}
}