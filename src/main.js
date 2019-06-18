'use strict';

import dayjs from 'dayjs';
import RavenLogger from './raven';

import Logger from 'utilities/logging';
import Module from 'utilities/module';
import { timeout } from 'utilities/object';

import {DEBUG} from 'utilities/constants';

import SettingsManager from './settings/index';
import AddonManager from './addons';
import ExperimentManager from './experiments';
import {TranslationManager} from './i18n';
import SocketClient from './socket';
import Site from 'site';
import Vue from 'utilities/vue';

class FrankerFaceZ extends Module {
	constructor() {
		super();
		const start_time = performance.now(),
			VER = FrankerFaceZ.version_info;

		FrankerFaceZ.instance = this;

		this.name = 'frankerfacez';
		this.__state = 0;
		this.__modules.core = this;

		// ========================================================================
		// Error Reporting and Logging
		// ========================================================================

		this.inject('raven', RavenLogger);

		this.log = new Logger(null, null, null, this.raven);
		this.log.init = true;

		this.core_log = this.log.get('core');

		this.log.info(`FrankerFaceZ v${VER} (build ${VER.build}${VER.commit ? ` - commit ${VER.commit}` : ''})`);


		// ========================================================================
		// Core Systems
		// ========================================================================

		this.inject('settings', SettingsManager);
		this.inject('experiments', ExperimentManager);
		this.inject('i18n', TranslationManager);
		this.inject('socket', SocketClient);
		this.inject('site', Site);
		this.inject('addons', AddonManager);

		this.register('vue', Vue);


		// ========================================================================
		// Startup
		// ========================================================================

		this.discoverModules();

		this.enable().then(() => this.enableInitialModules()).then(() => {
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
		for(const key in this.__modules) {
			const module = this.__modules[key];
			if ( module instanceof Module && module.generateLog && module != this )
				promises.push((async () => {
					try {
						return [
							key,
							await timeout(Promise.resolve(module.generateLog()), 5000)
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

		return out.map(x => {
			return `${x[0]}
-------------------------------------------------------------------------------
${typeof x[1] === 'string' ? x[1] : JSON.stringify(x[1], null, 4)}`
		}).join('\n\n');
	}


	// ========================================================================
	// Modules
	// ========================================================================

	discoverModules() {
		const ctx = require.context('src/modules', true, /(?:^(?:\.\/)?[^/]+|index)\.jsx?$/),
			modules = this.populate(ctx, this.core_log);

		this.core_log.info(`Loaded descriptions of ${Object.keys(modules).length} modules.`);
	}


	async enableInitialModules() {
		const promises = [];
		/* eslint guard-for-in: off */
		for(const key in this.__modules) {
			const module = this.__modules[key];
			if ( module instanceof Module && module.should_enable )
				promises.push(module.enable());
		}

		await Promise.all(promises);
	}
}

FrankerFaceZ.Logger = Logger;

const VER = FrankerFaceZ.version_info = {
	major: 4, minor: 5, revision: 1,
	commit: __git_commit__,
	build: __webpack_hash__,
	toString: () =>
		`${VER.major}.${VER.minor}.${VER.revision}${VER.extra || ''}${DEBUG ? '-dev' : ''}`
}


FrankerFaceZ.utilities = {
	addon: require('utilities/addon'),
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
	popper: require('popper.js').default
}



window.FrankerFaceZ = FrankerFaceZ;
window.ffz = new FrankerFaceZ();
