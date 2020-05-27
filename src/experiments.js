'use strict';

// ============================================================================
// Experiments
// ============================================================================

import {DEBUG, SERVER} from 'utilities/constants';
import Module from 'utilities/module';
import {has, deep_copy} from 'utilities/object';
import { getBuster } from 'utilities/time';

import Cookie from 'js-cookie';
import SHA1 from 'crypto-js/sha1';

const OVERRIDE_COOKIE = 'experiment_overrides',
	COOKIE_OPTIONS = {
		expires: 7,
		domain: '.twitch.tv'
	};


// We want to import this so that the file is included in the output.
// We don't load using this because we might want a newer file from the
// server.
import EXPERIMENTS from './experiments.json'; // eslint-disable-line no-unused-vars


// ============================================================================
// Experiment Manager
// ============================================================================

export default class ExperimentManager extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');

		this.settings.addUI('experiments', {
			path: 'Debugging > Experiments',
			component: 'experiments',
			no_filter: true,

			getExtraTerms: () => {
				const values = [];

				for(const [key,val] of Object.entries(this.experiments)) {
					values.push(key);
					if ( val.name )
						values.push(val.name);
					if ( val.description )
						values.push(val.description);
				}

				for(const [key, val] of Object.entries(this.getTwitchExperiments())) {
					values.push(key);
					if ( val.name )
						values.push(val.name);
				}

				return values;
			},

			unique_id: () => this.unique_id,

			ffz_data: () => deep_copy(this.experiments),
			twitch_data: () => deep_copy(this.getTwitchExperiments()),

			usingTwitchExperiment: key => this.usingTwitchExperiment(key),
			getTwitchAssignment: key => this.getTwitchAssignment(key),
			hasTwitchOverride: key => this.hasTwitchOverride(key),
			setTwitchOverride: (key, val) => this.setTwitchOverride(key, val),
			deleteTwitchOverride: key => this.deleteTwitchOverride(key),

			getAssignment: key => this.getAssignment(key),
			hasOverride: key => this.hasOverride(key),
			setOverride: (key, val) => this.setOverride(key, val),
			deleteOverride: key => this.deleteOverride(key),

			on: (...args) => this.on(...args),
			off: (...args) => this.off(...args)
		});

		this.unique_id = Cookie.get('unique_id');

		this.Cookie = Cookie;

		this.experiments = {};
		this.cache = new Map;
	}

	async onLoad() {
		await this.loadExperiments();
	}


	async loadExperiments() {
		let data;

		try {
			data = await fetch(DEBUG ? EXPERIMENTS : `${SERVER}/script/experiments.json?_=${getBuster()}`).then(r =>
				r.ok ? r.json() : null);

		} catch(err) {
			this.log.warn('Unable to load experiment data.', err);
		}

		if ( ! data )
			return;

		this.experiments = data;

		const old_cache = this.cache;
		this.cache = new Map;

		let changed = 0;

		for(const [key, old_val] of old_cache.entries()) {
			const new_val = this.getAssignment(key);
			if ( old_val !== new_val ) {
				changed++;
				this.emit(':changed', key, new_val);
				this.emit(`:changed:${key}`, new_val);
			}
		}

		this.log.info(`Loaded information on ${Object.keys(data).length} experiments.${changed > 0 ? ` ${changed} values updated.` : ''}`);
		//this.emit(':loaded');
	}


	onEnable() {
		this.on('socket:command:reload_experiments', this.loadExperiments, this);
		this.on('socket:command:update_experiment', this.updateExperiment, this);
	}


	updateExperiment(key, data) {
		this.log.info(`Received updated data for experiment "${key}" via WebSocket.`, data);

		if ( data.groups )
			this.experiments[key] = data;
		else
			this.experiments[key].groups = data;

		this._rebuildKey(key);
	}


	generateLog() {
		const out = [
			`Unique ID: ${this.unique_id}`,
			''
		];

		for(const [key, value] of Object.entries(this.experiments)) {
			out.push(`FFZ | ${value.name}: ${this.getAssignment(key)}${this.hasOverride(key) ? ' (Overriden)' : ''}`);
		}

		for(const [key, value] of Object.entries(this.getTwitchExperiments())) {
			if ( this.usingTwitchExperiment(key) )
				out.push(`TWITCH | ${value.name}: ${this.getTwitchAssignment(key)}${this.hasTwitchOverride(key) ? ' (Overriden)' : ''}`)
		}

		return out.join('\n');
	}


	// Twitch Experiments

	getTwitchExperiments() {
		if ( window.__twilightSettings )
			return window.__twilightSettings.experiments;

		const core = this.resolve('site')?.getCore();
		return core && core.experiments.experiments;
	}


	usingTwitchExperiment(key) {
		const core = this.resolve('site')?.getCore();
		return core && has(core.experiments.assignments, key)
	}


	setTwitchOverride(key, value = null) {
		const overrides = Cookie.getJSON(OVERRIDE_COOKIE) || {};
		overrides[key] = value;
		Cookie.set(OVERRIDE_COOKIE, overrides, COOKIE_OPTIONS);

		const core = this.resolve('site')?.getCore();
		if ( core )
			core.experiments.overrides[key] = value;

		this._rebuildTwitchKey(key, true, value);
	}

	deleteTwitchOverride(key) {
		const overrides = Cookie.getJSON(OVERRIDE_COOKIE);
		if ( ! overrides || ! has(overrides, key) )
			return;

		const old_val = overrides[key];
		delete overrides[key];
		Cookie.set(OVERRIDE_COOKIE, overrides, COOKIE_OPTIONS);

		const core = this.resolve('site')?.getCore();
		if ( core )
			delete core.experiments.overrides[key];

		this._rebuildTwitchKey(key, false, old_val);
	}

	hasTwitchOverride(key) { // eslint-disable-line class-methods-use-this
		const overrides = Cookie.getJSON(OVERRIDE_COOKIE);
		return overrides && has(overrides, key);
	}

	getTwitchAssignment(key) {
		const core = this.resolve('site')?.getCore(),
			exps = core && core.experiments;

		if ( ! exps )
			return null;

		if ( ! exps.hasInitialized && exps.initialize )
			try {
				exps.initialize();
			} catch(err) {
				this.log.warn('Error attempting to initialize Twitch experiments tracker.', err);
			}

		if ( exps.overrides && exps.overrides[key] )
			return exps.overrides[key];

		else if ( exps.assignments && exps.assignments[key] )
			return exps.assignments[key];

		return null;
	}

	getTwitchKeyFromName(name) {
		const experiments = this.getTwitchExperiments();
		if ( ! experiments )
			return undefined;

		name = name.toLowerCase();
		for(const key in experiments)
			if ( has(experiments, key) ) {
				const data = experiments[key];
				if ( data && data.name && data.name.toLowerCase() === name )
					return key;
			}
	}

	getTwitchAssignmentByName(name) {
		return this.getTwitchAssignment(this.getTwitchKeyFromName(name));
	}

	_rebuildTwitchKey(key, is_set, new_val) {
		const core = this.resolve('site')?.getCore(),
			exps = core.experiments,

			old_val = has(exps.assignments, key) ?
				exps.assignments[key] :
				undefined;

		if ( old_val !== new_val ) {
			const value = is_set ? new_val : old_val;
			this.emit(':twitch-changed', key, value);
			this.emit(`:twitch-changed:${key}`, value);
		}
	}


	// FFZ Experiments

	setOverride(key, value = null) {
		const overrides = this.settings.provider.get('experiment-overrides') || {};
		overrides[key] = value;

		this.settings.provider.set('experiment-overrides', overrides);

		this._rebuildKey(key);
	}

	deleteOverride(key) {
		const overrides = this.settings.provider.get('experiment-overrides');
		if ( ! overrides || ! has(overrides, key) )
			return;

		delete overrides[key];
		this.settings.provider.set('experiment-overrides', overrides);

		this._rebuildKey(key);
	}

	hasOverride(key) {
		const overrides = this.settings.provider.get('experiment-overrides');
		return overrides && has(overrides, key);
	}

	getAssignment(key) {
		if ( this.cache.has(key) )
			return this.cache.get(key);

		const experiment = this.experiments[key];
		if ( ! experiment ) {
			this.log.warn(`Tried to get assignment for experiment "${key}" which is not known.`);
			return null;
		}

		const overrides = this.settings.provider.get('experiment-overrides'),
			out = overrides && has(overrides, key) ?
				overrides[key] :
				ExperimentManager.selectGroup(key, experiment, this.unique_id);

		this.cache.set(key, out);
		return out;
	}

	_rebuildKey(key) {
		if ( ! this.cache.has(key) )
			return;

		const old_val = this.cache.get(key);
		this.cache.delete(key);
		const new_val = this.getAssignment(key);

		if ( new_val !== old_val ) {
			this.emit(':changed', key, new_val);
			this.emit(`:changed:${key}`, new_val);
		}
	}


	static selectGroup(key, experiment, unique_id) {
		const seed = key + unique_id + (experiment.seed || ''),
			total = experiment.groups.reduce((a,b) => a + b.weight, 0);

		let value = (SHA1(seed).words[0] >>> 0) / Math.pow(2, 32);

		for(const group of experiment.groups) {
			value -= group.weight / total;
			if ( value <= 0 )
				return group.value;
		}

		return null;
	}
}