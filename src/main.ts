'use strict';

import dayjs from 'dayjs';
//import RavenLogger from './raven';

import Logger from 'utilities/logging';
import Module, { State } from 'utilities/module';
import { timeout } from 'utilities/object';

import {DEBUG} from 'utilities/constants';

import SettingsManager from './settings/index';
import AddonManager from './addons';
import ExperimentManager from './experiments';
import TranslationManager from './i18n';
import SocketClient from './socket';
import PubSubClient from './pubsub';
import Site from 'site';
import Vue from 'utilities/vue';
import StagingSelector from './staging';
import LoadTracker from './load_tracker';

import type { ClientVersion } from 'utilities/types';

import * as Utility_Addons from 'utilities/addon';
import * as Utility_Blobs from 'utilities/blobs';
import * as Utility_Color from 'utilities/color';
import * as Utility_Constants from 'utilities/constants';
import * as Utility_Dialog from 'utilities/dialog';
import * as Utility_DOM from 'utilities/dom';
import * as Utility_Events from 'utilities/events';
import * as Utility_FontAwesome from 'utilities/font-awesome';
import * as Utility_GraphQL from 'utilities/graphql';
import * as Utility_Logging from 'utilities/logging';
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
		graphql: Utility_GraphQL,
		logging: Utility_Logging,
		module: Utility_Module,
		object: Utility_Object,
		time: Utility_Time,
		tooltip: Utility_Tooltip,
		i18n: Utility_I18n,
		filtering: Utility_Filtering
	};

	/*
	static utilities = {
		addon: require('utilities/addon'),
		blobs: require('utilities/blobs'),
		color: require('utilities/color'),
		constants: require('utilities/constants'),
		dialog: require('utilities/dialog'),
		dom: require('utilities/dom'),
		events: require('utilities/events'),
		fontAwesome: require('utilities/font-awesome'),
		graphql: require('utilities/graphql'),
		logging: require('utilities/logging'),
		module: require('utilities/module'),
		object: require('utilities/object'),
		time: require('utilities/time'),
		tooltip: require('utilities/tooltip'),
		i18n: require('utilities/translation-core'),
		dayjs: require('dayjs'),
		filtering: require('utilities/filtering'),
		popper: require('@popperjs/core')
	};
	*/


	core_log: Logger;

	host: string;
	flavor: string;

	constructor() {
		super();
		const start_time = performance.now();

		FrankerFaceZ.instance = this;

		this.host = 'twitch';
		this.flavor = 'main';
		this.name = 'frankerfacez';

		// Evil private member access.
		(this as any).__state = State.Disabled;
		(this as any).__modules.core = this;

		// Timing
		//this.inject('timing', Timing);
		this._time('instance');

		// ========================================================================
		// Error Reporting and Logging
		// ========================================================================

		//this.inject('raven', RavenLogger);

		this.log = new Logger(null, null, null); //, this.raven);
		this.log.init = true;

		this.core_log = this.log.get('core');
		this.log.hi(this, FrankerFaceZ.version_info);


		// ========================================================================
		// Core Systems
		// ========================================================================

		this.inject('settings', SettingsManager);
		this.inject('experiments', ExperimentManager);
		this.inject('i18n', TranslationManager);
		this.inject('staging', StagingSelector);
		this.inject('load_tracker', LoadTracker);
		this.inject('socket', SocketClient);
		this.inject('pubsub', PubSubClient);
		this.inject('site', Site);
		this.inject('addons', AddonManager);

		this.register('vue', Vue);


		// ========================================================================
		// Startup
		// ========================================================================

		this.discoverModules()
			.then(() => this.enable())
			.then(() => this.enableInitialModules()).then(() => {
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

	async discoverModules() {
		// TODO: Actually do async modules.
		const ctx = await require.context(
			'src/modules',
			true,
			/(?:^(?:\.\/)?[^/]+|index)\.[jt]sx?$/
			/*, 'lazy-once' */
		);

		const modules = this.loadFromContext(ctx, this.core_log);

		this.core_log.info(`Loaded descriptions of ${Object.keys(modules).length} modules.`);
	}


	async enableInitialModules() {
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

declare global {
	interface Window {
		FrankerFaceZ: typeof FrankerFaceZ;
		ffz: FrankerFaceZ;
	}
}

window.FrankerFaceZ = FrankerFaceZ;
window.ffz = new FrankerFaceZ();
