var FFZ = window.FrankerFaceZ;


// -----------------------
// Developer Mode
// -----------------------

FFZ.settings_info.developer_mode = {
	type: "boolean",
	value: false,
	storage_key: "ffzDebugMode",

	visible: function() { return this.settings.developer_mode || (Date.now() - parseInt(localStorage.ffzLastDevMode || "0")) < 604800000; },
	category: "Debugging",
	name: "Developer Mode",
	help: "Load FrankerFaceZ from the local development server instead of the CDN. Please refresh after changing this setting.",

	on_update: function() {
		localStorage.ffzLastDevMode = Date.now();
		}
	};


FFZ.ffz_commands.developer_mode = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		return "Developer Mode is currently " + (this.settings.developer_mode ? "enabled." : "disabled.");

	this.settings.set("developer_mode", enabled);
	return "Developer Mode is now " + (enabled ? "enabled" : "disabled") + ". Please refresh your browser.";
}

FFZ.ffz_commands.developer_mode.help = "Usage: /ffz developer_mode <on|off>\nEnable or disable Developer Mode. When Developer Mode is enabled, the script will be reloaded from //localhost:8000/script.js instead of from the CDN.";
