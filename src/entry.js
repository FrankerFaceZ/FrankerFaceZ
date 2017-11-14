/* eslint strict: off */
'use strict';
(() => {
	// Don't run on certain sub-domains.
	if ( /^(?:player|im|chatdepot|tmi|api|)\./.test(location.hostname) )
		return;

	const DEBUG = localStorage.ffzDebugMode == 'true' && document.body.classList.contains('ffz-dev') && ! window.Ember,
		SERVER = DEBUG ? '//localhost:8000' : '//cdn.frankerfacez.com',
		FLAVOR = window.Ember ? 'umbral' : 'avalon',

		script = document.createElement('script');

	script.id = 'ffz-script';
	script.src = `${SERVER}/script/${FLAVOR}.js?_=${Date.now()}`;
	document.head.appendChild(script);
})();