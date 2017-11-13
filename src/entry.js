/* eslint strict: off */
'use strict';
(() => {
	if ( location.hostname === 'player.twitch.tv' )
		return;

	const DEBUG = localStorage.ffzDebugMode == 'true' && document.body.classList.contains('ffz-dev'),
		SERVER = DEBUG ? '//localhost:8000' : '//cdn.frankerfacez.com',
		FLAVOR = window.Ember ? 'umbral' : 'avalon',

		script = document.createElement('script');

	script.id = 'ffz-script';
	script.src = `${SERVER}/script/${FLAVOR}.js?_=${Date.now()}`;
	document.head.appendChild(script);
})();