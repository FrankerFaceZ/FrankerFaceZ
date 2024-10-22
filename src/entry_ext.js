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

	// Set up the extension message bridge.
	window.addEventListener('message', evt => {
		if (evt.source !== window)
			return;

		if (evt.data && evt.data.type === 'ffz_to_ext')
			browser.runtime.sendMessage(evt.data.data, resp => {
				if (resp?.type === 'ffz_to_page')
					window.postMessage(resp.data, '*');
			});
	});

	browser.runtime.onMessage.addListener((msg, sender) => {
		if (msg?.type === 'ffz_to_page')
			window.postMessage(msg.data, '*');

		return false;
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
