/* eslint strict: off */
'use strict';
(() => {
	// Don't run on certain sub-domains.
	if ( /^(?:localhost\.rig|blog|player|im|chatdepot|tmi|api|)\./.test(location.hostname) )
		return;

	const DEBUG = localStorage.ffzDebugMode == 'true' && document.body.classList.contains('ffz-dev') && ! window.Ember,
		SERVER = DEBUG ? '//localhost:8000' : '//cdn.frankerfacez.com',
		BABEL = /Edge/.test(window.navigator.userAgent) ? 'babel/' : '',
		CLIPS = /clips\.twitch\.tv/.test(location.hostname) ? 'clips/' : '',
		FLAVOR = window.Ember ? 'umbral' : 'avalon',

		script = document.createElement('script');

	script.id = 'ffz-script';
	script.async = true;
	script.crossOrigin = 'anonymous';
	script.src = `${SERVER}/script/${CLIPS}${BABEL}${FLAVOR}.js?_=${Date.now()}`;
	document.head.appendChild(script);
})();