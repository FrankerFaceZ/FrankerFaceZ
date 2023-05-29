/* eslint strict: off */
'use strict';
(() => {
	// Don't run on certain sub-domains.
	if ( /^(?:localhost\.rig|blog|im|chatdepot|tmi|api|brand|dev|gql|passport)\./.test(location.hostname) )
		return;

	const HOST = location.hostname,
		SERVER = __EXTENSION_PATH__,
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
	document.body.classList.add('ffz-ext');
	document.head.appendChild(script);
})();
