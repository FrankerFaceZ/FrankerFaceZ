var FFZ = window.FrankerFaceZ;


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_notifications = function() {
	this.log("Adding event handler for window focus.");
	window.addEventListener("focus", this.clear_notifications.bind(this));

	// Firefox update warning.
	if ( navigator.userAgent.toLowerCase().indexOf('firefox/') !== -1 ) {
		if ( localStorage.hasOwnProperty('ffz_mozilla_sign_warning') )
			return;

		localStorage.ffz_mozilla_sign_warning = true;
		var f = this;
		setTimeout(function() {
			f.show_message('Firefox users please re-download the add-on from <a href="https://www.frankerfacez.com/" target="_new">https://www.frankerfacez.com/</a> to ensure that it continues to function after the upgrade to Firefox 41. You should see version 1.56 in your add-ons listing.');
		}, 1000);
	}
}


// ---------------------
// Settings
// ---------------------

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
			var old_val = this.settings.notification_timeout,
				new_val = prompt("Notification Timeout\n\nPlease enter the time you'd like notifications to be displayed before automatically closing, in seconds.\n\nDefault is: 60", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var parsed = parseInt(new_val);
			if ( parsed === NaN || parsed < 1 )
				parsed = 60;

			this.settings.set("notification_timeout", parsed);
		}
	};


// ---------------------
// Socket Commands
// ---------------------

FFZ.ws_commands.message = function(message) {
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


FFZ.prototype.show_notification = function(message, title, tag, timeout, on_click, on_close) {
	var perm = Notification.permission;
	if ( perm === "denied " )
		return false;

	if ( perm === "granted" ) {
		title = title || "FrankerFaceZ";
		timeout = timeout || (this.settings.notification_timeout*1000);

		var options = {
			lang: "en-US",
			dir: "ltr",
			body: message,
			tag: tag || "FrankerFaceZ",
			icon: "http://cdn.frankerfacez.com/icon32.png"
			};

		var f = this,
			n = new Notification(title, options),
			nid = FFZ._last_notification++;

		FFZ._notifications[nid] = n;

		n.addEventListener("click", function() {
			delete FFZ._notifications[nid];
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
	window.noty({
		text: message,
		theme: "ffzTheme",
		layout: "bottomCenter",
		closeWith: ["button"]
		}).show();
}