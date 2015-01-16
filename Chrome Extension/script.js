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

	if ( localStorage.ffzDebugMode == "true" ) {
		// Developer Mode is enabled. But is the server running? Check before
		// we include the script, otherwise someone could break their
		// experience and not be able to recover.
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "http://localhost:8000/dev_server", true);
		xhr.onload = function(e) {
			var resp = JSON.parse(xhr.responseText);
			console.log("FFZ: Development Server is present. Version " + resp.version + " running from: " + resp.path);
			script.src = "//localhost:8000/script/script.js";
			document.body.classList.add("ffz-dev");
			document.head.appendChild(script);
		};
		xhr.onerror = function(e) {
			console.log("FFZ: Development Server is not present. Using CDN.");
			script.src = "//cdn.frankerfacez.com/script/script.min.js";
			document.head.appendChild(script);
		};
		return xhr.send(null);
	}

	script.src = "//cdn.frankerfacez.com/script/script.min.js";
	document.head.appendChild(script);
}

ffz_init();