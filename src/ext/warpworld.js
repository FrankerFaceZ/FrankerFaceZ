var FFZ = window.FrankerFaceZ;

// --------------------
// Initialization
// --------------------

FFZ.settings_info.warp_world = {
	type: "boolean",
	value: true,

	category: "Channel Metadata",
	name: "Warp World <small>(Requires Refresh)</small>",

	help: 'Automatically load <a href="https://warp.world" target="_blank">Warp World</a> when viewing a channel that uses Warp World.'
}

FFZ.ws_commands.warp_world = function(data) {
	if ( ! data || ! this.settings.warp_world )
		return;

	// Make sure that Warp World isn't already loaded or loading.
	var ww_script = document.querySelector('script#ww_script');
	if ( ww_script || window.WarpWorld )
		return;

	ww_script = document.createElement('script');
	ww_script.id = 'ww_script';
	ww_script.src = '//cdn.warp.world/twitch_script/main.min.js?_=' + Date.now();
	document.head.appendChild(ww_script);
}