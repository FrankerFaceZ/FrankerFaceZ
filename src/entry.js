/* eslint strict: off */
'use strict';
(() => {
	// Don't run on certain sub-domains.
	if ( /^(?:localhost\.rig|blog|im|chatdepot|tmi|api|brand|dev)\./.test(location.hostname) )
		return;

	const DEBUG = localStorage.ffzDebugMode == 'true' && document.body.classList.contains('ffz-dev'),
		HOST = location.hostname,
		FLAVOR =
			HOST.includes('player') ? 'player' :
				HOST.includes('clips') ? 'clips' :
					(location.pathname === '/p/ffz_bridge/' ? 'bridge' : 'avalon'),
		SERVER = DEBUG ? '//localhost:8000' : '//cdn.frankerfacez.com',
		//CLIPS = /clips\.twitch\.tv/.test(location.hostname) ? 'clips/' : '',

		script = document.createElement('script');

	script.id = 'ffz-script';
	script.async = true;
	script.crossOrigin = 'anonymous';
	script.src = `${SERVER}/script/${FLAVOR}.js?_=${Date.now()}`;
	document.head.appendChild(script);
})();