'use strict';

export default class Logger {
	constructor(parent, name, level) {
		this.parent = parent;
		this.name = name;

		this.enabled = true;
		this.level = level || (parent && parent.level) || Logger.DEFAULT_LEVEL;

		this.children = {};
	}

	get(name, level) {
		if ( ! this.children[name] )
			this.children[name] = new Logger(this, (this.name ? `${this.name}.${name}` : name), level);

		return this.children[name];
	}

	debug(...args) {
		return this.invoke(Logger.DEBUG, args);
	}

	info(...args) {
		return this.invoke(Logger.INFO, args);
	}

	warn(...args) {
		return this.invoke(Logger.WARN, args);
	}

	error(...args) {
		return this.invoke(Logger.ERROR, args);
	}

	/* eslint no-console: "off" */
	invoke(level, args) {
		if ( ! this.enabled || level < this.level )
			return;

		const message = Array.prototype.slice.call(args);

		if ( this.name )
			message.unshift(`%cFFZ [%c${this.name}%c]:%c`, 'color:#755000; font-weight:bold', '', 'color:#755000; font-weight:bold', '');
		else
			message.unshift('%cFFZ:%c', 'color:#755000; font-weight:bold', '');

		if ( level === Logger.DEBUG )
			console.info(...message);

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


Logger.DEFAULT_LEVEL = 2;

Logger.DEBUG = 1;
Logger.INFO = 2;
Logger.WARN = 4;
Logger.ERROR = 8;
Logger.OFF = 99;