'use strict';

// ============================================================================
// FrankerFaceZ for Kick
//
// The client that runs on kick.com. It is its own flavor with its own site
// module (src/sites/kick) and, for now, loads only the parts of the client
// that aren't tied to Twitch: settings, the control center, add-ons and
// tooltips. Chat and player support come later.
// ============================================================================

import dayjs from 'dayjs';

import Module, { State } from 'utilities/module';
import { timeout } from 'utilities/object';

import {DEBUG} from 'utilities/constants';

import SettingsManager from './settings/index';
import AddonManager from './addons';
import ExperimentManager from './experiments';
import TranslationManager from './i18n';
import PubSubClient from './pubsub';
import StagingSelector from './staging';
import LoadTracker from './load_tracker';
import VueModule from 'utilities/vue';
import { installPort } from './utilities/extension_port';

import Site from './sites/kick';

import Tooltips from 'src/modules/tooltips';
import MainMenu from 'src/modules/main_menu';

import type { ClientVersion } from 'utilities/types';

import * as Utility_Addons from 'utilities/addon';
import * as Utility_Blobs from 'utilities/blobs';
import * as Utility_Color from 'utilities/color';
import * as Utility_Constants from 'utilities/constants';
import * as Utility_Dialog from 'utilities/dialog';
import * as Utility_DOM from 'utilities/dom';
import * as Utility_Events from 'utilities/events';
import * as Utility_FontAwesome from 'utilities/font-awesome';
import Logger, * as Utility_Logging from 'utilities/logging';
import * as Utility_Module from 'utilities/module';
import * as Utility_Object from 'utilities/object';
import * as Utility_Time from 'utilities/time';
import * as Utility_Tooltip from 'utilities/tooltip';
import * as Utility_I18n from 'utilities/translation-core';
import * as Utility_Filtering from 'utilities/filtering';

class FrankerFaceZ extends Module {

	static instance: FrankerFaceZ = null as any;
	static version_info: ClientVersion = null as any;
	static Logger = Logger;

	static utilities = {
		addon: Utility_Addons,
		blobs: Utility_Blobs,
		color: Utility_Color,
		constants: Utility_Constants,
		dialog: Utility_Dialog,
		dom: Utility_DOM,
		events: Utility_Events,
		fontAwesome: Utility_FontAwesome,
		logging: Utility_Logging,
		module: Utility_Module,
		object: Utility_Object,
		time: Utility_Time,
		tooltip: Utility_Tooltip,
		i18n: Utility_I18n,
		filtering: Utility_Filtering
	};

	core_log: Logger;

	host: string;
	flavor: string;

	constructor() {
		super();
		const start_time = performance.now();

		FrankerFaceZ.instance = this;

		this.host = 'kick';
		this.flavor = 'kick';
		this.name = 'ffz_kick';

		// Evil private member access.
		(this as any).__state = State.Disabled;
		(this as any).__modules.core = this;

		this._time('instance');

		// ========================================================================
		// Logging
		// ========================================================================

		this.log = new Logger(null, null, null);
		this.log.label = 'FFZKick';
		this.log.init = true;

		this.core_log = this.log.get('core');
		this.log.hi(this, FrankerFaceZ.version_info);


		// ========================================================================
		// Core Systems
		// ========================================================================

		if (document.body.dataset.ffzExtension)
			installPort(this);

		this.inject('settings', SettingsManager);
		this.inject('experiments', ExperimentManager);
		this.inject('i18n', TranslationManager);
		this.inject('staging', StagingSelector);
		this.inject('load_tracker', LoadTracker);
		this.inject('pubsub', PubSubClient);
		this.inject('site', Site);
		this.inject('addons', AddonManager);

		this.register('vue', VueModule);


		// ========================================================================
		// Startup
		// ========================================================================

		this.inject('tooltips', Tooltips);
		this.register('main_menu', MainMenu);

		Promise.resolve(this.enable())
			.then(() => this.enableInitialModules())
			.then(() => {
				const duration = performance.now() - start_time;
				this.core_log.info(`Initialization complete in ${duration.toFixed(5)}ms.`);
				this.log.init = false;

			}).catch(err => {
				this.core_log.error('An error occurred during initialization.', err);
				this.log.init = false;
			});
	}

	static get() {
		return FrankerFaceZ.instance;
	}


	// ========================================================================
	// Generate Log
	// ========================================================================

	async generateLog() {
		const promises = [];
		for(const [key, module] of Object.entries((this as any).__modules)) {
			if ( module instanceof Module && module.generateLog && (module as any) != this )
				promises.push((async () => {
					try {
						return [
							key,
							await timeout(Promise.resolve((module as any).generateLog()), 5000)
						];
					} catch(err) {
						return [
							key,
							`Error: ${err}`
						]
					}
				})());
		}

		const out = await Promise.all(promises);

		if ( this.log.captured_init && this.log.captured_init.length > 0 ) {
			const logs = [];
			for(const msg of this.log.captured_init) {
				const time = dayjs(msg.time).locale('en').format('H:mm:ss');
				logs.push(`[${time}] ${msg.level} | ${msg.category || 'core'}: ${msg.message}`);
			}

			out.unshift(['initialization', logs.join('\n')]);
		}

		return out.map(x => `${x[0]}
-------------------------------------------------------------------------------
${typeof x[1] === 'string' ? x[1] : JSON.stringify(x[1], null, 4)}`).join('\n\n');
	}


	// ========================================================================
	// Modules
	// ========================================================================

	enableInitialModules() {
		const promises = [];
		for(const module of Object.values((this as any).__modules)) {
			if ( module instanceof Module && module.should_enable )
				promises.push(module.enable());
		}

		return Promise.all(promises);
	}
}


const VER: ClientVersion = FrankerFaceZ.version_info = Object.freeze({
	major: __version_major__,
	minor: __version_minor__,
	revision: __version_patch__,
	extra: __version_prerelease__?.length && __version_prerelease__[0],
	commit: __git_commit__,
	build: __version_build__,
	hash: __webpack_hash__,
	toString: () =>
		`${VER.major}.${VER.minor}.${VER.revision}${VER.build ? `.${VER.build}` : ''}${VER.extra || ''}${DEBUG ? '-dev' : ''}`
});


export default FrankerFaceZ;

// main.ts declares window.FrankerFaceZ and window.ffz with its own class,
// so this flavor assigns them without redeclaring.
(window as any).FrankerFaceZ = FrankerFaceZ;
(window as any).ffz = new FrankerFaceZ();
