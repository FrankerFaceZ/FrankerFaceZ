'use strict';

// ============================================================================
// Development Log Forwarder
//
// When the client was built for a localhost host (FFZ_CLIENT_HOST), forward
// FrankerFaceZ warnings and errors, plus uncaught page errors, to that host's
// /log endpoint so they can be read from the serving machine. The default
// build has the CDN as its host, so this is inert there.
// ============================================================================

const LOCAL_HOST = /^https?:\/\/localhost(?::\d+)?$/.test(String(__client_host__))
	? String(__client_host__)
	: null;

const MAX_LENGTH = 4000;

type Entry = {
	time: number;
	level: string;
	category: string | null;
	message: string;
};

let queue: Entry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

/** Whether forwarding is active for this build. */
export const DEV_LOG_ENABLED = LOCAL_HOST != null;

function describe(value: any): string {
	if ( value instanceof Error )
		return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;

	if ( typeof value === 'string' )
		return value;

	if ( value === undefined )
		return 'undefined';

	try {
		const seen = new WeakSet();
		return JSON.stringify(value, (key, val) => {
			if ( val instanceof Error )
				return describe(val);
			if ( val && typeof val === 'object' ) {
				if ( seen.has(val) )
					return '[circular]';
				seen.add(val);
			}
			return val;
		});
	} catch(err) {
		return String(value);
	}
}

function flush() {
	timer = null;
	if ( ! LOCAL_HOST || ! queue.length )
		return;

	const batch = queue;
	queue = [];

	// text/plain avoids a CORS preflight; the server parses it as JSON.
	fetch(`${LOCAL_HOST}/log`, {
		method: 'POST',
		mode: 'cors',
		keepalive: true,
		headers: {'Content-Type': 'text/plain'},
		body: JSON.stringify(batch)
	}).catch(() => {
		// The server is not running. Drop the batch quietly.
	});
}

/**
 * Queue a log entry for forwarding. `args` are the values handed to the
 * logger; Error objects keep their stacks.
 */
export function forwardLog(level: string, category: string | null, args: any[]) {
	if ( ! LOCAL_HOST )
		return;

	// Strip the console styling directives the logger prepends.
	const parts = args
		.filter(arg => ! (typeof arg === 'string' && /^(?:color:|font-weight:)/.test(arg)))
		.map(describe);

	let message = parts.join(' ').replace(/%c/g, '').trim();
	if ( message.length > MAX_LENGTH )
		message = `${message.slice(0, MAX_LENGTH)}…`;

	queue.push({time: Date.now(), level, category, message});
	if ( ! timer )
		timer = setTimeout(flush, 300);
}

/** Forward uncaught errors and unhandled promise rejections from the page. */
export function installDevLogForwarder() {
	if ( ! LOCAL_HOST || installed )
		return;

	installed = true;

	window.addEventListener('error', event => {
		forwardLog('uncaught', 'window', [event.error ?? event.message, event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '']);
	});

	window.addEventListener('unhandledrejection', event => {
		forwardLog('unhandled-rejection', 'window', [event.reason]);
	});

	forwardLog('info', 'dev-log', [`Forwarding warnings and errors to ${LOCAL_HOST}/log`]);
}
