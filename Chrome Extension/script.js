// ==UserScript==
// @name FrankerFaceZ
// @namespace FrankerFaceZ
// @include *.twitch.tv/*
// @exclude api.twitch.tv/*
// @grant none
// @icon http://cdn.frankerfacez.com/icon32.png
// @version 1.56
// ==/UserScript==

function ffz_init()
{
	var script = document.createElement('script');
	script.type = 'text/javascript';

	var debug = localStorage.ffzDebugMode == "true";

	if ( debug )
		script.src = "//localhost:8000/script/script.js";
	else
		script.src = "//cdn.frankerfacez.com/script/script.min.js";

	var head = document.getElementsByTagName('head')[0];
	if(head) head.appendChild(script);
}

ffz_init();