import Module, { GenericModule, ModuleEvents } from 'utilities/module';
import type { AddonInfo } from './types';
import type Logger from './logging';
import type TranslationManager from '../i18n';
import type SettingsManager from '../settings';

/**
 * A special sub-class of {@link Module} used for the root module of an add-on.
 *
 * This sub-class has a static {@link register} method that add-ons should call
 * to properly inject themselves into FrankerFaceZ once their scripts have
 * loaded. {@link register} is called automatically by add-ons build from the
 * official add-ons repository.
 */
export class Addon<TPath extends string = '', TEventMap extends ModuleEvents = ModuleEvents> extends Module<TPath, TEventMap> {

	static info?: AddonInfo;

	// Dependencies
	i18n: TranslationManager = null as any;
	settings: SettingsManager = null as any;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent, true);

		this.inject('i18n');
		this.inject('settings');
	}

	/**
	 * @deprecated
	 * @see {@link loadFromContext}
	 */
	populate(ctx: __WebpackModuleApi.RequireContext, log?: Logger) {
		this.log.warn('[DEV-CHECK] populate() has been renamed to loadFromContext(). The populate() name is deprecated.');
		return this.loadFromContext(ctx, log);
	}

	/**
	 * Register this add-on with the FrankerFaceZ module system. This
	 * should be called as soon as your add-on class is available and
	 * ready to be enabled. The {@link AddonManager} class will then
	 * call {@link enable} on this module (assuming the user wants
	 * the add-on to be enabled.)
	 * @param id This add-on's ID, or an {@link AddonInfo} object.
	 * @param info An optional AddonInfo object if {@link id} was not set to an AddonInfo object.
	 */
	static register(id?: string | AddonInfo, info?: AddonInfo) {
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

		const ffz = window.FrankerFaceZ.get();
		if ( info ) {
			info.id = id;
			(ffz as any).addons.addAddon(info);
		}

		try {
			ffz.register(`addon.${id}`, this);
		} catch(err) {
			if ( (err instanceof Error) && err.message && err.message.includes('Name Collision for Module') ) {
				const module = ffz.resolve(`addon.${id}`);
				if ( module )
					(module as any).external = true;
			}

			throw err;
		}
	}
}
