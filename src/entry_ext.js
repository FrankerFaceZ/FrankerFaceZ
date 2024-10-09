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
	) {
		// Tell the service worker we aren't injecting.
		browser.runtime.sendMessage({
			type: 'ffz_not_supported'
		});
		return;
	}

	// Make sure to wake the service worker up early.
	browser.runtime.sendMessage({
		type: 'ffz_injecting'
	});

	// Set up the extension message bridge.
	window.addEventListener('message', evt => {
		if (evt.source !== window)
			return;

		if (evt.data && evt.data.type === 'ffz_to_ext')
			browser.runtime.sendMessage(evt.data.data, resp => {
				if (resp)
					window.postMessage({
						type: 'ffz_from_ext',
						data: resp
					}, '*');
			});
	});

	browser.runtime.onMessage.addListener((msg, sender) => {
		window.postMessage({
			type: 'ffz_from_ext',
			data: msg
		}, '*');
		return true;
	});

	// Now, inject our script into the page context.
	const HOST = location.hostname,
		SERVER = browser.runtime.getURL("web"),
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
