'use strict';

// ============================================================================
// Experiments
// ============================================================================

import {DEBUG, SERVER, SERVER_OR_EXT} from 'utilities/constants';
import Module, { GenericModule } from 'utilities/module';
import {has, deep_copy, fetchJSON} from 'utilities/object';
import { getBuster } from 'utilities/time';

import Cookie from 'js-cookie';
import SHA1 from 'crypto-js/sha1';

import type SettingsManager from './settings';
import type { ExperimentTypeMap } from 'utilities/types';

declare module 'utilities/types' {
	interface ModuleMap {
		experiments: ExperimentManager;
	}
	interface ModuleEventMap {
		experiments: ExperimentEvents;
	}
	interface ProviderTypeMap {
		'experiment-overrides': {
			[K in keyof ExperimentTypeMap]?: ExperimentTypeMap[K];
		}
	}
	interface PubSubCommands {
		reload_experiments: [];
		update_experiment: {
			key: keyof ExperimentTypeMap,
			data: FFZExperimentData | ExperimentGroup[]
		};
	}
}

declare global {
	interface Window {
		__twilightSettings?: {
			experiments?: Record<string, TwitchExperimentData>;
		}
	}
}


const OVERRIDE_COOKIE = 'experiment_overrides',
	COOKIE_OPTIONS = {
		expires: 7,
		domain: '.twitch.tv'
	};


// We want to import this so that the file is included in the output.
// We don't load using this because we might want a newer file from the
// server. Because of our webpack settings, this is imported as a URL
// and not an object.
const EXPERIMENTS: string = require('./experiments.json');

// ============================================================================
// Data Types
// ============================================================================

export enum TwitchExperimentType {
	Unknown = 0,
	Device = 1,
	User = 2,
	Channel = 3
};

export type ExperimentGroup = {
	value: unknown;
	weight: number;
};

export type FFZExperimentData = {
	name: string;
	seed?: number;
	description: string;
	groups: ExperimentGroup[];
}

export type TwitchExperimentData = {
	name: string;
	t: TwitchExperimentType;
	v: number;
	groups: ExperimentGroup[];
};

export type ExperimentData = FFZExperimentData | TwitchExperimentData;


export type OverrideCookie = {
	experiments: Record<string, string>;
	disabled: string[];
};


type ExperimentEvents = {
	':changed': [key: string, new_value: any, old_value: any];
	':twitch-changed': [key: string, new_value: string | null, old_value: string | null];
	[key: `:twitch-changed:${string}`]: [new_value: string | null, old_value: string | null];
} & {
	[K in keyof ExperimentTypeMap as `:changed:${K}`]: [new_value: ExperimentTypeMap[K], old_value: ExperimentTypeMap[K] | null];
};


type ExperimentLogEntry = {
	key: string;
	name: string;
	value: any;
	override: boolean;
	rarity: number;
	type?: string;
}


// ============================================================================
// Helper Methods
// ============================================================================

export function isTwitchExperiment(exp: ExperimentData): exp is TwitchExperimentData {
	return 't' in exp;
}

export function isFFZExperiment(exp: ExperimentData): exp is FFZExperimentData {
	return 'description' in exp;
}

function sortExperimentLog(a: ExperimentLogEntry, b: ExperimentLogEntry) {
	if ( a.rarity < b.rarity )
		return -1;
	else if ( a.rarity > b.rarity )
		return 1;

	if ( a.name < b.name )
		return -1;
	else if ( a.name > b.name )
		return 1;

	return 0;
}


// ============================================================================
// Experiment Manager
// ============================================================================

export default class ExperimentManager extends Module<'experiments', ExperimentEvents> {

	// Dependencies
	settings: SettingsManager = null as any;

	// State
	unique_id?: string;
	experiments: Partial<{
		[K in keyof ExperimentTypeMap]: FFZExperimentData;
	}>;

	private cache: Map<keyof ExperimentTypeMap, unknown>;


	// Helpers
	Cookie: typeof Cookie;


	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.get = this.getAssignment;

		this.inject('settings');

		this.settings.addUI('experiments', {
			path: 'Debugging > Experiments',
			component: 'experiments',
			no_filter: true,

			getExtraTerms: () => {
				const values: string[] = [];

				for(const [key, val] of Object.entries(this.experiments)) {
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

			is_locked: () => this.getControlsLocked(),
			unlock: () => this.unlockControls(),

			unique_id: () => this.unique_id,

			ffz_data: () => deep_copy(this.experiments),
			twitch_data: () => deep_copy(this.getTwitchExperiments()),

			usingTwitchExperiment: (key: string) => this.usingTwitchExperiment(key),
			getTwitchAssignment: (key: string) => this.getTwitchAssignment(key),
			getTwitchType: (type: TwitchExperimentType) => this.getTwitchType(type),
			hasTwitchOverride: (key: string) => this.hasTwitchOverride(key),
			setTwitchOverride: (key: string, val: string) => this.setTwitchOverride(key, val),
			deleteTwitchOverride: (key: string) => this.deleteTwitchOverride(key),

			getAssignment: <K extends keyof ExperimentTypeMap>(key: K) => this.getAssignment(key),
			hasOverride: (key: keyof ExperimentTypeMap) => this.hasOverride(key),
			setOverride: <K extends keyof ExperimentTypeMap>(key: K, val: ExperimentTypeMap[K]) => this.setOverride(key, val),
			deleteOverride: (key: keyof ExperimentTypeMap) => this.deleteOverride(key),

			on: (...args: Parameters<typeof this.on>) => this.on(...args),
			off: (...args: Parameters<typeof this.off>) => this.off(...args)
		});

		this.unique_id = Cookie.get('unique_id');

		this.Cookie = Cookie;

		this.experiments = {};
		this.cache = new Map;
	}

	getControlsLocked() {
		if ( DEBUG )
			return false;

		const ts = this.settings.provider.get<number>('exp-lock', 0);
		if ( isNaN(ts) || ! isFinite(ts) )
			return true;

		return Date.now() - ts >= 86400000;
	}

	unlockControls() {
		this.settings.provider.set('exp-lock', Date.now());
	}

	async onLoad() {
		await this.loadExperiments();
	}


	async loadExperiments() {
		let data: Record<keyof ExperimentTypeMap, FFZExperimentData> | null;

		try {
			data = await fetchJSON(DEBUG
				? EXPERIMENTS
				: `${SERVER}/script/experiments.json?_=${getBuster()}`
			);

		} catch(err) {
			this.log.warn('Unable to load experiment data.', err);
			return;
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
				this.emit(':changed', key, new_val, old_val);
				this.emit(`:changed:${key as keyof ExperimentTypeMap}`, new_val as any, old_val as any);
			}
		}

		this.log.info(`Loaded information on ${Object.keys(data).length} experiments.${changed > 0 ? ` ${changed} values updated.` : ''}`);
		//this.emit(':loaded');
	}

	/** @internal */
	onEnable() {
		this.on('pubsub:command:reload_experiments', this.loadExperiments, this);
		this.on('pubsub:command:update_experiment', data => {
			this.updateExperiment(data.key, data.data);
		}, this);
	}


	updateExperiment(key: keyof ExperimentTypeMap, data: FFZExperimentData | ExperimentGroup[]) {
		this.log.info(`Received updated data for experiment "${key}" via PubSub.`, data);

		if ( Array.isArray(data) ) {
			const existing = this.experiments[key];
			if ( ! existing )
				return;

			existing.groups = data;

		} else if ( data?.groups )
			this.experiments[key] = data;

		this._rebuildKey(key);
	}


	generateLog() {
		const out = [
			`Unique ID: ${this.unique_id}`,
			''
		];

		const ffz_assignments: ExperimentLogEntry[] = [];
		for(const [key, value] of Object.entries(this.experiments) as [keyof ExperimentTypeMap, FFZExperimentData][]) {
			const assignment = this.getAssignment(key),
				override = this.hasOverride(key);

			let weight = 0, total = 0;
			for(const group of value.groups) {
				if ( group.value === assignment )
					weight = group.weight;
				total += group.weight;
			}

			if ( ! override && weight === total )
				continue;

			ffz_assignments.push({
				key,
				name: value.name,
				value: assignment,
				override,
				rarity: weight / total
			});

			//out.push(`FFZ | ${value.name}: ${this.getAssignment(key)}${this.hasOverride(key) ? ' (Overriden)' : ''}`);
		}

		ffz_assignments.sort(sortExperimentLog);

		for(const entry of ffz_assignments)
			out.push(`FFZ | ${entry.name}: ${entry.value}${entry.override ? ' (Override)' : ''} (r:${entry.rarity})`);

		const twitch_assignments: ExperimentLogEntry[] = [],
			channel = this.settings.get('context.channel');

		for(const [key, value] of Object.entries(this.getTwitchExperiments())) {
			if ( ! this.usingTwitchExperiment(key) )
				continue;

			const assignment = this.getTwitchAssignment(key),
				override = this.hasTwitchOverride(key);

			let weight = 0, total = 0;
			for(const group of value.groups) {
				if ( group.value === assignment )
					weight = group.weight;
				total += group.weight;
			}

			if ( ! override && weight === total )
				continue;

			twitch_assignments.push({
				key,
				name: value.name,
				value: assignment,
				override,
				type: this.getTwitchTypeByKey(key),
				rarity: weight / total
			});

			//out.push(`TWITCH | ${value.name}: ${this.getTwitchAssignment(key)}${this.hasTwitchOverride(key) ? ' (Overriden)' : ''}`)
		}

		twitch_assignments.sort(sortExperimentLog);

		for(const entry of twitch_assignments)
			out.push(`Twitch | ${entry.name}: ${entry.value}${entry.override ? ' (Override)' : ''} (r:${entry.rarity}, t:${entry.type}${entry.type === 'channel_id' ? `, c:${channel}`: ''})`);

		return out.join('\n');
	}


	// Twitch Experiments

	getTwitchType(type: number) {
		const core = this.resolve('site')?.getCore?.();
		if ( core?.experiments?.getExperimentType )
			return core.experiments.getExperimentType(type);

		if ( type === 1 )
			return 'device_id';
		else if ( type === 2 )
			return 'user_id';
		else if ( type === 3 )
			return 'channel_id';
		return type;
	}

	getTwitchTypeByKey(key: string) {
		const exps = this.getTwitchExperiments(),
			exp = exps?.[key];

		if ( exp?.t )
			return this.getTwitchType(exp.t);

		return null;
	}

	getTwitchExperiments(): Record<string, TwitchExperimentData> {
		if ( window.__twilightSettings )
			return window.__twilightSettings.experiments ?? {};

		const core = this.resolve('site')?.getCore?.();
		return core && core.experiments.experiments || {};
	}


	usingTwitchExperiment(key: string) {
		const core = this.resolve('site')?.getCore?.();
		return core && has(core.experiments.assignments, key)
	}


	private _getOverrideCookie() {
		const raw = Cookie.get(OVERRIDE_COOKIE);
		let out: OverrideCookie;

		try {
			out = raw ? JSON.parse(raw) : {};
		} catch(err) {
			out = {} as OverrideCookie;
		}

		if ( ! out.experiments )
			out.experiments = {};

		if ( ! out.disabled )
			out.disabled = [];

		return out;
	}

	private _saveOverrideCookie(value?: OverrideCookie) {
		if ( value ) {
			if ((! value.experiments || ! Object.keys(value.experiments).length) &&
				(! value.disabled || ! value.disabled.length)
			)
				value = undefined;
		}

		if ( value )
			Cookie.set(OVERRIDE_COOKIE, JSON.stringify(value), COOKIE_OPTIONS);
		else
			Cookie.remove(OVERRIDE_COOKIE, COOKIE_OPTIONS);
	}


	private _checkExternalAccess() {
		let stack;
		try {
			stack = new Error().stack;
		} catch(err) {
			/* :thinking: */
			try {
				stack = err.stack;
			} catch(err_again) { /* aww */ }
		}

		if ( ! stack )
			return;

		stack = stack.split(/\s*\n+\s*/g).filter(x => x.startsWith('at '));

		let external = false;

		for(const line of stack) {
			if ( ! line.includes(SERVER_OR_EXT) ) {
				external = true;
				break;
			}
		}

		if ( external )
			this.log.warn('Detected access by external script.');
	}


	setTwitchOverride(key: string, value: string) {
		const overrides = this._getOverrideCookie(),
			experiments = overrides.experiments,
			disabled = overrides.disabled;

		this._checkExternalAccess();

		experiments[key] = value;

		const idx = disabled.indexOf(key);
		if (idx != -1)
			disabled.splice(idx, 1);

		this._saveOverrideCookie(overrides);

		const core = this.resolve('site')?.getCore?.();
		if ( core )
			core.experiments.overrides[key] = value;

		this._rebuildTwitchKey(key, true, value);
	}

	deleteTwitchOverride(key: string) {
		const overrides = this._getOverrideCookie(),
			experiments = overrides.experiments;

		this._checkExternalAccess();

		if ( ! has(experiments, key) )
			return;

		const old_val = experiments[key];
		delete experiments[key];

		this._saveOverrideCookie(overrides);

		const core = this.resolve('site')?.getCore?.();
		if ( core )
			delete core.experiments.overrides[key];

		this._rebuildTwitchKey(key, false, old_val);
	}

	hasTwitchOverride(key: string) { // eslint-disable-line class-methods-use-this
		const overrides = this._getOverrideCookie(),
			experiments = overrides.experiments;

		return has(experiments, key);
	}

	getTwitchAssignment(key: string, channel: string | null = null) {
		const core = this.resolve('site')?.getCore?.(),
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

		const exp_data = exps.experiments[key],
			type = this.getTwitchType(exp_data?.t ?? 0);

		// channel_id experiments always use getAssignmentById
		if ( type === 'channel_id' ) {
			return exps.getAssignmentById(key, {
				bucketing: {
					type: 1,
					value: channel ?? this.settings.get('context.channelID')
				}
			});
		}

		// Otherwise, just use the default assignment?
		if ( exps.assignments?.[key] )
			return exps.assignments[key];

		// If there is no default assignment, we should try to figure out
		// what assignment they *would* get.

		if ( type === 'device_id' )
			return exps.selectTreatment(key, exp_data, this.unique_id);

		else if ( type === 'user_id' )
			// Technically, some experiments are expecting to get the user's
			// login rather than user ID. But we don't care that much if an
			// inactive legacy experiment is shown wrong. Meh.
			return exps.selectTreatment(key, exp_data, this.resolve('site')?.getUser?.()?.id);

		// We don't know what kind of experiment this is.
		// Give up!
		return null;
	}

	getTwitchKeyFromName(name: string) {
		const experiments = this.getTwitchExperiments();
		if ( ! experiments )
			return;

		name = name.toLowerCase();
		for(const key in experiments)
			if ( has(experiments, key) ) {
				const data = experiments[key];
				if ( data && data.name && data.name.toLowerCase() === name )
					return key;
			}
	}

	getTwitchAssignmentByName(name: string, channel: string | null = null) {
		const key = this.getTwitchKeyFromName(name);
		if ( ! key )
			return null;
		return this.getTwitchAssignment(key, channel);
	}

	private _rebuildTwitchKey(
		key: string,
		is_set: boolean,
		new_val: string | null
	) {
		const core = this.resolve('site')?.getCore?.(),
			exps = core.experiments,

			old_val = has(exps.assignments, key) ?
				exps.assignments[key] as string :
				null;

		if ( old_val !== new_val ) {
			const value = is_set ? new_val : old_val;
			this.emit(':twitch-changed', key, value, old_val);
			this.emit(`:twitch-changed:${key}`, value, old_val);
		}
	}


	// FFZ Experiments

	setOverride<
		K extends keyof ExperimentTypeMap
	>(key: K, value: ExperimentTypeMap[K]) {
		const overrides = this.settings.provider.get('experiment-overrides', {});
		overrides[key] = value;

		this.settings.provider.set('experiment-overrides', overrides);

		this._rebuildKey(key);
	}

	deleteOverride(key: keyof ExperimentTypeMap) {
		const overrides = this.settings.provider.get('experiment-overrides');
		if ( ! overrides || ! has(overrides, key) )
			return;

		delete overrides[key];
		if ( Object.keys(overrides).length )
			this.settings.provider.set('experiment-overrides', overrides);
		else
			this.settings.provider.delete('experiment-overrides');

		this._rebuildKey(key);
	}

	hasOverride(key: keyof ExperimentTypeMap) {
		const overrides = this.settings.provider.get('experiment-overrides');
		return overrides ? has(overrides, key): false;
	}

	get: <K extends keyof ExperimentTypeMap>(
		key: K
	) => ExperimentTypeMap[K];

	getAssignment<K extends keyof ExperimentTypeMap>(
		key: K
	): ExperimentTypeMap[K] {
		if ( this.cache.has(key) )
			return this.cache.get(key) as ExperimentTypeMap[K];

		const experiment = this.experiments[key];
		if ( ! experiment ) {
			this.log.warn(`Tried to get assignment for experiment "${key}" which is not known.`);
			return null as ExperimentTypeMap[K];
		}

		const overrides = this.settings.provider.get('experiment-overrides'),
			out = overrides && has(overrides, key) ?
				overrides[key] :
				ExperimentManager.selectGroup<ExperimentTypeMap[K]>(key, experiment, this.unique_id ?? '');

		this.cache.set(key, out);
		return out as ExperimentTypeMap[K];
	}

	private _rebuildKey(key: keyof ExperimentTypeMap) {
		if ( ! this.cache.has(key) )
			return;

		const old_val = this.cache.get(key);
		this.cache.delete(key);
		const new_val = this.getAssignment(key);

		if ( new_val !== old_val ) {
			this.emit(':changed', key, new_val, old_val);
			this.emit(`:changed:${key}`, new_val, old_val);
		}
	}


	static selectGroup<T>(
		key: string,
		experiment: FFZExperimentData,
		unique_id: string
	): T | null {
		const seed = key + unique_id + (experiment.seed || ''),
			total = experiment.groups.reduce((a,b) => a + b.weight, 0);

		let value = (SHA1(seed).words[0] >>> 0) / Math.pow(2, 32);

		for(const group of experiment.groups) {
			value -= group.weight / total;
			if ( value <= 0 )
				return group.value as T;
		}

		return null;
	}
}
