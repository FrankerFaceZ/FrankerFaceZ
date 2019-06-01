import Module from 'utilities/module';

export class Addon extends Module {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject('settings');
	}

	static register(name) {
		FrankerFaceZ.get().register(`addon.${name}`, this).enable();
	}
}