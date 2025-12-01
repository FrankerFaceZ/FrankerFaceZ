/* eslint strict: off */
'use strict';
(() => {
	const browser = globalThis.browser ?? globalThis.chrome;
	const is_firefox = (typeof browser === 'object' && browser.runtime.getURL('').startsWith('moz'));

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
	document.body.dataset.ffzExtension = browser.runtime.id;

	// Make sure to wake the service worker up early.
	browser.runtime.sendMessage({
		type: 'ffz_injecting'
	});

	// Set up a bridge for connections, since Firefox
	// doesn't support externally_connectable.
	if (is_firefox) {
		let port;
		const initialize = () => {
			port = browser.runtime.connect({ name: 'ffz-cs-bridge' });
			port.onMessage.addListener(msg => {
				window.postMessage({
					ffz_from_worker: true,
					...msg
				}, window.location.origin);
			});
			port.onDisconnect.addListener(() => {
				// Try to re-establish the connection.
				console.log('FFZ-CS-Bridge: Disconnected, attempting to reconnect.');
				setTimeout(initialize, 0);
			});
		};

		initialize();

		window.addEventListener('message', evt => {
			if (evt.source !== window || ! evt.data?.ffz_to_worker )
				return;

			try {
				port.postMessage(evt.data);
			} catch(ignore) {
				initialize();
				try {
					port.postMessage(evt.data);
				} catch(err) {
					console.log('FFZ-CS-Bridge: Error sending message to extension.', err);
				}
			}
		});
	}

	// Let the extension send messages to the page directly.
	browser.runtime.onMessage.addListener(msg => {
		if (msg?.ffz_from_worker)
			window.postMessage(msg, window.location.origin);

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
