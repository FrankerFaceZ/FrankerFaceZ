var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants");


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_notifications = function() {
	this.log("Adding event handler for window focus.");
	window.addEventListener("focus", this.clear_notifications.bind(this));
}


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.server_messages = {
	type: "boolean",
	value: true,

	category: "Appearance",
	name: "Server Notifications",
	help: "Display global FrankerFaceZ notifications."
	};


FFZ.settings_info.highlight_notifications = {
	type: "boolean",
	value: false,

	category: "Chat Filtering",
	no_bttv: true,
	no_mobile: true,
	//visible: function() { return ! this.has_bttv },

	name: "Highlight Notifications",
	help: "Display notifications when a highlighted word appears in chat in an unfocused tab. This is automatically disabled on the dashboard.",

	on_update: function(val, direct) {
			// Check to see if we have notification permission. If this is
			// enabled, at least.
			if ( ! val || ! direct )
				return;

			if ( Notification.permission === "denied" ) {
				this.log("Notifications have been denied by the user.");
				this.settings.set("highlight_notifications", false);
				return;

			} else if ( Notification.permission === "granted" )
				return;

			var f = this;
			Notification.requestPermission(function(e) {
				if ( e === "denied" ) {
					f.log("Notifications have been denied by the user.");
					f.settings.set("highlight_notifications", false);
				}
			});
		}
	};


FFZ.settings_info.notification_timeout = {
	type: "button",
	value: 60,

	category: "Chat Filtering",
	no_bttv: true,
	no_mobile: true,

	name: "Notification Timeout",
	help: "Specify how long notifications should be displayed before automatically closing.",

	method: function() {
			var f = this,
				old_val = this.settings.notification_timeout;
			utils.prompt(
				"Notification Timeout",
				"Please enter the time you'd like notifications to be displayed before automatically closing, in seconds. A value of zero may prevent notifications from disappearing automatically. This value is subject to the limitations of your web browser.</p><p><b>Default:</b> 60",
				old_val === false ? 0 : old_val,
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					new_val = parseInt(new_val);
					if ( new_val <= 0 )
						new_val = false;
					else if ( Number.isNaN(new_val) || ! Number.isFinite(new_val) )
						new_val = 60;

					f.settings.set("notification_timeout", new_val);
				});
		}
	};


// ---------------------
// Socket Commands
// ---------------------

FFZ.ws_commands.message = function(message) {
	if ( ! this.settings.server_messages )
		return;

	this.show_message(message);
}


// ---------------------
// Notifications
// ---------------------

FFZ._notifications = {};
FFZ._last_notification = 0;

FFZ.prototype.clear_notifications = function() {
	for(var k in FFZ._notifications) {
		var n = FFZ._notifications[k];
		if ( n )
			try {
				n.close();
			} catch(err) { }
	}

	FFZ._notifications = {};
	FFZ._last_notification = 0;
}


FFZ.prototype.show_notification = function(message, title, tag, timeout, on_click, on_close, icon) {
	var perm = Notification.permission;
	if ( perm === "denied" )
		return false;

	if ( perm === "granted" ) {
		title = title || "FrankerFaceZ";
		timeout = timeout || (this.settings.notification_timeout === false ? false : this.settings.notification_timeout * 1000);

		var options = {
			lang: "en-US",
			dir: "ltr",
			body: message,
			tag: tag || "FrankerFaceZ",
			icon: icon || "//cdn.frankerfacez.com/icon32.png"
			};

		var f = this,
			n = new Notification(title, options),
			nid = FFZ._last_notification++;

		FFZ._notifications[nid] = n;

		n.addEventListener("click", function() {
			delete FFZ._notifications[nid];
			n.close();
			if ( on_click )
				on_click.bind(f)();
			});

		n.addEventListener("close", function() {
			delete FFZ._notifications[nid];
			if ( on_close )
				on_close.bind(f)();
			});

		if ( typeof timeout == "number" )
			n.addEventListener("show", function() {
				setTimeout(function() {
					delete FFZ._notifications[nid];
					n.close();
					}, timeout);
				});

		return;
	}

	var f = this;
	Notification.requestPermission(function(e) {
		f.show_notification(message, title, tag);
	});
}



// ---------------------
// Noty Notification
// ---------------------

FFZ.prototype.show_message = function(message) {
	if ( ! window.jQuery || ! window.jQuery.noty || ! jQuery.noty.themes.ffzTheme ) {
		setTimeout(this.show_message.bind(this, message), 50);
		return;
	}

	window.noty({
		text: message,
		template: '<div class="noty_message"><span class="noty_text"></span><div class="noty_close">' + constants.CLOSE + '</div></div>',
		theme: "ffzTheme",
		layout: "bottomCenter",
		closeWith: ["button"]
		}).show();
}