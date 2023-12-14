import type { ClientVersion } from "./types";

const RAVEN_LEVELS: Record<number, string> = {
	1: 'debug',
	2: 'info',
	4: 'warn',
	8: 'error'
};


export enum LogLevel {
	Verbose = 0,
	Debug = 1,
	Info = 2,
	Warning = 4,
	Error = 8,
	Off = 99
}

function readLSLevel(): number | null {
	const level = localStorage.ffzLogLevel;
	if ( ! level )
		return null;

	const upper = level.toUpperCase(),
		value = (Logger as any)[upper];

	if ( typeof value === 'number' )
		return value;

	if ( /^\d+$/.test(level) )
		return parseInt(level, 10);

	return null;
}


interface Core {

	host: string;
	flavor: string;

};


type InitItem = {
	time: number;
	category: string | null;
	message: string;
	level: string | number;
}


export class Logger {
	public static readonly Levels = LogLevel;
	public static readonly VERBOSE = LogLevel.Verbose;
	public static readonly DEBUG = LogLevel.Debug;
	public static readonly INFO = LogLevel.Info;
	public static readonly WARN = LogLevel.Warning;
	public static readonly WARNING = LogLevel.Warning;
	public static readonly ERROR = LogLevel.Error;
	public static readonly OFF = LogLevel.Off;

	public static readonly DEFAULT_LEVEL = LogLevel.Info;

	name: string | null;
	enabled: boolean;
	level: LogLevel;

	label?: string;

	init?: boolean;
	captured_init?: InitItem[];

	root: Logger;
	parent: Logger | null;
	children: Record<string, Logger>;

	raven: any;

	constructor(parent: Logger | null, name: string | null, level?: LogLevel | null, raven?: any) {
		this.root = parent ? parent.root : this;
		this.parent = parent;
		this.name = name;

		if ( this.root == this ) {
			this.init = false;
			this.captured_init = [];
			this.label = 'FFZ';
		}

		this.enabled = true;
		this.level = level ?? (parent && parent.level) ?? readLSLevel() ?? Logger.DEFAULT_LEVEL;
		this.raven = raven || (parent && parent.raven);

		this.children = {};
	}

	/** @internal */
	hi(core: Core, version?: ClientVersion) {
		const VER = version ?? (core.constructor as any)?.version_info;
		this.info(`FrankerFaceZ v${VER} (s:${core.host} f:${core.flavor} b:${VER?.build} c:${VER?.commit || 'null'})`);

		try {
			const loc = new URL(location.toString());
			loc.search = '';
			this.info(`Initial URL: ${loc}`);
		} catch(err) {
			this.warn(`Unable to read location.`, err);
		}
	}

	get(name: string, level?: LogLevel) {
		if ( ! this.children[name] )
			this.children[name] = new Logger(this, (this.name ? `${this.name}.${name}` : name), level);

		return this.children[name];
	}

	verbose(message: any, ...optionalParams: any[]) {
		return this.invoke(LogLevel.Verbose, message, optionalParams);
	}

	verboseColor(message: any, colors: string[], ...optionalParams: any[]) {
		return this.invokeColor(Logger.VERBOSE, message, colors, optionalParams);
	}

	debug(message: any, ...optionalParams: any[]) {
		return this.invoke(Logger.DEBUG, message, optionalParams);
	}

	debugColor(message: any, colors: string[], ...optionalParams: any[]) {
		return this.invokeColor(Logger.DEBUG, message, colors, optionalParams);
	}

	info(message: any, ...optionalParams: any[]) {
		return this.invoke(Logger.INFO, message, optionalParams);
	}

	infoColor(message: any, colors: string[], ...optionalParams: any[]) {
		return this.invokeColor(Logger.INFO, message, colors, optionalParams);
	}

	warn(message: any, ...optionalParams: any[]) {
		return this.invoke(Logger.WARN, message, optionalParams);
	}

	warnColor(message: any, colors: string[], ...optionalParams: any[]) {
		return this.invokeColor(Logger.WARN, message, colors, optionalParams);
	}

	warning(message: any, ...optionalParams: any[]) {
		return this.invoke(Logger.WARN, message, optionalParams);
	}

	warningColor(message: any, colors: string[], ...optionalParams: any[]) {
		return this.invokeColor(Logger.WARN, message, colors, optionalParams);
	}

	error(message: any, ...optionalParams: any[]) {
		return this.invoke(Logger.ERROR, message, optionalParams);
	}

	errorColor(message: any, colors: string[], ...optionalParams: any[]) {
		return this.invokeColor(Logger.ERROR, message, colors, optionalParams);
	}

	crumb(...args: any[]) {
		if ( this.raven )
			return this.raven.captureBreadcrumb(...args);
	}

	capture(exc: Error, opts?: any, ...args: any[]) {
		if ( this.raven ) {
			opts = opts || {};
			if ( ! opts.logger )
				opts.logger = this.name;

			this.raven.captureException(exc, opts);
		}

		if ( args.length ) {
			const msg = args.shift();
			return this.error(msg, ...args);
		}
	}

	invokeColor(level: number, message: any, colors: string | string[], ...optionalParams: any[]) {
		if ( ! this.enabled || level < this.level )
			return;

		if ( ! Array.isArray(colors) )
			colors = [colors];

		//const message = args ? Array.prototype.slice.call(args) : [];

		if ( level > LogLevel.Verbose ) {
			let out = message;
			if ( typeof out === 'string' )
				out = out.replace(/%c/g, '');

			if ( optionalParams.length )
				out = `${out} ${optionalParams.join(' ')}`;

			if ( this.root.init && this.root.captured_init )
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

		const default_style = level < LogLevel.Info
			? 'color:#999999'
			: '';

		if ( this.name ) {
			if ( typeof message === 'string' )
				message = `%c${this.root.label} [%c${this.name}%c]:%c ${message}`;
			else {
				optionalParams.unshift(message);
				message = `%c${this.root.label} [%c${this.name}%c]:%c`;
			}

			colors.unshift('color:#755000; font-weight:bold', default_style, 'color:#755000; font-weight:bold', default_style);

		} else {
			if ( typeof message === 'string' )
				message = `%c${this.root.label}:%c ${message}`;
			else {
				optionalParams.unshift(message);
				message = `%c${this.root.label}:%c`;
			}

			colors.unshift('color:#755000; font-weight:bold', default_style);
		}

		if ( level < LogLevel.Info )
			console.debug(message, ...colors, ...optionalParams);

		else if ( level < LogLevel.Warning )
			console.info(message, ...colors, ...optionalParams);

		else if ( level < LogLevel.Error )
			console.warn(message, ...colors, ...optionalParams);

		else if ( level < LogLevel.Off )
			console.error(message, ...colors, ...optionalParams);
	}

	/* eslint no-console: "off" */
	invoke(level: number, message: string, optionalParams?: any[]) {
		if ( ! this.enabled || level < this.level || level >= LogLevel.Off )
			return;

		const result = optionalParams ? [
			message,
			...optionalParams
		] : [message];

		if ( level > LogLevel.Verbose ) {
			const out = result.join(' ');

			if ( this.root.init && this.root.captured_init )
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

		// Chrome removed any sort of special styling from debug
		// logging, so let's add our own to make them visually distinct.
		const default_style = level < LogLevel.Info
			? 'color:#999999'
			: '';

		// If we're adding our own style, we need to grab as many of
		// the strings as we can.
		let strings = '';
		if ( default_style !== '' ) {
			while(result.length > 0 && typeof result[0] === 'string') {
				strings += ' ' + result.shift();
			}
		}

		if ( this.name ) {
			result.unshift(`%c${this.root.label} [%c${this.name}%c]:%c${strings}`, 'color:#755000; font-weight:bold', default_style, 'color:#755000; font-weight:bold', default_style);
		} else
			result.unshift(`%c${this.root.label}:%c${strings}`, 'color:#755000; font-weight:bold', default_style);

		if ( level < LogLevel.Info )
			console.debug(...result);

		else if ( level < LogLevel.Warning )
			console.info(...result);

		else if ( level < LogLevel.Error )
			console.warn(...result);

		else if ( level < LogLevel.Off )
			console.error(...result);
	}
}

export default Logger;
