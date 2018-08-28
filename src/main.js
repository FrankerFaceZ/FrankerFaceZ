'use strict';

import RavenLogger from './raven';

import Logger from 'utilities/logging';
import Module from 'utilities/module';

import {DEBUG} from 'utilities/constants';

import SettingsManager from './settings/index';
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

		if ( ! DEBUG )
			this.inject('raven', RavenLogger);

		this.log = new Logger(null, null, null, this.raven);
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

		this.register('vue', Vue);


		// ========================================================================
		// Startup
		// ========================================================================

		this.discoverModules();

		this.enable().then(() => this.enableInitialModules()).then(() => {
			const duration = performance.now() - start_time;
			this.core_log.info(`Initialization complete in ${duration.toFixed(5)}ms.`);

		}).catch(err => {
			this.core_log.error('An error occurred during initialization.', err);
		});
	}

	static get() {
		return FrankerFaceZ.instance;
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
	major: 4, minor: 0, revision: 0, extra: '-rc12.14',
	commit: __git_commit__,
	build: __webpack_hash__,
	toString: () =>
		`${VER.major}.${VER.minor}.${VER.revision}${VER.extra || ''}${DEBUG ? '-dev' : ''}`
}


FrankerFaceZ.utilities = {
	dom: require('utilities/dom'),
	color: require('utilities/color'),
	events: require('utilities/events'),
	module: require('utilities/module'),
	constants: require('utilities/constants'),
	logging: require('utilities/logging'),
	object: require('utilities/object'),
	time: require('utilities/time'),
	tooltip: require('utilities/tooltip')
}



window.FrankerFaceZ = FrankerFaceZ;
window.ffz = new FrankerFaceZ();
