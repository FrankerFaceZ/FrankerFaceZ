'use strict';

import { has } from 'utilities/object';

const RAVEN_LEVELS = {
	1: 'debug',
	2: 'info',
	4: 'warn',
	8: 'error'
};


function readLSLevel() {
	const level = localStorage.ffzLogLevel;
	if ( ! level )
		return null;

	const upper = level.toUpperCase();
	if ( has(Logger, upper) )
		return Logger[upper];

	if ( /^\d+$/.test(level) )
		return parseInt(level, 10);

	return null;
}


export class Logger {
	constructor(parent, name, level, raven) {
		this.root = parent ? parent.root : this;
		this.parent = parent;
		this.name = name;

		if ( this.root == this ) {
			this.captured_init = [];
			this.label = 'FFZ';
		}

		this.init = false;
		this.enabled = true;
		this.level = level ?? (parent && parent.level) ?? readLSLevel() ?? Logger.DEFAULT_LEVEL;
		this.raven = raven || (parent && parent.raven);

		this.children = {};
	}

	hi(core) {
		const VER = core.constructor.version_info;
		this.info(`FrankerFaceZ v${VER} (s:${core.host} f:${core.flavor} b:${VER.build} c:${VER.commit || 'null'})`);

		try {
			const loc = new URL(location);
			loc.search = '';
			this.info(`Initial URL: ${loc}`);
		} catch(err) {
			this.warn(`Unable to read location.`, err);
		}
	}

	get(name, level) {
		if ( ! this.children[name] )
			this.children[name] = new Logger(this, (this.name ? `${this.name}.${name}` : name), level);

		return this.children[name];
	}

	verbose(...args) {
		return this.invoke(Logger.VERBOSE, args);
	}

	verboseColor(msg, colors, ...args) {
		return this.invokeColor(Logger.VERBOSE, msg, colors, args);
	}

	debug(...args) {
		return this.invoke(Logger.DEBUG, args);
	}

	debugColor(msg, colors, ...args) {
		return this.invokeColor(Logger.DEBUG, msg, colors, args);
	}

	info(...args) {
		return this.invoke(Logger.INFO, args);
	}

	infoColor(msg, colors, ...args) {
		return this.invokeColor(Logger.INFO, msg, colors, args);
	}

	warn(...args) {
		return this.invoke(Logger.WARN, args);
	}

	warnColor(msg, colors, ...args) {
		return this.invokeColor(Logger.WARN, msg, colors, args);
	}

	warning(...args) {
		return this.invoke(Logger.WARN, args);
	}

	warningColor(msg, colors, ...args) {
		return this.invokeColor(Logger.WARN, msg, colors, args);
	}

	error(...args) {
		return this.invoke(Logger.ERROR, args);
	}

	errorColor(msg, colors, ...args) {
		return this.invokeColor(Logger.ERROR, msg, colors, args);
	}

	crumb(...args) {
		if ( this.raven )
			return this.raven.captureBreadcrumb(...args);
	}

	capture(exc, opts, ...args) {
		if ( this.raven ) {
			opts = opts || {};
			if ( ! opts.logger )
				opts.logger = this.name;

			this.raven.captureException(exc, opts);
		}

		if ( args.length )
			return this.error(...args);
	}

	invokeColor(level, msg, colors, args) {
		if ( ! this.enabled || level < this.level )
			return;

		if ( ! Array.isArray(colors) )
			colors = [colors];

		const message = args ? Array.prototype.slice.call(args) : [];

		if ( level !== Logger.VERBOSE ) {
			const out = msg.replace(/%c/g, '') + ' ' + message.join(' ');

			if ( this.root.init )
				this.root.captured_init.push({
					time: Date.now(),
					category: this.name,
					message: out,
					level: RAVEN_LEVELS[level] || level
				});

			this.crumb({
				message: out,
				category: this.name,
				level: RAVEN_LEVELS[level] || level
			});
		}

		message.unshift(msg);

		if ( this.name ) {
			message[0] = `%c${this.root.label} [%c${this.name}%c]:%c ${message[0]}`;
			colors.unshift('color:#755000; font-weight:bold', '', 'color:#755000; font-weight:bold', '');

		} else {
			message[0] = `%c${this.root.label}:%c ${message[0]}`;
			colors.unshift('color:#755000; font-weight:bold', '');
		}

		message.splice(1, 0, ...colors);

		if ( level === Logger.DEBUG || level === Logger.VERBOSE )
			console.debug(...message);

		else if ( level === Logger.INFO )
			console.info(...message);

		else if ( level === Logger.WARN )
			console.warn(...message);

		else if ( level === Logger.ERROR )
			console.error(...message);

		else
			console.log(...message);
	}

	/* eslint no-console: "off" */
	invoke(level, args) {
		if ( ! this.enabled || level < this.level )
			return;

		const message = Array.prototype.slice.call(args);

		if ( level !== Logger.VERBOSE ) {
			if ( this.root.init )
				this.root.captured_init.push({
					time: Date.now(),
					category: this.name,
					message: message.join(' '),
					level: RAVEN_LEVELS[level] || level
				});

			this.crumb({
				message: message.join(' '),
				category: this.name,
				level: RAVEN_LEVELS[level] || level
			});
		}

		if ( this.name )
			message.unshift(`%c${this.root.label} [%c${this.name}%c]:%c`, 'color:#755000; font-weight:bold', '', 'color:#755000; font-weight:bold', '');
		else
			message.unshift(`%c${this.root.label}:%c`, 'color:#755000; font-weight:bold', '');

		if ( level === Logger.DEBUG || level === Logger.VERBOSE )
			console.debug(...message);

		else if ( level === Logger.INFO )
			console.info(...message);

		else if ( level === Logger.WARN )
			console.warn(...message);

		else if ( level === Logger.ERROR )
			console.error(...message);

		else
			console.log(...message);
	}
}

Logger.VERBOSE = 0;
Logger.DEBUG = 1;
Logger.INFO = 2;
Logger.WARN = 4;
Logger.WARNING = 4;
Logger.ERROR = 8;
Logger.OFF = 99;

Logger.DEFAULT_LEVEL = Logger.INFO;

export default Logger;