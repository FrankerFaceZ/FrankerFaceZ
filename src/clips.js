'use strict';

import dayjs from 'dayjs';
//import RavenLogger from './raven';

import Logger from 'utilities/logging';
import Module from 'utilities/module';

import {DEBUG} from 'utilities/constants';
import {timeout} from 'utilities/object';

import { installPort } from './utilities/extension_port';

import SettingsManager from './settings/index';
import AddonManager from './addons';
import ExperimentManager from './experiments';
import TranslationManager from './i18n';
import PubSubClient from './pubsub';
import StagingSelector from './staging';
import LoadTracker from './load_tracker';

import Site from './sites/clips';
import VueModule from 'utilities/vue';

import Tooltips from 'src/modules/tooltips';
import Chat from 'src/modules/chat';
import EmoteCard from 'src/modules/emote_card';

class FrankerFaceZ extends Module {
	constructor() {
		super();
		const start_time = performance.now();

		FrankerFaceZ.instance = this;

		this.host = 'twitch';
		this.flavor = 'clips';
		this.name = 'ffz_clips';
		this.__state = 0;
		this.__modules.core = this;

		// ========================================================================
		// Error Reporting and Logging
		// ========================================================================

		//this.inject('raven', RavenLogger);

		this.log = new Logger(null, null, null); //, this.raven);
		this.log.label = 'FFZClips';
		this.log.init = true;

		this.core_log = this.log.get('core');
		this.log.hi(this);


		// ========================================================================
		// Core Systems
		// ========================================================================

		if (!! document.body.dataset.ffzExtension)
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

		this.register('chat', Chat);
		this.register('emote_card', EmoteCard);

		this.enable()
			.then(() => this.enableInitialModules())
			.then(() => {
				const duration = performance.now() - start_time;
				this.core_log.info(`Initialization complete in ${duration.toFixed(5)}ms.`);
				this.log.init = false;

			}).catch(err => {
				this.core_log.error(`An error occurred during initialization.`, err);
				this.log.init = false;
			});
	}

	static get() {
		return FrankerFaceZ.instance;
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

	// ========================================================================
	// Generate Log
	// ========================================================================

	async generateLog() {
		const promises = [];
		for(const key in this.__modules) { // eslint-disable-line guard-for-in
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

		return out.map(x => `${x[0]}
-------------------------------------------------------------------------------
${typeof x[1] === 'string' ? x[1] : JSON.stringify(x[1], null, 4)}`).join('\n\n');
	}
}


FrankerFaceZ.Logger = Logger;

const VER = FrankerFaceZ.version_info = Object.freeze({
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

// We don't support addons in the player right now, so
FrankerFaceZ.utilities = {
	addon: require('utilities/addon'),
	blobs: require('utilities/blobs'),
	color: require('utilities/color'),
	constants: require('utilities/constants'),
	dom: require('utilities/dom'),
	events: require('utilities/events'),
	//fontAwesome: require('utilities/font-awesome'),
	//graphql: require('utilities/graphql'),
	logging: require('utilities/logging'),
	module: require('utilities/module'),
	object: require('utilities/object'),
	time: require('utilities/time'),
	tooltip: require('utilities/tooltip'),
	i18n: require('utilities/translation-core'),
	dayjs: require('dayjs'),
	popper: require('@popperjs/core')
}


window.FrankerFaceZ = FrankerFaceZ;
window.ffz = new FrankerFaceZ();
