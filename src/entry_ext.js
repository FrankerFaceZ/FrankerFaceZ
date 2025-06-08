/* eslint strict: off */
'use strict';
(() => {
	const browser = globalThis.browser ?? globalThis.chrome;

	if (
		// Don't run on certain sub-domains.
		/^(?:localhost\.rig|blog|im|chatdepot|tmi|api|brand|dev|gql|passport)\./.test(location.hostname)
		||
		// Don't run on pages that have disabled FFZ.
		/disable_frankerfacez/.test(location.search)
		||
		// Don't run on pages we've already run on.
		document.body.dataset.ffzSource
	) {
		// Tell the service worker we aren't injecting.
		browser.runtime.sendMessage({
			type: 'ffz_not_supported'
		});
		return;
	}

	document.body.dataset.ffzSource = 'extension';

	// Make sure to wake the service worker up early.
	browser.runtime.sendMessage({
		type: 'ffz_injecting'
	});

	// Set up a bridge for connections, since Firefox
	// doesn't support externally_connectable.
	const connections = new Map;

	function handleConnect(id) {
		if ( connections.has(id) )
			return;

		const port = browser.runtime.connect();
		connections.set(id, port);

		port.onMessage.addListener(msg => {
			window.postMessage({
				type: 'ffz-con-message',
				id,
				payload: msg
			})
		});

		port.onDisconnect.addListener(() => {
			connections.delete(id);
			window.postMessage({
				type: 'ffz-con-disconnect',
				id
			});
		});
	}

	function handleDisconnect(id) {
		const port = connections.get(id);
		if ( port ) {
			connections.delete(id);
			port.disconnect();
		}
	}

	function handleMessage(id, payload) {
		const port = connections.get(id);
		if ( port ) {
			port.postMessage(payload);
		}
	}

	window.addEventListener('message', evt => {
		if (evt.source !== window || ! evt.data )
			return;

		const { type, id, payload } = evt.data;

		if ( type === 'ffz-con-connect' )
			handleConnect(id);

		else if ( type === 'ffz-con-message' )
			handleMessage(id, payload);

		else if ( type === 'ffz-con-disconnect' )
			handleDisconnect(id);
	});


	// Let the extension send messages to the page directly.
	browser.runtime.onMessage.addListener(msg => {
		if (msg?.type === 'ffz_to_page')
			window.postMessage(msg.data, '*');

		return false;
	});

	// Now, inject our script into the page context.
	const HOST = location.hostname,
		SERVER = browser.runtime.getURL('web'),
		script = document.createElement('script');

	let FLAVOR =
			HOST.includes('player') ? 'player' :
				HOST.includes('clips') ? 'clips' :
					(location.pathname === '/p/ffz_bridge/' ? 'bridge' : 'avalon');

	if (FLAVOR === 'clips' && location.pathname === '/embed')
		FLAVOR = 'player';

	script.id = 'ffz-script';
	script.async = true;
	script.crossOrigin = 'anonymous';
	script.src = `${SERVER}/${FLAVOR}.js?_=${Date.now()}`;
	script.dataset.path = SERVER;

	document.head.appendChild(script);
})();
