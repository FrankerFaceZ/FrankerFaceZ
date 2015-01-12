var FFZ = window.FrankerFaceZ;


// --------------------
// Debug Command
// --------------------

FFZ.chat_commands.debug = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		enabled = !(localStorage.ffzDebugMode == "true");

	localStorage.ffzDebugMode = enabled;
	return "Debug Mode is now " + (enabled ? "enabled" : "disabled") + ". Please refresh your browser.";
}

FFZ.chat_commands.debug.help = "Usage: /ffz debug [on|off]\nEnable or disable Debug Mode. When Debug Mode is enabled, the script will be reloaded from //localhost:8000/script.js instead of from the CDN.";