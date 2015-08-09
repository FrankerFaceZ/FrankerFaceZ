(function(window) {(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.1.20150716
 *
 * By Eli Grey, http://eligrey.com
 * License: X11/MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// See https://code.google.com/p/chromium/issues/detail?id=375297#c7 and
		// https://github.com/eligrey/FileSaver.js/commit/485930a#commitcomment-8768047
		// for the reasoning behind the timeout and revocation flow
		, arbitrary_revoke_timeout = 500 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			if (view.chrome) {
				revoker();
			} else {
				setTimeout(revoker, arbitrary_revoke_timeout);
			}
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob(["\ufeff", blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab == undefined && typeof safari !== "undefined") {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				save_link.href = object_url;
				save_link.download = name;
				setTimeout(function() {
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name, no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name || "download");
		};
	}

	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd != null)) {
  define([], function() {
    return saveAs;
  });
}

},{}],2:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils');


// --------------------
// Settings
// --------------------

FFZ.settings_info.show_badges = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	name: "Additional Badges",
	help: "Show additional badges for bots, FrankerFaceZ donors, and other special users."
	};


FFZ.settings_info.transparent_badges = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,
	
	name: "Transparent Badges",
	help: "Make chat badges transparent for a nice, clean look. On light chat, non-subscriber badges are inverted to remain visible.",
	
	on_update: function(val) {
			if ( ! this.has_bttv )
				document.body.classList.toggle("ffz-transparent-badges", val);
		}
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_badges = function() {
	if ( ! this.has_bttv )
		document.body.classList.toggle("ffz-transparent-badges", this.settings.transparent_badges);
	
	this.log("Preparing badge system.");
	this.badges = {};

	this.log("Creating badge style element.");
	var s = this._badge_style = document.createElement('style');
	s.id = "ffz-badge-css";
	document.head.appendChild(s);

	this.log("Adding legacy donor badges.");
	this._legacy_add_donors();
}


// --------------------
// Reloading Badges
// --------------------

FFZ.ws_commands.reload_badges = function() {
	this._legacy_load_bots();
	this._legacy_load_donors();
}


FFZ.ws_commands.set_badge = function(data) {
	var user_id = data[0],
		slot = data[1],
		badge = data[2],

		user = this.users[user_id] = this.users[user_id] || {},
		badges = user.badges = user.badges || {};

	if ( badge === undefined || badge === null )
		delete badges[slot];
	else
		badges[slot] = badge;
}


// --------------------
// Badge CSS
// --------------------

var badge_css = function(badge) {
	var out = ".badges .ffz-badge-" + badge.id + " { background-color: " + badge.color + '; background-image: url("' + badge.image + '"); ' + (badge.extra_css || "") + '}';
	if ( badge.transparent_image )
		out += ".ffz-transparent-badges .badges .ffz-badge-" + badge.id + ' { background-image: url("' + badge.transparent_image + '"); }';
	return out;
}


// --------------------
// Render Badge
// --------------------

FFZ.prototype.bttv_badges = function(data) {
	if ( ! this.settings.show_badges )
		return;

	var user_id = data.sender,
		user = this.users[user_id],
		badges_out = [],
		insert_at = -1,
		alpha = BetterTTV.settings.get('alphaTags');

	if ( ! user || ! user.badges )
		return;

	if ( ! data.badges )
		data.badges = [];

	// Determine where in the list to insert these badges.
	for(var i=0; i < data.badges.length; i++) {
		var badge = data.badges[i];
		if ( badge.type == "subscriber" || badge.type == "turbo" ) {
			insert_at = i;
			break;
		}
	}

	for (var slot in user.badges) {
		if ( ! user.badges.hasOwnProperty(slot) )
			continue;

		var badge = user.badges[slot],
			full_badge = this.badges[badge.id] || {},
			desc = badge.title || full_badge.title,
			style = "";

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible == "function" )
				visible = visible.bind(this)(null, user_id);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var replaced = false;
			for(var i=0; i < data.badges.length; i++) {
				var b = data.badges[i];
				if ( b.type === full_badge.replaces_type ) {
					b.type = "ffz-badge-replacement " + b.type;
					b.description += ", " + (badge.title || full_badge.title) +
						'" style="background-image: url(&quot;' + (badge.image || full_badge.image) + "&quot;)";
					replaced = true;
					break;
				}
			}

			if ( replaced )
				continue;
		}

		if ( badge.image )
			style += 'background-image: url(&quot;' + badge.image + '&quot;); ';

		if ( badge.color && ! alpha )
			style += 'background-color: ' + badge.color + '; ';

		if ( badge.extra_css )
			style += badge.extra_css;

		if ( style )
			desc += '" style="' + style;

		badges_out.push([(insert_at == -1 ? 1 : -1) * slot, {type: "ffz-badge-" + badge.id + (alpha ? " alpha" : ""), name: "", description: desc}]);
	}

	badges_out.sort(function(a,b){return a[0] - b[0]});

	if ( insert_at == -1 ) {
		while(badges_out.length)
			data.badges.push(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			data.badges.insertAt(insert_at, badges_out.shift()[1]);
	}
}


FFZ.prototype.render_badges = function(component, badges) {
	if ( ! this.settings.show_badges )
		return badges;

	var user = component.get('msgObject.from'),
		room_id = component.get('msgObject.room') || App.__container__.lookup('controller:chat').get('currentRoom.id');

	var data = this.users[user];
	if ( ! data || ! data.badges )
		return badges;

	for(var slot in data.badges) {
		if ( ! data.badges.hasOwnProperty(slot) )
			continue;

		var badge = data.badges[slot],
			full_badge = this.badges[badge.id] || {},
			old_badge = badges[slot];

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible === "function" )
				visible = visible.bind(this)(room_id, user, component, badges);
			
			if ( ! visible )
				continue;
		}

		if ( old_badge ) {
			var replaces = badge.hasOwnProperty('replaces') ? badge.replaces : full_badge.replaces;
			if ( ! replaces )
				continue;
			
			old_badge.image = badge.image || full_badge.image;
			old_badge.klass += ' ffz-badge-replacement';
			old_badge.title += ', ' + (badge.title || full_badge.title);
			continue;
		}

		badges[slot] = {
			klass: 'ffz-badge-' + badge.id,
			title: badge.title || full_badge.title,
			image: badge.image,
			color: badge.color,
			extra_css: badge.extra_css
		};
	}
	
	return badges;
}


FFZ.prototype.render_badge = function(component) {
	if ( ! this.settings.show_badges )
		return;

	var user = component.get('msgObject.from'),
		room_id = App.__container__.lookup('controller:chat').get('currentRoom.id'),
		badges = component.$('.badges');

	var data = this.users[user];
	if ( ! data || ! data.badges )
		return;

	// If we don't have badges, add them.
	if ( ! badges.length ) {
		var b_cont = document.createElement('span'),
			from = component.$('.from');

		b_cont.className = 'badges float-left';

		if ( ! from )
			return;

		from.before(b_cont);
		badges = $(b_cont);
	}

	// Figure out where to place our badge(s).
	var before = badges.find('.badge').filter(function(i) {
		var t = this.title.toLowerCase();
		return t == "subscriber" || t == "turbo";
	}).first();

	var badges_out = [], reverse = !(!before.length);
	for ( var slot in data.badges ) {
		if ( ! data.badges.hasOwnProperty(slot) )
			continue;

		var badge = data.badges[slot],
			full_badge = this.badges[badge.id] || {};

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible == "function" )
				visible = visible.bind(this)(room_id, user);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var el = badges[0].querySelector('.badge.' + full_badge.replaces);
			if ( el ) {
				el.style.backgroundImage = 'url("' + (badge.image || full_badge.image) + '")';
				el.classList.add("ffz-badge-replacement");
				el.title += ", " + (badge.title || full_badge.title);
				continue;
			}
		}

		var el = document.createElement('div');
		el.className = 'badge float-left tooltip ffz-badge-' + badge.id;
		el.setAttribute('title', badge.title || full_badge.title);

		if ( badge.image )
			el.style.backgroundImage = 'url("' + badge.image + '")';

		if ( badge.color )
			el.style.backgroundColor = badge.color;

		if ( badge.extra_css )
			el.style.cssText += badge.extra_css;

		badges_out.push([((reverse ? 1 : -1) * slot), el]);
	}

	badges_out.sort(function(a,b){return a[0] - b[0]});

	if ( reverse ) {
		while(badges_out.length)
			before.before(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			badges.append(badges_out.shift()[1]);
	}
}


// --------------------
// Legacy Support
// --------------------

FFZ.bttv_known_bots = ["nightbot","moobot","sourbot","xanbot","manabot","mtgbot","ackbot","baconrobot","tardisbot","deejbot","valuebot","stahpbot"];


FFZ.prototype._legacy_add_donors = function() {
	// Developer Badge
	this.badges[0] = {id: 0, title: "FFZ Developer", color: "#FAAF19", image: "//cdn.frankerfacez.com/script/devicon.png", transparent_image: "//cdn.frankerfacez.com/script/devtransicon.png"};
	utils.update_css(this._badge_style, 0, badge_css(this.badges[0]));

	// Donor Badge
	this.badges[1] = {id: 1, title: "FFZ Donor", color: "#755000", image: "//cdn.frankerfacez.com/script/devicon.png"};
	utils.update_css(this._badge_style, 1, badge_css(this.badges[1]));

	// Bot Badge
	this.badges[2] = {id: 2, title: "Bot", color: "#595959", image: "//cdn.frankerfacez.com/script/boticon.png",
		replaces: true, replaces_type: "moderator",
		visible: function(r,user) { return !(this.has_bttv && FFZ.bttv_known_bots.indexOf(user)!==-1); }};

	utils.update_css(this._badge_style, 2, badge_css(this.badges[2]));

	// Load BTTV Bots
	for(var i=0; i < FFZ.bttv_known_bots.length; i++) {
		var name = FFZ.bttv_known_bots[i],
			user = this.users[name] = this.users[name] || {},
			badges = user.badges = user.badges || {};

		if ( ! badges[0] )
			badges[0] = {id:2};
	}

	// Special Badges
	this.users.sirstendec = {badges: {1: {id:0}}, sets: [4330]};
	this.users.zenwan = {badges: {0: {id:2, image: "//cdn.frankerfacez.com/script/momiglee_badge.png", title: "WAN"}}};

	this._legacy_load_bots();
	this._legacy_load_donors();
}

FFZ.prototype._legacy_load_bots = function(tries) {
	jQuery.ajax(constants.SERVER + "script/bots.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_badges(data, 0, 2, "Bot (By: {})");

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				this._legacy_load_bots(tries);
		});
}

FFZ.prototype._legacy_load_donors = function(tries) {
	jQuery.ajax(constants.SERVER + "script/donors.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_badges(data, 1, 1);

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return this._legacy_load_donors(tries);
		});
}


FFZ.prototype._legacy_parse_badges = function(data, slot, badge_id, title_template) {
	var title = this.badges[badge_id].title,
		count = 0;
		ds = null;

	title_template = title_template || '{}';

	if ( data != null ) {
		var lines = data.trim().split(/\W+/);
		for(var i=0; i < lines.length; i++) {
			var line_data = lines[i].split(";"),
				user_id = line_data[0],
				user = this.users[user_id] = this.users[user_id] || {},
				badges = user.badges = user.badges || {},
				sets = user.sets = user.sets || [];

			if ( ds !== null && sets.indexOf(ds) === -1 )
				sets.push(ds);

			if ( badges[slot] )
				continue;

			badges[slot] = {id:badge_id};
			if ( line_data.length > 1 )
				badges[slot].title = title_template.replace('{}', line_data[1]);
			count += 1;
		}
	}

	this.log('Added "' + title + '" badge to ' + utils.number_commas(count) + " users.");
}
},{"./constants":5,"./utils":35}],3:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,

	hue2rgb = function(p, q, t) {
		if ( t < 0 ) t += 1;
		if ( t > 1 ) t -= 1;
		if ( t < 1/6 )
			return p + (q-p) * 6 * t;
		if ( t < 1/2 )
			return q;
		if ( t < 2/3 )
			return p + (q-p) * (2/3 - t) * 6;
		return p;
	};


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.fix_color = {
	type: "select",
	options: {
		'-1': "Disabled",
		0: "Default Colors",
		1: "Luv Adjustment",
		2: "HSL Adjustment (Depreciated)",
		3: "HSV Adjustment (Depreciated)",
		4: "RGB Adjustment (Depreciated)"
	},
	value: '1',

	category: "Chat Appearance",
	no_bttv: true,

	name: "Username Colors - Brightness",
	help: "Ensure that username colors contrast with the background enough to be readable.",

	process_value: function(val) {
		// Load legacy setting.
		if ( val === false )
			return '0';
		else if ( val === true )
			return '1';
		return val;
	},

	on_update: function(val) {
			document.body.classList.toggle("ffz-chat-colors-gray", !this.has_bttv && (val === '-1'));

			if ( ! this.has_bttv && val !== '-1' )
				this._rebuild_colors();
		}
	};


FFZ.settings_info.luv_contrast = {
	type: "button",
	value: 4.5,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Username Colors - Luv Minimum Contrast",
	help: "Set the minimum contrast ratio used by Luv Adjustment to ensure colors are readable.",

	method: function() {
			var old_val = this.settings.luv_contrast,
				new_val = prompt("Luv Adjustment Minimum Contrast Ratio\n\nPlease enter a new value for the minimum contrast ratio required between username colors and the background. The default is: 4.5", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var parsed = parseFloat(new_val);
			if ( parsed === NaN || parsed < 1 )
				parsed = 4.5;

			this.settings.set("luv_contrast", parsed);
		},

	on_update: function(val) {
			this._rebuild_contrast();

			if ( ! this.has_bttv && this.settings.fix_color == '1' )
			this._rebuild_colors();
		}
	};


FFZ.settings_info.color_blind = {
	type: "select",
	options: {
		0: "Disabled",
		protanope: "Protanope",
		deuteranope: "Deuteranope",
		tritanope: "Tritanope"
	},
	value: '0',

	category: "Chat Appearance",
	no_bttv: true,

	name: "Username Colors - Color Blindness",
	help: "Adjust username colors in an attempt to make them more distinct for people with color blindness.",

	on_update: function(val) {
			if ( ! this.has_bttv && this.settings.fix_color !== '-1' )
			this._rebuild_colors();
		}
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_colors = function() {
	this._colors = {};
	this._rebuild_contrast();

	this._update_colors();

	// Events for rebuilding colors.
	var Layout = window.App && App.__container__.lookup('controller:layout'),
		Settings = window.App && App.__container__.lookup('controller:settings');

	if ( Layout )
		Layout.addObserver("isTheatreMode", this._update_colors.bind(this, true));

	if ( Settings )
		Settings.addObserver("model.darkMode", this._update_colors.bind(this, true))

	this._color_old_darkness = (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('model.darkMode'));
}


// -----------------------
// Color Handling Classes
// -----------------------

FFZ.Color = {};

FFZ.Color.CVDMatrix = {
	protanope: [ // reds are greatly reduced (1% men)
		0.0, 2.02344, -2.52581,
		0.0, 1.0,      0.0,
		0.0, 0.0,      1.0
	],
	deuteranope: [ // greens are greatly reduced (1% men)
		1.0,      0.0, 0.0,
		0.494207, 0.0, 1.24827,
		0.0,      0.0, 1.0
	],
	tritanope: [ // blues are greatly reduced (0.003% population)
		1.0,       0.0,      0.0,
		0.0,       1.0,      0.0,
		-0.395913, 0.801109, 0.0
	]
}


var RGBColor = FFZ.Color.RGB = function(r, g, b) {
	this.r = r||0; this.g = g||0; this.b = b||0;
};

var HSVColor = FFZ.Color.HSV = function(h, s, v) {
	this.h = h||0; this.s = s||0; this.v = v||0;
};

var HSLColor = FFZ.Color.HSL = function(h, s, l) {
	this.h = h||0; this.s = s||0; this.l = l||0;
};

var XYZColor = FFZ.Color.XYZ = function(x, y, z) {
	this.x = x||0; this.y = y||0; this.z = z||0;
};

var LUVColor = FFZ.Color.LUV = function(l, u, v) {
	this.l = l||0; this.u = u||0; this.v = v||0;
};


// RGB Colors

RGBColor.prototype.eq = function(rgb) {
	return rgb.r === this.r && rgb.g === this.g && rgb.b === this.b;
}

RGBColor.fromHex = function(code) {
	var raw = parseInt(code.charAt(0) === '#' ? code.substr(1) : code, 16);
	return new RGBColor(
		(raw >> 16),		 // Red
		(raw >> 8 & 0x00FF), // Green
		(raw & 0x0000FF)	 // Blue
		)
}

RGBColor.fromHSV = function(h, s, v) {
	var r, g, b,

		i = Math.floor(h * 6),
		f = h * 6 - i,
		p = v * (1 - s),
		q = v * (1 - f * s),
		t = v * (1 - (1 - f) * s);

	switch(i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q;
	}

	return new RGBColor(
		Math.round(Math.min(Math.max(0, r*255), 255)),
		Math.round(Math.min(Math.max(0, g*255), 255)),
		Math.round(Math.min(Math.max(0, b*255), 255))
	);
}

RGBColor.fromXYZ = function(x, y, z) {
	var R =  3.240479 * x - 1.537150 * y - 0.498535 * z,
		G = -0.969256 * x + 1.875992 * y + 0.041556 * z,
		B =  0.055648 * x - 0.204043 * y + 1.057311 * z;

	// Make sure we end up in a real color space
	return new RGBColor(
		Math.max(0, Math.min(255, 255 * XYZColor.channelConverter(R))),
		Math.max(0, Math.min(255, 255 * XYZColor.channelConverter(G))),
		Math.max(0, Math.min(255, 255 * XYZColor.channelConverter(B)))
	);
}

RGBColor.fromHSL = function(h, s, l) {
	if ( s === 0 ) {
		var v = Math.round(Math.min(Math.max(0, 255*l), 255));
		return new RGBColor(v, v, v);
	}

	var q = l < 0.5 ? l * (1 + s) : l + s - l * s,
		p = 2 * l - q;

	return new RGBColor(
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h + 1/3)), 255)),
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h)), 255)),
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h - 1/3)), 255))
	);
}

RGBColor.prototype.toHSV = function() { return HSVColor.fromRGB(this.r, this.g, this.b); }
RGBColor.prototype.toHSL = function() { return HSLColor.fromRGB(this.r, this.g, this.b); }
RGBColor.prototype.toCSS = function() { return "rgb(" + Math.round(this.r) + "," + Math.round(this.g) + "," + Math.round(this.b) + ")"; }
RGBColor.prototype.toXYZ = function() { return XYZColor.fromRGB(this.r, this.g, this.b); }
RGBColor.prototype.toLUV = function() { return this.toXYZ().toLUV(); }

RGBColor.prototype.toHex = function() {
	var rgb = this.b | (this.g << 8) | (this.r << 16);
	return '#' + (0x1000000 + rgb).toString(16).slice(1);
}


RGBColor.prototype.luminance = function() {
	var rgb = [this.r / 255, this.g / 255, this.b / 255];
	for (var i =0, l = rgb.length; i < l; i++) {
		if (rgb[i] <= 0.03928) {
			rgb[i] = rgb[i] / 12.92;
		} else {
			rgb[i] = Math.pow( ((rgb[i]+0.055)/1.055), 2.4 );
		}
	}
	return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
}


RGBColor.prototype.brighten = function(amount) {
	amount = typeof amount === "number" ? amount : 1;
	amount = Math.round(255 * (amount / 100));

	return new RGBColor(
		Math.max(0, Math.min(255, this.r + amount)),
		Math.max(0, Math.min(255, this.g + amount)),
		Math.max(0, Math.min(255, this.b + amount))
	);
}


RGBColor.prototype.daltonize = function(type, amount) {
	amount = typeof amount === "number" ? amount : 1.0;
	var cvd;
	if ( typeof type === "string" ) {
		if ( FFZ.Color.CVDMatrix.hasOwnProperty(type) )
			cvd = FFZ.Color.CVDMatrix[type];
		else
			throw "Invalid CVD matrix.";
	} else
		cvd = type;

	var cvd_a = cvd[0], cvd_b = cvd[1], cvd_c = cvd[2],
		cvd_d = cvd[3], cvd_e = cvd[4], cvd_f = cvd[5],
		cvd_g = cvd[6], cvd_h = cvd[7], cvd_i = cvd[8],

		L, M, S, l, m, s, R, G, B, RR, GG, BB;

	// RGB to LMS matrix conversion
	L = (17.8824 * this.r) + (43.5161 * this.g) + (4.11935 * this.b);
	M = (3.45565 * this.r) + (27.1554 * this.g) + (3.86714 * this.b);
	S = (0.0299566 * this.r) + (0.184309 * this.g) + (1.46709 * this.b);
	// Simulate color blindness
	l = (cvd_a * L) + (cvd_b * M) + (cvd_c * S);
	m = (cvd_d * L) + (cvd_e * M) + (cvd_f * S);
	s = (cvd_g * L) + (cvd_h * M) + (cvd_i * S);
	// LMS to RGB matrix conversion
	R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
	G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
	B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);
	// Isolate invisible colors to color vision deficiency (calculate error matrix)
	R = this.r - R;
	G = this.g - G;
	B = this.b - B;
	// Shift colors towards visible spectrum (apply error modifications)
	RR = (0.0 * R) + (0.0 * G) + (0.0 * B);
	GG = (0.7 * R) + (1.0 * G) + (0.0 * B);
	BB = (0.7 * R) + (0.0 * G) + (1.0 * B);
	// Add compensation to original values
	R = Math.min(Math.max(0, RR + this.r), 255);
	G = Math.min(Math.max(0, GG + this.g), 255);
	B = Math.min(Math.max(0, BB + this.b), 255);

	return new RGBColor(R, G, B);
}

RGBColor.prototype._r = function(r) { return new RGBColor(r, this.g, this.b); }
RGBColor.prototype._g = function(g) { return new RGBColor(this.r, g, this.b); }
RGBColor.prototype._b = function(b) { return new RGBColor(this.r, this.g, b); }


// HSL Colors

HSLColor.prototype.eq = function(hsl) {
	return hsl.h === this.h && hsl.s === this.s && hsl.l === this.l;
}

HSLColor.fromRGB = function(r, g, b) {
	r /= 255; g /= 255; b /= 255;

	var max = Math.max(r,g,b),
		min = Math.min(r,g,b),

		h, s, l = Math.min(Math.max(0, (max+min) / 2), 1),
		d = Math.min(Math.max(0, max - min), 1);

	if ( d === 0 )
		h = s = 0;
	else {
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch(max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
		}
		h /= 6;
	}

	return new HSLColor(h, s, l);
}

HSLColor.prototype.toRGB = function() { return RGBColor.fromHSL(this.h, this.s, this.l); }
HSLColor.prototype.toCSS = function() { return "hsl(" + Math.round(this.h*360) + "," + Math.round(this.s*100) + "%," + Math.round(this.l*100) + "%)"; }
HSLColor.prototype.toHex = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toHex(); }
HSLColor.prototype.toHSV = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toHSV(); }
HSLColor.prototype.toXYZ = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toXYZ(); }
HSLColor.prototype.toLUV = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toLUV(); }


HSLColor.prototype._h = function(h) { return new HSLColor(h, this.s, this.l); }
HSLColor.prototype._s = function(s) { return new HSLColor(this.h, s, this.l); }
HSLColor.prototype._l = function(l) { return new HSLColor(this.h, this.s, l); }


// HSV Colors

HSVColor.prototype.eq = function(hsv) { return hsv.h === this.h && hsv.s === this.s && hsv.v === this.v; }

HSVColor.fromRGB = function(r, g, b) {
	r /= 255; g /= 255; b /= 255;

	var max = Math.max(r, g, b),
		min = Math.min(r, g, b),
		d = Math.min(Math.max(0, max - min), 1),

		h,
		s = max === 0 ? 0 : d / max,
		v = max;

	if ( d === 0 )
		h = 0;
	else {
		switch(max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
		}
		h /= 6;
	}

	return new HSVColor(h, s, v);
}


HSVColor.prototype.toRGB = function() { return RGBColor.fromHSV(this.h, this.s, this.v); }
HSVColor.prototype.toHSL = function() { return RGBColor.fromHSV(this.h, this.s, this.v).toHSL(); }
HSVColor.prototype.toXYZ = function() { return RGBColor.fromHSV(this.h, this.s, this.v).toXYZ(); }
HSVColor.prototype.toLUV = function() { return RGBColor.fromHSV(this.h, this.s, this.v).toLUV(); }


HSVColor.prototype._h = function(h) { return new HSVColor(h, this.s, this.v); }
HSVColor.prototype._s = function(s) { return new HSVColor(this.h, s, this.v); }
HSVColor.prototype._v = function(v) { return new HSVColor(this.h, this.s, v); }


// XYZ Colors

RGBColor.channelConverter = function (channel) {
	// http://www.brucelindbloom.com/Eqn_RGB_to_XYZ.html
	// This converts rgb 8bit to rgb linear, lazy because the other algorithm is really really dumb
	return Math.pow(channel, 2.2);

	// CSS Colors Level 4 says 0.03928, Bruce Lindbloom who cared to write all algos says 0.04045, used bruce because whynawt
	return (channel <= 0.04045) ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
};

XYZColor.channelConverter = function (channel) {
	// Using lazy conversion in the other direction as well
	return Math.pow(channel, 1/2.2);

	// I'm honestly not sure about 0.0031308, I've only seen it referenced on Bruce Lindbloom's site
	return (channel <= 0.0031308) ? channel * 12.92 : Math.pow(1.055 * channel, 1/2.4) - 0.055;
};


XYZColor.prototype.eq = function(xyz) {  return xyz.x === this.x && xyz.y === this.y && xyz.z === this.z; }

XYZColor.fromRGB = function(r, g, b) {
	var R = RGBColor.channelConverter(r / 255),
		G = RGBColor.channelConverter(g / 255),
		B = RGBColor.channelConverter(b / 255);

	return new XYZColor(
		0.412453 * R + 0.357580 * G + 0.180423 * B,
		0.212671 * R + 0.715160 * G + 0.072169 * B,
		0.019334 * R + 0.119193 * G + 0.950227 * B
	);
}

XYZColor.fromLUV = function(l, u, v) {
	var deltaGammaFactor = 1 / (XYZColor.WHITE.x + 15 * XYZColor.WHITE.y + 3 * XYZColor.WHITE.z);
	var uDeltaGamma = 4 * XYZColor.WHITE.x * deltaGammaFactor;
	var vDeltagamma = 9 * XYZColor.WHITE.y * deltaGammaFactor;

	// XYZColor.EPSILON * XYZColor.KAPPA = 8
	var Y = (l > 8) ? Math.pow((l + 16) / 116, 3) : l / XYZColor.KAPPA;

	var a = 1/3 * (((52 * l) / (u + 13 * l * uDeltaGamma)) - 1);
	var b = -5 * Y;
	var c = -1/3;
	var d = Y * (((39 * l) / (v + 13 * l * vDeltagamma)) - 5);

	var X = (d - b) / (a - c);
	var Z = X * a + b;

	return new XYZColor(X, Y, Z);
}


XYZColor.prototype.toRGB = function() { return RGBColor.fromXYZ(this.x, this.y, this.z); }
XYZColor.prototype.toLUV = function() { return LUVColor.fromXYZ(this.x, this.y, this.z); }
XYZColor.prototype.toHSL = function() { return RGBColor.fromXYZ(this.x, this.y, this.z).toHSL(); }
XYZColor.prototype.toHSV = function() { return RGBColor.fromXYZ(this.x, this.y, this.z).toHSV(); }


XYZColor.prototype._x = function(x) { return new XYZColor(x, this.y, this.z); }
XYZColor.prototype._y = function(y) { return new XYZColor(this.x, y, this.z); }
XYZColor.prototype._z = function(z) { return new XYZColor(this.x, this.y, z); }


// LUV Colors

XYZColor.EPSILON = Math.pow(6 / 29, 3);
XYZColor.KAPPA = Math.pow(29 / 3, 3);
XYZColor.WHITE = (new RGBColor(255, 255, 255)).toXYZ();


LUVColor.prototype.eq = function(luv) { return luv.l === this.l && luv.u === this.u && luv.v === this.v; }

LUVColor.fromXYZ = function(X, Y, Z) {
	var deltaGammaFactor = 1 / (XYZColor.WHITE.x + 15 * XYZColor.WHITE.y + 3 * XYZColor.WHITE.z);
	var uDeltaGamma = 4 * XYZColor.WHITE.x * deltaGammaFactor;
	var vDeltagamma = 9 * XYZColor.WHITE.y * deltaGammaFactor;

	var yGamma = Y / XYZColor.WHITE.y;
	var deltaDivider = (X + 15 * Y + 3 * Z);

	if (deltaDivider === 0) {
		deltaDivider = 1;
	}

	var deltaFactor = 1 / deltaDivider;

	var uDelta = 4 * X * deltaFactor;
	var vDelta = 9 * Y * deltaFactor;

	var L = (yGamma > XYZColor.EPSILON) ? 116 * Math.pow(yGamma, 1/3) - 16 : XYZColor.KAPPA * yGamma;
	var u = 13 * L * (uDelta - uDeltaGamma);
	var v = 13 * L * (vDelta - vDeltagamma);

	return new LUVColor(L, u, v);
}


LUVColor.prototype.toXYZ = function() { return XYZColor.fromLUV(this.l, this.u, this.v); }
LUVColor.prototype.toRGB = function() { return XYZColor.fromLUV(this.l, this.u, this.v).toRGB(); }
LUVColor.prototype.toHSL = function() { return XYZColor.fromLUV(this.l, this.u, this.v).toHSL(); }
LUVColor.prototype.toHSV = function() { return XYZColor.fromLUV(this.l, this.u, this.v).toHSV(); }


LUVColor.prototype._l = function(l) { return new LUVColor(l, this.u, this.v); }
LUVColor.prototype._u = function(u) { return new LUVColor(this.l, u, this.v); }
LUVColor.prototype._v = function(v) { return new LUVColor(this.l, this.u, v); }


// --------------------
// Rebuild Colors
// --------------------

FFZ.prototype._rebuild_contrast = function() {
	this._luv_required_bright = new XYZColor(0, (this.settings.luv_contrast * (new RGBColor(35,35,35).toXYZ().y + 0.05) - 0.05), 0).toLUV().l;
	this._luv_required_dark = new XYZColor(0, ((new RGBColor(217,217,217).toXYZ().y + 0.05) / this.settings.luv_contrast - 0.05), 0).toLUV().l;
}

FFZ.prototype._rebuild_colors = function() {
	if ( this.has_bttv )
		return;

	// With update colors, we'll automatically process the colors we care about.
	this._colors = {};
	this._update_colors();
}


FFZ.prototype._update_colors = function(darkness_only) {
	// Update the lines. ALL of them.
	var Layout = window.App && App.__container__.lookup('controller:layout'),
		Settings = window.App && App.__container__.lookup('controller:settings'),

		is_dark =  (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('model.darkMode'));

	if ( darkness_only && this._color_old_darkness === is_dark )
		return;

	this._color_old_darkness = is_dark;

	var colored_bits = document.querySelectorAll('.chat-line .has-color');
	for(var i=0, l=colored_bits.length; i < l; i++) {
		var bit = colored_bits[i],
			color = bit.getAttribute('data-color'),
			colors = color && this._handle_color(color);

		if ( ! colors )
			continue;

		bit.style.color = is_dark ? colors[1] : colors[0];
	}
}


FFZ.prototype._handle_color = function(color) {
	if ( ! color || this._colors.hasOwnProperty(color) )
		return this._colors[color];

	var rgb = RGBColor.fromHex(color),

		light_color = color,
		dark_color = color;

	// Color Blindness Handling
	if ( this.settings.color_blind !== '0' ) {
		var new_color = rgb.daltonize(this.settings.color_blind);
		if ( ! rgb.eq(new_color) ) {
			rgb = new_color;
			light_color = dark_color = rgb.toHex();
		}
	}


	// Color Processing - RGB
	if ( this.settings.fix_color === '4' ) {
		var lum = rgb.luminance();

		if ( lum > 0.3 ) {
			var s = 127, nc = rgb;
			while(s--) {
				nc = nc.brighten(-1);
				if ( nc.luminance() <= 0.3 )
					break;
			}

			light_color = nc.toHex();
		}

		if ( lum < 0.15 ) {
			var s = 127, nc = rgb;
			while(s--) {
				nc = nc.brighten();
				if ( nc.luminance() >= 0.15 )
					break;
			}

			dark_color = nc.toHex();
		}
	}


	// Color Processing - HSL
	if ( this.settings.fix_color === '2' ) {
		var hsl = rgb.toHSL();

		light_color = hsl._l(Math.min(Math.max(0, 0.7 * hsl.l), 1)).toHex();
		dark_color = hsl._l(Math.min(Math.max(0, 0.3 + (0.7 * hsl.l)), 1)).toHex();
	}


	// Color Processing - HSV
	if ( this.settings.fix_color === '3' ) {
		var hsv = rgb.toHSV();

		if ( hsv.s === 0 ) {
			// Black and White
			light_color = hsv._v(Math.min(Math.max(0.5, 0.5 * hsv.v), 1)).toRGB().toHex();
			dark_color = hsv._v(Math.min(Math.max(0.5, 0.5 + (0.5 * hsv.v)), 1)).toRGB().toHex();

		} else {
			light_color = RGBColor.fromHSV(hsv.h, Math.min(Math.max(0.7, 0.7 + (0.3 * hsv.s)), 1), Math.min(0.7, hsv.v)).toHex();
			dark_color = RGBColor.fromHSV(hsv.h, Math.min(0.7, hsv.s), Math.min(Math.max(0.7, 0.7 + (0.3 * hsv.v)), 1)).toHex();
		}
	}

	// Color Processing - LUV
	if ( this.settings.fix_color === '1' ) {
		var luv = rgb.toLUV();

		if ( luv.l > this._luv_required_dark )
			light_color = luv._l(this._luv_required_dark).toRGB().toHex();

		if ( luv.l < this._luv_required_bright )
			dark_color = luv._l(this._luv_required_bright).toRGB().toHex();
	}

	var out = this._colors[color] = [light_color, dark_color];
	return out;
}
},{}],4:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// -----------------
// Log Export
// -----------------

FFZ.ffz_commands.log = function(room, args) {
	this._pastebin(this._log_data.join("\n"), function(url) {
		if ( ! url )
			return this.room_message(room, "There was an error uploading the FrankerFaceZ log.");

		this.room_message(room, "Your FrankerFaceZ log has been pasted to: " + url);
	});
};


// -----------------
// Mass Moderation
// -----------------

FFZ.ffz_commands.massunmod = function(room, args) {
	args = args.join(" ").trim();

	if ( ! args.length )
		return "You must provide a list of users to unmod.";

	args = args.split(/\W*,\W*/);

	var user = this.get_user();
	if ( ! user || ! user.login == room.id )
		return "You must be the broadcaster to use massunmod.";

	if ( args.length > 50 )
		return "Each user you unmod counts as a single message. To avoid being globally banned, please limit yourself to 50 at a time and wait between uses.";

	var count = args.length;
	while(args.length) {
		var name = args.shift();
		room.room.tmiRoom.sendMessage("/unmod " + name);
	}

	return "Sent unmod command for " + count + " users.";
}

FFZ.ffz_commands.massunmod.help = "Usage: /ffz massunmod <list, of, users>\nBroadcaster only. Unmod all the users in the provided list.";


FFZ.ffz_commands.massmod = function(room, args) {
	args = args.join(" ").trim();

	if ( ! args.length )
		return "You must provide a list of users to mod.";

	args = args.split(/\W*,\W*/);

	var user = this.get_user();
	if ( ! user || ! user.login == room.id )
		return "You must be the broadcaster to use massmod.";

	if ( args.length > 50 )
		return "Each user you mod counts as a single message. To avoid being globally banned, please limit yourself to 50 at a time and wait between uses.";

	var count = args.length;
	while(args.length) {
		var name = args.shift();
		room.room.tmiRoom.sendMessage("/mod " + name);
	}

	return "Sent mod command for " + count + " users.";
}

FFZ.ffz_commands.massmod.help = "Usage: /ffz massmod <list, of, users>\nBroadcaster only. Mod all the users in the provided list.";


/*FFZ.ffz_commands.massunban = function(room, args) {
	args = args.join(" ").trim();
	
	
	
}*/
},{}],5:[function(require,module,exports){
var SVGPATH = '<path d="m120.95 1.74c4.08-0.09 8.33-0.84 12.21 0.82 3.61 1.8 7 4.16 11.01 5.05 2.08 3.61 6.12 5.46 8.19 9.07 3.6 5.67 7.09 11.66 8.28 18.36 1.61 9.51 7.07 17.72 12.69 25.35 3.43 7.74 1.97 16.49 3.6 24.62 2.23 5.11 4.09 10.39 6.76 15.31 1.16 2 4.38 0.63 4.77-1.32 1.2-7.1-2.39-13.94-1.97-21.03 0.38-3.64-0.91-7.48 0.25-10.99 2.74-3.74 4.57-8.05 7.47-11.67 3.55-5.47 10.31-8.34 16.73-7.64 2.26 2.89 5.13 5.21 7.58 7.92 2.88 4.3 6.52 8.01 9.83 11.97 1.89 2.61 3.06 5.64 4.48 8.52 2.81 4.9 4 10.5 6.63 15.49 2.16 6.04 5.56 11.92 5.37 18.5 0.65 1.95 0.78 4 0.98 6.03 1.01 3.95 2.84 8.55 0.63 12.42-2.4 5.23-7.03 8.97-11.55 12.33-6.06 4.66-11.62 10.05-18.37 13.75-4.06 2.65-8.24 5.17-12.71 7.08-3.59 1.57-6.06 4.94-9.85 6.09-2.29 1.71-3.98 4.51-6.97 5.02-4.56 1.35-8.98-3.72-13.5-1.25-2.99 1.83-6.19 3.21-9.39 4.6-8.5 5.61-18.13 9.48-28.06 11.62-8.36-0.2-16.69 0.62-25.05 0.47-3.5-1.87-7.67-1.08-11.22-2.83-6.19-1.52-10.93-6.01-16.62-8.61-2.87-1.39-5.53-3.16-8.11-4.99-2.58-1.88-4.17-4.85-6.98-6.44-3.83-0.11-6.54 3.42-10.24 3.92-2.31 0.28-4.64 0.32-6.96 0.31-3.5-3.65-5.69-8.74-10.59-10.77-5.01-3.68-10.57-6.67-14.84-11.25-2.52-2.55-5.22-4.87-8.24-6.8-4.73-4.07-7.93-9.51-11.41-14.62-3.08-4.41-5.22-9.73-4.6-15.19 0.65-8.01 0.62-16.18 2.55-24.02 4.06-10.46 11.15-19.34 18.05-28.06 3.71-5.31 9.91-10.21 16.8-8.39 3.25 1.61 5.74 4.56 7.14 7.89 1.19 2.7 3.49 4.93 3.87 7.96 0.97 5.85 1.6 11.86 0.74 17.77-1.7 6.12-2.98 12.53-2.32 18.9 0.01 2.92 2.9 5.36 5.78 4.57 3.06-0.68 3.99-4.07 5.32-6.48 1.67-4.06 4.18-7.66 6.69-11.23 3.61-5.28 5.09-11.57 7.63-17.37 2.07-4.56 1.7-9.64 2.56-14.46 0.78-7.65-0.62-15.44 0.7-23.04 1.32-3.78 1.79-7.89 3.8-11.4 3.01-3.66 6.78-6.63 9.85-10.26 1.72-2.12 4.21-3.32 6.55-4.6 7.89-2.71 15.56-6.75 24.06-7z"/>',
	DEBUG = localStorage.ffzDebugMode == "true" && document.body.classList.contains('ffz-dev'),
	SERVER = DEBUG ? "//localhost:8000/" : "//cdn.frankerfacez.com/";

module.exports = {
	DEBUG: DEBUG,
	SERVER: SERVER,
	API_SERVER: "//api.frankerfacez.com/",
	API_SERVER_2: "//direct-api.frankerfacez.com/",

	KNOWN_CODES: {
		"#-?[\\\\/]": "#-/",
		":-?(?:7|L)": ":-7",
		"\\&lt\\;\\]": "<]",
		"\\:-?(S|s)": ":-S",
		"\\:-?\\\\": ":-\\",
		"\\:\\&gt\\;": ":>",
		"B-?\\)": "B-)",
		"\\:-?[z|Z|\\|]": ":-Z",
		"\\:-?\\)": ":-)",
		"\\:-?\\(": ":-(",
		"\\:-?(p|P)": ":-P",
		"\\;-?(p|P)": ";-P",
		"\\&lt\\;3": "<3",
		"\\:-?[\\\\/]": ":-/",
		"\\;-?\\)": ";-)",
		"R-?\\)": "R-)",
		"[o|O](_|\\.)[o|O]": "O.o",
		"\\:-?D": ":-D",
		"\\:-?(o|O)": ":-O",
		"\\&gt\\;\\(": ">(",
		"Gr(a|e)yFace": "GrayFace"
		},

	EMOTE_REPLACEMENT_BASE: SERVER + "script/replacements/",
	EMOTE_REPLACEMENTS: {
		15: "15-JKanStyle.png",
		16: "16-OptimizePrime.png",
		17: "17-StoneLightning.png",
		18: "18-TheRinger.png",
		19: "19-PazPazowitz.png",
		20: "20-EagleEye.png",
		21: "21-CougarHunt.png",
		22: "22-RedCoat.png",
		26: "26-JonCarnage.png",
		27: "27-PicoMause.png",
		30: "30-BCWarrior.png",
		33: "33-DansGame.png",
		36: "36-PJSalt.png"
	},

	EMOJI_REGEX: /((?:\ud83c\udde8\ud83c\uddf3|\ud83c\uddfa\ud83c\uddf8|\ud83c\uddf7\ud83c\uddfa|\ud83c\uddf0\ud83c\uddf7|\ud83c\uddef\ud83c\uddf5|\ud83c\uddee\ud83c\uddf9|\ud83c\uddec\ud83c\udde7|\ud83c\uddeb\ud83c\uddf7|\ud83c\uddea\ud83c\uddf8|\ud83c\udde9\ud83c\uddea|\u0039\ufe0f?\u20e3|\u0038\ufe0f?\u20e3|\u0037\ufe0f?\u20e3|\u0036\ufe0f?\u20e3|\u0035\ufe0f?\u20e3|\u0034\ufe0f?\u20e3|\u0033\ufe0f?\u20e3|\u0032\ufe0f?\u20e3|\u0031\ufe0f?\u20e3|\u0030\ufe0f?\u20e3|\u0023\ufe0f?\u20e3|\ud83d\udeb3|\ud83d\udeb1|\ud83d\udeb0|\ud83d\udeaf|\ud83d\udeae|\ud83d\udea6|\ud83d\udea3|\ud83d\udea1|\ud83d\udea0|\ud83d\ude9f|\ud83d\ude9e|\ud83d\ude9d|\ud83d\ude9c|\ud83d\ude9b|\ud83d\ude98|\ud83d\ude96|\ud83d\ude94|\ud83d\ude90|\ud83d\ude8e|\ud83d\ude8d|\ud83d\ude8b|\ud83d\ude8a|\ud83d\ude88|\ud83d\ude86|\ud83d\ude82|\ud83d\ude81|\ud83d\ude36|\ud83d\ude34|\ud83d\ude2f|\ud83d\ude2e|\ud83d\ude2c|\ud83d\ude27|\ud83d\ude26|\ud83d\ude1f|\ud83d\ude1b|\ud83d\ude19|\ud83d\ude17|\ud83d\ude15|\ud83d\ude11|\ud83d\ude10|\ud83d\ude0e|\ud83d\ude08|\ud83d\ude07|\ud83d\ude00|\ud83d\udd67|\ud83d\udd66|\ud83d\udd65|\ud83d\udd64|\ud83d\udd63|\ud83d\udd62|\ud83d\udd61|\ud83d\udd60|\ud83d\udd5f|\ud83d\udd5e|\ud83d\udd5d|\ud83d\udd5c|\ud83d\udd2d|\ud83d\udd2c|\ud83d\udd15|\ud83d\udd09|\ud83d\udd08|\ud83d\udd07|\ud83d\udd06|\ud83d\udd05|\ud83d\udd04|\ud83d\udd02|\ud83d\udd01|\ud83d\udd00|\ud83d\udcf5|\ud83d\udcef|\ud83d\udced|\ud83d\udcec|\ud83d\udcb7|\ud83d\udcb6|\ud83d\udcad|\ud83d\udc6d|\ud83d\udc6c|\ud83d\udc65|\ud83d\udc2a|\ud83d\udc16|\ud83d\udc15|\ud83d\udc13|\ud83d\udc10|\ud83d\udc0f|\ud83d\udc0b|\ud83d\udc0a|\ud83d\udc09|\ud83d\udc08|\ud83d\udc07|\ud83d\udc06|\ud83d\udc05|\ud83d\udc04|\ud83d\udc03|\ud83d\udc02|\ud83d\udc01|\ud83d\udc00|\ud83c\udfe4|\ud83c\udfc9|\ud83c\udfc7|\ud83c\udf7c|\ud83c\udf50|\ud83c\udf4b|\ud83c\udf33|\ud83c\udf32|\ud83c\udf1e|\ud83c\udf1d|\ud83c\udf1c|\ud83c\udf1a|\ud83c\udf18|\ud83c\udccf|\ud83c\udd70|\ud83c\udd71|\ud83c\udd7e|\ud83c\udd8e|\ud83c\udd91|\ud83c\udd92|\ud83c\udd93|\ud83c\udd94|\ud83c\udd95|\ud83c\udd96|\ud83c\udd97|\ud83c\udd98|\ud83c\udd99|\ud83c\udd9a|\ud83d\udc77|\ud83d\udec5|\ud83d\udec4|\ud83d\udec3|\ud83d\udec2|\ud83d\udec1|\ud83d\udebf|\ud83d\udeb8|\ud83d\udeb7|\ud83d\udeb5|\ud83c\ude01|\ud83c\ude02|\ud83c\ude32|\ud83c\ude33|\ud83c\ude34|\ud83c\ude35|\ud83c\ude36|\ud83c\ude37|\ud83c\ude38|\ud83c\ude39|\ud83c\ude3a|\ud83c\ude50|\ud83c\ude51|\ud83c\udf00|\ud83c\udf01|\ud83c\udf02|\ud83c\udf03|\ud83c\udf04|\ud83c\udf05|\ud83c\udf06|\ud83c\udf07|\ud83c\udf08|\ud83c\udf09|\ud83c\udf0a|\ud83c\udf0b|\ud83c\udf0c|\ud83c\udf0f|\ud83c\udf11|\ud83c\udf13|\ud83c\udf14|\ud83c\udf15|\ud83c\udf19|\ud83c\udf1b|\ud83c\udf1f|\ud83c\udf20|\ud83c\udf30|\ud83c\udf31|\ud83c\udf34|\ud83c\udf35|\ud83c\udf37|\ud83c\udf38|\ud83c\udf39|\ud83c\udf3a|\ud83c\udf3b|\ud83c\udf3c|\ud83c\udf3d|\ud83c\udf3e|\ud83c\udf3f|\ud83c\udf40|\ud83c\udf41|\ud83c\udf42|\ud83c\udf43|\ud83c\udf44|\ud83c\udf45|\ud83c\udf46|\ud83c\udf47|\ud83c\udf48|\ud83c\udf49|\ud83c\udf4a|\ud83c\udf4c|\ud83c\udf4d|\ud83c\udf4e|\ud83c\udf4f|\ud83c\udf51|\ud83c\udf52|\ud83c\udf53|\ud83c\udf54|\ud83c\udf55|\ud83c\udf56|\ud83c\udf57|\ud83c\udf58|\ud83c\udf59|\ud83c\udf5a|\ud83c\udf5b|\ud83c\udf5c|\ud83c\udf5d|\ud83c\udf5e|\ud83c\udf5f|\ud83c\udf60|\ud83c\udf61|\ud83c\udf62|\ud83c\udf63|\ud83c\udf64|\ud83c\udf65|\ud83c\udf66|\ud83c\udf67|\ud83c\udf68|\ud83c\udf69|\ud83c\udf6a|\ud83c\udf6b|\ud83c\udf6c|\ud83c\udf6d|\ud83c\udf6e|\ud83c\udf6f|\ud83c\udf70|\ud83c\udf71|\ud83c\udf72|\ud83c\udf73|\ud83c\udf74|\ud83c\udf75|\ud83c\udf76|\ud83c\udf77|\ud83c\udf78|\ud83c\udf79|\ud83c\udf7a|\ud83c\udf7b|\ud83c\udf80|\ud83c\udf81|\ud83c\udf82|\ud83c\udf83|\ud83c\udf84|\ud83c\udf85|\ud83c\udf86|\ud83c\udf87|\ud83c\udf88|\ud83c\udf89|\ud83c\udf8a|\ud83c\udf8b|\ud83c\udf8c|\ud83c\udf8d|\ud83c\udf8e|\ud83c\udf8f|\ud83c\udf90|\ud83c\udf91|\ud83c\udf92|\ud83c\udf93|\ud83c\udfa0|\ud83c\udfa1|\ud83c\udfa2|\ud83c\udfa3|\ud83c\udfa4|\ud83c\udfa5|\ud83c\udfa6|\ud83c\udfa7|\ud83c\udfa8|\ud83c\udfa9|\ud83c\udfaa|\ud83c\udfab|\ud83c\udfac|\ud83c\udfad|\ud83c\udfae|\ud83c\udfaf|\ud83c\udfb0|\ud83c\udfb1|\ud83c\udfb2|\ud83c\udfb3|\ud83c\udfb4|\ud83c\udfb5|\ud83c\udfb6|\ud83c\udfb7|\ud83c\udfb8|\ud83c\udfb9|\ud83c\udfba|\ud83c\udfbb|\ud83c\udfbc|\ud83c\udfbd|\ud83c\udfbe|\ud83c\udfbf|\ud83c\udfc0|\ud83c\udfc1|\ud83c\udfc2|\ud83c\udfc3|\ud83c\udfc4|\ud83c\udfc6|\ud83c\udfc8|\ud83c\udfca|\ud83c\udfe0|\ud83c\udfe1|\ud83c\udfe2|\ud83c\udfe3|\ud83c\udfe5|\ud83c\udfe6|\ud83c\udfe7|\ud83c\udfe8|\ud83c\udfe9|\ud83c\udfea|\ud83c\udfeb|\ud83c\udfec|\ud83c\udfed|\ud83c\udfee|\ud83c\udfef|\ud83c\udff0|\ud83d\udc0c|\ud83d\udc0d|\ud83d\udc0e|\ud83d\udc11|\ud83d\udc12|\ud83d\udc14|\ud83d\udc17|\ud83d\udc18|\ud83d\udc19|\ud83d\udc1a|\ud83d\udc1b|\ud83d\udc1c|\ud83d\udc1d|\ud83d\udc1e|\ud83d\udc1f|\ud83d\udc20|\ud83d\udc21|\ud83d\udc22|\ud83d\udc23|\ud83d\udc24|\ud83d\udc25|\ud83d\udc26|\ud83d\udc27|\ud83d\udc28|\ud83d\udc29|\ud83d\udc2b|\ud83d\udc2c|\ud83d\udc2d|\ud83d\udc2e|\ud83d\udc2f|\ud83d\udc30|\ud83d\udc31|\ud83d\udc32|\ud83d\udc33|\ud83d\udc34|\ud83d\udc35|\ud83d\udc36|\ud83d\udc37|\ud83d\udc38|\ud83d\udc39|\ud83d\udc3a|\ud83d\udc3b|\ud83d\udc3c|\ud83d\udc3d|\ud83d\udc3e|\ud83d\udc40|\ud83d\udc42|\ud83d\udc43|\ud83d\udc44|\ud83d\udc45|\ud83d\udc46|\ud83d\udc47|\ud83d\udc48|\ud83d\udc49|\ud83d\udc4a|\ud83d\udc4b|\ud83d\udc4c|\ud83d\udc4d|\ud83d\udc4e|\ud83d\udc4f|\ud83d\udc50|\ud83d\udc51|\ud83d\udc52|\ud83d\udc53|\ud83d\udc54|\ud83d\udc55|\ud83d\udc56|\ud83d\udc57|\ud83d\udc58|\ud83d\udc59|\ud83d\udc5a|\ud83d\udc5b|\ud83d\udc5c|\ud83d\udc5d|\ud83d\udc5e|\ud83d\udc5f|\ud83d\udc60|\ud83d\udc61|\ud83d\udc62|\ud83d\udc63|\ud83d\udc64|\ud83d\udc66|\ud83d\udc67|\ud83d\udc68|\ud83d\udc69|\ud83d\udc6a|\ud83d\udc6b|\ud83d\udc6e|\ud83d\udc6f|\ud83d\udc70|\ud83d\udc71|\ud83d\udc72|\ud83d\udc73|\ud83d\udc74|\ud83d\udc75|\ud83d\udc76|\ud83d\udeb4|\ud83d\udc78|\ud83d\udc79|\ud83d\udc7a|\ud83d\udc7b|\ud83d\udc7c|\ud83d\udc7d|\ud83d\udc7e|\ud83d\udc7f|\ud83d\udc80|\ud83d\udc81|\ud83d\udc82|\ud83d\udc83|\ud83d\udc84|\ud83d\udc85|\ud83d\udc86|\ud83d\udc87|\ud83d\udc88|\ud83d\udc89|\ud83d\udc8a|\ud83d\udc8b|\ud83d\udc8c|\ud83d\udc8d|\ud83d\udc8e|\ud83d\udc8f|\ud83d\udc90|\ud83d\udc91|\ud83d\udc92|\ud83d\udc93|\ud83d\udc94|\ud83d\udc95|\ud83d\udc96|\ud83d\udc97|\ud83d\udc98|\ud83d\udc99|\ud83d\udc9a|\ud83d\udc9b|\ud83d\udc9c|\ud83d\udc9d|\ud83d\udc9e|\ud83d\udc9f|\ud83d\udca0|\ud83d\udca1|\ud83d\udca2|\ud83d\udca3|\ud83d\udca4|\ud83d\udca5|\ud83d\udca6|\ud83d\udca7|\ud83d\udca8|\ud83d\udca9|\ud83d\udcaa|\ud83d\udcab|\ud83d\udcac|\ud83d\udcae|\ud83d\udcaf|\ud83d\udcb0|\ud83d\udcb1|\ud83d\udcb2|\ud83d\udcb3|\ud83d\udcb4|\ud83d\udcb5|\ud83d\udcb8|\ud83d\udcb9|\ud83d\udcba|\ud83d\udcbb|\ud83d\udcbc|\ud83d\udcbd|\ud83d\udcbe|\ud83d\udcbf|\ud83d\udcc0|\ud83d\udcc1|\ud83d\udcc2|\ud83d\udcc3|\ud83d\udcc4|\ud83d\udcc5|\ud83d\udcc6|\ud83d\udcc7|\ud83d\udcc8|\ud83d\udcc9|\ud83d\udcca|\ud83d\udccb|\ud83d\udccc|\ud83d\udccd|\ud83d\udcce|\ud83d\udccf|\ud83d\udcd0|\ud83d\udcd1|\ud83d\udcd2|\ud83d\udcd3|\ud83d\udcd4|\ud83d\udcd5|\ud83d\udcd6|\ud83d\udcd7|\ud83d\udcd8|\ud83d\udcd9|\ud83d\udcda|\ud83d\udcdb|\ud83d\udcdc|\ud83d\udcdd|\ud83d\udcde|\ud83d\udcdf|\ud83d\udce0|\ud83d\udce1|\ud83d\udce2|\ud83d\udce3|\ud83d\udce4|\ud83d\udce5|\ud83d\udce6|\ud83d\udce7|\ud83d\udce8|\ud83d\udce9|\ud83d\udcea|\ud83d\udceb|\ud83d\udcee|\ud83d\udcf0|\ud83d\udcf1|\ud83d\udcf2|\ud83d\udcf3|\ud83d\udcf4|\ud83d\udcf6|\ud83d\udcf7|\ud83d\udcf9|\ud83d\udcfa|\ud83d\udcfb|\ud83d\udcfc|\ud83d\udd03|\ud83d\udd0a|\ud83d\udd0b|\ud83d\udd0c|\ud83d\udd0d|\ud83d\udd0e|\ud83d\udd0f|\ud83d\udd10|\ud83d\udd11|\ud83d\udd12|\ud83d\udd13|\ud83d\udd14|\ud83d\udd16|\ud83d\udd17|\ud83d\udd18|\ud83d\udd19|\ud83d\udd1a|\ud83d\udd1b|\ud83d\udd1c|\ud83d\udd1d|\ud83d\udd1e|\ud83d\udd1f|\ud83d\udd20|\ud83d\udd21|\ud83d\udd22|\ud83d\udd23|\ud83d\udd24|\ud83d\udd25|\ud83d\udd26|\ud83d\udd27|\ud83d\udd28|\ud83d\udd29|\ud83d\udd2a|\ud83d\udd2b|\ud83d\udd2e|\ud83d\udd2f|\ud83d\udd30|\ud83d\udd31|\ud83d\udd32|\ud83d\udd33|\ud83d\udd34|\ud83d\udd35|\ud83d\udd36|\ud83d\udd37|\ud83d\udd38|\ud83d\udd39|\ud83d\udd3a|\ud83d\udd3b|\ud83d\udd3c|\ud83d\udd3d|\ud83d\udd50|\ud83d\udd51|\ud83d\udd52|\ud83d\udd53|\ud83d\udd54|\ud83d\udd55|\ud83d\udd56|\ud83d\udd57|\ud83d\udd58|\ud83d\udd59|\ud83d\udd5a|\ud83d\udd5b|\ud83d\uddfb|\ud83d\uddfc|\ud83d\uddfd|\ud83d\uddfe|\ud83d\uddff|\ud83d\ude01|\ud83d\ude02|\ud83d\ude03|\ud83d\ude04|\ud83d\ude05|\ud83d\ude06|\ud83d\ude09|\ud83d\ude0a|\ud83d\ude0b|\ud83d\ude0c|\ud83d\ude0d|\ud83d\ude0f|\ud83d\ude12|\ud83d\ude13|\ud83d\ude14|\ud83d\ude16|\ud83d\ude18|\ud83d\ude1a|\ud83d\ude1c|\ud83d\ude1d|\ud83d\ude1e|\ud83d\ude20|\ud83d\ude21|\ud83d\ude22|\ud83d\ude23|\ud83d\ude24|\ud83d\ude25|\ud83d\ude28|\ud83d\ude29|\ud83d\ude2a|\ud83d\ude2b|\ud83d\ude2d|\ud83d\ude30|\ud83d\ude31|\ud83d\ude32|\ud83d\ude33|\ud83d\ude35|\ud83d\ude37|\ud83d\ude38|\ud83d\ude39|\ud83d\ude3a|\ud83d\ude3b|\ud83d\ude3c|\ud83d\ude3d|\ud83d\ude3e|\ud83d\ude3f|\ud83d\ude40|\ud83d\ude45|\ud83d\ude46|\ud83d\ude47|\ud83d\ude48|\ud83d\ude49|\ud83d\ude4a|\ud83d\ude4b|\ud83d\ude4c|\ud83d\ude4d|\ud83d\ude4e|\ud83d\ude4f|\ud83d\ude80|\ud83d\ude83|\ud83d\ude84|\ud83d\ude85|\ud83d\ude87|\ud83d\ude89|\ud83d\ude8c|\ud83d\ude8f|\ud83d\ude91|\ud83d\ude92|\ud83d\ude93|\ud83d\ude95|\ud83d\ude97|\ud83d\ude99|\ud83d\ude9a|\ud83d\udea2|\ud83d\udea4|\ud83d\udea5|\ud83d\udea7|\ud83d\udea8|\ud83d\udea9|\ud83d\udeaa|\ud83d\udeab|\ud83d\udeac|\ud83d\udead|\ud83d\udeb2|\ud83d\udeb6|\ud83d\udeb9|\ud83d\udeba|\ud83d\udebb|\ud83d\udebc|\ud83d\udebd|\ud83d\udebe|\ud83d\udec0|\ud83c\udde6|\ud83c\udde7|\ud83c\udde8|\ud83c\udde9|\ud83c\uddea|\ud83c\uddeb|\ud83c\uddec|\ud83c\udded|\ud83c\uddee|\ud83c\uddef|\ud83c\uddf0|\ud83c\uddf1|\ud83c\uddf2|\ud83c\uddf3|\ud83c\uddf4|\ud83c\uddf5|\ud83c\uddf6|\ud83c\uddf7|\ud83c\uddf8|\ud83c\uddf9|\ud83c\uddfa|\ud83c\uddfb|\ud83c\uddfc|\ud83c\uddfd|\ud83c\uddfe|\ud83c\uddff|\ud83c\udf0d|\ud83c\udf0e|\ud83c\udf10|\ud83c\udf12|\ud83c\udf16|\ud83c\udf17|\ue50a|\u3030|\u27b0|\u2797|\u2796|\u2795|\u2755|\u2754|\u2753|\u274e|\u274c|\u2728|\u270b|\u270a|\u2705|\u26ce|\u23f3|\u23f0|\u23ec|\u23eb|\u23ea|\u23e9|\u2122|\u27bf|\u00a9|\u00ae)|(?:(?:\ud83c\udc04|\ud83c\udd7f|\ud83c\ude1a|\ud83c\ude2f|\u3299|\u303d|\u2b55|\u2b50|\u2b1c|\u2b1b|\u2b07|\u2b06|\u2b05|\u2935|\u2934|\u27a1|\u2764|\u2757|\u2747|\u2744|\u2734|\u2733|\u2716|\u2714|\u2712|\u270f|\u270c|\u2709|\u2708|\u2702|\u26fd|\u26fa|\u26f5|\u26f3|\u26f2|\u26ea|\u26d4|\u26c5|\u26c4|\u26be|\u26bd|\u26ab|\u26aa|\u26a1|\u26a0|\u2693|\u267f|\u267b|\u3297|\u2666|\u2665|\u2663|\u2660|\u2653|\u2652|\u2651|\u2650|\u264f|\u264e|\u264d|\u264c|\u264b|\u264a|\u2649|\u2648|\u263a|\u261d|\u2615|\u2614|\u2611|\u260e|\u2601|\u2600|\u25fe|\u25fd|\u25fc|\u25fb|\u25c0|\u25b6|\u25ab|\u25aa|\u24c2|\u231b|\u231a|\u21aa|\u21a9|\u2199|\u2198|\u2197|\u2196|\u2195|\u2194|\u2139|\u2049|\u203c|\u2668)([\uFE0E\uFE0F]?)))/g,

	SVGPATH: SVGPATH,
	ZREKNARF: '<svg style="padding:1.75px 0" class="svg-glyph_views ffz-svg svg-zreknarf" width="16px" viewBox="0 0 249 195" version="1.1" height="12.5px">' + SVGPATH + '</svg>',
	CHAT_BUTTON: '<svg class="svg-emoticons ffz-svg" height="18px" width="24px" viewBox="0 0 249 195" version="1.1">' + SVGPATH + '</svg>',

	ROOMS: '<svg class="svg-glyph_views svg-roomlist" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,13v-2h14v2H1z M1,5h13v2H1V5z M1,2h10v2H1V2z M12,10H1V8h11V10z" fill-rule="evenodd"></path></svg>',
	CAMERA: '<svg class="svg-camera" height="16px" version="1.1" viewBox="0 0 36 36" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" d="M24,20v6H4V10h20v6l8-6v16L24,20z"/></svg>',
	INVITE: '<svg class="svg-plus" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M15,9h-3v3h-2V9H7V7h3V4h2v3h3V9z M9,6H6v4h2h1v3h4l0,0l0,0v1h-3H4H1v-1l3-3h2L4,8V2h6v1H9V6z" fill-rule="evenodd"></path></svg>',

	LIVE: '<svg class="svg-glyph_live_small" height="16px" version="1.1" viewbox="0 0 16 16" width="13px" x="0px" y="0px"><path clip-rule="evenodd" d="M11,14H5H2v-1l3-3h2L5,8V2h6v6l-2,2h2l3,3v1H11z" fill-rule="evenodd"></path></svg>',

	EYE: '<svg class="svg-glyph_views ffz-svg svg-eye" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M11,13H5L1,9V8V7l4-4h6l4,4v1v1L11,13z M8,5C6.344,5,5,6.343,5,8c0,1.656,1.344,3,3,3c1.657,0,3-1.344,3-3C11,6.343,9.657,5,8,5z M8,9C7.447,9,7,8.552,7,8s0.447-1,1-1s1,0.448,1,1S8.553,9,8,9z" fill-rule="evenodd"></path></svg>',
	CLOCK: '<svg class="svg-glyph_views ffz-svg svg-clock" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M8,15c-3.866,0-7-3.134-7-7s3.134-7,7-7s7,3.134,7,7 S11.866,15,8,15z M8,3C5.238,3,3,5.238,3,8s2.238,5,5,5s5-2.238,5-5S10.762,3,8,3z M7.293,8.707L7,8l1-4l0.902,3.607L11,11 L7.293,8.707z"/></svg>',
	GEAR: '<svg class="svg-gear" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M15,7v2h-2.115c-0.125,0.615-0.354,1.215-0.713,1.758l1.484,1.484l-1.414,1.414l-1.484-1.484C10.215,12.531,9.615,12.76,9,12.885V15H7v-2.12c-0.614-0.126-1.21-0.356-1.751-0.714l-1.491,1.49l-1.414-1.414l1.491-1.49C3.477,10.211,3.247,9.613,3.12,9H1V7h2.116C3.24,6.384,3.469,5.785,3.829,5.242L2.343,3.757l1.414-1.414l1.485,1.485C5.785,3.469,6.384,3.24,7,3.115V1h2v2.12c0.613,0.126,1.211,0.356,1.752,0.714l1.49-1.491l1.414,1.414l-1.49,1.492C12.523,5.79,12.754,6.387,12.88,7H15z M8,6C6.896,6,6,6.896,6,8s0.896,2,2,2s2-0.896,2-2S9.104,6,8,6z" fill-rule="evenodd"></path></svg>',
	HEART: '<svg class="svg-heart" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M8,13.5L1.5,7V4l2-2h3L8,3.5L9.5,2h3l2,2v3L8,13.5z" fill-rule="evenodd"></path></svg>',
	EMOTE: '<svg class="svg-emote" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M9,18c-4.971,0-9-4.029-9-9s4.029-9,9-9s9,4.029,9,9S13.971,18,9,18z M14,4.111V4h-0.111C12.627,2.766,10.904,2,9,2C7.095,2,5.373,2.766,4.111,4H4v0.111C2.766,5.373,2,7.096,2,9s0.766,3.627,2,4.889V14l0.05-0.051C5.317,15.217,7.067,16,9,16c1.934,0,3.684-0.783,4.949-2.051L14,14v-0.111c1.234-1.262,2-2.984,2-4.889S15.234,5.373,14,4.111zM11,6h2v4h-2V6z M12.535,12.535C11.631,13.44,10.381,14,9,14s-2.631-0.56-3.536-1.465l0.707-0.707C6.896,12.553,7.896,13,9,13s2.104-0.447,2.828-1.172L12.535,12.535z M5,6h2v4H5V6z" fill-rule="evenodd"></path></svg>',
	STAR: '<svg class="svg-star" height="16px" version="1.1" viewbox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M15,6l-4.041,2.694L13,14l-5-3.333L3,14l2.041-5.306L1,6h5.077L8,1l1.924,5H15z" fill-rule="evenodd"></path></svg>',
	CLOSE: '<svg class="svg-close_small" height="16px" version="1.1" viewbox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M12.657,4.757L9.414,8l3.243,3.242l-1.415,1.415L8,9.414l-3.243,3.243l-1.414-1.415L6.586,8L3.343,4.757l1.414-1.414L8,6.586l3.242-3.243L12.657,4.757z" fill-rule="evenodd"></path></svg>',

	EDIT: '<svg class="svg-edit" height="16px" version="1.1" viewbox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M6.414,12.414L3.586,9.586l8-8l2.828,2.828L6.414,12.414z M4.829,14H2l0,0v-2.828l0.586-0.586l2.828,2.828L4.829,14z" fill-rule="evenodd"></path></svg>',

	GRAPH: '<svg class="svg-graph" height="16px" version="1.1" viewbox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,16V2h16v14H1z M5,4H3v1h2V4z M5,7H3v1h2V7z M5,10H3v1h2V10zM5,13H3v1h2V13z M9,7H7v7h2V7z M12,10h-2v4h2V10z M15,4h-2v10h2V4z" fill-rule="evenodd"></path></svg>'
}
},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_channel = function() {
	// Style Stuff!
	this.log("Creating channel style element.");
	var s = this._channel_style = document.createElement("style");
	s.id = "ffz-channel-css";
	document.head.appendChild(s);

	// Settings stuff!
	document.body.classList.toggle("ffz-hide-view-count", !this.settings.channel_views);

	this.log("Creating channel style element.");
	var s = this._channel_style = document.createElement('style');
	s.id = "ffz-channel-css";
	document.head.appendChild(s);

	this.log("Hooking the Ember Channel Index view.");
	var Channel = App.__container__.resolve('view:channel/index'),
		f = this;

	if ( ! Channel )
		return;

	this._modify_cindex(Channel);

	// The Stupid View Fix. Is this necessary still?
	try {
		Channel.create().destroy();
	} catch(err) { }

	// Update Existing
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof Channel) )
			continue;

		this.log("Manually updating Channel Index view.", view);
		this._modify_cindex(view);
		view.ffzInit();
	};


	this.log("Hooking the Ember Channel model.");
	Channel = App.__container__.resolve('model:channel');
	if ( ! Channel )
		return;

	Channel.reopen({
		ffz_host_target: undefined,

		setHostMode: function(e) {
			if ( f.settings.hosted_channels ) {
				this.set('ffz_host_target', e.target);
				return this._super(e);
			} else {
				this.set('ffz_host_target', undefined);
				return this._super({target: void 0, delay: 0});
			}
		}
	});


	this.log("Hooking the Ember Channel controller.");

	Channel = App.__container__.lookup('controller:channel');
	if ( ! Channel )
		return;

	Channel.reopen({
		ffzUpdateUptime: function() {
			if ( f._cindex )
				f._cindex.ffzUpdateUptime();

		}.observes("isLive", "content.id"),

		ffzUpdateInfo: function() {
			if ( this._ffz_update_timer )
				clearTimeout(this._ffz_update_timer);

			if ( ! this.get('content.id') )
				return;

			this._ffz_update_timer = setTimeout(this.ffzCheckUpdate.bind(this), 60000);
		}.observes("content.id"),

		ffzCheckUpdate: function() {
			var t = this,
				id = t.get('content.id');

			id && Twitch.api && Twitch.api.get("streams/" + id, {}, {version:3})
				.done(function(data) {
					if ( ! data || ! data.stream ) {
						// If the stream is offline, clear its created_at time and set it to zero viewers.
						t.set('stream.created_at', null);
						t.set('stream.viewers', 0);
						return;
					}

					t.set('stream.created_at', data.stream.created_at || null);
					t.set('stream.viewers', data.stream.viewers || 0);

					var game = data.stream.game || (data.stream.channel && data.stream.channel.game);
					if ( game ) {
						t.set('game', game);
						t.set('rollbackData.game', game);
					}

					if ( data.stream.channel ) {
						if ( data.stream.channel.status )
							t.set('status', data.stream.channel.status);

						if ( data.stream.channel.views )
							t.set('views', data.stream.channel.views);

						if ( data.stream.channel.followers && t.get('content.followers.isLoaded') )
							t.set('content.followers.total', data.stream.channel.followers);
					}

				})
				.always(function(data) {
					t.ffzUpdateInfo();
				});
		},


		ffzUpdateTitle: function() {
			var name = this.get('content.name'),
				display_name = this.get('content.display_name');

			if ( display_name )
				FFZ.capitalization[name] = [display_name, Date.now()];

			if ( f._cindex )
				f._cindex.ffzFixTitle();
		}.observes("content.status", "content.id"),

		ffzHostTarget: function() {
			var target = this.get('content.hostModeTarget'),
				name = target && target.get('name'),
				id = target && target.get('id'),
				display_name = target && target.get('display_name');

			if ( id !== f.__old_host_target ) {
				if ( f.__old_host_target )
					f.ws_send("unsub_channel", f.__old_host_target);

				if ( id ) {
					f.ws_send("sub_channel", id);
					f.__old_host_target = id;
				} else
					delete f.__old_host_target;
			}

			if ( display_name )
				FFZ.capitalization[name] = [display_name, Date.now()];

			if ( f.settings.group_tabs && f._chatv )
				f._chatv.ffzRebuildTabs();

			if ( f.settings.follow_buttons )
				f.rebuild_following_ui();

			if ( f.settings.srl_races )
				f.rebuild_race_ui();

		}.observes("content.hostModeTarget")
	});

	Channel.ffzUpdateInfo();
}


FFZ.prototype._modify_cindex = function(view) {
	var f = this;

	view.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.ffzInit();
			} catch(err) {
				f.error("CIndex didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("CIndex willClearRender: " + err);
			}
			return this._super();
		},

		ffzInit: function() {
			var id = this.get('controller.id'),
				el = this.get('element');

			f._cindex = this;
			f.ws_send("sub_channel", id);

			el.setAttribute('data-channel', id);
			el.classList.add('ffz-channel');

			// Try changing the theater mode tooltip.
			this.$('.theatre-button a').attr('title', 'Theater Mode (Alt+T)');

			this.ffzFixTitle();
			this.ffzUpdateUptime();
			this.ffzUpdateChatters();
			this.ffzUpdateHostButton();
			this.ffzUpdatePlayerStats();

			var views = this.get('element').querySelector('.svg-glyph_views:not(.ffz-svg)')
			if ( views )
				views.parentNode.classList.add('twitch-channel-views');

			if ( f.settings.follow_buttons )
				f.rebuild_following_ui();

			if ( f.settings.srl_races )
				f.rebuild_race_ui();

			if ( f.settings.auto_theater ) {
				var Layout = App.__container__.lookup('controller:layout');
				if ( Layout )
					Layout.set('isTheatreMode', true);
			}
		},

		ffzFixTitle: function() {
			if ( f.has_bttv || ! f.settings.stream_title )
				return;

			var status = this.get("controller.status"),
				channel = this.get("controller.id");

			status = f.render_tokens(f.tokenize_line(channel, channel, status, true));

			this.$(".title span").each(function(i, el) {
				var scripts = el.querySelectorAll("script");
				if ( ! scripts.length )
					el.innerHTML = status;
				else
					el.innerHTML = scripts[0].outerHTML + status + scripts[1].outerHTML;
			});
		},


		ffzUpdateHostButton: function() {
			var channel_id = this.get('controller.id'),
				hosted_id = this.get('controller.hostModeTarget.id'),

				user = f.get_user(),
				room = user && f.rooms && f.rooms[user.login] && f.rooms[user.login].room,
				now_hosting = room && room.ffz_host_target,
				hosts_left = room && room.ffz_hosts_left,

				el = this.get('element');

			this.set('ffz_host_updating', false);

			if ( channel_id ) {
				var container = el && el.querySelector('.stats-and-actions .channel-actions'),
					btn = container && container.querySelector('#ffz-ui-host-button');

				if ( ! container || ! f.settings.stream_host_button || ! user || user.login === channel_id ) {
					if ( btn )
						btn.parentElement.removeChild(btn);
				} else {
					if ( ! btn ) {
						btn = document.createElement('span');
						btn.id = 'ffz-ui-host-button';
						btn.className = 'button action tooltip';

						btn.addEventListener('click', this.ffzClickHost.bind(btn, this, false));

						var before;
						try { before = container.querySelector(':scope > .theatre-button'); }
						catch(err) { before = undefined; }

						if ( before )
							container.insertBefore(btn, before);
						else
							container.appendChild(btn);
					}

					btn.classList.remove('disabled');
					btn.innerHTML = channel_id === now_hosting ? 'Unhost' : 'Host';
					if ( now_hosting )
						btn.title = 'You are now hosting ' + utils.sanitize(FFZ.get_capitalization(now_hosting)) + '.';
					else
						btn.title = 'You are not hosting any channel.';

					if ( typeof hosts_left === "number" )
						btn.title += ' You have ' + hosts_left + ' host command' + utils.pluralize(hosts_left) + ' remaining this half hour.';
				}
			}


			if ( hosted_id ) {
				var container = el && el.querySelector('#hostmode .channel-actions'),
					btn = container && container.querySelector('#ffz-ui-host-button');

				if ( ! container || ! f.settings.stream_host_button || ! user || user.login === hosted_id ) {
					if ( btn )
						btn.parentElement.removeChild(btn);
				} else {
					if ( ! btn ) {
						btn = document.createElement('span');
						btn.id = 'ffz-ui-host-button';
						btn.className = 'button action tooltip';

						btn.addEventListener('click', this.ffzClickHost.bind(btn, this, true));

						var before;
						try { before = container.querySelector(':scope > .theatre-button'); }
						catch(err) { before = undefined; }

						if ( before )
							container.insertBefore(btn, before);
						else
							container.appendChild(btn);
					}

					btn.classList.remove('disabled');
					btn.innerHTML = hosted_id === now_hosting ? 'Unhost' : 'Host';
					if ( now_hosting )
						btn.title = 'You are currently hosting ' + utils.sanitize(FFZ.get_capitalization(now_hosting)) + '. Click to ' + (hosted_id === now_hosting ? 'unhost' : 'host') + ' this channel.';
					else
						btn.title = 'You are not currently hosting any channel. Click to host this channel.';

					if ( typeof hosts_left === "number" )
						btn.title += ' You have ' + hosts_left + ' host command' + utils.pluralize(hosts_left) + ' remaining this half hour.';
				}
			}
		},

		ffzClickHost: function(controller, is_host) {
			var target = controller.get(is_host ? 'controller.hostModeTarget.id' : 'controller.id'),
				user = f.get_user(),
				room = user && f.rooms && f.rooms[user.login] && f.rooms[user.login].room,
				now_hosting = room && room.ffz_host_target;

			if ( ! room || controller.get('ffz_host_updating') )
				return;

			this.classList.add('disabled');
			this.title = 'Updating...';

			controller.set('ffz_host_updating', true);
			if ( now_hosting === target )
				room.send("/unhost");
			else
				room.send("/host " + target);
		},


		ffzUpdateChatters: function() {
			// Get the counts.
			var room_id = this.get('controller.id'),
				room = f.rooms && f.rooms[room_id];

			if ( ! room || ! f.settings.chatter_count ) {
				var el = this.get('element').querySelector('#ffz-chatter-display');
				el && el.parentElement.removeChild(el);
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentElement.removeChild(el);
				return;
			}

			var chatter_count = Object.keys(room.room.get('ffz_chatters') || {}).length,
				ffz_chatters = room.ffz_chatters || 0,
				ffz_viewers = room.ffz_viewers || 0;

			var el = this.get('element').querySelector('#ffz-chatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-chatter-display';
				stat.title = "Currently in Chat";

				stat.innerHTML = constants.ROOMS + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-ffzchatter-display");
				if ( other )
					cont.insertBefore(stat, other);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy();
			}

			el.innerHTML = utils.number_commas(chatter_count);

			if ( ! ffz_chatters && ! ffz_viewers ) {
				el = this.get('element').querySelector('#ffz-ffzchatter-display');
				el && el.parentNode.removeChild(el);
				return;
			}

			el = this.get('element').querySelector('#ffz-ffzchatter-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-ffzchatter-display';
				stat.title = "Viewers (In Chat) with FrankerFaceZ";

				stat.innerHTML = constants.ZREKNARF + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var other = cont.querySelector("#ffz-chatter-display");
				if ( other )
					cont.insertBefore(stat, other.nextSibling);
				else
					cont.appendChild(stat);

				jQuery(stat).tipsy();
			}

			el.innerHTML = utils.number_commas(ffz_viewers) + " (" + utils.number_commas(ffz_chatters) + ")";
		},


		ffzUpdatePlayerStats: function() {
			var channel_id = this.get('controller.id'),
				hosted_id = this.get('controller.hostModeTarget.id'),

				el = this.get('element');

			if ( channel_id ) {
				var container = el && el.querySelector('.stats-and-actions .channel-stats'),
					stat_el = container && container.querySelector('#ffz-ui-player-stats'),
					el = stat_el && stat_el.querySelector('span'),

					player_cont = f.players && f.players[channel_id],
					player = player_cont && player_cont.player,
					stats = player && player.stats;


				if ( ! container || ! f.settings.player_stats || ! stats || stats.hlsLatencyBroadcaster === 'NaN' || stats.hlsLatencyBroadcaster === NaN ) {
					if ( stat_el )
						stat_el.parentElement.removeChild(stat_el);
				} else {
					if ( ! stat_el ) {
						stat_el = document.createElement('span');
						stat_el.id = 'ffz-ui-player-stats';
						stat_el.className = 'ffz stat tooltip';

						stat_el.innerHTML = constants.GRAPH + " ";
						el = document.createElement('span');
						stat_el.appendChild(el);

						var other = container.querySelector('#ffz-uptime-display');
						if ( other )
							container.insertBefore(stat_el, other.nextSibling);
						else
							container.appendChild(stat_el);
					}

					stat_el.title = 'Stream Latency\nFPS: ' + stats.fps + '\nPlayback Rate: ' + stats.playbackRate + ' Kbps';
					el.textContent = stats.hlsLatencyBroadcaster + 's';
				}
			}


			if ( hosted_id ) {
				var container = el && el.querySelector('#hostmode .channel-stats'),
					stat_el = container && container.querySelector('#ffz-ui-player-stats'),
					el = stat_el && stat_el.querySelector('span'),

					player_cont = f.players && f.players[hosted_id],
					player = player_cont && player_cont.player,
					stats = player && player.stats;


				if ( ! container || ! f.settings.player_stats || ! stats || stats.hlsLatencyBroadcaster === 'NaN' || stats.hlsLatencyBroadcaster === NaN ) {
					if ( stat_el )
						stat_el.parentElement.removeChild(stat_el);
				} else {
					if ( ! stat_el ) {
						stat_el = document.createElement('span');
						stat_el.id = 'ffz-ui-player-stats';
						stat_el.className = 'ffz stat tooltip';

						stat_el.innerHTML = constants.GRAPH + " ";
						el = document.createElement('span');
						stat_el.appendChild(el);

						var other = container.querySelector('#ffz-uptime-display');
						if ( other )
							container.insertBefore(stat_el, other.nextSibling);
						else
							container.appendChild(stat_el);
					}

					stat_el.title = 'Stream Latency\nFPS: ' + stats.fps + '\nPlayback Rate: ' + stats.playbackRate + ' Kbps';
					el.textContent = stats.hlsLatencyBroadcaster + 's';
				}
			}
		},


		ffzUpdateUptime: function() {
			if ( this._ffz_update_uptime ) {
				clearTimeout(this._ffz_update_uptime);
				delete this._ffz_update_uptime;
			}

			if ( ! f.settings.stream_uptime || ! this.get("controller.isLiveAccordingToKraken") ) {
				var el = this.get('element').querySelector('#ffz-uptime-display');
				if ( el )
					el.parentElement.removeChild(el);
				return;
			}

			// Schedule an update.
			this._ffz_update_uptime = setTimeout(this.ffzUpdateUptime.bind(this), 1000);

			// Determine when the channel last went live.
			var online = this.get("controller.content.stream.created_at");
			online = online && utils.parse_date(online);

			var uptime = online && Math.floor((Date.now() - online.getTime()) / 1000) || -1;
			if ( uptime < 0 ) {
				var el = this.get('element').querySelector('#ffz-uptime-display');
				if ( el )
					el.parentElement.removeChild(el);
				return;
			}

			var el = this.get('element').querySelector('#ffz-uptime-display span');
			if ( ! el ) {
				var cont = this.get('element').querySelector('.stats-and-actions .channel-stats');
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-uptime-display';
				stat.title = "Stream Uptime <nobr>(since " + online.toLocaleString() + ")</nobr>";

				stat.innerHTML = constants.CLOCK + " ";
				el = document.createElement("span");
				stat.appendChild(el);

				var viewers = cont.querySelector(".live-count");
				if ( viewers )
					cont.insertBefore(stat, viewers.nextSibling);
				else {
					try {
						viewers = cont.querySelector("script:nth-child(0n+2)");
						cont.insertBefore(stat, viewers.nextSibling);
					} catch(err) {
						cont.insertBefore(stat, cont.childNodes[0]);
					}
				}

				jQuery(stat).tipsy({html: true});
			}

			el.innerHTML = utils.time_to_string(uptime);
		},

		ffzTeardown: function() {
			var id = this.get('controller.id');
			if ( id )
				f.ws_send("unsub_channel", id);

			this.get('element').setAttribute('data-channel', '');
			f._cindex = undefined;
			if ( this._ffz_update_uptime )
				clearTimeout(this._ffz_update_uptime);

			utils.update_css(f._channel_style, id, null);
		}
	});
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.auto_theater = {
	type: "boolean",
	value: false,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,

	name: "Automatic Theater Mode",
	help: "Automatically enter theater mode when opening a channel."
	};


FFZ.settings_info.chatter_count = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Channel Metadata",

	name: "Chatter Count",
	help: "Display the current number of users connected to chat beneath the channel.",

	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateChatters();

			if ( ! val || ! this.rooms )
				return;

			// Refresh the data.
			for(var room_id in this.rooms)
				this.rooms.hasOwnProperty(room_id) && this.rooms[room_id].room && this.rooms[room_id].room.ffzInitChatterCount();
		}
	};


FFZ.settings_info.channel_views = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Channel Views",
	help: 'Display the number of times the channel has been viewed beneath the stream.',
	on_update: function(val) {
			document.body.classList.toggle("ffz-hide-view-count", !val);
		}
	};


FFZ.settings_info.hosted_channels = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Channel Hosting",
	help: "Display other channels that have been featured by the current channel.",
	on_update: function(val) {
			var cb = document.querySelector('input.ffz-setting-hosted-channels');
			if ( cb )
				cb.checked = val;

			if ( ! this._cindex )
				return;

			var chan = this._cindex.get('controller.model'),
				room = chan && this.rooms && this.rooms[chan.get('id')],
				target = room && room.room && room.room.get('ffz_host_target');
			if ( ! chan || ! room )
				return;

			chan.setHostMode({target: target, delay: 0});
		}
	};


FFZ.settings_info.stream_host_button = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Host This Channel Button",
	help: "Display a button underneath streams that make it easy to host them with your own channel.",
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateHostButton();
		}
	};


FFZ.settings_info.stream_uptime = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Stream Uptime",
	help: 'Display the stream uptime under a channel by the viewer count.',
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzUpdateUptime();
		}
	};


FFZ.settings_info.stream_title = {
	type: "boolean",
	value: true,
	no_bttv: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Title Links",
	help: "Make links in stream titles clickable.",
	on_update: function(val) {
			if ( this._cindex )
				this._cindex.ffzFixTitle();
		}
	};
},{"../constants":5,"../utils":35}],8:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),

	is_android = navigator.userAgent.indexOf('Android') !== -1,

	KEYCODES = {
		BACKSPACE: 8,
		TAB: 9,
		ENTER: 13,
		ESC: 27,
		SPACE: 32,
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		TWO: 50,
		COLON: 59,
		FAKE_COLON: 186
	},

	selection_start = function(e) {
		if ( typeof e.selectionStart === "number" )
			return e.selectionStart;

		if ( ! e.createTextRange )
			return -1;

		var n = document.selection.createRange(),
			r = e.createTextRange();

		r.moveToBookmark(n.getBookmark());
		r.moveStart("character", -e.value.length);
		return r.text.length;
	},

	move_selection = function(e, pos) {
		if ( e.setSelectionRange )
			e.setSelectionRange(pos, pos);
		else if ( e.createTextRange ) {
			var r = e.createTextRange();
			r.move("character", -e.value.length);
			r.move("character", pos);
			r.select();
		}
	};


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.input_quick_reply = {
	type: "boolean",
	value: true,

	category: "Chat Input",
	no_bttv: true,

	name: "Reply to Whispers with /r",
	help: "Automatically replace /r at the start of the line with the command to whisper to the person you've whispered with most recently."
};

FFZ.settings_info.input_mru = {
	type: "boolean",
	value: true,

	category: "Chat Input",
	no_bttv: true,
	
	name: "Chat Input History",
	help: "Use the Up and Down arrows in chat to select previously sent chat messages."
};

FFZ.settings_info.input_emoji = {
	type: "boolean",
	value: false,

	category: "Chat Input",
	//visible: false,
	no_bttv: true,
	
	name: "Enter Emoji By Name",
	help: "Replace emoji that you type by name with the character. :+1: becomes 👍."
};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_chat_input = function() {
	this.log("Hooking the Ember Chat Input controller.");
	var Input = App.__container__.resolve('component:twitch-chat-input'),
		f = this;

	if ( ! Input )
		return;

	this._modify_chat_input(Input);

	if ( this._roomv ) {
		for(var i=0; i < this._roomv._childViews.length; i++) {
			var v = this._roomv._childViews[i];
			if ( v instanceof Input ) {
				this._modify_chat_input(v);
				v.ffzInit();
			}
		}
	}
}


FFZ.prototype._modify_chat_input = function(component) {
	var f = this;
	
	component.reopen({
		ffz_mru_index: -1,
		
		didInsertElement: function() {
			this._super();

			try {
				this.ffzInit();
			} catch(err) { f.error("ChatInput didInsertElement: " + err); }
		},
		
		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) { f.error("ChatInput willClearRender: " + err); }
			return this._super();
		},

		ffzInit: function() {
			f._inputv = this;

			var s = this._ffz_minimal_style = document.createElement('style');
			s.id = 'ffz-minimal-chat-textarea-height';
			document.head.appendChild(s);

			// Redo our key bindings.
			var t = this.$("textarea");
			
			t.off("keydown");
			t.on("keydown", this._ffzKeyDown.bind(this));

			t.attr('rows', 1);

			this.ffzResizeInput();
			setTimeout(this.ffzResizeInput.bind(this), 500);

			/*var suggestions = this._parentView.get('context.model.chatSuggestions');
			this.set('ffz_chatters', suggestions);*/
		},
		
		ffzTeardown: function() {
			if ( f._inputv === this )
				f._inputv = undefined; 

			this.ffzResizeInput();

			if ( this._ffz_minimal_style ) {
				this._ffz_minimal_style.parentElement.removeChild(this._ffz_minimal_style);
				this._ffz_minimal_style = undefined;
			}

			// Reset normal key bindings.
			var t = this.$("textarea");
			
			t.attr('rows', undefined);

			t.off("keydown");
			t.on("keydown", this._onKeyDown.bind(this));
		},

		// Input Control
		
		ffzOnInput: function() {
			if ( ! f._chat_style || ! f.settings.minimal_chat || is_android )
				return;
			
			var now = Date.now(),
				since = now - (this._ffz_last_resize || 0);
			
			if ( since > 500 )
				this.ffzResizeInput();

		}.observes('textareaValue'),
		
		ffzResizeInput: function() {
			this._ffz_last_resize = Date.now();
			
			var el = this.get('element'),
				t = el && el.querySelector('textarea');
			
			if ( ! t || ! f._chat_style || ! f.settings.minimal_chat )
				return;
			
			// Unfortunately, we need to change this with CSS.
			this._ffz_minimal_style.innerHTML = 'body.ffz-minimal-chat .ember-chat .chat-interface .textarea-contain textarea { height: auto !important; }';
			var height = Math.max(32, Math.min(128, t.scrollHeight));				
			this._ffz_minimal_style.innerHTML = 'body.ffz-minimal-chat .ember-chat .chat-interface .textarea-contain textarea { height: ' + height + 'px !important; }';
			
			if ( height !== this._ffz_last_height ) {
				utils.update_css(f._chat_style, "input_height", 'body.ffz-minimal-chat .ember-chat .chat-interface { height: ' + height + 'px !important; }' +
					'body.ffz-minimal-chat .ember-chat .chat-messages, body.ffz-minimal-chat .ember-chat .chat-interface .emoticon-selector { bottom: ' + height + 'px !important; }');
				f._roomv && f._roomv.get('stuckToBottom') && f._roomv._scrollToBottom();
			}

			this._ffz_last_height = height;
		},
		
		_ffzKeyDown: function(event) {
			var e = event || window.event,
				key = e.charCode || e.keyCode;

			switch(key) {
				case KEYCODES.UP:
				case KEYCODES.DOWN:
					if ( e.shiftKey || e.shiftLeft || e.ctrlKey || e.metaKey )
						return;
					else if ( this.get("isShowingSuggestions") )
						e.preventDefault();
					else if ( f.settings.input_mru )
						Ember.run.next(this.ffzCycleMRU.bind(this, key, selection_start(this.get("chatTextArea"))));
					else
						return this._onKeyDown(event);
					break;
					
				case KEYCODES.SPACE:
					if ( f.settings.input_quick_reply && selection_start(this.get("chatTextArea")) === 2 && this.get("textareaValue").substring(0,2) === "/r" ) {
						var t = this;
						Ember.run.next(function() {
							var wt = t.get("uniqueWhisperSuggestions.0");
							if ( wt ) {
								var text = "/w " + wt + t.get("textareaValue").substr(2);
								t.set("_currentWhisperTarget", 0);
								t.set("textareaValue", text);
								
								Ember.run.next(function() {
									move_selection(t.get('chatTextArea'), 4 + wt.length);
								});
							}
						});
					} else
						return this._onKeyDown(event);
					break;
				
				case KEYCODES.COLON:
				case KEYCODES.FAKE_COLON:
					if ( f.settings.input_emoji && (e.shiftKey || e.shiftLeft) ) {
						var t = this,
							ind = selection_start(this.get("chatTextArea"));

						ind > 0 && Ember.run.next(function() {
							var text = t.get("textareaValue"),
								emoji_start = text.lastIndexOf(":", ind - 1);

							if ( emoji_start !== -1 && ind !== -1 && text.charAt(ind) === ":" ) {
								var match = text.substr(emoji_start + 1, ind-emoji_start - 1),
									emoji_id = f.emoji_names[match],
									emoji = f.emoji_data[emoji_id];

								if ( emoji ) {
									var prefix = text.substr(0, emoji_start) + emoji.raw;
									t.set('textareaValue', prefix + text.substr(ind + 1));
									Ember.run.next(function() {
										move_selection(t.get('chatTextArea'), prefix.length);
									});
								}
							}
						});
						return;
					}
					return this._onKeyDown(event);
					
				case KEYCODES.ENTER:
					if ( ! e.shiftKey && ! e.shiftLeft )
						this.set('ffz_mru_index', -1);
					
				default:
					return this._onKeyDown(event);
			}
		},
		
		ffzCycleMRU: function(key, start_ind) {
			// We don't want to do this if the keys were just moving the cursor around.
			var cur_pos = selection_start(this.get("chatTextArea"));
			if ( start_ind !== cur_pos )
				return;
			
			var ind = this.get('ffz_mru_index'),
				mru = this._parentView.get('context.model.mru_list') || [];

			if ( key === KEYCODES.UP )
				ind = (ind + 1) % (mru.length + 1);
			else
				ind = (ind + mru.length) % (mru.length + 1);

			var old_val = this.get('ffz_old_mru');
			if ( old_val === undefined || old_val === null ) {
				old_val = this.get('textareaValue');
				this.set('ffz_old_mru', old_val);
			}

			var new_val = mru[ind];
			if ( new_val === undefined ) {
				this.set('ffz_old_mru', undefined);
				new_val = old_val;
			}

			this.set('ffz_mru_index', ind);
			this.set('textareaValue', new_val);
		},

		completeSuggestion: function(e) {
			var r, n, i = this,
				o = this.get("textareaValue"),
				a = this.get("partialNameStartIndex");

			r = o.substring(0, a) + (o.charAt(0) === "/" ? e : FFZ.get_capitalization(e));
			n = o.substring(a + this.get("partialName").length);
			if ( ! n )
				r += " ";

			this.set("textareaValue", r + n);
			this.set("isShowingSuggestions", false);
			this.set("partialName", "");
			this.trackSuggestionsCompleted();
			Ember.run.next(function() {
				move_selection(i.get('chatTextArea'), r.length);
			});
		}

		/*ffz_emoticons: function() {
			var output = [],

				room = this._parentView.get('context.model'),
				room_id = room && room.get('id'),
				tmi = room && room.tmiSession,

				user = f.get_user(),
				ffz_sets = f.getEmotes(user && user.login, room_id);

			if ( tmi ) {
				var es = tmi.getEmotes();
				if ( es && es.emoticon_sets ) {
					for(var set_id in es.emoticon_sets) {
						var emote_set = es.emoticon_sets[set_id];
						for(var emote_id in emote_set) {
							if ( emote_set[emote_id] ) {
								var code = emote_set[emote_id].code;
								output.push({id: constants.KNOWN_CODES[code] || code});
							}
						}
					}
				}
			}

			for(var i=0; i < ffz_sets.length; i++) {
				var emote_set = f.emote_sets[ffz_sets[i]];
				if ( ! emote_set )
					continue;

				for(var emote_id in emote_set.emoticons) {
					var emote = emote_set.emoticons[emote_id];
					if ( ! emote.hidden )
						output.push({id:emote.name});
				}
			}
			
			return output; 	
		}.property(),

		ffz_chatters: [],

		suggestions: function(key, value, previousValue) {
			if ( arguments.length > 1 ) {
				this.set('ffz_chatters', value);
			}
			
			var output = [];
			
			// Chatters
			output = output.concat(this.get('ffz_chatters'));
			
			// Emoticons
			if ( this.get('isSuggestionsTriggeredWithTab') ) {
				output = output.concat(this.get('ffz_emoticons'));
			}
			
			return output;
		}.property("ffz_emoticons", "ffz_chatters", "isSuggestionsTriggeredWithTab")*/
	});
}
},{"../constants":5,"../utils":35}],9:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.minimal_chat = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",

	name: "Minimalistic Chat",
	help: "Hide all of the chat user interface, only showing messages and an input box.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-minimal-chat", val);
			if ( this.settings.group_tabs && this._chatv && this._chatv._ffz_tabs ) {
				var f = this;
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
					f._roomv && f._roomv.get('stuckToBottom') && f._roomv._scrollToBottom();
				},0);
			}

			if ( this._chatv && this._chatv.get('controller.showList') )
				this._chatv.set('controller.showList', false);

			// Remove the style if we have it.
			if ( ! val && this._chat_style ) {
				if ( this._inputv ) {
					if ( this._inputv._ffz_minimal_style )
						this._inputv._ffz_minimal_style.innerHTML = '';

					this._inputv._ffz_last_height = undefined;
				}

				utils.update_css(this._chat_style, "input_height", '');
				this._roomv && this._roomv.get('stuckToBottom') && this._roomv._scrollToBottom();

			} else if ( this._inputv )
				this._inputv.ffzResizeInput();
		}
	};


FFZ.settings_info.remove_deleted = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Filtering",
	name: "Remove Deleted Messages",
	help: "Remove deleted messages from chat entirely rather than leaving behind a clickable &lt;deleted message&gt;.",

	on_update: function(val) {
			if ( this.has_bttv || ! this.rooms || ! val )
				return;

			for(var room_id in this.rooms) {
				var ffz_room = this.rooms[room_id],
					room = ffz_room && ffz_room.room;
				if ( ! room )
					continue;

				var msgs = room.get('messages'),
					total = msgs.get('length'),
					i = total,
					alternate;

				while(i--) {
					var msg = msgs.get(i);

					if ( msg.ffz_deleted || msg.deleted ) {
						if ( alternate === undefined )
							alternate = msg.ffz_alternate;
						msgs.removeAt(i);
						continue;
					}

					if ( alternate === undefined )
						alternate = msg.ffz_alternate;
					else {
						alternate = ! alternate;
						room.set('messages.' + i + '.ffz_alternate', alternate);
					}
				}
			}
		}
	};


FFZ.settings_info.prevent_clear = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Filtering",
	name: "Show Deleted Messages",
	help: "Fade deleted messages instead of replacing them, and prevent chat from being cleared.",

	on_update: function(val) {
			if ( this.has_bttv || ! this.rooms )
				return;

			for(var room_id in this.rooms) {
				var ffz_room = this.rooms[room_id],
					room = ffz_room && ffz_room.room;
				if ( ! room )
					continue;

				room.get("messages").forEach(function(s, n) {
					if ( val && ! s.ffz_deleted && s.deleted )
						room.set("messages." + n + ".deleted", false);

					else if ( s.ffz_deleted && ! val && ! s.deleted )
						room.set("messages." + n + ".deleted", true);
				});
			}
		}
	};

FFZ.settings_info.chat_history = {
	type: "boolean",
	value: true,

	visible: false,
	category: "Chat Appearance",
	name: "Chat History <span>Alpha</span>",
	help: "Load previous chat messages when loading a chat room so you can see what people have been talking about. <b>This currently only works in a handful of channels due to server capacity.</b>",
	};

FFZ.settings_info.group_tabs = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Moderation",
	name: "Chat Room Tabs <span>Beta</span>",
	help: "Enhanced UI for switching the current chat room and noticing new messages.",

	on_update: function(val) {
			var enabled = !this.has_bttv && val;
			if ( ! this._chatv || enabled === this._group_tabs_state )
				return;

			if ( enabled )
				this._chatv.ffzEnableTabs();
			else
				this._chatv.ffzDisableTabs();
		}
	};


FFZ.settings_info.pinned_rooms = {
	value: [],
	visible: false,
	};

FFZ.settings_info.visible_rooms = {
	value: [],
	visible: false,
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_chatview = function() {
	document.body.classList.toggle("ffz-minimal-chat", this.settings.minimal_chat);

	this.log("Hooking the Ember Chat controller.");

	var Chat = App.__container__.lookup('controller:chat'),
		f = this;

	if ( Chat ) {
		Chat.reopen({
			ffzUpdateChannels: function() {
				if ( ! f._chatv )
					return;

				f._chatv.ffzRebuildMenu();
				if ( f.settings.group_tabs )
					f._chatv.ffzRebuildTabs();

			}.observes("currentChannelRoom", "connectedPrivateGroupRooms"),

			removeCurrentChannelRoom: function() {
				if ( ! f.settings.group_tabs || f.has_bttv )
					return this._super();

				var room = this.get("currentChannelRoom"),
					room_id = room && room.get('id'),
					user = f.get_user();

				if ( ! f.settings.pinned_rooms || f.settings.pinned_rooms.indexOf(room_id) === -1 ) {
					if ( room === this.get("currentRoom") )
						this.blurRoom();

					// Don't destroy it if it's the user's room.
					if ( room && user && user.login === room_id )
						room.destroy();
				}

				this.set("currentChannelRoom", void 0);
			}
		});
	}


	this.log("Hooking the Ember Chat view.");

	var Chat = App.__container__.resolve('view:chat');
	this._modify_cview(Chat);

	// For some reason, this doesn't work unless we create an instance of the
	// chat view and then destroy it immediately.
	try {
		Chat.create().destroy();
	} catch(err) { }

	// Modify all existing Chat views.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof Chat) )
			continue;

		this.log("Manually updating existing Chat view.", view);
		try {
			view.ffzInit();
		} catch(err) {
			this.error("setup: build_ui_link: " + err);
		}
	}


	this.log("Hooking the Ember 'Right Column' controller. Seriously...");
	var Column = App.__container__.lookup('controller:right-column');
	if ( ! Column )
		return;

	Column.reopen({
		ffzFixTabs: function() {
			if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs ) {
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
				},0);
			}
		}.observes("firstTabSelected")
	});
}


// --------------------
// Modify Chat View
// --------------------

FFZ.prototype._modify_cview = function(view) {
	var f = this;

	view.reopen({
		didInsertElement: function() {
			this._super();

			try {
				this.ffzInit();
			} catch(err) {
				f.error("ChatView didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("ChatView willClearRender: " + err);
			}
			this._super();
		},

		ffzInit: function() {
			f._chatv = this;
			this.$('.textarea-contain').append(f.build_ui_link(this));
			this.$('.chat-messages').find('.html-tooltip').tipsy({live: true, html: true, gravity: jQuery.fn.tipsy.autoNS});

			if ( !f.has_bttv && f.settings.group_tabs )
				this.ffzEnableTabs();

			this.ffzRebuildMenu();

			setTimeout(function() {
				if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs )
					f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");

				var controller = f._chatv.get('controller');
				controller && controller.set('showList', false);
			}, 1000);
		},

		ffzTeardown: function() {
			if ( f._chatv === this )
				f._chatv = null;

			this.$('.textarea-contain .ffz-ui-toggle').remove();

			if ( f.settings.group_tabs )
				this.ffzDisableTabs();
		},

		ffzChangeRoom: Ember.observer('controller.currentRoom', function() {
			f.update_ui_link();

			var room = this.get('controller.currentRoom'), rows;
			room && room.resetUnreadCount();

			if ( this._ffz_chan_table ) {
				rows = jQuery(this._ffz_chan_table);
				rows.children('.ffz-room-row').removeClass('active');
				if ( room )
					rows.children('.ffz-room-row[data-room="' + room.get('id') + '"]').addClass('active').children('span').text('');
			}

			if ( this._ffz_group_table ) {
				rows = jQuery(this._ffz_group_table);
				rows.children('.ffz-room-row').removeClass('active');
				if ( room )
					rows.children('.ffz-room-row[data-room="' + room.get('id') + '"]').addClass('active').children('span').text('');
			}

			if ( !f.has_bttv && f.settings.group_tabs && this._ffz_tabs ) {
				var tabs = jQuery(this._ffz_tabs);
				tabs.children('.ffz-chat-tab').removeClass('active');
				if ( room && room._ffz_tab ) {
					room._ffz_tab.classList.remove('tab-mentioned');
					room._ffz_tab.classList.remove('hidden');
					room._ffz_tab.classList.add('active');
					var sp = room._ffz_tab.querySelector('span');
					if ( sp )
						sp.innerHTML = '';
				}

				// Invite Link
				var can_invite = room && room.get('canInvite');
				this._ffz_invite && this._ffz_invite.classList.toggle('hidden', !can_invite);
				this.set('controller.showInviteUser', can_invite && this.get('controller.showInviteUser'))

				// Now, adjust the chat-room.
				this.$('.chat-room').css('top', this._ffz_tabs.offsetHeight + "px");
			}
		}),

		// Better Menu

		ffzRebuildMenu: function() {
			return;

			var el = this.get('element'),
				room_list = el && el.querySelector('.chat-rooms .tse-content');

			if ( ! room_list )
				return;

			if ( ! room_list.classList.contains('ffz-room-list') ) {
				room_list.classList.add('ffz-room-list');

				// Find the Pending Invitations
				var headers = room_list.querySelectorAll('.list-header'),
					hdr = headers.length ? headers[headers.length-1] : undefined;

				if ( hdr ) {
					hdr.classList.add('ffz');
					if ( hdr.nextSibling && hdr.nextSibling.classList )
						hdr.nextSibling.classList.add('ffz');
				}
			}


			// Channel Table
			var t = this,
				chan_table = this._ffz_chan_table || room_list.querySelector('#ffz-channel-table tbody');

			if ( ! chan_table ) {
				var tbl = document.createElement('table');
				tbl.setAttribute('cellspacing', 0);
				tbl.id = 'ffz-channel-table';
				tbl.className = 'ffz';
				tbl.innerHTML = '<thead><tr><th colspan="2">Channels</th><th class="ffz-row-switch">Join</th><th class="ffz-row-switch">Pin</th></tr></thead><tbody></tbody>';
				room_list.insertBefore(tbl, room_list.firstChild);

				chan_table = this._ffz_chan_table = tbl.querySelector('tbody');
			}

			chan_table.innerHTML = '';

			// Current Channel
			var room = this.get('controller.currentChannelRoom'), row;
			if ( room ) {
				row = this.ffzBuildRow(this, room, true);
				row && chan_table.appendChild(row);
			}

			// Host Target
			if ( this._ffz_host_room ) {
				row = this.ffzBuildRow(this, this._ffz_host_room, false, true);
				row && chan_table.appendChild(row);
			}

			// Pinned Rooms
			for(var i=0; i < f.settings.pinned_rooms.length; i++) {
				var room_id = f.settings.pinned_rooms[i];
				if ( room && room.get('id') !== room_id && this._ffz_host !== room_id && f.rooms[room_id] && f.rooms[room_id].room ) {
					row = this.ffzBuildRow(this, f.rooms[room_id].room);
					row && chan_table.appendChild(row);
				}
			}


			// Group Chat Table
			var group_table = this._ffz_group_table || room_list.querySelector('#ffz-group-table tbody');
			if ( ! group_table ) {
				var tbl = document.createElement('table');
				tbl.setAttribute('cellspacing', 0);
				tbl.id = 'ffz-group-table';
				tbl.className = 'ffz';
				tbl.innerHTML = '<thead><tr><th colspan="2">Group Chats</th><th class="ffz-row-switch">Pin</th></tr></thead><tbody></tbody>';

				var before = room_list.querySelector('#ffz-channel-table');
				room_list.insertBefore(tbl, before.nextSibling);

				group_table = this._ffz_group_table = tbl.querySelector('tbody');
			}

			group_table.innerHTML = '';

			_.each(this.get('controller.connectedPrivateGroupRooms'), function(room) {
				var row = t.ffzBuildRow(t, room);
				row && group_table && group_table.appendChild(row);
			});


			// Change Create Tooltip
			var create_btn = el.querySelector('.button.create');
			if ( create_btn )
				create_btn.title = 'Create a Group Room';
		},

		ffzBuildRow: function(view, room, current_channel, host_channel) {
			var row = document.createElement('tr'),
				icon = document.createElement('td'),
				name_el = document.createElement('td'),

				btn,
				toggle_pinned = document.createElement('td'),
				toggle_visible = document.createElement('td'),

				group = room.get('isGroupRoom'),
				current = room === view.get('controller.currentRoom'),
				//unread = format_unread(current ? 0 : room.get('unreadCount')),

				name = room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room.get('id'), function(name) {
					f.log("Name for Row: " + name);
					//unread = format_unread(current ? 0 : room.get('unreadCount'));
					name_el.innerHTML = utils.sanitize(name);
				}));

			name_el.className = 'ffz-room';
			name_el.innerHTML = utils.sanitize(name);

			if ( current_channel ) {
				icon.innerHTML = constants.CAMERA;
				icon.title = name_el.title = "Current Channel";
				icon.className = name_el.className = 'tooltip';
			} else if ( host_channel ) {
				icon.innerHTML = constants.EYE;
				icon.title = name_el.title = "Hosted Channel";
				icon.className = name_el.className = 'tooltip';
			}

			toggle_pinned.className = toggle_visible.className = 'ffz-row-switch';

			toggle_pinned.innerHTML = '<a class="switch' + (f.settings.pinned_rooms.indexOf(room.get('id')) !== -1 ? ' active' : '') + '"><span></span></a>';
			toggle_visible.innerHTML = '<a class="switch' + (f.settings.visible_rooms.indexOf(room.get('id')) !== -1 ? ' active' : '') + '"><span></span></a>';

			row.setAttribute('data-room', room.get('id'));

			row.className = 'ffz-room-row';
			row.classList.toggle('current-channel', current_channel);
			row.classList.toggle('host-channel', host_channel);
			row.classList.toggle('group-chat', group);
			row.classList.toggle('active', current);

			row.appendChild(icon);
			row.appendChild(name_el);

			if ( ! group ) {
				row.appendChild(toggle_pinned);
				btn = toggle_pinned.querySelector('a.switch');
				btn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation && e.stopPropagation();

					var room_id = room.get('id'),
						is_pinned = f.settings.pinned_rooms.indexOf(room_id) !== -1;

					if ( is_pinned )
						f._leave_room(room_id);
					else
						f._join_room(room_id);

					this.classList.toggle('active', !is_pinned);
				});
			} else {
				btn = document.createElement('a');
				btn.className = 'leave-chat tooltip';
				btn.innerHTML = constants.CLOSE;
				btn.title = 'Leave Group';

				name_el.appendChild(btn);

				btn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation && e.stopPropagation();

					if ( ! confirm('Are you sure you want to leave the group room "' + name + '"?') )
						return;

					room.get('isGroupRoom') && room.del();
				});
			}

			row.appendChild(toggle_visible);
			btn = toggle_visible.querySelector('a.switch');
			btn.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation && e.stopPropagation();

				var room_id = room.get('id'),
					visible_rooms = f.settings.visible_rooms,
					is_visible = visible_rooms.indexOf(room_id) !== -1;

				if ( is_visible )
					visible_rooms.removeObject(room_id);
				else
					visible_rooms.push(room_id);

				f.settings.set('visible_rooms', visible_rooms);
				this.classList.toggle('active', !is_visible);
				view.ffzRebuildTabs();
			});

			row.addEventListener('click', function() {
				var controller = view.get('controller');
				controller.focusRoom(room);
				controller.set('showList', false);
			});

			return row;
		},

		// Group Tabs~!

		ffzEnableTabs: function() {
			if ( f.has_bttv || ! f.settings.group_tabs )
				return;

			// Hide the existing chat UI.
			this.$(".chat-header").addClass("hidden");

			// Create our own UI.
			var tabs = this._ffz_tabs = document.createElement("div");
			tabs.id = "ffz-group-tabs";
			this.$(".chat-header").after(tabs);

			// List the Rooms
			this.ffzRebuildTabs();
		},

		ffzRebuildTabs: function() {
			if ( f.has_bttv || ! f.settings.group_tabs )
				return;

			var tabs = this._ffz_tabs || this.get('element').querySelector('#ffz-group-tabs');
			if ( ! tabs )
				return;

			tabs.innerHTML = "";

			var link = document.createElement('a'),
				view = this;

			link.className = 'button glyph-only tooltip';
			link.title = "Chat Room Management";
			link.innerHTML = constants.ROOMS;

			link.addEventListener('click', function() {
				var controller = view.get('controller');
				controller && controller.set('showList', !controller.get('showList'));
			});

			tabs.appendChild(link);


			link = document.createElement('a'),
			link.className = 'button glyph-only tooltip invite';
			link.title = "Invite a User";
			link.innerHTML = constants.INVITE;

			link.addEventListener('click', function() {
				var controller = view.get('controller');
				controller && controller.set('showInviteUser', controller.get('currentRoom.canInvite') && !controller.get('showInviteUser'));
			});

			link.classList.toggle('hidden', !this.get("controller.currentRoom.canInvite"));
			view._ffz_invite = link;
			tabs.appendChild(link);

			var room = this.get('controller.currentChannelRoom'), tab;
			if ( room ) {
				tab = this.ffzBuildTab(view, room, true);
				tab && tabs.appendChild(tab);
			}

			// Check Host Target
			var Channel = App.__container__.lookup('controller:channel'),
				Room = App.__container__.resolve('model:room');
				target = Channel && Channel.get('hostModeTarget');

			if ( target && Room ) {
				var target_id = target.get('id');
				if ( this._ffz_host !== target_id ) {
					if ( f.settings.pinned_rooms.indexOf(this._ffz_host) === -1 && this._ffz_host_room ) {
						if ( this.get('controller.currentRoom') === this._ffz_host_room )
							this.get('controller').blurRoom();
						this._ffz_host_room.destroy();
					}

					this._ffz_host = target_id;
					this._ffz_host_room = Room.findOne(target_id);
				}
			} else if ( this._ffz_host ) {
				if ( f.settings.pinned_rooms.indexOf(this._ffz_host) === -1 && this._ffz_host_room ) {
					if ( this.get('controller.currentRoom') === this._ffz_host_room )
						this.get('controller').blurRoom();
					this._ffz_host_room.destroy();
				}

				delete this._ffz_host;
				delete this._ffz_host_room;
			}

			if ( this._ffz_host_room ) {
				tab = view.ffzBuildTab(view, this._ffz_host_room, false, true);
				tab && tabs.appendChild(tab);
			}

			// Pinned Rooms
			for(var i=0; i < f.settings.pinned_rooms.length; i++) {
				var room_id = f.settings.pinned_rooms[i];
				if ( room && room.get('id') !== room_id && this._ffz_host !== room_id && f.rooms[room_id] && f.rooms[room_id].room ) {
					var tab = view.ffzBuildTab(view, f.rooms[room_id].room, false, false);
					tab && tabs.appendChild(tab);
				}
			}

			_.each(this.get('controller.connectedPrivateGroupRooms'), function(room) {
				var tab = view.ffzBuildTab(view, room);
				tab && tabs.appendChild(tab);
			});

			// Now, adjust the chat-room.
			this.$('.chat-room').css('top', tabs.offsetHeight + "px");
		},

		ffzTabUnread: function(room_id) {
			// TODO: Update menu.

			if ( f.has_bttv || ! f.settings.group_tabs )
				return;

			var tabs = this._ffz_tabs || this.get('element').querySelector('#ffz-group-tabs'),
				current_id = this.get('controller.currentRoom.id');

			if ( ! tabs )
				return;

			if ( room_id ) {
				var room = f.rooms && f.rooms[room_id] && f.rooms[room_id].room,
					tab = room && room._ffz_tab;

				if ( tab ) {
					var unread = utils.format_unread(room_id === current_id ? 0 : room.get('unreadCount'));
					tab.querySelector('span').innerHTML = unread;
				}
			}

			var children = tabs.querySelectorAll('.ffz-chat-tab');
			for(var i=0; i < children.length; i++) {
				var tab = children[i],
					room_id = tab.getAttribute('data-room'),
					room = f.rooms && f.rooms[room_id] && f.rooms[room_id];

				if ( ! room )
					continue;

				var unread = utils.format_unread(room_id === current_id ? 0 : room.room.get('unreadCount'));
				tab.querySelector('span').innerHTML = unread;
			}
		},

		ffzBuildTab: function(view, room, current_channel, host_channel) {
			var tab = document.createElement('span'), name, unread, icon = '',
				room_id = room.get('id'),
				group = room.get('isGroupRoom'),
				current = room === view.get('controller.currentRoom'),
				visible = current || f.settings.visible_rooms.indexOf(room_id) !== -1;

			tab.setAttribute('data-room', room.id);

			tab.className = 'ffz-chat-tab tooltip';
			//tab.classList.toggle('hidden', ! visible);
			tab.classList.toggle('current-channel', current_channel);
			tab.classList.toggle('host-channel', host_channel);
			tab.classList.toggle('group-chat', group);
			tab.classList.toggle('active', current);

			unread = utils.format_unread(current ? 0 : room.get('unreadCount'));

			name = room.get('tmiRoom.displayName') || (group ? room.get('tmiRoom.name') : FFZ.get_capitalization(room.get('id'), function(name) {
				unread = utils.format_unread(current ? 0 : room.get('unreadCount'));
				tab.innerHTML = icon + utils.sanitize(name) + '<span>' + unread + '</span>';
			}));

			if ( current_channel ) {
				icon = constants.CAMERA;
				tab.title = "Current Channel";
			} else if ( host_channel ) {
				icon = constants.EYE;
				tab.title = "Hosted Channel";
			} else if ( group )
				tab.title = "Group Chat";
			else
				tab.title = "Pinned Channel";

			tab.innerHTML = icon + utils.sanitize(name) + '<span>' + unread + '</span>';

			tab.addEventListener('click', function() {
				var controller = view.get('controller');
				controller.focusRoom(room);
				controller.set('showList', false);
				});

			room._ffz_tab = tab;
			return tab;
		},

		ffzDisableTabs: function() {
			if ( this._ffz_tabs ) {
				this._ffz_tabs.parentElement.removeChild(this._ffz_tabs);
				delete this._ffz_tabs;
				delete this._ffz_invite;
			}

			if ( this._ffz_host ) {
				if ( f.settings.pinned_rooms.indexOf(this._ffz_host) === -1 && this._ffz_host_room ) {
					if ( this.get('controller.currentRoom') === this._ffz_host_room )
						this.get('controller').blurRoom();
					this._ffz_host_room.destroy();
				}

				delete this._ffz_host;
				delete this._ffz_host_room;
			}

			// Show the old chat UI.
			this.$('.chat-room').css('top', '');
			this.$(".chat-header").removeClass("hidden");
		},
	});
}


// ----------------------
// Chat Room Connections
// ----------------------

FFZ.prototype.connect_extra_chat = function() {
	var user = this.get_user();
	if ( user && user.login ) {
		// Make sure we're in the user's room.
		if ( ! this.rooms[user.login] || this.rooms[user.login].room ) {
			var Room = App.__container__.resolve('model:room'),
				r = Room && Room.findOne(user.login);
		}
	}

	if ( this.has_bttv )
		return;

	for(var i=0; i < this.settings.pinned_rooms.length; i++)
		this._join_room(this.settings.pinned_rooms[i], true);

	if ( ! this._chatv )
		return;

	if ( ! this.has_bttv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	this._chatv.ffzRebuildMenu();
}


FFZ.prototype._join_room = function(room_id, no_rebuild) {
	var did_join = false;
	if ( this.settings.pinned_rooms.indexOf(room_id) === -1 ) {
		this.settings.pinned_rooms.push(room_id);
		this.settings.set("pinned_rooms", this.settings.pinned_rooms);
		did_join = true;
	}

	// Make sure we're not already there.
	if ( this.rooms[room_id] && this.rooms[room_id].room ) {
		if ( did_join && ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
			this._chatv.ffzRebuildTabs();
		return did_join;
	}

	// Okay, fine. Get it.
	var Room = App.__container__.resolve('model:room'),
		r = Room && Room.findOne(room_id);

	// Finally, rebuild the chat UI.
	if ( ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	if ( ! no_rebuild && this._chatv )
		this._chatv.ffzRebuildMenu();

	return did_join;
}


FFZ.prototype._leave_room = function(room_id, no_rebuild) {
	var did_leave = false;
	if ( this.settings.pinned_rooms.indexOf(room_id) !== -1 ) {
		this.settings.pinned_rooms.removeObject(room_id);
		this.settings.set("pinned_rooms", this.settings.pinned_rooms);
		did_leave = true;
	}

	if ( ! this.rooms[room_id] || ! this.rooms[room_id].room )
		return did_leave;

	var Chat = App.__container__.lookup('controller:chat'),
		r = this.rooms[room_id].room,
		user = this.get_user();

	if ( ! Chat || Chat.get('currentChannelRoom.id') === room_id || (this._chatv && this._chatv._ffz_host === room_id) )
		return did_leave;

	if ( Chat.get('currentRoom.id') === room_id )
		Chat.blurRoom();

	// Don't leave the user's room, but update the UI.
	if ( ! user || user.login !== room_id )
		r.destroy();

	if ( ! no_rebuild && ! this.has_bttv && this._chatv && this.settings.group_tabs )
		this._chatv.ffzRebuildTabs();

	if ( ! no_rebuild && this._chatv )
		this._chatv.ffzRebuildMenu();

	return did_leave;
}


// ----------------------
// Commands
// ----------------------

FFZ.chat_commands.join = function(room, args) {
	if ( ! args || ! args.length || args.length > 1 )
		return "Join Usage: /join <channel>";

	var room_id = args[0].toLowerCase();
	if ( room_id.charAt(0) === "#" )
		room_id = room_id.substr(1);

	if ( this._join_room(room_id) )
		return "Joining " + room_id + ". You will always connect to this channel's chat unless you later /part from it.";
	else
		return "You have already joined " + room_id + ". Please use \"/part " + room_id + "\" to leave it.";
}


FFZ.chat_commands.part = function(room, args) {
	if ( ! args || ! args.length || args.length > 1 )
		return "Part Usage: /part <channel>";

	var room_id = args[0].toLowerCase();
	if ( room_id.charAt(0) === "#" )
		room_id = room_id.substr(1);

	if ( this._leave_room(room_id) )
		return "Leaving " + room_id + ".";
	else if ( this.rooms[room_id] )
		return "You do not have " + room_id + " pinned and you cannot leave the current channel or hosted channels via /part.";
	else
		return "You are not in " + room_id + ".";
}
},{"../constants":5,"../utils":35}],10:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Settings
// --------------------

FFZ.settings_info.swap_sidebars = {
	type: "boolean",
	value: false,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,
	
	name: "Swap Sidebar Positions",
	help: "Swap the positions of the left and right sidebars, placing chat on the left.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-sidebar-swap", val);
			this._fix_menu_position();
		}
	};


FFZ.settings_info.right_column_width = {
	type: "button",
	value: 340,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,
	
	name: "Right Sidebar Width",
	help: "Set the width of the right sidebar for chat.",
	
	method: function() {
			var old_val = this.settings.right_column_width || 340,
				new_val = prompt("Right Sidebar Width\n\nPlease enter a new width for the right sidebar, in pixels. Minimum: 250, Default: 340", old_val);
			
			if ( new_val === null || new_val === undefined )
				return;
			
			var width = parseInt(new_val);
			if ( ! width || width === NaN )
				width = 340;

			this.settings.set('right_column_width', Math.max(250, width));
		},

	on_update: function(val) {
			if ( this.has_bttv )
				return;
			
			var Layout = App.__container__.lookup('controller:layout');
			if ( ! Layout )
				return;
			
			Layout.set('rightColumnWidth', val);
			Ember.propertyDidChange(Layout, 'contentWidth');
		}
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_layout = function() {
	if ( this.has_bttv )
		return;

	document.body.classList.toggle("ffz-sidebar-swap", this.settings.swap_sidebars);

	this.log("Creating layout style element.");
	var s = this._layout_style = document.createElement('style');
	s.id = 'ffz-layout-css';
	document.head.appendChild(s);

	this.log("Hooking the Ember Layout controller.");
	var Layout = App.__container__.lookup('controller:layout'),
		f = this;

	if ( ! Layout )
		return;

	Layout.reopen({
		rightColumnWidth: 340,
		
		isTooSmallForRightColumn: function() {
			return this.get("windowWidth") < (1090 - this.get('rightColumnWidth'))
		}.property("windowWidth", "rightColumnWidth"),
		
		contentWidth: function() {
			var left_width = this.get("isLeftColumnClosed") ? 50 : 240,
				right_width = this.get("isRightColumnClosed") ? 0 : this.get("rightColumnWidth");

			return this.get("windowWidth") - left_width - right_width - 60;
			
		}.property("windowWidth", "isRightColumnClosed", "isLeftColumnClosed", "rightColumnWidth"),
		
		/*ffzUpdateWidth: _.throttle(function() {
			var rc = document.querySelector('#right_close');
			if ( ! rc )
				return;
			
			var left_width = this.get("isLeftColumnClosed") ? 50 : 240,
				right_width;
			
			if ( f.settings.swap_sidebars )
				right_width = rc.offsetLeft; // + this.get('rightColumnWidth') - 5;
			else
				right_width = document.body.offsetWidth - rc.offsetLeft - left_width - 25;
			
			if ( right_width < 250 ) {
				// Close it!
				
			}

			this.set('rightColumnWidth', right_width);
			Ember.propertyDidChange(Layout, 'contentWidth');
		}, 200),*/
		
		ffzUpdateCss: function() {
			var width = this.get('rightColumnWidth');
			
			f._layout_style.innerHTML = '#main_col.expandRight #right_close { left: none !important; } #right_col { width: ' + width + 'px; } body:not(.ffz-sidebar-swap) #main_col:not(.expandRight) { margin-right: ' + width + 'px; } body.ffz-sidebar-swap #main_col:not(.expandRight) { margin-left: ' + width + 'px; }';

		}.observes("rightColumnWidth"),
		
		ffzFixTabs: function() {
			if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs ) {
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
				},0);
			}
		}.observes("isRightColumnClosed", "rightColumnWidth")
	});

	/*
	// Try modifying the closer.
	var rc = jQuery("#right_close");
	if ( ! rc || ! rc.length )
		return;

	rc.draggable({
		axis: "x",
		drag: Layout.ffzUpdateWidth.bind(Layout),
		stop: Layout.ffzUpdateWidth.bind(Layout)
		});*/


	// Force the layout to update.
	Layout.set('rightColumnWidth', this.settings.right_column_width);
	Ember.propertyDidChange(Layout, 'contentWidth');
}
},{}],11:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*");


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.room_status = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Room Status Indicators",
	help: "Display the current room state (slow mode, sub mode, and r9k mode) next to the Chat button.",

	on_update: function() {
			if ( this._roomv )
				this._roomv.ffzUpdateStatus();
		}
	};


FFZ.settings_info.line_purge_icon = {
	type: "boolean",
	value: false,

	no_bttv: true,
	category: "Chat Moderation",

	name: "Purge Icon in Mod Icons",
	help: "Display a Purge Icon in chat line Mod Icons for quickly purging users.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-chat-purge-icon", val);
		}
	};


FFZ.settings_info.replace_bad_emotes = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Fix Low Quality Twitch Global Emoticons",
	help: "Replace emoticons such as DansGame and RedCoat with cleaned up versions that don't have pixels around the edges or white backgrounds for nicer display on dark chat."
	};


FFZ.settings_info.parse_emoji = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",

	name: "Replace Emoji with Images",
	help: "Replace emoji in chat messages with nicer looking images from the open-source Twitter Emoji project."
	};


FFZ.settings_info.room_status = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Room Status Indicators",
	help: "Display the current room state (slow mode, sub mode, and r9k mode) next to the Chat button.",

	on_update: function() {
			if ( this._roomv )
				this._roomv.ffzUpdateStatus();
		}
	};


FFZ.settings_info.scrollback_length = {
	type: "button",
	value: 150,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Scrollback Length",
	help: "Set the maximum number of lines to keep in chat.",

	method: function() {
			var new_val = prompt("Scrollback Length\n\nPlease enter a new maximum length for the chat scrollback. Default: 150\n\nNote: Making this too large will cause your browser to lag.", this.settings.scrollback_length);
			if ( new_val === null || new_val === undefined )
				return;

			new_val = parseInt(new_val);
			if ( new_val === NaN )
				return;

			if ( new_val < 10 )
				new_val = 10;

			this.settings.set("scrollback_length", new_val);

			// Update our everything.
			var Chat = App.__container__.lookup('controller:chat'),
				current_id = Chat && Chat.get('currentRoom.id');

			for(var room_id in this.rooms) {
				var room = this.rooms[room_id];
				room.room.set('messageBufferSize', new_val + ((this._roomv && !this._roomv.get('stuckToBottom') && current_id === room_id) ? 150 : 0));
			}
		}
	};


FFZ.settings_info.hosted_sub_notices = {
	type: "boolean",
	value: true,

	category: "Chat Filtering",
	no_bttv: true,

	name: "Show Hosted Channel Subscriber Notices",
	help: "Display notices in chat when someone subscribes to the hosted channel."
	};


FFZ.settings_info.banned_words = {
	type: "button",
	value: [],

	category: "Chat Filtering",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Banned Words",
	help: "Set a list of words that will be locally removed from chat messages.",

	method: function() {
			var old_val = this.settings.banned_words.join(", "),
				new_val = prompt("Banned Words\n\nPlease enter a comma-separated list of words that you would like to be removed from chat messages.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			new_val = new_val.trim().split(SPLITTER);
			var vals = [];

			for(var i=0; i < new_val.length; i++)
				new_val[i] && vals.push(new_val[i]);

			if ( vals.length == 1 && vals[0] == "disable" )
				vals = [];

			this.settings.set("banned_words", vals);
		}
	};


FFZ.settings_info.keywords = {
	type: "button",
	value: [],

	category: "Chat Filtering",
	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function() {
			var old_val = this.settings.keywords.join(", "),
				new_val = prompt("Highlight Keywords\n\nPlease enter a comma-separated list of words that you would like to be highlighted in chat.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			// Split them up.
			new_val = new_val.trim().split(SPLITTER);
			var vals = [];

			for(var i=0; i < new_val.length; i++)
				new_val[i] && vals.push(new_val[i]);

			if ( vals.length == 1 && vals[0] == "disable" )
				vals = [];

			this.settings.set("keywords", vals);
		}
	};


FFZ.settings_info.clickable_emoticons = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	no_bttv: true,
	no_mobile: true,

	name: "Emoticon Information Pages",
	help: "When enabled, holding shift and clicking on an emoticon will open it on the FrankerFaceZ website or Twitch Emotes."
	};


FFZ.settings_info.link_info = {
	type: "boolean",
	value: true,

	category: "Chat Tooltips",
	no_bttv: true,

	name: "Link Information <span>Beta</span>",
	help: "Check links against known bad websites, unshorten URLs, and show YouTube info."
	};


FFZ.settings_info.link_image_hover = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	no_bttv: true,
	no_mobile: true,

	name: "Image Preview",
	help: "Display image thumbnails for links to Imgur and YouTube."
	};


FFZ.settings_info.image_hover_all_domains = {
	type: "boolean",
	value: false,

	category: "Chat Tooltips",
	no_bttv: true,
	no_mobile: true,

	name: "Image Preview - All Domains",
	help: "<i>Requires Image Preview.</i> Attempt to show an image preview for any URL ending in the appropriate extension. <b>Warning: This may be used to leak your IP address to malicious users.</b>"
	};


FFZ.settings_info.legacy_badges = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",

	name: "Legacy Badges",
	help: "Display the old, pre-vector chat badges from Twitch.",

	on_update: function(val) { document.body.classList.toggle("ffz-legacy-badges", val); }
	};


FFZ.settings_info.chat_rows = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Chat Line Backgrounds",
	help: "Display alternating background colors for lines in chat.",

	on_update: function(val) { document.body.classList.toggle("ffz-chat-background", !this.has_bttv && val); }
	};


FFZ.settings_info.chat_separators = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Basic Line (1px solid)",
		2: "3D Line (2px groove)"
	},
	value: '0',

	category: "Chat Appearance",
	no_bttv: true,

	process_value: function(val) {
		if ( val === false )
			return '0';
		else if ( val === true )
			return '1';
		return val;
	},

	name: "Chat Line Separators",
	help: "Display thin lines between chat messages for further visual separation.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-chat-separator", !this.has_bttv && val !== '0');
			document.body.classList.toggle("ffz-chat-separator-3d", !this.has_bttv && val === '2');
		}
	};


FFZ.settings_info.chat_padding = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Reduced Chat Line Padding",
	help: "Reduce the amount of padding around chat messages to fit more on-screen at once.",

	on_update: function(val) { document.body.classList.toggle("ffz-chat-padding", !this.has_bttv && val); }
	};


FFZ.settings_info.high_contrast_chat = {
	type: "select",
	options: {
		'222': "Disabled",
		'212': "Bold",
		'221': "Text",
		'211': "Text + Bold",
		'122': "Background",
		'121': "Background + Text",
		'112': "Background + Bold",
		'111': 'All'
	},
	value: '222',

	category: "Chat Appearance",
	no_bttv: true,

	name: "High Contrast",
	help: "Display chat using white and black for maximum contrast. This is suitable for capturing and chroma keying chat to display on stream.",

	process_value: function(val) {
		if ( val === false )
			return '222';
		else if ( val === true )
			return '111';
		return val;
	},

	on_update: function(val) {
			document.body.classList.toggle("ffz-high-contrast-chat-text", !this.has_bttv && val[2] === '1');
			document.body.classList.toggle("ffz-high-contrast-chat-bold", !this.has_bttv && val[1] === '1');
			document.body.classList.toggle("ffz-high-contrast-chat-bg", !this.has_bttv && val[0] === '1');
		}
	};


FFZ.settings_info.chat_font_size = {
	type: "button",
	value: 12,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Font Size",
	help: "Make the chat font bigger or smaller.",

	method: function() {
			var old_val = this.settings.chat_font_size,
				new_val = prompt("Chat Font Size\n\nPlease enter a new size for the chat font. The default is 12.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var parsed = parseInt(new_val);
			if ( ! parsed || parsed === NaN || parsed < 1 )
				parsed = 12;

			this.settings.set("chat_font_size", parsed);
		},

	on_update: function(val) {
		if ( this.has_bttv || ! this._chat_style )
			return;

		var css;
		if ( val === 12 || ! val )
			css = "";
		else {
			var lh = Math.max(20, Math.round((20/12)*val)),
				pd = Math.floor((lh - 20) / 2);
			css = ".ember-chat .chat-messages .chat-line { font-size: " + val + "px !important; line-height: " + lh + "px !important; }";
			if ( pd )
				css += ".ember-chat .chat-messages .chat-line .mod-icons, .ember-chat .chat-messages .chat-line .badges { padding-top: " + pd + "px; }";
		}

		utils.update_css(this._chat_style, "chat_font_size", css);
		FFZ.settings_info.chat_ts_size.on_update.bind(this)(this.settings.chat_ts_size);
		}
	};


FFZ.settings_info.chat_ts_size = {
	type: "button",
	value: null,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Timestamp Font Size",
	help: "Make the chat timestamp font bigger or smaller.",

	method: function() {
			var old_val = this.settings.chat_ts_size;

			if ( ! old_val )
				old_val = this.settings.chat_font_size;

			var new_val = prompt("Chat Timestamp Font Size\n\nPlease enter a new size for the chat timestamp font. The default is to match the regular chat font size.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var parsed = parseInt(new_val);
			if ( ! parsed || parsed === NaN || parsed < 1 )
				parsed = null;

			this.settings.set("chat_ts_size", parsed);
		},

	on_update: function(val) {
		if ( this.has_bttv || ! this._chat_style )
			return;

		var css;
		if ( val === null )
			css = "";
		else {
			var lh = Math.max(20, Math.round((20/12)*val), Math.round((20/12)*this.settings.chat_font_size));
			css = ".ember-chat .chat-messages .timestamp { font-size: " + val + "px !important; line-height: " + lh + "px !important; }";
		}

		utils.update_css(this._chat_style, "chat_ts_font_size", css);
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_line = function() {
	// Tipsy Handler
	jQuery(document.body).on("mouseleave", ".tipsy", function() {
		this.parentElement.removeChild(this);
	});

	// Aliases
	try {
		this.aliases = JSON.parse(localStorage.ffz_aliases || '{}');
	} catch(err) {
		this.log("Error Loading Aliases: " + err);
		this.aliases = {};
	}


	// Chat Style
	var s = this._chat_style = document.createElement('style');
	s.id = "ffz-style-chat";
	s.type = 'text/css';
	document.head.appendChild(s);

	// Initial calculation.
	FFZ.settings_info.chat_font_size.on_update.bind(this)(this.settings.chat_font_size);


	// Chat Enhancements
	document.body.classList.toggle("ffz-chat-colors", !this.has_bttv && this.settings.fix_color !== '-1');
	document.body.classList.toggle("ffz-chat-colors-gray", !this.has_bttv && this.settings.fix_color === '-1');

	document.body.classList.toggle("ffz-legacy-badges", this.settings.legacy_badges);
	document.body.classList.toggle('ffz-chat-background', !this.has_bttv && this.settings.chat_rows);
	document.body.classList.toggle("ffz-chat-separator", !this.has_bttv && this.settings.chat_separators !== '0');
	document.body.classList.toggle("ffz-chat-separator-3d", !this.has_bttv && this.settings.chat_separators === '2');
	document.body.classList.toggle("ffz-chat-padding", !this.has_bttv && this.settings.chat_padding);
	document.body.classList.toggle("ffz-chat-purge-icon", !this.has_bttv && this.settings.line_purge_icon);

	document.body.classList.toggle("ffz-high-contrast-chat-text", !this.has_bttv && this.settings.high_contrast_chat[2] === '1');
	document.body.classList.toggle("ffz-high-contrast-chat-bold", !this.has_bttv && this.settings.high_contrast_chat[1] === '1');
	document.body.classList.toggle("ffz-high-contrast-chat-bg", !this.has_bttv && this.settings.high_contrast_chat[0] === '1');

	this._last_row = {};

	this.log("Hooking the Ember Whisper Line component.");
	var Whisper = App.__container__.resolve('component:whisper-line');

	if ( Whisper )
		this._modify_line(Whisper);

	this.log("Hooking the Ember Message Line component.");

	var Line = App.__container__.resolve('component:message-line');

	if ( Line )
		this._modify_line(Line);

	// Store the capitalization of our own name.
	var user = this.get_user();
	if ( user && user.name )
		FFZ.capitalization[user.login] = [user.name, Date.now()];
}


FFZ.prototype.save_aliases = function() {
	this.log("Saving " + Object.keys(this.aliases).length + " aliases to local storage.");
	localStorage.ffz_aliases = JSON.stringify(this.aliases);
}


FFZ.prototype._modify_line = function(component) {
	var f = this,

		Layout = App.__container__.lookup('controller:layout'),
		Settings = App.__container__.lookup('controller:settings');


	component.reopen({
		tokenizedMessage: function() {
			// Add our own step to the tokenization procedure.
			var tokens = this.get("msgObject.cachedTokens");
			if ( tokens )
				return tokens;

			tokens = this._super();

			var start = performance.now(),
				user = f.get_user(),
				from_me = user && this.get("msgObject.from") === user.login;

			tokens = f._remove_banned(tokens);
			tokens = f._emoticonize(this, tokens);

			if ( f.settings.parse_emoji )
				tokens = f.tokenize_emoji(tokens);

			// Store the capitalization.
			var display = this.get("msgObject.tags.display-name");
			if ( display && display.length )
				FFZ.capitalization[this.get("msgObject.from")] = [display.trim(), Date.now()];

			if ( ! from_me )
				tokens = f.tokenize_mentions(tokens);

			for(var i = 0; i < tokens.length; i++) {
				var token = tokens[i];
				if ( ! _.isString(token) && token.mentionedUser && ! token.own ) {
					this.set('msgObject.ffz_has_mention', true);
					break;
				}
			}

			var end = performance.now();
			if ( end - start > 5 )
				f.log("Tokenizing Message Took Too Long - " + (end-start) + "ms", tokens, false, true);

			this.set("msgObject.cachedTokens", tokens);
			return tokens;

		}.property("msgObject.message", "isChannelLinksDisabled", "currentUserNick", "msgObject.from", "msgObject.tags.emotes"),

		ffzUpdated: Ember.observer("msgObject.ffz_deleted", "msgObject.ffz_old_messages", function() {
			this.rerender();
		}),

		click: function(e) {
			if ( e.target && e.target.classList.contains('ffz-old-messages') )
				return f._show_deleted(this.get('msgObject.room'));

			if ( e.target && e.target.classList.contains('deleted-link') )
				return f._deleted_link_click.bind(e.target)(e);

			if ( e.target && e.target.classList.contains('mod-icon') ) {
				jQuery(e.target).trigger('mouseout');

				if ( e.target.classList.contains('purge') ) {
					var i = this.get('msgObject.from'),
						room_id = this.get('msgObject.room'),
						room = room_id && f.rooms[room_id] && f.rooms[room_id].room;

					if ( room ) {
						room.send("/timeout " + i + " 1");
						room.clearMessages(i);
					}
					return;
				}
			}

			if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons && e.target && e.target.classList.contains('emoticon') ) {
				var eid = e.target.getAttribute('data-emote');
				if ( eid )
					window.open("https://twitchemotes.com/emote/" + eid);
				else {
					eid = e.target.getAttribute("data-ffz-emote");
					window.open("https://www.frankerfacez.com/emoticons/" + eid);
				}
			}

			return this._super(e);
		},

		ffzUserLevel: function() {
			if ( this.get('isStaff') )
				return 5;
			else if ( this.get('isAdmin') )
				return 4;
			else if ( this.get('isBroadcaster') )
				return 3;
			else if ( this.get('isGlobalModerator') )
				return 2;
			else if ( this.get('isModerator') )
				return 1;
			return 0;
		}.property('msgObject.labels.[]'),

		render: function(e) {
			var deleted = this.get('msgObject.deleted'),
				r = this,

				badges = {},

				user = this.get('msgObject.from'),
				room_id = this.get('msgObject.room'),
				room = f.rooms && f.rooms[room_id],

				recipient = this.get('msgObject.to'),
				is_whisper = recipient && recipient.length,

				this_ul = this.get('ffzUserLevel'),
				other_ul = room && room.room && room.room.get('ffzUserLevel') || 0,

				row_type = this.get('msgObject.ffz_alternate'),
				raw_color = this.get('msgObject.color'),
				colors = raw_color && f._handle_color(raw_color),

				is_dark = (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('model.darkMode'));

			if ( row_type === undefined ) {
				row_type = f._last_row[room_id] = f._last_row.hasOwnProperty(room_id) ? !f._last_row[room_id] : false;
				this.set("msgObject.ffz_alternate", row_type);
			}

			e.push('<div class="indicator"></div>');
			e.push('<span class="timestamp float-left">' + this.get("timestamp") + '</span> ');

			if ( ! is_whisper && this_ul < other_ul ) {
				e.push('<span class="mod-icons float-left">');
				if ( deleted )
					e.push('<a class="mod-icon float-left tooltip unban" title="Unban User" href="#">Unban</a>');
				else
					e.push('<a class="mod-icon float-left tooltip ban" title="Ban User" href="#">Ban</a>');

				e.push('<a class="mod-icon float-left tooltip timeout" title="Timeout User (10m)" href="#">Timeout</a>');
				e.push('<a class="mod-icon float-left tooltip purge" title="Purge User (Timeout 1s)" href="#">Purge</a>');
				e.push('</span>');
			}

			// Stock Badges
			if ( ! is_whisper && this.get('isBroadcaster') )
				badges[0] = {klass: 'broadcaster', title: 'Broadcaster'};
			else if ( this.get('isStaff') )
				badges[0] = {klass: 'staff', title: 'Staff'};
			else if ( this.get('isAdmin') )
				badges[0] = {klass: 'admin', title: 'Admin'};
			else if ( this.get('isGlobalMod') )
				badges[0] = {klass: 'global-moderator', title: 'Global Moderator'};
			else if ( ! is_whisper && this.get('isModerator') )
				badges[0] = {klass: 'moderator', title: 'Moderator'};

			if ( ! is_whisper && this.get('isSubscriber') )
				badges[10] = {klass: 'subscriber', title: 'Subscriber'};
			if ( this.get('hasTurbo') )
				badges[15] = {klass: 'turbo', title: 'Turbo'};

			// FFZ Badges
			badges = f.render_badges(this, badges);

			// Rendering!
			e.push('<span class="badges float-left">');

			for(var key in badges) {
				var badge = badges[key],
					css = badge.image ? 'background-image:url(&quot;' + badge.image + '&quot;);' : '';

				if ( badge.color )
					css += 'background-color:' + badge.color + ';';

				if ( badge.extra_css )
					css += badge.extra_css;

				e.push('<div class="badge float-left tooltip ' + badge.klass + '"' + (css ? ' style="' + css + '"' : '') + ' title="' + badge.title + '"></div>');
			}

			e.push('</span>');

			var alias = f.aliases[user],
				name = this.get('msgObject.tags.display-name') || (user && user.capitalize()) || "unknown user",
				style = colors && 'color:' + (is_dark ? colors[1] : colors[0]),
				colored = style ? ' has-color' : '';

			if ( alias )
				e.push('<span class="from ffz-alias tooltip' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '" title="' + utils.sanitize(name) + '">' + utils.sanitize(alias) + '</span>');
			else
				e.push('<span class="from' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' + utils.sanitize(name) + '</span>');

			if ( is_whisper ) {
				var to_alias = f.aliases[recipient],
					to_name = this.get('msgObject.tags.recipient-display-name') || (recipient && recipient.capitalize()) || "unknown user",

					to_color = this.get('msgObject.toColor'),
					to_colors = to_color && f._handle_color(to_color),
					to_style = to_color && 'color:' + (is_dark ? to_colors[1] : to_colors[0]),
					to_colored = to_style ? ' has-color' : '';

				this._renderWhisperArrow(e);

				if ( to_alias )
					e.push('<span class="to ffz-alias tooltip' + to_colored + '" style="' + to_style + (to_color ? '" data-color="' + to_color : '') + '" title="' + utils.sanitize(to_name) + '">' + utils.sanitize(to_alias) + '</span>');
				else
					e.push('<span class="to' + to_colored + '" style="' + to_style + (to_colors ? '" data-color="' + to_color : '') + '">' + utils.sanitize(to_name) + '</span>');
			}

			e.push('<span class="colon">:</span> ');

			if ( this.get('msgObject.style') !== 'action' ) {
				style = '';
				colored = '';
			}

			if ( deleted )
				e.push('<span class="deleted"><a class="undelete" href="#">&lt;message deleted&gt;</a></span>');
			else {
				e.push('<span class="message' + colored + '" style="' + style + '">');
				e.push(f.render_tokens(this.get('tokenizedMessage'), true));

				var old_messages = this.get('msgObject.ffz_old_messages');
				if ( old_messages && old_messages.length )
					e.push('<div class="button primary float-right ffz-old-messages">Show ' + utils.number_commas(old_messages.length) + ' Old</div>');

				e.push('</span>');
			}
		},

		classNameBindings: [
			'msgObject.ffz_alternate:ffz-alternate',
			'msgObject.ffz_has_mention:ffz-mentioned',
			'ffzWasDeleted:ffz-deleted',
			'ffzHasOldMessages:clearfix',
			'ffzHasOldMessages:ffz-has-deleted'
			],


		ffzWasDeleted: function() {
			return f.settings.prevent_clear && this.get('msgObject.ffz_deleted');
		}.property('msgObject.ffz_deleted'),

		ffzHasOldMessages: function() {
			var old_messages = this.get('msgObject.ffz_old_messages');
			return old_messages && old_messages.length;
		}.property('msgObject.ffz_old_messages'),


		didInsertElement: function() {
			this._super();

			var el = this.get('element');

			el.setAttribute('data-room', this.get('msgObject.room'));
			el.setAttribute('data-sender', this.get('msgObject.from'));
			el.setAttribute('data-deleted', this.get('msgObject.deleted') || false);
		}
	});
}


// ---------------------
// Capitalization
// ---------------------

FFZ.capitalization = {};
FFZ._cap_fetching = 0;

FFZ.get_capitalization = function(name, callback) {
	if ( ! name )
		return name;

	name = name.toLowerCase();
	if ( name == "jtv" || name == "twitchnotify" )
		return name;

	var old_data = FFZ.capitalization[name];
	if ( old_data ) {
		if ( Date.now() - old_data[1] < 3600000 )
			return old_data[0];
	}

	if ( FFZ._cap_fetching < 25 ) {
		FFZ._cap_fetching++;
		FFZ.get().ws_send("get_display_name", name, function(success, data) {
			var cap_name = success ? data : name;
			FFZ.capitalization[name] = [cap_name, Date.now()];
			FFZ._cap_fetching--;
			typeof callback === "function" && callback(cap_name);
		});
	}

	return old_data ? old_data[0] : name;
}


// ---------------------
// Banned Words
// ---------------------

FFZ.prototype._remove_banned = function(tokens) {
	var banned_words = this.settings.banned_words,
		banned_links = ['j.mp', 'bit.ly'],

		has_banned_words = banned_words && banned_words.length;

	if ( !has_banned_words && (! banned_links || ! banned_links.length) )
		return tokens;

	if ( typeof tokens == "string" )
		tokens = [tokens];

	var regex = FFZ._words_to_regex(banned_words),
		link_regex = FFZ._words_to_regex(banned_links),
		new_tokens = [];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! _.isString(token ) ) {
			if ( token.emoticonSrc && has_banned_words && regex.test(token.altText) )
				new_tokens.push(token.altText.replace(regex, "$1***"));
			else if ( token.isLink && has_banned_words && regex.test(token.href) )
				new_tokens.push({
					isLink: true,
					href: token.href,
					isDeleted: true,
					isLong: false,
					censoredHref: token.href.replace(regex, "$1***")
				});
			else if ( token.isLink && link_regex.test(token.href) )
				new_tokens.push({
					isLink: true,
					href: token.href,
					isDeleted: true,
					isLong: false,
					censoredHref: token.href.replace(link_regex, "$1***")
				});
			else
				new_tokens.push(token);

		} else if ( has_banned_words )
			new_tokens.push(token.replace(regex, "$1***"));
		else
			new_tokens.push(token);
	}

	return new_tokens;
}


// ---------------------
// Emoticon Replacement
// ---------------------

FFZ.prototype._emoticonize = function(component, tokens) {
	var room_id = component.get("msgObject.room"),
		user_id = component.get("msgObject.from");

	return this.tokenize_emotes(user_id, room_id, tokens);
}
},{"../constants":5,"../utils":35}],12:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants"),
	helpers,

	keycodes = {
		ESC: 27,
		P: 80,
		B: 66,
		T: 84,
		U: 85
		},

	MESSAGE = '<svg class="svg-messages" height="16px" version="1.1" viewBox="0 0 18 18" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M1,15V3h16v12H1z M15.354,5.354l-0.707-0.707L9,10.293L3.354,4.646L2.646,5.354L6.293,9l-3.646,3.646l0.707,0.707L7,9.707l1.646,1.646h0.707L11,9.707l3.646,3.646l0.707-0.707L11.707,9L15.354,5.354z" fill-rule="evenodd"></path></svg>',
	CHECK = '<svg class="svg-unban" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" fill="#888888" d="M6.5,12.75L2,8.25l2-2l2.5,2.5l5.5-5.5l2,2L6.5,12.75z"/></svg>',

	DURATIONS = {},
	duration_string = function(val) {
		if ( val === 1 )
			return 'Purge';

		if ( DURATIONS[val] )
			return DURATIONS[val];

		var weeks, days, hours, minutes, seconds;

		weeks = Math.floor(val / 604800);
		seconds = val % 604800;

		days = Math.floor(seconds / 86400);
		seconds %= 86400;

		hours = Math.floor(seconds / 3600);
		seconds %= 3600;

		minutes = Math.floor(seconds / 60);
		seconds %= 60;

		var out = DURATIONS[val] = (weeks ? weeks + 'w' : '') + ((days || (weeks && (hours || minutes || seconds))) ? days + 'd' : '') + ((hours || ((weeks || days) && (minutes || seconds))) ? hours + 'h' : '') + ((minutes || ((weeks || days || hours) && seconds)) ? minutes + 'm' : '') + (seconds ? seconds + 's' : '');
		return out;
	};


try {
	helpers = window.require && window.require("ember-twitch-chat/helpers/chat-line-helpers");
} catch(err) { }


// ----------------
// Settings
// ----------------

FFZ.basic_settings.enhanced_moderation_cards = {
	type: "boolean",

	no_bttv: true,

	category: "Chat",
	name: "Enhanced Moderation Cards",
	help: "Improve moderation cards with hotkeys, additional buttons, chat history, and other information to make moderating easier.",

	get: function() {
		return this.settings.mod_card_hotkeys &&
				this.settings.mod_card_info &&
				this.settings.mod_card_history;
	},

	set: function(val) {
		this.settings.set('mod_card_hotkeys', val);
		this.settings.set('mod_card_info', val);
		this.settings.set('mod_card_history', val);
	}
};


FFZ.basic_settings.chat_hover_pause = {
	type: "boolean",

	no_bttv: true,

	category: "Chat",
	name: "Pause Chat Scrolling on Mouse Hover",
	help: "Automatically prevent the chat from scrolling when moving the mouse over it to prevent moderation mistakes and link misclicks.",

	get: 'chat_hover_pause',
	set: 'chat_hover_pause'
};


FFZ.settings_info.chat_hover_pause = {
	type: "boolean",
	value: false,

	no_bttv: true,

	category: "Chat Moderation",
	name: "Pause Chat Scrolling on Mouse Hover",
	help: "Automatically prevent the chat from scrolling when moving the mouse over it to prevent moderation mistakes and link misclicks.",

	on_update: function(val) {
			if ( ! this._roomv )
				return;

			if ( val )
				this._roomv.ffzEnableFreeze();
			else
				this._roomv.ffzDisableFreeze();
		}
	};


FFZ.settings_info.short_commands = {
	type: "boolean",
	value: true,

	no_bttv: true,
	category: "Chat Moderation",

	name: "Short Moderation Commands",
	help: "Use /t, /b, and /u in chat in place of /timeout, /ban, /unban for quicker moderation, and use /p for 1 second timeouts."
	};


FFZ.settings_info.mod_card_hotkeys = {
	type: "boolean",
	value: false,

	no_bttv: true,
	category: "Chat Moderation",

	name: "Moderation Card Hotkeys",
	help: "With a moderation card selected, press B to ban the user, T to time them out for 10 minutes, P to time them out for 1 second, or U to unban them. ESC closes the card."
	};


FFZ.settings_info.mod_card_info = {
	type: "boolean",
	value: true,

	no_bttv: true,
	category: "Chat Moderation",

	name: "Moderation Card Additional Information",
	help: "Display a channel's follower count, view count, and account age on moderation cards."
	};


FFZ.settings_info.mod_card_history = {
	type: "boolean",
	value: false,

	no_bttv: true,
	category: "Chat Moderation",

	name: "Moderation Card History",
	help: "Display a few of the user's previously sent messages on moderation cards.",

	on_update: function(val) {
			if ( val || ! this.rooms )
				return;

			// Delete all history~!
			for(var room_id in this.rooms) {
				var room = this.rooms[room_id];
				if ( room )
					room.user_history = undefined;
			}
		}
	};


FFZ.settings_info.mod_card_buttons = {
	type: "button",
	value: [],

	category: "Chat Moderation",
	no_bttv: true,

	name: "Moderation Card Additional Buttons",
	help: "Add additional buttons to moderation cards for running chat commands on those users.",

	method: function() {
			var old_val = "";
			for(var i=0; i < this.settings.mod_card_buttons.length; i++) {
				var cmd = this.settings.mod_card_buttons[i];
				if ( cmd.indexOf(' ') !== -1 )
					old_val += ' "' + cmd + '"';
				else
					old_val += ' ' + cmd;
			}

			var new_val = prompt("Moderation Card Additional Buttons\n\nPlease enter a list of additional commands to display buttons for on moderation cards. Commands are separated by spaces. To include spaces in a command, surround the command with double quotes (\"). Use \"{user}\" to insert the user's username into the command, otherwise it will be appended to the end.\n\nExample: !permit \"!reg add {user}\"", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var vals = [];
			new_val = new_val.trim();

			while(new_val) {
				if ( new_val.charAt(0) === '"' ) {
					var end = new_val.indexOf('"', 1);
					if ( end === -1 )
						end = new_val.length;

					var segment = new_val.substr(1, end - 1);
					if ( segment )
						vals.push(segment);

					new_val = new_val.substr(end + 1);

				} else {
					var ind = new_val.indexOf(' ');
					if ( ind === -1 ) {
						if ( new_val )
							vals.push(new_val);

						new_val = '';

					} else {
						var segment = new_val.substr(0, ind);
						if ( segment )
							vals.push(segment);

						new_val = new_val.substr(ind + 1);
					}
				}
			}

			this.settings.set("mod_card_buttons", vals);
		}
	};


FFZ.settings_info.mod_card_durations = {
	type: "button",
	value: [300, 600, 3600, 43200, 86400, 604800],

	category: "Chat Moderation",
	no_bttv: true,

	name: "Moderation Card Timeout Buttons",
	help: "Add additional timeout buttons to moderation cards with specific durations.",

	method: function() {
			var old_val = this.settings.mod_card_durations.join(", "),
				new_val = prompt("Moderation Card Timeout Buttons\n\nPlease enter a comma-separated list of durations that you would like to have timeout buttons for. Durations must be expressed in seconds.\n\nEnter \"reset\" without quotes to return to the default value.", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			if ( new_val === "reset" )
				new_val = FFZ.settings_info.mod_card_durations.value.join(", ");

			// Split them up.
			new_val = new_val.trim().split(/[ ,]+/);
			var vals = [];

			for(var i=0; i < new_val.length; i++) {
				var val = parseInt(new_val[i]);
				if ( val === 0 )
					val = 1;

				if ( val !== NaN && val > 0 )
					vals.push(val);
			}

			this.settings.set("mod_card_durations", vals);
		}
	};


// ----------------
// Initialization
// ----------------

FFZ.prototype.setup_mod_card = function() {
	this.log("Modifying Mousetrap stopCallback so we can catch ESC.");
	var orig_stop = Mousetrap.stopCallback;
	Mousetrap.stopCallback = function(e, element, combo) {
		if ( element.classList.contains('no-mousetrap') )
			return true;

		return orig_stop(e, element, combo);
	}

	Mousetrap.bind("up up down down left right left right b a enter", function() {
		var el = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
		el && el.classList.toggle('ffz-flip');
	});


	this.log("Hooking the Ember Moderation Card view.");
	var Card = App.__container__.resolve('component:moderation-card'),
		f = this;

	Card.reopen({
		ffzForceRedraw: function() {
			this.rerender();
		}.observes("cardInfo.isModeratorOrHigher", "cardInfo.user"),

		ffzRebuildInfo: function() {
			var el = this.get('element'),
				info = el && el.querySelector('.info');
			if ( ! info )
				return;

			var out = '<span class="stat tooltip" title="Total Views">' + constants.EYE + ' ' + utils.number_commas(this.get('cardInfo.user.views') || 0) + '</span>',
				since = utils.parse_date(this.get('cardInfo.user.created_at') || ''),
				followers = this.get('cardInfo.user.ffz_followers');

			if ( typeof followers === "number" ) {
				out += '<span class="stat tooltip" title="Followers">' + constants.HEART + ' ' + utils.number_commas(followers || 0) + '</span>';

			} else if ( followers === undefined ) {
				var t = this;
				this.set('cardInfo.user.ffz_followers', false);
				Twitch.api.get("channels/" + this.get('cardInfo.user.id') + '/follows', {limit:1}).done(function(data) {
					t.set('cardInfo.user.ffz_followers', data._total);
					t.ffzRebuildInfo();
				}).fail(function(data) {
					t.set('cardInfo.user.ffz_followers', undefined);
				});
			}

			if ( since ) {
				var age = Math.floor((Date.now() - since.getTime()) / 1000);
				if ( age > 0 ) {
					out += '<span class="stat tooltip" title="Member Since: ' + (age > 86400 ? since.toLocaleDateString() : since.toLocaleString()) + '">' + constants.CLOCK + ' ' + utils.human_time(age, 10) + '</span>';
				}
			}

			info.innerHTML = out;
		}.observes("cardInfo.user.views"),

		userName: Ember.computed("cardInfo.user.id", "cardInfo.user.display_name", function() {
			var user_id = this.get("cardInfo.user.id"),
				alias = f.aliases[user_id];

			return alias || this.get("cardInfo.user.display_name") || user_id.capitalize();
		}),

		didInsertElement: function() {
			this._super();
			window._card = this;
			try {
				if ( f.has_bttv )
					return;

				var el = this.get('element'),
					controller = this.get('controller'),
					line,

					user_id = controller.get('cardInfo.user.id'),
					alias = f.aliases[user_id];

				// Alias Display
				if ( alias ) {
					var name = el.querySelector('h3.name'),
						link = name && name.querySelector('a');

					if ( link )
						name = link;
					if ( name ) {
						name.classList.add('ffz-alias');
						name.title = utils.sanitize(controller.get('cardInfo.user.display_name') || user_id.capitalize());
						jQuery(name).tipsy();
					}
				}

				// Style it!
				el.classList.add('ffz-moderation-card');

				// Info-tize it!
				if ( f.settings.mod_card_info ) {
					var info = document.createElement('div'),
						after = el.querySelector('h3.name');
					if ( after ) {
						el.classList.add('ffz-has-info');
						info.className = 'info channel-stats';
						after.parentElement.insertBefore(info, after.nextSibling);
						this.ffzRebuildInfo();
					}
				}

				// Additional Buttons
				if ( f.settings.mod_card_buttons && f.settings.mod_card_buttons.length ) {
					line = document.createElement('div');
					line.className = 'extra-interface interface clearfix';

					var cmds = {},
						add_btn_click = function(cmd) {
							var user_id = controller.get('cardInfo.user.id'),
								cont = App.__container__.lookup('controller:chat'),
								room = cont && cont.get('currentRoom');

							room && room.send(cmd.replace(/{user}/g, user_id));
						},

						add_btn_make = function(cmd) {
							var btn = document.createElement('button'),
								segment = cmd.split(' ', 1)[0],
								title = cmds[segment] > 1 ? cmd.split(' ', cmds[segment]) : [segment];

							if ( /^[!~./]/.test(title[0]) )
								title[0] = title[0].substr(1);

							title = _.map(title, function(s){ return s.capitalize() }).join(' ');

							btn.className = 'button';
							btn.innerHTML = utils.sanitize(title);
							btn.title = utils.sanitize(cmd.replace(/{user}/g, controller.get('cardInfo.user.id') || '{user}'));

							jQuery(btn).tipsy();
							btn.addEventListener('click', add_btn_click.bind(this, cmd));
							return btn;
						};

					var cmds = {};
					for(var i=0; i < f.settings.mod_card_buttons.length; i++)
						cmds[f.settings.mod_card_buttons[i].split(' ',1)[0]] = (cmds[f.settings.mod_card_buttons[i].split(' ',1)[0]] || 0) + 1;

					for(var i=0; i < f.settings.mod_card_buttons.length; i++) {
						var cmd = f.settings.mod_card_buttons[i],
							ind = cmd.indexOf('{user}');

						if ( ind === -1 )
							cmd += ' {user}';

						line.appendChild(add_btn_make(cmd))
					}

					el.appendChild(line);
				}


				// Key Handling
				el.setAttribute('tabindex', 1);
				if ( f.settings.mod_card_hotkeys ) {
					el.classList.add('no-mousetrap');

					el.addEventListener('keyup', function(e) {
						var key = e.keyCode || e.which,
							user_id = controller.get('cardInfo.user.id'),
							is_mod = controller.get('cardInfo.isModeratorOrHigher'),
							room = App.__container__.lookup('controller:chat').get('currentRoom');

						if ( is_mod && key == keycodes.P )
							room.send("/timeout " + user_id + " 1");

						else if ( is_mod && key == keycodes.B )
							room.send("/ban " + user_id);

						else if ( is_mod && key == keycodes.T )
							room.send("/timeout " + user_id + " 600");

						else if ( is_mod && key == keycodes.U )
							room.send("/unban " + user_id);

						else if ( key != keycodes.ESC )
							return;

						controller.send('close');
					});
				}


				// Only do the big stuff if we're mod.
				if ( controller.get('cardInfo.isModeratorOrHigher') ) {
					el.classList.add('ffz-is-mod');

					// Key Handling
					if ( f.settings.mod_card_hotkeys ) {
						el.classList.add('no-mousetrap');

						el.addEventListener('keyup', function(e) {
							var key = e.keyCode || e.which,
								user_id = controller.get('cardInfo.user.id'),
								room = App.__container__.lookup('controller:chat').get('currentRoom');

							if ( key == keycodes.P )
								room.send("/timeout " + user_id + " 1");

							else if ( key == keycodes.B )
								room.send("/ban " + user_id);

							else if ( key == keycodes.T )
								room.send("/timeout " + user_id + " 600");

							else if ( key == keycodes.U )
								room.send("/unban " + user_id);

							else if ( key != keycodes.ESC )
								return;

							controller.send('close');
						});
					}

					var btn_click = function(timeout) {
						var user_id = controller.get('cardInfo.user.id'),
							room = App.__container__.lookup('controller:chat').get('currentRoom');

							if ( timeout === -1 )
								room.send("/unban " + user_id);
							else
								room.send("/timeout " + user_id + " " + timeout);
						},

					btn_make = function(timeout) {
							var btn = document.createElement('button')
							btn.className = 'button';
							btn.innerHTML = duration_string(timeout);
							btn.title = "Timeout User for " + utils.number_commas(timeout) + " Second" + (timeout != 1 ? "s" : "");

							if ( f.settings.mod_card_hotkeys && timeout === 600 )
								btn.title = "(T)" + btn.title.substr(1);
							else if ( f.settings.mod_card_hotkeys &&  timeout === 1 )
								btn.title = "(P)urge - " + btn.title;

							jQuery(btn).tipsy();

							btn.addEventListener('click', btn_click.bind(this, timeout));
							return btn;
						};

					if ( f.settings.mod_card_durations && f.settings.mod_card_durations.length ) {
						// Extra Moderation
						line = document.createElement('div');
						line.className = 'extra-interface interface clearfix';

						line.appendChild(btn_make(1));

						var s = document.createElement('span');
						s.className = 'right';
						line.appendChild(s);

						for(var i=0; i < f.settings.mod_card_durations.length; i++)
							s.appendChild(btn_make(f.settings.mod_card_durations[i]));

						el.appendChild(line);

						// Fix Other Buttons
						this.$("button.timeout").remove();
					}

					var ban_btn = el.querySelector('button.ban');
					if ( f.settings.mod_card_hotkeys )
						ban_btn.setAttribute('title', '(B)an User');

					// Unban Button
					var unban_btn = document.createElement('button');
					unban_btn.className = 'unban button glyph-only light';
					unban_btn.innerHTML = CHECK;
					unban_btn.title = (f.settings.mod_card_hotkeys ? "(U)" : "U") + "nban User";

					jQuery(unban_btn).tipsy();
					unban_btn.addEventListener("click", btn_click.bind(this, -1));

					jQuery(ban_btn).after(unban_btn);
				}


				// More Fixing Other Buttons
				var op_btn = el.querySelector('button.mod');
				if ( op_btn ) {
					var is_owner = controller.get('cardInfo.isChannelOwner'),
						user = ffz.get_user();
						can_op = is_owner || (user && user.is_admin) || (user && user.is_staff);

					if ( ! can_op )
						op_btn.parentElement.removeChild(op_btn);
				}


				var msg_btn = el.querySelector(".interface > button.message-button");
				if ( msg_btn ) {
					msg_btn.innerHTML = 'W';
					msg_btn.classList.add('glyph-only');
					msg_btn.classList.add('message');

					msg_btn.title = "Whisper User";
					jQuery(msg_btn).tipsy();


					var real_msg = document.createElement('button');
					real_msg.className = 'message-button button glyph-only message tooltip';
					real_msg.innerHTML = MESSAGE;
					real_msg.title = "Message User";

					real_msg.addEventListener('click', function() {
						window.open('http://www.twitch.tv/message/compose?to=' + controller.get('cardInfo.user.id'));
					})

					msg_btn.parentElement.insertBefore(real_msg, msg_btn.nextSibling);
				}


				// Alias Button
				var alias_btn = document.createElement('button');
				alias_btn.className = 'alias button glyph-only tooltip';
				alias_btn.innerHTML = constants.EDIT;
				alias_btn.title = "Set Alias";

				alias_btn.addEventListener('click', function() {
					var user = controller.get('cardInfo.user.id'),
						alias = f.aliases[user];

					var new_val = prompt("Alias for User: " + user + "\n\nPlease enter an alias for the user. Leave it blank to remove the alias.", alias);
					if ( new_val === null || new_val === undefined )
						return;

					new_val = new_val.trim();
					if ( ! new_val )
						new_val = undefined;

					f.aliases[user] = new_val;
					f.save_aliases();

					// Update UI
					f._update_alias(user);

					Ember.propertyDidChange(controller, 'userName');
					var name = el.querySelector('h3.name'),
						link = name && name.querySelector('a');

					if ( link )
						name = link;
					if ( name )
						name.classList.toggle('ffz-alias', new_val);
				});

				if ( msg_btn )
					msg_btn.parentElement.insertBefore(alias_btn, msg_btn);
				else {
					var follow_btn = el.querySelector(".interface > .follow-button");
					if ( follow_btn )
						follow_btn.parentElement.insertBefore(alias_btn, follow_btn.nextSibling);
				}


				// Message History
				if ( f.settings.mod_card_history ) {
					var Chat = App.__container__.lookup('controller:chat'),
						room = Chat && Chat.get('currentRoom'),
						ffz_room = room && f.rooms && f.rooms[room.get('id')],
						user_history = ffz_room && ffz_room.user_history && ffz_room.user_history[controller.get('cardInfo.user.id')];

					if ( user_history && user_history.length ) {
						var history = document.createElement('ul'),
							alternate = false;
						history.className = 'interface clearfix chat-history';

						for(var i=0; i < user_history.length; i++) {
							var line = user_history[i],
								l_el = document.createElement('li');

							l_el.className = 'message-line chat-line clearfix';
							l_el.classList.toggle('ffz-alternate', alternate);
							alternate = !alternate;

							if ( line.style )
								l_el.classList.add(line.style);

							l_el.innerHTML = (helpers ? '<span class="timestamp float-left">' + helpers.getTime(line.date) + '</span> ' : '') + '<span class="message">' + (line.style === 'action' ? '*' + line.from + ' ' : '') + f.render_tokens(line.cachedTokens) + '</span>';

							// Banned Links
							var bad_links = l_el.querySelectorAll('a.deleted-link');
							for(var x=0; x < bad_links.length; x++)
								bad_links[x].addEventListener("click", f._deleted_link_click);

							jQuery('.html-tooltip', l_el).tipsy({html:true});
							history.appendChild(l_el);
						}

						el.appendChild(history);

						// Lazy scroll-to-bottom
						history.scrollTop = history.scrollHeight;
					}
				}

				// Reposition the menu if it's off-screen.
				var el_bound = el.getBoundingClientRect(),
					body_bound = document.body.getBoundingClientRect();

				if ( el_bound.bottom > body_bound.bottom ) {
					var offset = el_bound.bottom - body_bound.bottom;
					if ( el_bound.top - offset > body_bound.top )
						el.style.top = (el_bound.top - offset) + "px";
				}

				// Focus the Element
				this.$().draggable({
					start: function() {
						el.focus();
						}});

				el.focus();

			} catch(err) {
				try {
					f.error("ModerationCardView didInsertElement: " + err);
				} catch(err) { }
			}
		}});
}


// ----------------
// Aliases
// ----------------

FFZ.prototype._update_alias = function(user) {
	var alias = this.aliases && this.aliases[user],
		cap_name = FFZ.get_capitalization(user),
		display_name = alias || cap_name,
		el = this._roomv && this._roomv.get('element'),
		lines = el && el.querySelectorAll('.chat-line[data-sender="' + user + '"]');

	if ( ! lines )
		return;

	for(var i=0, l = lines.length; i < l; i++) {
		var line = lines[i],
			el_from = line.querySelector('.from');

		el_from.classList.toggle('ffz-alias', alias);
		el_from.textContent = display_name;
		el_from.title = alias ? cap_name : '';
	}
}


// ----------------
// Chat Commands
// ----------------

FFZ.chat_commands.purge = function(room, args) {
	if ( ! args || ! args.length )
		return "Purge Usage: /p username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only purge up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/timeout " + name + " 1");
	}
}

FFZ.chat_commands.p = function(room, args) {
	return FFZ.chat_commands.purge.bind(this)(room, args);
}

FFZ.chat_commands.p.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.t = function(room, args) {
	if ( ! args || ! args.length )
		return "Timeout Usage: /t username [duration]";
	room.room.send("/timeout " + args.join(" "));
}

FFZ.chat_commands.t.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.b = function(room, args) {
	if ( ! args || ! args.length )
		return "Ban Usage: /b username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only ban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/ban " + name);
	}
}

FFZ.chat_commands.b.enabled = function() { return this.settings.short_commands; }


FFZ.chat_commands.u = function(room, args) {
	if ( ! args || ! args.length )
		return "Unban Usage: /u username [more usernames separated by spaces]";

	if ( args.length > 10 )
		return "Please only unban up to 10 users at once.";

	for(var i=0; i < args.length; i++) {
		var name = args[i];
		if ( name )
			room.room.send("/unban " + name);
	}
}

FFZ.chat_commands.u.enabled = function() { return this.settings.short_commands; }
},{"../constants":5,"../utils":35}],13:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	GROUP_CHAT = /^_([^_]+)_\d+$/,
	HOSTED_SUB = / subscribed to /,
	constants = require('../constants'),
	utils = require('../utils'),

	// StrimBagZ Support
	is_android = navigator.userAgent.indexOf('Android') !== -1,

	moderator_css = function(room) {
		if ( ! room.moderator_badge )
			return "";

		return '.chat-line[data-room="' + room.id + '"] .badges .moderator:not(.ffz-badge-replacement) { background-image:url("' + room.moderator_badge + '") !important; }';
	}


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_room = function() {
	this.rooms = {};

	this.log("Creating room style element.");
	var s = this._room_style = document.createElement("style");
	s.id = "ffz-room-css";
	document.head.appendChild(s);

	this.log("Hooking the Ember Room controller.");

	// Responsive ban button.
	var f = this,
		RC = App.__container__.lookup('controller:room');
	if ( RC ) {
		var orig_ban = RC._actions.banUser,
			orig_to = RC._actions.timeoutUser;

		RC._actions.banUser = function(e) {
			orig_ban.bind(this)(e);
			this.get("model").clearMessages(e.user);
		}

		RC._actions.timeoutUser = function(e) {
			orig_to.bind(this)(e);
			this.get("model").clearMessages(e.user);
		}

		RC._actions.purgeUser = function(e) {
			this.get("model.tmiRoom").sendMessage("/timeout " + e.user + " 1");
			this.get("model").clearMessages(e.user);
		}
	}

	this.log("Hooking the Ember Room model.");

	var Room = App.__container__.resolve('model:room');
	this._modify_room(Room);

	// Modify all current instances of Room, as the changes to the base
	// class won't be inherited automatically.
	var instances = Room.instances;
	for(var key in instances) {
		if ( ! instances.hasOwnProperty(key) )
			continue;

		var inst = instances[key];
		this.add_room(inst.id, inst);
		this._modify_room(inst);
		inst.ffzPatchTMI();
	}

	this.log("Hooking the Ember Room view.");

	var RoomView = App.__container__.resolve('view:room');
	this._modify_rview(RoomView);

	// For some reason, this doesn't work unless we create an instance of the
	// room view and then destroy it immediately.
	try {
		RoomView.create().destroy();
	} catch(err) { }

	// Modify all existing Room views.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof RoomView) )
			continue;

		this.log("Manually updating existing Room view.", view);
		try {
			view.ffzInit();
		} catch(err) {
			this.error("RoomView setup ffzInit: " + err);
		}
	}
}


// --------------------
// View Customization
// --------------------

FFZ.prototype._modify_rview = function(view) {
	var f = this;
	view.reopen({
		didInsertElement: function() {
			this._super();

			try {
				this.ffzInit();
			} catch(err) {
				f.error("RoomView didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("RoomView willClearRender: " + err);
			}
			this._super();
		},

		ffzInit: function() {
			f._roomv = this;

			this.ffz_frozen = false;

			// Fix scrolling.
			this._ffz_mouse_down = this.ffzMouseDown.bind(this);
			if ( is_android )
				// We don't unbind scroll because that messes with the scrollbar. ;_;
				this._$chatMessagesScroller.bind('scroll', this._ffz_mouse_down);

			this._$chatMessagesScroller.unbind('mousedown');
			this._$chatMessagesScroller.bind('mousedown', this._ffz_mouse_down);

			if ( f.settings.chat_hover_pause )
				this.ffzEnableFreeze();

			if ( f.settings.room_status )
				this.ffzUpdateStatus();

			var controller = this.get('controller');
			if ( controller ) {
				controller.reopen({
					submitButtonText: function() {
						if ( this.get("model.isWhisperMessage") && this.get("model.isWhispersEnabled") )
							return i18n("Whisper");

						var wait = this.get("model.slowWait"),
							msg = this.get("model.messageToSend") || "";

						if ( (msg.charAt(0) === "/" && msg.substr(0, 4) !== "/me ") || !wait || !f.settings.room_status )
							return i18n("Chat");

						return utils.time_to_string(wait, false, false, true);
					}.property("model.isWhisperMessage", "model.isWhispersEnabled", "model.slowWait")
				});

				Ember.propertyDidChange(controller, 'submitButtonText');
			}
		},

		ffzTeardown: function() {
			if ( f._roomv === this )
				f._roomv = undefined;

			this.ffzDisableFreeze();
		},

		ffzUpdateStatus: function() {
			var room = this.get('controller.model'),

				el = this.get('element'),
				cont = el && el.querySelector('.chat-buttons-container');

			if ( ! cont )
				return;

			var r9k_badge = cont.querySelector('#ffz-stat-r9k'),
				sub_badge = cont.querySelector('#ffz-stat-sub'),
				slow_badge = cont.querySelector('#ffz-stat-slow'),
				banned_badge = cont.querySelector('#ffz-stat-banned'),
				btn = cont.querySelector('button');

			if ( f.has_bttv || ! f.settings.room_status ) {
				if ( r9k_badge )
					r9k_badge.parentElement.removeChild(r9k_badge);
				if ( sub_badge )
					sub_badge.parentElement.removeChild(sub_badge);
				if ( slow_badge )
					slow_badge.parentElement.removeChild(slow_badge);

				if ( btn )
					btn.classList.remove('ffz-waiting');
				return;
			}

			if ( ! r9k_badge ) {
				r9k_badge = document.createElement('span');
				r9k_badge.className = 'ffz room-state stat float-right';
				r9k_badge.id = 'ffz-stat-r9k';
				r9k_badge.innerHTML = 'R9K';
				r9k_badge.title = "This room is in R9K-mode.";
				cont.appendChild(r9k_badge);
				jQuery(r9k_badge).tipsy({gravity:"s", offset:15});
			}

			if ( ! sub_badge ) {
				sub_badge = document.createElement('span');
				sub_badge.className = 'ffz room-state stat float-right';
				sub_badge.id = 'ffz-stat-sub';
				sub_badge.innerHTML = 'SUB';
				sub_badge.title = "This room is in subscribers-only mode.";
				cont.appendChild(sub_badge);
				jQuery(sub_badge).tipsy({gravity:"s", offset:15});
			}

			if ( ! slow_badge ) {
				slow_badge = document.createElement('span');
				slow_badge.className = 'ffz room-state stat float-right';
				slow_badge.id = 'ffz-stat-slow';
				slow_badge.innerHTML = 'SLOW';
				slow_badge.title = "This room is in slow mode. You may send messages every 120 seconds.";
				cont.appendChild(slow_badge);
				jQuery(slow_badge).tipsy({gravity:"s", offset:15});
			}

			if ( ! banned_badge ) {
				banned_badge = document.createElement('span');
				banned_badge.className = 'ffz room-state stat float-right';
				banned_badge.id = 'ffz-stat-banned';
				banned_badge.innerHTML = 'BAN';
				banned_badge.title = "You have been banned from talking in this room.";
				cont.appendChild(banned_badge);
				jQuery(banned_badge).tipsy({gravity:"s", offset:15});
			}

			r9k_badge.classList.toggle('hidden', !(room && room.get('r9k')));
			sub_badge.classList.toggle('hidden', !(room && room.get('subsOnly')));
			slow_badge.classList.toggle('hidden', !(room && room.get('slowMode')));
			slow_badge.title = "This room is in slow mode. You may send messages every " + utils.number_commas(room && room.get('slow')||120) + " seconds.";
			banned_badge.classList.toggle('hidden', !(room && room.get('ffz_banned')));

			if ( btn ) {
				btn.classList.toggle('ffz-waiting', (room && room.get('slowWait') || 0));
				btn.classList.toggle('ffz-banned', (room && room.get('ffz_banned')));
			}

		}.observes('controller.model'),

		ffzEnableFreeze: function() {
			var el = this.get('element'),
				messages = el.querySelector('.chat-messages');

			if ( ! messages )
				return;

			this._ffz_interval = setInterval(this.ffzPulse.bind(this), 200);
			this._ffz_messages = messages;
			
			this._ffz_mouse_move = this.ffzMouseMove.bind(this);
			this._ffz_mouse_out = this.ffzMouseOut.bind(this);

			messages.addEventListener('mousemove', this._ffz_mouse_move);
			messages.addEventListener('touchmove', this._ffz_mouse_move);
			messages.addEventListener('mouseout', this._ffz_mouse_out);
			document.addEventListener('mouseout', this._ffz_mouse_out);
		},

		ffzDisableFreeze: function() {
			if ( this._ffz_interval ) {
				clearInterval(this._ffz_interval);
				this._ffz_interval = undefined;
			}

			this.ffzUnfreeze();

			var messages = this._ffz_messages;
			if ( ! messages )
				return;

			this._ffz_messages = undefined;

			if ( this._ffz_mouse_move ) {
				messages.removeEventListener('mousemove', this._ffz_mouse_move);
				this._ffz_mouse_move = undefined;
			}

			if ( this._ffz_mouse_out ) {
				messages.removeEventListener('mouseout', this._ffz_mouse_out);
				this._ffz_mouse_out = undefined;
			}
		},

		ffzPulse: function() {
			if ( this.ffz_frozen ) {
				var elapsed = Date.now() - this._ffz_last_move;
				if ( elapsed > 750 )
					this.ffzUnfreeze();
			}
		},

		ffzUnfreeze: function() {
			this.ffz_frozen = false;
			this._ffz_last_move = 0;
			this.ffzUnwarnPaused();

			if ( this.get('stuckToBottom') )
				this._scrollToBottom();
		},

		ffzMouseDown: function(event) {
			var t = this._$chatMessagesScroller;
			if ( t && t[0] && ((!this.ffz_frozen && "mousedown" === event.type) || "mousewheel" === event.type || (is_android && "scroll" === event.type) ) ) {
				if ( event.type === "mousedown" )
					f.log("Freezing from mouse down!", event);
				var r = t[0].scrollHeight - t[0].scrollTop - t[0].offsetHeight;
				this._setStuckToBottom(10 >= r);
			}
		},

		ffzMouseOut: function(event) {
			this._ffz_outside = true;
			var e = this;
			setTimeout(function() {
				if ( e._ffz_outside )
					e.ffzUnfreeze();
			}, 25);
		},

		ffzMouseMove: function(event) {
			this._ffz_last_move = Date.now();
			this._ffz_outside = false;

			if ( event.screenX === this._ffz_last_screenx && event.screenY === this._ffz_last_screeny )
				return;

			this._ffz_last_screenx = event.screenX;
			this._ffz_last_screeny = event.screenY;

			if ( this.ffz_frozen )
				return;

			this.ffz_frozen = true;
			if ( this.get('stuckToBottom') ) {
				this.set('controller.model.messageBufferSize', f.settings.scrollback_length + 150);
				this.ffzWarnPaused();
			}
		},

		_scrollToBottom: _.throttle(function() {
			var e = this,
				s = this._$chatMessagesScroller;

			Ember.run.next(function() {
				setTimeout(function(){
					if ( e.ffz_frozen || ! s || ! s.length )
						return;
					
					s[0].scrollTop = s[0].scrollHeight;
					e._setStuckToBottom(true);
				})
			})
		}, 200),

		_setStuckToBottom: function(val) {
			this.set("stuckToBottom", val);
			this.get("controller.model") && this.set("controller.model.messageBufferSize", f.settings.scrollback_length + (val ? 0 : 150));
			if ( ! val )
				this.ffzUnfreeze();
		},

		// Warnings~!
		ffzWarnPaused: function() {
			var el = this.get('element'),
				warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

			if ( ! el )
				return;

			if ( ! warning ) {
				warning = document.createElement('div');
				warning.className = 'more-messages-indicator ffz-freeze-indicator';
				warning.innerHTML = '(Chat Paused Due to Mouse Movement)';

				var cont = el.querySelector('.chat-interface');
				if ( ! cont )
					return;
				cont.insertBefore(warning, cont.childNodes[0])
			}

			warning.classList.remove('hidden');
		},


		ffzUnwarnPaused: function() {
			var el = this.get('element'),
				warning = el && el.querySelector('.chat-interface .more-messages-indicator.ffz-freeze-indicator');

			if ( warning )
				warning.classList.add('hidden');
		}

	});
}


// --------------------
// Command System
// --------------------

FFZ.chat_commands = {};
FFZ.ffz_commands = {};


FFZ.prototype.room_message = function(room, text) {
	var lines = text.split("\n");
	if ( this.has_bttv ) {
		for(var i=0; i < lines.length; i++)
			BetterTTV.chat.handlers.onPrivmsg(room.id, {style: 'admin', date: new Date(), from: 'jtv', message: lines[i]});

	} else {
		for(var i=0; i < lines.length; i++)
			room.room.addMessage({style: 'ffz admin', date: new Date(), from: 'FFZ', message: lines[i]});
	}
}


FFZ.prototype.run_command = function(text, room_id) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return false;

	if ( ! text )
		return;

	var args = text.split(" "),
		cmd = args.shift().substr(1).toLowerCase(),

		command = FFZ.chat_commands[cmd],
		output;

	if ( ! command )
		return false;

	if ( command.hasOwnProperty('enabled') ) {
		var val = command.enabled;
		if ( typeof val == "function" ) {
			try {
				val = command.enabled.bind(this)(room, args);
			} catch(err) {
				this.error('command "' + cmd + '" enabled: ' + err);
				val = false;
			}
		}

		if ( ! val )
			return false;
	}

	this.log("Received Command: " + cmd, args, true);

	try {
		output = command.bind(this)(room, args);
	} catch(err) {
		this.error('command "' + cmd + '" runner: ' + err);
		output = "There was an error running the command.";
	}

	if ( output )
		this.room_message(room, output);

	return true;
}


FFZ.prototype.run_ffz_command = function(text, room_id) {
	var room = this.rooms[room_id];
	if ( ! room || !room.room )
		return;

	if ( ! text ) {
		// Try to pop-up the menu.
		var link = document.querySelector('a.ffz-ui-toggle');
		if ( link )
			return link.click();

		text = "help";
	}

	var args = text.split(" "),
		cmd = args.shift().toLowerCase();

	this.log("Received Command: " + cmd, args, true);

	var command = FFZ.ffz_commands[cmd], output;
	if ( command ) {
		try {
			output = command.bind(this)(room, args);
		} catch(err) {
			this.log("Error Running Command - " + cmd + ": " + err, room);
			output = "There was an error running the command.";
		}
	} else
		output = 'There is no "' + cmd + '" command.';

	if ( output )
		this.room_message(room, output);
}


FFZ.ffz_commands.help = function(room, args) {
	if ( args && args.length ) {
		var command = FFZ.ffz_commands[args[0].toLowerCase()];
		if ( ! command )
			return 'There is no "' + args[0] + '" command.';

		else if ( ! command.help )
			return 'No help is available for the command "' + args[0] + '".';

		else
			return command.help;
	}

	var cmds = [];
	for(var c in FFZ.ffz_commands)
		FFZ.ffz_commands.hasOwnProperty(c) && cmds.push(c);

	return "The available commands are: " + cmds.join(", ");
}

FFZ.ffz_commands.help.help = "Usage: /ffz help [command]\nList available commands, or show help for a specific command.";


// --------------------
// Room Management
// --------------------

FFZ.prototype.add_room = function(id, room) {
	if ( this.rooms[id] )
		return this.log("Tried to add existing room: " + id);

	this.log("Adding Room: " + id);

	// Create a basic data table for this room.
	var data = this.rooms[id] = {id: id, room: room, menu_sets: [], sets: [], css: null, needs_history: false};

	if ( this.follow_sets && this.follow_sets[id] ) {
		data.extra_sets = this.follow_sets[id];
		delete this.follow_sets[id];

		for(var i=0; i < data.extra_sets.length; i++) {
			var sid = data.extra_sets[i],
				set = this.emote_sets && this.emote_sets[sid];

			if ( set ) {
				if ( set.users.indexOf(id) === -1 )
					set.users.push(id);
				continue;
			}

			this.load_set(sid, function(success, data) {
				if ( success )
					data.users.push(id);
			});
		}
	}

	// Let the server know where we are.
	this.ws_send("sub", id);

	// See if we need history?
	if ( ! this.has_bttv && this.settings.chat_history && room && (room.get('messages.length') || 0) < 10 ) {
		if ( ! this.ws_send("chat_history", [id,25], this._load_history.bind(this, id)) )
			data.needs_history = true;
	}

	// Why don't we set the scrollback length, too?
	room.set('messageBufferSize', this.settings.scrollback_length + ((this._roomv && !this._roomv.get('stuckToBottom') && this._roomv.get('controller.model.id') === id) ? 150 : 0));

	// For now, we use the legacy function to grab the .css file.
	this.load_room(id);
}


FFZ.prototype.remove_room = function(id) {
	var room = this.rooms[id];
	if ( ! room )
		return;

	this.log("Removing Room: " + id);

	// Remove the CSS
	if ( room.css || room.moderator_badge )
		utils.update_css(this._room_style, id, null);

	// Let the server know we're gone and delete our data for this room.
	this.ws_send("unsub", id);
	delete this.rooms[id];

	// Clean up sets we aren't using any longer.
	if ( id.charAt(0) === "_" )
		return;

	var set = this.emote_sets[room.set];
	if ( set ) {
		set.users.removeObject(id);
		if ( ! this.global_sets.contains(room.set) && ! set.users.length )
			this.unload_set(room.set);
	}
}


// --------------------
// Chat History
// --------------------

FFZ.prototype._load_history = function(room_id, success, data) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return;

		if ( success )
		this.log("Received " + data.length + " old messages for: " + room_id);
	else
		return this.log("Error retrieving chat history for: " + room_id);

	if ( ! data.length )
		return;

	return this._insert_history(room_id, data);
}


FFZ.prototype._show_deleted = function(room_id) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return;

	var old_messages = room.room.get('messages.0.ffz_old_messages');
	if ( ! old_messages || ! old_messages.length )
		return;

	room.room.set('messages.0.ffz_old_messages', undefined);
	this._insert_history(room_id, old_messages);
}

FFZ.prototype._insert_history = function(room_id, data) {
	var room = this.rooms[room_id];
	if ( ! room || ! room.room )
		return;

	var r = room.room,
		messages = r.get('messages'),
		tmiSession = r.tmiSession || (TMI._sessions && TMI._sessions[0]),
		tmiRoom = r.tmiRoom,

		inserted = 0,

		last_msg = data[data.length - 1],
		now = new Date(),
		last_date = typeof last_msg.date === "string" ? utils.parse_date(last_msg.date) : last_msg.date,
		age = (now - last_date) / 1000,
		is_old = age > 300,

		i = data.length,
		alternation = r.get('messages.0.ffz_alternate') || false;

	if ( is_old )
		alternation = ! alternation;

	var i = data.length;
	while(i--) {
		var msg = data[i];

		if ( typeof msg.date === "string" )
			msg.date = utils.parse_date(msg.date);

		msg.ffz_alternate = alternation = ! alternation;
		if ( ! msg.room )
			msg.room = room_id;

		if ( ! msg.color )
			msg.color = msg.tags && msg.tags.color ? msg.tags.color : tmiSession && msg.from ? tmiSession.getColor(msg.from.toLowerCase()) : "#755000";

		if ( ! msg.labels || ! msg.labels.length ) {
			var labels = msg.labels = [];
			if ( msg.tags ) {
				if ( msg.tags.turbo )
					labels.push("turbo");
				if ( msg.tags.subscriber )
					labels.push("subscriber");
				if ( msg.from === room_id )
					labels.push("owner")
				else {
					var ut = msg.tags['user-type'];
					if ( ut === 'mod' || ut === 'staff' || ut === 'admin' || ut === 'global_mod' )
						labels.push(ut);
				}
			}
		}

		if ( ! msg.style ) {
			if ( msg.from === "jtv" )
				msg.style = "admin";
			else if ( msg.from === "twitchnotify" )
				msg.style = "notification";
		}

		if ( ! msg.cachedTokens || ! msg.cachedTokens.length )
			this.tokenize_chat_line(msg, true, r.get('roomProperties.hide_chat_links'));

		if ( r.shouldShowMessage(msg) ) {
			if ( messages.length < r.get("messageBufferSize") ) {
				// One last thing! Make sure we don't have too many messages.
				if ( msg.ffz_old_messages ) {
					var max_msgs = r.get("messageBufferSize") - (messages.length + 1);
					if ( msg.ffz_old_messages.length > max_msgs )
						msg.ffz_old_messages = msg.ffz_old_messages.slice(msg.ffz_old_messages.length - max_msgs);
				}

				messages.unshiftObject(msg);
				inserted += 1;
			} else
				break;
		}
	}

	if ( is_old ) {
		var msg = {
			ffz_alternate: ! alternation,
			color: "#755000",
			date: new Date(),
			from: "frankerfacez_admin",
			style: "admin",
			message: "(Last message is " + utils.human_time(age) + " old.)",
			room: room_id
		};

		this.tokenize_chat_line(msg, true, r.get('roomProperties.hide_chat_links'));
		if ( r.shouldShowMessage(msg) ) {
			messages.insertAt(inserted, msg);
			while( messages.length > r.get('messageBufferSize') )
				messages.removeAt(0);
		}
	}
}


// --------------------
// Receiving Set Info
// --------------------

FFZ.prototype.load_room = function(room_id, callback, tries) {
	var f = this;
	jQuery.getJSON(((tries||0)%2 === 0 ? constants.API_SERVER : constants.API_SERVER_2) + "v1/room/" + room_id)
		.done(function(data) {
			if ( data.sets ) {
				for(var key in data.sets)
					data.sets.hasOwnProperty(key) && f._load_set_json(key, undefined, data.sets[key]);
			}

			f._load_room_json(room_id, callback, data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback == "function" && callback(false);

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return f.load_room(room_id, callback, tries);

			return typeof callback == "function" && callback(false);
		});
}


FFZ.prototype._load_room_json = function(room_id, callback, data) {
	if ( ! data || ! data.room )
		return typeof callback == "function" && callback(false);

	data = data.room;

	// Preserve the pointer to the Room instance.
	if ( this.rooms[room_id] )
		data.room = this.rooms[room_id].room;

	// Preserve everything else.
	for(var key in this.rooms[room_id]) {
		if ( key !== 'room' && this.rooms[room_id].hasOwnProperty(key) && ! data.hasOwnProperty(key) )
			data[key] = this.rooms[room_id][key];
	}

	data.needs_history = this.rooms[room_id] && this.rooms[room_id].needs_history || false;

	this.rooms[room_id] = data;

	if ( data.css || data.moderator_badge )
		utils.update_css(this._room_style, room_id, moderator_css(data) + (data.css||""));

	if ( ! this.emote_sets.hasOwnProperty(data.set) )
		this.load_set(data.set, function(success, set) {
			if ( set.users.indexOf(room_id) === -1 )
				set.users.push(room_id);
		});
	else if ( this.emote_sets[data.set].users.indexOf(room_id) === -1 )
		this.emote_sets[data.set].users.push(room_id);

	this.update_ui_link();

	if ( callback )
		callback(true, data);
}


// --------------------
// Ember Modifications
// --------------------

FFZ.prototype._modify_room = function(room) {
	var f = this;
	room.reopen({
		slowWaiting: false,
		slow: 0,

		mru_list: [],

		updateWait: function(value, was_banned) {
			var wait = this.get('slowWait') || 0;
			this.set('slowWait', value);
			if ( wait < 1 && value > 0 ) {
				if ( this._ffz_wait_timer )
					clearTimeout(this._ffz_wait_timer);
				this._ffz_wait_timer = setTimeout(this.ffzUpdateWait.bind(this), 1000);
				f._roomv && f._roomv.ffzUpdateStatus();
			} else if ( (wait > 0 && value < 1) || was_banned ) {
				this.set('ffz_banned', false);
				f._roomv && f._roomv.ffzUpdateStatus();
			}
		},

		ffzUpdateWait: function() {
			this._ffz_wait_timer = undefined;
			var wait = this.get('slowWait') || 0;
			if ( wait < 1 )
				return;

			this.set('slowWait', --wait);
			if ( wait > 0 )
				this._ffz_wait_timer = setTimeout(this.ffzUpdateWait.bind(this), 1000);
			else {
				this.set('ffz_banned', false);
				f._roomv && f._roomv.ffzUpdateStatus();
			}
		},

		ffzUpdateStatus: function() {
			if ( f._roomv )
				f._roomv.ffzUpdateStatus();
		}.observes('r9k', 'subsOnly', 'slow', 'ffz_banned'),

		// User Level
		ffzUserLevel: function() {
			if ( this.get('isStaff') )
				return 5;
			else if ( this.get('isAdmin') )
				return 4;
			else if ( this.get('isBroadcaster') )
				return 3;
			else if ( this.get('isGlobalModerator') )
				return 2;
			else if ( this.get('isModerator') )
				return 1;
			return 0;
		}.property('id', 'chatLabels.[]'),

		// Track which rooms the user is currently in.
		init: function() {
			this._super();
			try {
				f.add_room(this.id, this);
				this.set("ffz_chatters", {});
			} catch(err) {
				f.error("add_room: " + err);
			}
		},

		willDestroy: function() {
			this._super();
			try {
				f.remove_room(this.id);
			} catch(err) {
				f.error("remove_room: " + err);
			}
		},

		clearMessages: function(user) {
			var t = this;
			if ( user ) {
				var msgs = t.get('messages'),
					total = msgs.get('length'),
					i = total,
					alternate;
				
				while(i--) {
					var msg = msgs.get(i);
					
					if ( msg.from === user ) {
						if ( f.settings.remove_deleted ) {
							if ( alternate === undefined )
								alternate = msg.ffz_alternate;
							msgs.removeAt(i);
							continue;
						}
						
						t.set('messages.' + i + '.ffz_deleted', true);
						if ( ! f.settings.prevent_clear )
							t.set('messages.' + i + '.deleted', true);
					}
					
					if ( alternate === undefined )
						alternate = msg.ffz_alternate;
					else {
						alternate = ! alternate;
						t.set('messages.' + i + '.ffz_alternate', alternate);
					}
				}

				if ( f.settings.mod_card_history ) {
					var room = f.rooms && f.rooms[t.get('id')],
						user_history = room && room.user_history && room.user_history[user]

					if ( user_history !== null && user_history !== undefined ) {
						var has_delete = false,
							last = user_history.length > 0 ? user_history[user_history.length-1] : null;

						has_delete = last !== null && last.is_delete;
						if ( has_delete ) {
							last.cachedTokens = ['User has been timed out ' + utils.number_commas(++last.deleted_times) + ' times.'];
						} else {
							user_history.push({from: 'jtv', is_delete: true, style: 'admin', cachedTokens: ['User has been timed out.'], deleted_times: 1, date: new Date()});
							while ( user_history.length > 20 )
								user_history.shift();
						}
					}
				}
			} else {
				if ( f.settings.prevent_clear )
					this.addTmiMessage("A moderator's attempt to clear chat was ignored.");
				else {
					var msgs = t.get("messages");
					t.set("messages", []);
					t.addMessage({
						style: 'admin',
						message: i18n("Chat was cleared by a moderator"),
						ffz_old_messages: msgs
					});
				}
			}
		},

		trimMessages: function() {
			var messages = this.get("messages"),
				len = messages.get("length"),
				limit = this.get("messageBufferSize");
			
			if ( len > limit )
				messages.removeAt(0, len - limit);
		},

		pushMessage: function(msg) {
			if ( this.shouldShowMessage(msg) ) {
				this.get("messages").pushObject(msg);
				this.trimMessages();

				"admin" === msg.style || ("whisper" === msg.style && ! this.ffz_whisper_room ) || this.incrementProperty("unreadCount", 1);
			}
		},

		addMessage: function(msg) {
			if ( msg ) {
				if ( ! f.settings.hosted_sub_notices && msg.style === 'notification' && HOSTED_SUB.test(msg.message) )
					return;
				
				var is_whisper = msg.style === 'whisper';
				if ( f.settings.group_tabs && f.settings.whisper_room ) {
					if ( ( is_whisper && ! this.ffz_whisper_room ) || ( ! is_whisper && this.ffz_whisper_room ) )
						return;
				}

				if ( ! is_whisper )
					msg.room = this.get('id');

				// Tokenization
				f.tokenize_chat_line(msg, false, this.get('roomProperties.hide_chat_links'));

				// Keep the history.
				if ( ! is_whisper && msg.from && msg.from !== 'jtv' && msg.from !== 'twitchnotify' && f.settings.mod_card_history ) {
					var room = f.rooms && f.rooms[msg.room];
					if ( room ) {
						var chat_history = room.user_history = room.user_history || {},
							user_history = room.user_history[msg.from] = room.user_history[msg.from] || [];
	
						user_history.push({
							from: msg.tags && msg.tags['display-name'] || msg.from,
							cachedTokens: msg.cachedTokens,
							style: msg.style,
							date: msg.date
						});
	
						if ( user_history.length > 20 )
							user_history.shift();
					}
				}

				// Check for message from us.
				if ( ! is_whisper ) {
					var user = f.get_user();
					if ( user && user.login === msg.from ) {
						var was_banned = this.get('ffz_banned');
						this.set('ffz_banned', false);

						// Update the wait time.
						if ( this.get('isSubscriber') || this.get('isModeratorOrHigher') || ! this.get('slowMode') )
							this.updateWait(0, was_banned)
						else if ( this.get('slowMode') )
							this.updateWait(this.get('slow'));
					}
				}
				
				// Also update chatters.
				if ( ! is_whisper && this.chatters && ! this.chatters[msg.from] && msg.from !== 'twitchnotify' && msg.from !== 'jtv' )
					this.ffzUpdateChatters(msg.from);
			}

			var out = this._super(msg);

			// Color processing.
			if ( msg.color )
				f._handle_color(msg.color);

			return out;
		},

		setHostMode: function(e) {
			this.set('ffz_host_target', e && e.hostTarget || null);
			var user = f.get_user();
			if ( user && f._cindex && this.get('id') === user.login )
				f._cindex.ffzUpdateHostButton();
			
			var Chat = App.__container__.lookup('controller:chat');
			if ( ! Chat || Chat.get('currentChannelRoom') !== this )
				return;

			return this._super(e);
		},

		send: function(text) {
			if ( f.settings.group_tabs && f.settings.whisper_room && this.ffz_whisper_room )
				return;

			try {
				if ( text ) {
					// Command History
					var mru = this.get('mru_list'),
						ind = mru.indexOf(text);
	
					if ( ind !== -1 )
						mru.splice(ind, 1)
					else if ( mru.length > 20 )
						mru.pop();
	
					mru.unshift(text);
				}
				
				var cmd = text.split(' ', 1)[0].toLowerCase();
				if ( cmd === "/ffz" ) {
					this.set("messageToSend", "");
					f.run_ffz_command(text.substr(5), this.get('id'));
					return;

				} else if ( cmd.charAt(0) === "/" && f.run_command(text, this.get('id')) ) {
					this.set("messageToSend", "");
					return;
				}

			} catch(err) {
				f.error("send: " + err);
			}

			return this._super(text);
		},

		ffzUpdateUnread: function() {
			if ( f.settings.group_tabs ) {
				var Chat = App.__container__.lookup('controller:chat');
				if ( Chat && Chat.get('currentRoom') === this )
					this.resetUnreadCount();
				else if ( f._chatv )
					f._chatv.ffzTabUnread(this.get('id'));
			}
		}.observes('unreadCount'),


		ffzInitChatterCount: function() {
			if ( ! this.tmiRoom )
				return;

			if ( this._ffz_chatter_timer ) {
				clearTimeout(this._ffz_chatter_timer);
				this._ffz_chatter_timer = undefined;
			}

			var room = this;
			this.tmiRoom.list().done(function(data) {
				var chatters = {};
				data = data.data.chatters;
				for(var i=0; i < data.admins.length; i++)
					chatters[data.admins[i]] = true;
				for(var i=0; i < data.global_mods.length; i++)
					chatters[data.global_mods[i]] = true;
				for(var i=0; i < data.moderators.length; i++)
					chatters[data.moderators[i]] = true;
				for(var i=0; i < data.staff.length; i++)
					chatters[data.staff[i]] = true;
				for(var i=0; i < data.viewers.length; i++)
					chatters[data.viewers[i]] = true;

				room.set("ffz_chatters", chatters);
				room.ffzUpdateChatters();
			}).always(function() {
				room._ffz_chatter_timer = setTimeout(room.ffzInitChatterCount.bind(room), 300000);
			});
		},


		ffzUpdateChatters: function(add, remove) {
			var chatters = this.get("ffz_chatters") || {};
			if ( add )
				chatters[add] = true;
			if ( remove && chatters[remove] )
				delete chatters[remove];

			if ( ! f.settings.chatter_count )
				return;

			if ( f._cindex )
				f._cindex.ffzUpdateChatters();

			try {
				if ( window.parent && window.parent.postMessage )
					window.parent.postMessage({from_ffz: true, command: 'chatter_count', message: Object.keys(this.get('ffz_chatters') || {}).length}, "http://www.twitch.tv/");
			} catch(err) { /* Ignore errors because of security */ }
		},


		ffzPatchTMI: function() {
			if ( this.get('ffz_is_patched') || ! this.get('tmiRoom') )
				return;

			if ( f.settings.chatter_count )
				this.ffzInitChatterCount();

			var tmi = this.get('tmiRoom'),
				room = this;

			// Let's get chatter information!
			// TODO: Remove this cause it's terrible.
			var connection = tmi._roomConn._connection;
			if ( ! connection.ffz_cap_patched ) {
				connection.ffz_cap_patched = true;
				connection._send("CAP REQ :twitch.tv/membership");

				connection.on("opened", function() {
						this._send("CAP REQ :twitch.tv/membership");
					}, connection);
			}


			// NOTICE for catching slow-mode updates
			tmi.on('notice', function(msg) {
				if ( msg.msgId === 'msg_slowmode' ) {
					var match = /in (\d+) seconds/.exec(msg.message);
					if ( match ) {
						room.updateWait(parseInt(match[1]));
					}
				}

				if ( msg.msgId === 'msg_timedout' ) {
					var match = /for (\d+) more seconds/.exec(msg.message);
					if ( match ) {
						room.set('ffz_banned', true);
						room.updateWait(parseInt(match[1]));
					}
				}

				if ( msg.msgId === 'msg_banned' ) {
					room.set('ffz_banned', true);
					f._roomv && f._roomv.ffzUpdateStatus();
				}

				if ( msg.msgId === 'hosts_remaining' ) {
					var match = /(\d+) host command/.exec(msg.message);
					if ( match ) {
						room.set('ffz_hosts_left', parseInt(match[1] || 0));
						f._cindex && f._cindex.ffzUpdateHostButton();
					}
				}
			});

			// Check this shit.
			tmi._roomConn._connection.off("message", tmi._roomConn._onIrcMessage, tmi._roomConn);

			tmi._roomConn._onIrcMessage = function(ircMsg) {
				if ( ircMsg.target != this.ircChannel )
					return;

				switch ( ircMsg.command ) {
					case "JOIN":
						if ( this._session && this._session.nickname === ircMsg.sender ) {
							this._onIrcJoin(ircMsg);
						} else
							f.settings.chatter_count && room.ffzUpdateChatters(ircMsg.sender);
						break;

					case "PART":
						if ( this._session && this._session.nickname === ircMsg.sender ) {
							this._resetActiveState();
							this._connection._exitedRoomConn();
							this._trigger("exited");
						} else
							f.settings.chatter_count && room.ffzUpdateChatters(null, ircMsg.sender);
						break;

					default:
						break;
				}
			}

			tmi._roomConn._connection.on("message", tmi._roomConn._onIrcMessage, tmi._roomConn);

			this.set('ffz_is_patched', true);

		}.observes('tmiRoom'),

		// Room State Stuff
		
		slowMode: function() {
			return this.get('slow') > 0;
		}.property('slow'),
		
		onSlowOff: function() {
			if ( ! this.get('slowMode') )
				this.updateWait(0);
		}.observes('slowMode')
	});
}
},{"../constants":5,"../utils":35}],14:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_viewers = function() {
	this.log("Hooking the Ember Viewers controller.");

	var Viewers = App.__container__.resolve('controller:viewers');
	this._modify_viewers(Viewers);
}


FFZ.prototype._modify_viewers = function(controller) {
	var f = this;

	controller.reopen({
		lines: function() {
			var viewers = this._super();
			try {
				var categories = [],
					data = {},
					last_category = null;

				// Get the broadcaster name.
				var Channel = App.__container__.lookup('controller:channel'),
					room_id = this.get('parentController.model.id'),
					broadcaster = Channel && Channel.get('id');

				// We can get capitalization for the broadcaster from the channel.
				if ( broadcaster ) {
					var display_name = Channel.get('display_name');
					if ( display_name )
						FFZ.capitalization[broadcaster] = [display_name, Date.now()];
				}

				// If the current room isn't the channel's chat, then we shouldn't
				// display them as the broadcaster.
				if ( room_id != broadcaster )
					broadcaster = null;

				// Now, break the viewer array down into something we can use.
				for(var i=0; i < viewers.length; i++) {
					var entry = viewers[i];
					if ( entry.category ) {
						last_category = entry.category;
						categories.push(last_category);
						data[last_category] = [];

					} else {
						var viewer = entry.chatter.toLowerCase();
						if ( ! viewer )
							continue;

						// If the viewer is the broadcaster, give them their own
						// group. Don't put them with normal mods!
						if ( viewer == broadcaster ) {
							categories.unshift("Broadcaster");
							data["Broadcaster"] = [viewer];

						} else if ( data.hasOwnProperty(last_category) )
							data[last_category].push(viewer);
					}
				}

				// Now, rebuild the viewer list. However, we're going to actually
				// sort it this time.
				viewers = [];
				for(var i=0; i < categories.length; i++) {
					var category = categories[i],
						chatters = data[category];

					if ( ! chatters || ! chatters.length )
						continue;

					viewers.push({category: category});
					viewers.push({chatter: ""});

					// Push the chatters, capitalizing them as we go.
					chatters.sort();
					while(chatters.length) {
						var viewer = chatters.shift();
						viewer = FFZ.get_capitalization(viewer);
						viewers.push({chatter: viewer});
					}
				}

			} catch(err) {
				f.error("ViewersController lines: " + err);
			}

			return viewers;
		}.property("content.chatters")
	});
}
},{}],15:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	MOD_CSS = /[^\n}]*\.badges\s+\.moderator\s*{\s*background-image:\s*url\(\s*['"]([^'"]+)['"][^}]+(?:}|$)/,
	constants = require('./constants'),
	utils = require('./utils'),


	check_margins = function(margins, height) {
		var mlist = margins.split(/ +/);
		if ( mlist.length != 2 )
			return margins;

		mlist[0] = parseFloat(mlist[0]);
		mlist[1] = parseFloat(mlist[1]);

		if ( mlist[0] == (height - 18) / -2 && mlist[1] == 0 )
			return null;

		return margins;
	},


	build_legacy_css = function(emote) {
		var margin = emote.margins, srcset = "";
		if ( ! margin )
			margin = ((emote.height - 18) / -2) + "px 0";

		if ( emote.urls[2] || emote.urls[4] ) {
			srcset = 'url("' + emote.urls[1] + '") 1x';
			if ( emote.urls[2] )
				srcset += ', url("' + emote.urls[2] + '") 2x';
			if ( emote.urls[4] )
				srcset += ', url("' + emote.urls[4] + '") 4x';

			srcset = '-webkit-image-set(' + srcset + '); image-set(' + srcset + ');';
		}

		return ".ffz-emote-" + emote.id + ' { background-image: url("' + emote.urls[1] + '"); height: ' + emote.height + "px; width: " + emote.width + "px; margin: " + margin + (srcset ? '; ' + srcset : '') + (emote.css ? "; " + emote.css : "") + "}\n";
	},


	build_new_css = function(emote) {
		if ( ! emote.margins && ! emote.css )
			return build_legacy_css(emote);

		return build_legacy_css(emote) + 'img[src="' + emote.urls[1] + '"] { ' + (emote.margins ? "margin: " + emote.margins + ";" : "") + (emote.css || "") + " }\n";
	},


	build_css = build_new_css,

	from_code_point = function(cp) {
		var code = typeof cp === "string" ? parseInt(cp, 16) : cp;
		if ( code < 0x10000)
			return String.fromCharCode(code);

		code -= 0x10000;
		return String.fromCharCode(
			0xD800 + (code >> 10),
			0xDC00 + (code & 0x3FF)
		);
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_emoticons = function() {
	this.log("Preparing emoticon system.");

	this.emoji_data = {};
	this.emoji_names = {};

	this.emote_sets = {};
	this.global_sets = [];
	this.default_sets = [];
	this._last_emote_id = 0;

	// Usage Data
	this.emote_usage = {};


	this.log("Creating emoticon style element.");
	var s = this._emote_style = document.createElement('style');
	s.id = "ffz-emoticon-css";
	document.head.appendChild(s);

	this.log("Loading global emote sets.");
	this.load_global_sets();

	this.log("Loading emoji data.");
	this.load_emoji_data();

	this.log("Watching Twitch emoticon parser to ensure it loads.");
	this._twitch_emote_check = setTimeout(this.check_twitch_emotes.bind(this), 10000);
}


// ------------------------
// Emote Usage
// ------------------------

FFZ.prototype.add_usage = function(room_id, emote_id, count) {
	var rooms = this.emote_usage[emote_id] = this.emote_usage[emote_id] || {};
	rooms[room_id] = (rooms[room_id] || 0) + (count || 1);

	if ( this._emote_report_scheduled )
		return;

	this._emote_report_scheduled = setTimeout(this._report_emotes.bind(this), 30000);
}


FFZ.prototype._report_emotes = function() {
	if ( this._emote_report_scheduled )
		delete this._emote_report_scheduled;

	var usage = this.emote_usage;
	this.emote_usage = {};
	this.ws_send("emoticon_uses", [usage], function(){}, true);
}


// ------------------------
// Twitch Emoticon Checker
// ------------------------

FFZ.prototype.check_twitch_emotes = function() {
	if ( this._twitch_emote_check ) {
		clearTimeout(this._twitch_emote_check);
		delete this._twitch_emote_check;
	}

	var room;
	if ( this.rooms ) {
		for(var key in this.rooms) {
			if ( this.rooms.hasOwnProperty(key) ) {
				room = this.rooms[key];
				break;
			}
		}
	}

	if ( ! room || ! room.room || ! room.room.tmiSession ) {
		this._twitch_emote_check = setTimeout(this.check_twitch_emotes.bind(this), 10000);
		return;
	}

	var parser = room.room.tmiSession._emotesParser,
		emotes = Object.keys(parser.emoticonRegexToIds).length;

	// If we have emotes, we're done!
	if ( emotes > 0 )
		return;

	// No emotes. Try loading them.
	var sets = parser.emoticonSetIds;
	parser.emoticonSetIds = "";
	parser.updateEmoticons(sets);

	// Check again in a bit to see if we've got them.
	this._twitch_emote_check = setTimeout(this.check_twitch_emotes.bind(this), 10000);
}



// ---------------------
// Set Management
// ---------------------

FFZ.prototype.getEmotes = function(user_id, room_id) {
	var user = this.users && this.users[user_id],
		room = this.rooms && this.rooms[room_id];

	return _.union(user && user.sets || [], room && room.set && [room.set] || [], room && room.extra_sets || [], this.default_sets);
}


// ---------------------
// Commands
// ---------------------

FFZ.ws_commands.reload_set = function(set_id) {
	if ( this.emote_sets.hasOwnProperty(set_id) )
		this.load_set(set_id);
}


FFZ.ws_commands.load_set = function(set_id) {
	this.load_set(set_id);
}


// ---------------------
// Tooltip Powah!
// ---------------------

FFZ.prototype._emote_tooltip = function(emote) {
	if ( ! emote )
		return null;

	if ( emote._tooltip )
		return emote._tooltip;

	var set = this.emote_sets[emote.set_id],
		owner = emote.owner,
		title = set && set.title || "Global";

	emote._tooltip = "Emoticon: " + (emote.hidden ? "???" : emote.name) + "\nFFZ " + title + (owner ? "\nBy: " + owner.display_name : "");
	return emote._tooltip;
}


// ---------------------
// Emoji Loading
// ---------------------

FFZ.prototype.load_emoji_data = function(callback, tries) {
	var f = this;
	jQuery.getJSON(constants.SERVER + "emoji/emoji.json")
		.done(function(data) {
			var new_data = {},
				by_name = {};
			for(var eid in data) {
				var emoji = data[eid];
				eid = eid.toLowerCase();
				emoji.code = eid;
				
				new_data[eid] = emoji;
				by_name[emoji.short_name] = eid;

				emoji.raw = _.map(emoji.code.split("-"), from_code_point).join("");

				emoji.src = constants.SERVER + 'emoji/' + eid + '-1x.png';
				emoji.srcSet = emoji.src + ' 1x, ' + constants.SERVER + 'emoji/' + eid + '-2x.png 2x, ' + constants.SERVER + 'emoji/' + eid + '-4x.png 4x';

				emoji.token = {
					srcSet: emoji.srcSet,
					emoticonSrc: emoji.src,
					ffzEmoji: eid,
					altText: emoji.raw
					};
				
			}

			f.emoji_data = new_data;
			f.emoji_names = by_name;
			
			f.log("Loaded data on " + Object.keys(new_data).length + " emoji.");
			if ( typeof callback === "function" )
				callback(true, data);

		}).fail(function(data) {
			if ( data.status === 404 )
				return typeof callback === "function" && callback(false);

			tries = (tries || 0) + 1;
			if ( tries < 50 )
				return f.load_emoji(callback, tries);

			return typeof callback === "function" && callback(false);
		});
}


// ---------------------
// Set Loading
// ---------------------

FFZ.prototype.load_global_sets = function(callback, tries) {
	var f = this;
	jQuery.getJSON(((tries||0)%2 === 0 ? constants.API_SERVER : constants.API_SERVER_2) + "v1/set/global")
		.done(function(data) {
			f.default_sets = data.default_sets;
			var gs = f.global_sets = [],
				sets = data.sets || {};

			if ( f.feature_friday && f.feature_friday.set ) {
				if ( f.global_sets.indexOf(f.feature_friday.set) === -1 )
					f.global_sets.push(f.feature_friday.set);
				if ( f.default_sets.indexOf(f.feature_friday.set) === -1 )
					f.default_sets.push(f.feature_friday.set);
			}

			for(var key in sets) {
				if ( ! sets.hasOwnProperty(key) )
					continue;

				var set = sets[key];
				gs.push(key);
				f._load_set_json(key, undefined, set);
			}
		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback == "function" && callback(false);

			tries = tries || 0;
			tries++;
			if ( tries < 50 )
				return f.load_global_sets(callback, tries);

			return typeof callback == "function" && callback(false);
		});
}


FFZ.prototype.load_set = function(set_id, callback, tries) {
	var f = this;
	jQuery.getJSON(((tries||0)%2 === 0 ? constants.API_SERVER : constants.API_SERVER_2)  + "v1/set/" + set_id)
		.done(function(data) {
			f._load_set_json(set_id, callback, data && data.set);

		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback == "function" && callback(false);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return f.load_set(set_id, callback, tries);

			return typeof callback == "function" && callback(false);
		});
}


FFZ.prototype.unload_set = function(set_id) {
	var set = this.emote_sets[set_id];
	if ( ! set )
		return;

	this.log("Unloading emoticons for set: " + set_id);

	utils.update_css(this._emote_style, set_id, null);
	delete this.emote_sets[set_id];
}


FFZ.prototype._load_set_json = function(set_id, callback, data) {
	if ( ! data )
		return typeof callback == "function" && callback(false);

	// Do we have existing users?
	var users = this.emote_sets[set_id] && this.emote_sets[set_id].users || [];

	// Store our set.
	this.emote_sets[set_id] = data;
	data.users = users;
	data.count = 0;


	// Iterate through all the emoticons, building CSS and regex objects as appropriate.
	var output_css = "",
		ems = data.emoticons;

	data.emoticons = {};

	for(var i=0; i < ems.length; i++) {
		var emote = ems[i];

		emote.klass = "ffz-emote-" + emote.id;
		emote.set_id = set_id;

		emote.srcSet = emote.urls[1] + " 1x";
		if ( emote.urls[2] )
			emote.srcSet += ", " + emote.urls[2] + " 2x";
		if ( emote.urls[4] )
			emote.srcSet += ", " + emote.urls[4] + " 4x";

		if ( emote.name[emote.name.length-1] === "!" )
			emote.regex = new RegExp("(^|\\W|\\b)(" + emote.name + ")(?=\\W|$)", "g");
		else
			emote.regex = new RegExp("(^|\\W|\\b)(" + emote.name + ")\\b", "g");

		output_css += build_css(emote);
		data.count++;
		data.emoticons[emote.id] = emote;
	}

	utils.update_css(this._emote_style, set_id, output_css + (data.css || ""));
	this.log("Updated emoticons for set #" + set_id + ": " + data.title, data);

	if ( this._cindex )
		this._cindex.ffzFixTitle();

	this.update_ui_link();

	if ( callback )
		callback(true, data);
}
},{"./constants":5,"./utils":35}],16:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),
	SENDER_REGEX = /(\sdata-sender="[^"]*"(?=>))/;


// --------------------
// Initialization
// --------------------

FFZ.prototype.find_bttv = function(increment, delay) {
	this.has_bttv = false;
	if ( window.BTTVLOADED )
		return this.setup_bttv(delay||0);

	if ( delay >= 60000 )
		this.log("BetterTTV was not detected after 60 seconds.");
	else
		setTimeout(this.find_bttv.bind(this, increment, (delay||0) + increment),
			increment);
}


FFZ.prototype.setup_bttv = function(delay) {
	this.log("BetterTTV was detected after " + delay + "ms. Hooking.");
	this.has_bttv = true;

	// this.track('setCustomVariable', '3', 'BetterTTV', BetterTTV.info.versionString());

	// Disable Dark if it's enabled.
	document.body.classList.remove("ffz-dark");
	if ( this._dark_style ) {
		this._dark_style.parentElement.removeChild(this._dark_style);
		this._dark_style = undefined;
	}

	if ( this._layout_style ) {
		this._layout_style.parentElement.removeChild(this._layout_style);
		this._layout_style = undefined;
	}

	if ( this._chat_style ) {
		utils.update_css(this._chat_style, 'chat_font_size', '');
		utils.update_css(this._chat_style, 'chat_ts_font_size', '');
	}

	// Disable Chat Tabs
	if ( this.settings.group_tabs && this._chatv ) {
		this._chatv.ffzDisableTabs();
	}

	if ( this._roomv ) {
		// Disable Chat Pause
		if ( this.settings.chat_hover_pause )
			this._roomv.ffzDisableFreeze();

		// And hide the status
		if ( this.settings.room_status )
			this._roomv.ffzUpdateStatus();
	}

	// Disable other features too.
	document.body.classList.remove("ffz-chat-colors");
	document.body.classList.remove("ffz-chat-colors-gray");
	document.body.classList.remove("ffz-chat-background");
	document.body.classList.remove("ffz-chat-padding");
	document.body.classList.remove("ffz-chat-separator");
	document.body.classList.remove("ffz-chat-separator-3d");
	document.body.classList.remove("ffz-sidebar-swap");
	document.body.classList.remove("ffz-transparent-badges");
	document.body.classList.remove("ffz-high-contrast-chat-text");
	document.body.classList.remove("ffz-high-contrast-chat-bg");
	document.body.classList.remove("ffz-high-contrast-chat-bold");

	// Remove Following Count
	if ( this.settings.following_count ) {
		this._schedule_following_count();
		this._draw_following_count();
		this._draw_following_channels();
	}

	// Remove Sub Count
	if ( this.is_dashboard )
		this._update_subscribers();

	document.body.classList.add('ffz-bttv');

	// Send Message Behavior
	var original_send = BetterTTV.chat.helpers.sendMessage, f = this;
	BetterTTV.chat.helpers.sendMessage = function(message) {
		var cmd = message.split(' ', 1)[0].toLowerCase();

		if ( cmd === "/ffz" )
			f.run_ffz_command(message.substr(5), BetterTTV.chat.store.currentRoom);
		else
			return original_send(message);
	}


	// Ugly Hack for Current Room, as this is stripped out before we get to
	// the actual privmsg renderer.
	var original_handler = BetterTTV.chat.handlers.onPrivmsg,
		received_room;
	BetterTTV.chat.handlers.onPrivmsg = function(room, data) {
		received_room = room;
		var output = original_handler(room, data);
		received_room = null;
		return output;
	}


	// Message Display Behavior
	var original_privmsg = BetterTTV.chat.templates.privmsg;
	BetterTTV.chat.templates.privmsg = function(highlight, action, server, isMod, data) {
		try {
			// Handle badges.
			f.bttv_badges(data);

			// Now, do everything else manually because things are hard-coded.
			return '<div class="chat-line'+(highlight?' highlight':'')+(action?' action':'')+(server?' admin':'')+'" data-sender="'+(data.sender||"").toLowerCase()+'" data-room="'+received_room+'">'+
				BetterTTV.chat.templates.timestamp(data.time)+' '+
				(isMod?BetterTTV.chat.templates.modicons():'')+' '+
				BetterTTV.chat.templates.badges(data.badges)+
				BetterTTV.chat.templates.from(data.nickname, data.color)+
				BetterTTV.chat.templates.message(data.sender, data.message, data.emotes, action?data.color:false)+
				'</div>';
		} catch(err) {
			f.log("Error: ", err);
			return original_privmsg(highlight, action, server, isMod, data);
		}
	}

	// Whispers too!
	var original_whisper = BetterTTV.chat.templates.whisper;
	BetterTTV.chat.templates.whisper = function(data) {
		try {
			// Handle badges.
			f.bttv_badges(data);

			// Now, do everything else manually because things are hard-coded.
			return '<div class="chat-line whisper" data-sender="' + data.sender + '">' +
				BetterTTV.chat.templates.timestamp(data.time) + ' ' +
				(data.badges && data.badges.length ? BetterTTV.chat.templates.badges(data.badges) : '') +
				BetterTTV.chat.templates.whisperName(data.sender, data.receiver, data.from, data.to, data.fromColor, data.toColor) +
				BetterTTV.chat.templates.message(data.sender, data.message, data.emotes, false) +
				'</div>';
		} catch(err) {
			f.log("Error: ", err);
			return original_whisper(data);
		}
	}

	// Message Renderer. I had to completely rewrite this method to get it to
	// use my replacement emoticonizer.
	var original_message = BetterTTV.chat.templates.message,
		received_sender;
	BetterTTV.chat.templates.message = function(sender, message, emotes, colored) {
		try {
			colored = colored || false;
			var rawMessage = encodeURIComponent(message);

			if(sender !== 'jtv') {
				// Hackilly send our state across.
				received_sender = sender;
				var tokenizedMessage = BetterTTV.chat.templates.emoticonize(message, emotes);
				received_sender = null;

				for(var i=0; i<tokenizedMessage.length; i++) {
					if(typeof tokenizedMessage[i] === 'string') {
						tokenizedMessage[i] = BetterTTV.chat.templates.bttvMessageTokenize(sender, tokenizedMessage[i]);
					} else {
						tokenizedMessage[i] = tokenizedMessage[i][0];
					}
				}

				message = tokenizedMessage.join(' ');
			}

			return '<span class="message" '+(colored?'style="color: '+colored+'" ':'')+'data-raw="'+rawMessage+'" data-emotes="'+(emotes ? encodeURIComponent(JSON.stringify(emotes)) : 'false')+'">'+message+'</span>';
		} catch(err) {
			f.log("Error: ", err);
			return original_message(sender, message, emotes, colored);
		}
	};

	// Emoticonize
	var original_emoticonize = BetterTTV.chat.templates.emoticonize;
	BetterTTV.chat.templates.emoticonize = function(message, emotes) {
		var tokens = original_emoticonize(message, emotes),

			room = (received_room || BetterTTV.getChannel()),
			l_room = room && room.toLowerCase(),
			l_sender = received_sender && received_sender.toLowerCase(),
			sets = f.getEmotes(l_sender, l_room),
			emotes = [],
			user = f.get_user(),
			mine = user && user.login === l_sender;

		// Build a list of emotes that match.
		_.each(sets, function(set_id) {
			var set = f.emote_sets[set_id];
			if ( ! set )
				return;

			_.each(set.emoticons, function(emote) {
				_.any(tokens, function(token) {
					return _.isString(token) && token.match(emote.regex);
				}) && emotes.push(emote);
			});
		});

		// Don't bother proceeding if we have no emotes.
		if ( emotes.length ) {
			// Why is emote parsing so bad? ;_;
			_.each(emotes, function(emote) {
				var tooltip = f._emote_tooltip(emote),
					eo = ['<img class="emoticon" data-ffz-emote="' + emote.id + '" srcset="' + (emote.srcSet || "") + '" src="' + emote.urls[1] + '" data-regex="' + emote.name + '" title="' + tooltip + '" />'],
					old_tokens = tokens;

				tokens = [];

				for(var i=0; i < old_tokens.length; i++) {
					var token = old_tokens[i];
					if ( typeof token != "string" ) {
						tokens.push(token);
						continue;
					}

					var tbits = token.split(emote.regex);
					while(tbits.length) {
						var bit = tbits.shift();
						if ( tbits.length ) {
							bit += tbits.shift();
							if ( bit )
								tokens.push(bit);

							tbits.shift();
							tokens.push(eo);

							if ( mine && l_room )
								f.add_usage(l_room, emote.id);

						} else
							tokens.push(bit);
					}
				}
			});
		}

		// Sneak in Emojicon Processing
		/*
		if ( f.settings.parse_emoji && f.emoji_data ) {
			var old_tokens = tokens;
			tokens = [];

			for(var i=0; i < old_tokens.length; i++) {
				var token = old_tokens[i];
				if ( typeof token !== "string" ) {
					tokens.push(token);
					continue;
				}

				var tbits = token.split(constants.EMOJI_REGEX);
				while(tbits.length) {
					var bit = tbits.shift();
					bit && tokens.push(bit);

					if ( tbits.length ) {
						var match = tbits.shift(),
							variant = tbits.shift();

						if ( variant === '\uFE0E' )
							bits.push(match);
						else {
							var eid = utils.emoji_to_codepoint(match, variant),
								data = f.emoji_data[eid];

							if ( data ) {
								tokens.push(['<img class="emoticon" height="18px" srcset="' + (data.srcSet || "") + '" src="' + data.src + '" alt="' + alt + '" title="Emoji: ' + data.raw + '\nName: :' + data.short_name + ':">']);
							} else
								tokens.push(match + (variant || ""));
						}
					}
				}
			}
		}*/

		return tokens;
	}

	this.update_ui_link();
}
},{"../constants":5,"../utils":35}],17:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.find_emote_menu = function(increment, delay) {
	this.has_emote_menu = false;
	if ( window.emoteMenu && emoteMenu.registerEmoteGetter )
		return this.setup_emote_menu(delay||0);

	if ( delay >= 60000 )
		this.log("Emote Menu for Twitch was not detected after 60 seconds.");
	else
		setTimeout(this.find_emote_menu.bind(this, increment, (delay||0) + increment),
			increment);
}


FFZ.prototype.setup_emote_menu = function(delay) {
	this.log("Emote Menu for Twitch was detected after " + delay + "ms. Registering emote enumerator.");
	emoteMenu.registerEmoteGetter("FrankerFaceZ", this._emote_menu_enumerator.bind(this));
}


// --------------------
// Emote Enumerator
// --------------------

FFZ.prototype._emote_menu_enumerator = function() {
	var twitch_user = this.get_user(),
		user_id = twitch_user ? twitch_user.login : null,
		controller = App.__container__.lookup('controller:chat'),
		room_id = controller ? controller.get('currentRoom.id') : null,
		sets = this.getEmotes(user_id, room_id),
		emotes = [];

	for(var x = 0; x < sets.length; x++) {
		var set = this.emote_sets[sets[x]];
		if ( ! set || ! set.emoticons )
			continue;

		for(var emote_id in set.emoticons) {
			if ( ! set.emoticons.hasOwnProperty(emote_id) )
				continue;

			var emote = set.emoticons[emote_id];
			if ( emote.hidden )
				continue;

			var title = "FrankerFaceZ " + set.title,
				badge = set.icon || '//cdn.frankerfacez.com/script/devicon.png';

			emotes.push({text: emote.name, url: emote.urls[1],
				hidden: false, channel: title, badge: badge});
		}
	}

	return emotes;
}
},{}],18:[function(require,module,exports){
// Modify Array and others.
// require('./shims');

// ----------------
// The Constructor
// ----------------

var FFZ = window.FrankerFaceZ = function() {
	FFZ.instance = this;

	// Logging
	this._log_data = [];

	// Get things started.
	this.initialize();
}


FFZ.get = function() { return FFZ.instance; }


// Version
var VER = FFZ.version_info = {
	major: 3, minor: 5, revision: 13,
	toString: function() {
		return [VER.major, VER.minor, VER.revision].join(".") + (VER.extra || "");
	}
}


// Logging

FFZ.prototype.log = function(msg, data, to_json, log_json) {
	msg = "FFZ: " + msg + (to_json ? " -- " + JSON.stringify(data) : "");
	this._log_data.push(msg + ((!to_json && log_json) ? " -- " + JSON.stringify(data) : ""));

	if ( data !== undefined && console.groupCollapsed && console.dir ) {
		console.groupCollapsed(msg);
		if ( navigator.userAgent.indexOf("Firefox/") !== -1 )
			console.log(data);
		else
			console.dir(data);

		console.groupEnd(msg);
	} else
		console.log(msg);
}


FFZ.prototype.error = function(msg, data, to_json) {
	msg = "FFZ Error: " + msg + (to_json ? " -- " + JSON.stringify(data) : "");
	this._log_data.push(msg);

	if ( data !== undefined && console.groupCollapsed && console.dir ) {
		console.groupCollapsed(msg);
		if ( navigator.userAgent.indexOf("Firefox/") !== -1 )
			console.log(data);
		else
			console.dir(data);

		console.groupEnd(msg);
	} else
		console.assert(false, msg);
}


FFZ.prototype.paste_logs = function() {
	this._pastebin(this._log_data.join("\n"), function(url) {
		if ( ! url )
			return console.log("FFZ Error: Unable to upload log to pastebin.");

		console.log("FFZ: Your FrankerFaceZ log has been pasted to: " + url);
	});
}


FFZ.prototype._pastebin = function(data, callback) {
	jQuery.ajax({url: "http://putco.de/", type: "PUT", data: data, context: this})
		.success(function(e) {
			callback.bind(this)(e.trim() + ".log");
		}).fail(function(e) {
			callback.bind(this)(null);
		});
}


// -------------------
// User Data
// -------------------

FFZ.prototype.get_user = function() {
	if ( window.PP && PP.login ) {
		return PP;
	} else if ( window.App ) {
		var nc = App.__container__.lookup("controller:login");
		return nc ? nc.get("userData") : undefined;
	}
}


// -------------------
// Import Everything!
// -------------------

// Import these first to set up data structures
require('./ui/menu');
require('./settings');
require('./socket');

require('./colors');
require('./emoticons');
require('./badges');
require('./tokenize');


// Analytics: require('./ember/router');
require('./ember/channel');
//require('./ember/player');
require('./ember/room');
require('./ember/layout');
require('./ember/line');
require('./ember/chatview');
require('./ember/viewers');
require('./ember/moderation-card');
require('./ember/chat-input');
//require('./ember/teams');

require('./debug');

require('./ext/betterttv');
require('./ext/emote_menu');

require('./featurefriday');

require('./ui/styles');
require('./ui/dark');
require('./ui/notifications');
require('./ui/viewer_count');
require('./ui/sub_count');

require('./ui/menu_button');
require('./ui/following');
require('./ui/following-count');
require('./ui/races');
require('./ui/my_emotes');
require('./ui/about_page');

require('./commands');


// ---------------
// Initialization
// ---------------

FFZ.prototype.initialize = function(increment, delay) {
	// Make sure that FrankerFaceZ doesn't start setting itself up until the
	// Twitch ember application is ready.

	// Check for the player
	if ( location.hostname === 'player.twitch.tv' ) {
		//this.init_player(delay);
		return;
	}

	// Check for special non-ember pages.
	if ( /^\/(?:$|search$|user\/|p\/|settings|m\/|messages?\/)/.test(location.pathname) ) {
		this.init_normal(delay);
		return;
	}

	if ( location.hostname === 'passport' && /^\/(?:authorize)/.test(location.pathname) ) {
		this.log("Running on passport!");
		this.init_normal(delay, true);
		return;
	}

	// Check for the dashboard.
	if ( /\/[^\/]+\/dashboard/.test(location.pathname) && !/bookmarks$/.test(location.pathname) ) {
		this.init_dashboard(delay);
		return;
	}

	var loaded = window.App != undefined &&
				 App.__container__ != undefined &&
				 App.__container__.resolve('model:room') != undefined;

	if ( !loaded ) {
		increment = increment || 10;
		if ( delay >= 60000 )
			this.log("Twitch application not detected in \"" + location.toString() + "\". Aborting.");
		else
			setTimeout(this.initialize.bind(this, increment, (delay||0) + increment),
				increment);
		return;
	}

	this.init_ember(delay);
}


FFZ.prototype.init_player = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch Player after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = false;
	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Literally only make it dark.
	this.load_settings();
	this.setup_dark();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.init_normal = function(delay, no_socket) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found non-Ember Twitch after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = false;
	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();

	if ( ! no_socket )
		this.ws_create();

	this.setup_colors();
	this.setup_emoticons();
	this.setup_badges();

	this.setup_notifications();
	this.setup_following_count(false);
	this.setup_css();
	this.setup_menu();

	this.find_bttv(10);

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.is_dashboard = false;

FFZ.prototype.init_dashboard = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch Dashboard after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = true;
	this.embed_in_dash = false;

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();

	this.ws_create();
	this.setup_colors();
	this.setup_emoticons();
	this.setup_badges();

	this.setup_tokenization();
	this.setup_notifications();
	this.setup_css();

	this._update_subscribers();

	// Set up the FFZ message passer.
	this.setup_message_event();

	this.find_bttv(10);

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


FFZ.prototype.init_ember = function(delay) {
	var start = (window.performance && performance.now) ? performance.now() : Date.now();
	this.log("Found Twitch application after " + (delay||0) + " ms in \"" + location + "\". Initializing FrankerFaceZ version " + FFZ.version_info);

	this.users = {};
	this.is_dashboard = false;
	try {
		this.embed_in_dash = window.top !== window && /\/[^\/]+\/dashboard/.test(window.top.location.pathname) && !/bookmarks$/.test(window.top.location.pathname);
	} catch(err) { this.embed_in_dash = false; }

	// Initialize all the modules.
	this.load_settings();

	// Start this early, for quick loading.
	this.setup_dark();

	this.ws_create();
	this.setup_emoticons();
	this.setup_badges();

	//this.setup_router();
	this.setup_colors();
	this.setup_tokenization();
	//this.setup_player();
	this.setup_channel();
	this.setup_room();
	this.setup_line();
	this.setup_layout();
	this.setup_chatview();
	this.setup_viewers();
	this.setup_mod_card();
	this.setup_chat_input();

	//this.setup_teams();

	this.setup_notifications();
	this.setup_css();
	this.setup_menu();
	this.setup_my_emotes();
	this.setup_following();
	this.setup_following_count(true);
	this.setup_races();

	this.connect_extra_chat();

	this.find_bttv(10);
	this.find_emote_menu(10);

	this.check_ff();

	var end = (window.performance && performance.now) ? performance.now() : Date.now(),
		duration = end - start;

	this.log("Initialization complete in " + duration + "ms");
}


// ------------------------
// Dashboard Message Event
// ------------------------

FFZ.prototype.setup_message_event = function() {
	this.log("Listening for Window Messages.");
	window.addEventListener("message", this._on_window_message.bind(this), false);
}


FFZ.prototype._on_window_message = function(e) {
	if ( ! e.data || ! e.data.from_ffz )
		return;

	var msg = e.data;
}
},{"./badges":2,"./colors":3,"./commands":4,"./debug":6,"./ember/channel":7,"./ember/chat-input":8,"./ember/chatview":9,"./ember/layout":10,"./ember/line":11,"./ember/moderation-card":12,"./ember/room":13,"./ember/viewers":14,"./emoticons":15,"./ext/betterttv":16,"./ext/emote_menu":17,"./featurefriday":19,"./settings":20,"./socket":21,"./tokenize":22,"./ui/about_page":23,"./ui/dark":24,"./ui/following":26,"./ui/following-count":25,"./ui/menu":27,"./ui/menu_button":28,"./ui/my_emotes":29,"./ui/notifications":30,"./ui/races":31,"./ui/styles":32,"./ui/sub_count":33,"./ui/viewer_count":34}],19:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.feature_friday = null;


// --------------------
// Check FF
// --------------------

FFZ.prototype.check_ff = function(tries) {
	if ( ! tries )
		this.log("Checking for Feature Friday data...");

	jQuery.ajax(constants.SERVER + "script/event.json", {cache: false, dataType: "json", context: this})
		.done(function(data) {
			return this._load_ff(data);
		}).fail(function(data) {
			if ( data.status == 404 )
				return this._load_ff(null);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return setTimeout(this.check_ff.bind(this, tries), 250);

			return this._load_ff(null);
		});
}


FFZ.ws_commands.reload_ff = function() {
	this.check_ff();
}


// --------------------
// Rendering UI
// --------------------

FFZ.prototype._feature_friday_ui = function(room_id, parent, view) {
	if ( ! this.feature_friday || this.feature_friday.channel == room_id )
		return;

	this._emotes_for_sets(parent, view, [this.feature_friday.set], this.feature_friday.title, this.feature_friday.icon, "FrankerFaceZ");

	// Before we add the button, make sure the channel isn't the
	// current channel.
	var Channel = App.__container__.lookup('controller:channel');
	if ( Channel && Channel.get('id') == this.feature_friday.channel )
		return;


	var ff = this.feature_friday, f = this,
		btnc = document.createElement('div'),
		btn = document.createElement('a');

	btnc.className = 'chat-menu-content';
	btnc.style.textAlign = 'center';

	var message = ff.display_name + (ff.live ? " is live now!" : "");

	btn.className = 'button primary';
	btn.classList.toggle('live', ff.live);
	btn.classList.toggle('blue', this.has_bttv && BetterTTV.settings.get('showBlueButtons'));

	btn.href = "http://www.twitch.tv/" + ff.channel;
	btn.title = message;
	btn.target = "_new";
	btn.innerHTML = "<span>" + message + "</span>";

	// Track the number of users to click this button.
	// btn.addEventListener('click', function() { f.track('trackLink', this.href, 'link'); });

	btnc.appendChild(btn);
	parent.appendChild(btnc);
}


// --------------------
// Loading Data
// --------------------

FFZ.prototype._load_ff = function(data) {
	// Check for previous Feature Friday data and remove it.
	if ( this.feature_friday ) {
		// Remove the global set, delete the data, and reset the UI link.
		this.global_sets.removeObject(this.feature_friday.set);
		this.default_sets.removeObject(this.feature_friday.set);

		this.feature_friday = null;
		this.update_ui_link();
	}

	// If there's no data, just leave.
	if ( ! data || ! data.set || ! data.channel )
		return;

	// We have our data! Set it up.
	this.feature_friday = {set: data.set, channel: data.channel, live: false,
			title: data.title || "Feature Friday",
			display_name: FFZ.get_capitalization(data.channel, this._update_ff_name.bind(this))};

	// Add the set.
	this.global_sets.push(data.set);
	this.default_sets.push(data.set);
	this.load_set(data.set);

	// Check to see if the channel is live.
	this._update_ff_live();
}


FFZ.prototype._update_ff_live = function() {
	if ( ! this.feature_friday )
		return;

	var f = this;
	Twitch.api.get("streams/" + this.feature_friday.channel)
		.done(function(data) {
			f.feature_friday.live = data.stream != null;
			f.update_ui_link();
		})
		.always(function() {
			f.feature_friday.timer = setTimeout(f._update_ff_live.bind(f), 120000);
		});
}


FFZ.prototype._update_ff_name = function(name) {
	if ( this.feature_friday )
		this.feature_friday.display_name = name;
}
},{"./constants":5}],20:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require("./constants"),
	FileSaver = require("./FileSaver");


	make_ls = function(key) {
		return "ffz_setting_" + key;
	},

	toggle_setting = function(swit, key) {
		var val = ! this.settings.get(key);
		this.settings.set(key, val);
		swit.classList.toggle('active', val);
	},

	option_setting = function(select, key) {
		this.settings.set(key, JSON.parse(select.options[select.selectedIndex].value));
	},


	toggle_basic_setting = function(swit, key) {
		var getter = FFZ.basic_settings[key].get,
			val = !(typeof getter === 'function' ? getter.bind(this)() : this.settings.get(getter)),

			setter = FFZ.basic_settings[key].set;

		if ( typeof setter === 'function' )
			setter.bind(this)(val);
		else
			this.settings.set(setter, val);

		swit.classList.toggle('active', val);
	},

	option_basic_setting = function(select, key) {
		FFZ.basic_settings[key].set.bind(this)(JSON.parse(select.options[select.selectedIndex].value));
	};


// --------------------
// Initializer
// --------------------

FFZ.settings_info = {
	advanced_settings: { value: false, visible: false }
};

FFZ.basic_settings = {};

FFZ.prototype.load_settings = function() {
	this.log("Loading settings.");

	// Build a settings object.
	this.settings = {};

	for(var key in FFZ.settings_info) {
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		var info = FFZ.settings_info[key],
			ls_key = info.storage_key || make_ls(key),
			val = info.hasOwnProperty("value") ? info.value : undefined;

		if ( localStorage.hasOwnProperty(ls_key) ) {
			try {
				val = JSON.parse(localStorage.getItem(ls_key));
			} catch(err) {
				this.log('Error loading value for "' + key + '": ' + err);
			}
		}

		if ( info.process_value )
			val = info.process_value.bind(this)(val);

		this.settings[key] = val;
	}

	// Helpers
	this.settings.get = this._setting_get.bind(this);
	this.settings.set = this._setting_set.bind(this);
	this.settings.del = this._setting_del.bind(this);

	// Listen for Changes
	window.addEventListener("storage", this._setting_update.bind(this), false);
}


// --------------------
// Backup and Restore
// --------------------

FFZ.prototype.save_settings_file = function() {
	var data = {
		version: 1,
		script_version: FFZ.version_info + '',
		aliases: this.aliases,
		settings: {}
		};

	for(var key in FFZ.settings_info) {
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		var info = FFZ.settings_info[key],
			ls_key = info.storage_key || make_ls(key);

		if ( localStorage.hasOwnProperty(ls_key) )
			data.settings[key] = this.settings[key];
	}

	var blob = new Blob([JSON.stringify(data, null, 4)], {type: "application/json;charset=utf-8"});
	FileSaver.saveAs(blob, "ffz-settings.json");
}


FFZ.prototype.load_settings_file = function(file) {
	if ( typeof file === "string" )
		this._load_settings_file(file);
	else {
		var reader = new FileReader(),
			f = this;

		reader.onload = function(e) { f._load_settings_file(e.target.result); }
		reader.readAsText(file);
	}
}

FFZ.prototype._load_settings_file = function(data) {
	try {
		data = JSON.parse(data);
	} catch(err) {
		this.error("Error Loading Settings: " + err);
		return alert("There was an error attempting to read the provided settings data.");
	}

	this.log("Loading Settings Data", data);

	var skipped = [],
		applied = [];

	if ( data.settings ) {
		for(var key in data.settings) {
			if ( ! FFZ.settings_info.hasOwnProperty(key) ) {
				skipped.push(key);
				continue;
			}

			var info = FFZ.settings_info[key],
				val = data.settings[key];

			if ( info.process_value )
				val = info.process_value.bind(this)(val);

			if ( val !== this.settings.get(key) )
				this.settings.set(key, val);

			applied.push(key);
		}
	}

	// Do this in a timeout so that any styles have a moment to update.
	setTimeout(function(){
		alert('Successfully loaded ' + applied.length + ' settings and skipped ' + skipped.length + ' settings.');
	});
}


// --------------------
// Menu Page
// --------------------

FFZ.menu_pages.settings = {
	render: function(view, container) {
		// Bottom Bar
		var menu = document.createElement('ul'),
			page = document.createElement('div'),

			tab_basic = document.createElement('li'),
			link_basic = document.createElement('a'),

			tab_adv = document.createElement('li'),
			link_adv = document.createElement('a'),

			tab_save = document.createElement('li'),
			link_save = document.createElement('a'),

			height = parseInt(container.style.maxHeight || '0');


		// Height Calculation
		if ( ! height )
			height = Math.max(200, view.$().height() - 172);

		if ( height && height !== NaN ) {
			height -= 37;
			page.style.maxHeight = height + 'px';
		}

		// Menu Building
		page.className = 'ffz-ui-sub-menu-page';
		menu.className = 'menu sub-menu clearfix';

		tab_basic.className = 'item';
		tab_basic.id = 'ffz-settings-page-basic';
		link_basic.innerHTML = 'Basic';
		tab_basic.appendChild(link_basic);

		tab_adv.className = 'item';
		tab_adv.id = 'ffz-settings-page-advanced';
		link_adv.innerHTML = 'Advanced';
		tab_adv.appendChild(link_adv);

		tab_save.className = 'item';
		tab_save.id = 'ffz-settings-page-save';
		link_save.textContent = 'Backup & Restore';
		tab_save.appendChild(link_save);

		menu.appendChild(tab_basic);
		menu.appendChild(tab_adv);
		menu.appendChild(tab_save);

		var cp = FFZ.menu_pages.settings.change_page;

		link_basic.addEventListener('click', cp.bind(this, view, container, menu, page, 'basic'));
		link_adv.addEventListener('click', cp.bind(this, view, container, menu, page, 'advanced'));
		link_save.addEventListener('click', cp.bind(this, view, container, menu, page, 'save'));

		if ( this.settings.advanced_settings )
			link_adv.click();
		else
			link_basic.click();

		container.appendChild(page);
		container.appendChild(menu);
	},

	change_page: function(view, container, menu, page, key) {
		page.innerHTML = '';
		page.setAttribute('data-page', key);

		var els = menu.querySelectorAll('li.active');
		for(var i=0, l = els.length; i < l; i++)
			els[i].classList.remove('active');

		var el = menu.querySelector('#ffz-settings-page-' + key);
		if ( el )
			el.classList.add('active');

		FFZ.menu_pages.settings['render_' + key].bind(this)(view, page);

		if ( key === 'advanced' )
			this.settings.set('advanced_settings', true);
		else if ( key === 'basic' )
			this.settings.set('advanced_settings', false);
	},

	render_save: function(view, container) {
		var backup_head = document.createElement('div'),
			restore_head = document.createElement('div'),
			backup_cont = document.createElement('div'),
			restore_cont = document.createElement('div'),

			backup_para = document.createElement('p'),
			backup_link = document.createElement('a'),
			backup_help = document.createElement('span'),

			restore_para = document.createElement('p'),
			restore_input = document.createElement('input'),
			restore_link = document.createElement('a'),
			restore_help = document.createElement('span'),
			f = this;


		backup_cont.className = 'chat-menu-content';
		backup_head.className = 'heading';
		backup_head.innerHTML = 'Backup Settings';
		backup_cont.appendChild(backup_head);

		backup_para.className = 'clearfix option';

		backup_link.href = '#';
		backup_link.innerHTML = 'Save to File';
		backup_link.addEventListener('click', this.save_settings_file.bind(this));

		backup_help.className = 'help';
		backup_help.innerHTML = 'This generates a JSON file containing all of your settings and prompts you to save it.';

		backup_para.appendChild(backup_link);
		backup_para.appendChild(backup_help);
		backup_cont.appendChild(backup_para);

		restore_cont.className = 'chat-menu-content';
		restore_head.className = 'heading';
		restore_head.innerHTML = 'Restore Settings';
		restore_cont.appendChild(restore_head);

		restore_para.className = 'clearfix option';

		restore_input.type = 'file';
		restore_input.addEventListener('change', function() { f.load_settings_file(this.files[0]); })

		restore_link.href = '#';
		restore_link.innerHTML = 'Restore from File';
		restore_link.addEventListener('click', function(e) { e.preventDefault(); restore_input.click(); });

		restore_help.className = 'help';
		restore_help.innerHTML = 'This loads settings from a previously generated JSON file.';

		restore_para.appendChild(restore_link);
		restore_para.appendChild(restore_help);
		restore_cont.appendChild(restore_para);

		container.appendChild(backup_cont);
		container.appendChild(restore_cont);
	},

	render_basic: function(view, container) {
		var settings = {},
			categories = [],
			is_android = navigator.userAgent.indexOf('Android') !== -1;

		for(var key in FFZ.basic_settings) {
			if ( ! FFZ.basic_settings.hasOwnProperty(key) )
				continue;

			var info = FFZ.basic_settings[key],
				cat = info.category || "Miscellaneous",
				cs = settings[cat];

			if ( info.visible !== undefined && info.visible !== null ) {
				var visible = info.visible;
				if ( typeof info.visible == "function" )
					visible = info.visible.bind(this)();

				if ( ! visible )
					continue;
			}

			if ( is_android && info.no_mobile )
				continue;

			if ( ! cs ) {
				categories.push(cat);
				cs = settings[cat] = [];
			}

			cs.push([key, info]);
		}

		categories.sort(function(a,b) {
			var a = a.toLowerCase(),
				b = b.toLowerCase();

			if ( a === "debugging" )
				a = "zzz" + a;

			if ( b === "debugging" )
				b = "zzz" + b;

			if ( a < b ) return -1;
			else if ( a > b ) return 1;
			return 0;
		});

		var f = this,
			current_page = this._ffz_basic_settings_page || categories[0];

		for(var ci=0; ci < categories.length; ci++) {
			var category = categories[ci],
				cset = settings[category],

				menu = document.createElement('div'),
				heading = document.createElement('div');

			heading.className = 'heading';
			menu.className = 'chat-menu-content'; // collapsable';

			menu.setAttribute('data-category', category);
			//menu.classList.toggle('collapsed', current_page !== category);

			heading.innerHTML = category;
			menu.appendChild(heading);

			/*menu.addEventListener('click', function() {
				if ( ! this.classList.contains('collapsed') )
					return;

				var t = this,
					old_selection = container.querySelectorAll('.chat-menu-content:not(.collapsed)');
				for(var i=0; i < old_selection.length; i++)
					old_selection[i].classList.add('collapsed');

				f._ffz_basic_settings_page = t.getAttribute('data-category');
				t.classList.remove('collapsed');
				setTimeout(function(){t.scrollIntoViewIfNeeded()});
			});*/

			cset.sort(function(a,b) {
				var a = a[1],
					b = b[1],

					at = a.type === "boolean" ? 1 : 2,
					bt = b.type === "boolean" ? 1 : 2,

					an = a.name.toLowerCase(),
					bn = b.name.toLowerCase();

				if ( at < bt ) return -1;
				else if ( at > bt ) return 1;

				else if ( an < bn ) return -1;
				else if ( an > bn ) return 1;

				return 0;
			});

			for(var i=0; i < cset.length; i++) {
				var key = cset[i][0],
					info = cset[i][1],
					el = document.createElement('p'),
					val = info.type !== "button" && typeof info.get === 'function' ? info.get.bind(this)() : this.settings.get(info.get);

				el.className = 'clearfix';

				if ( this.has_bttv && info.no_bttv ) {
					var label = document.createElement('span'),
						help = document.createElement('span');
					label.className = 'switch-label';
					label.innerHTML = info.name;

					help = document.createElement('span');
					help.className = 'help';
					help.innerHTML = 'Disabled due to incompatibility with BetterTTV.';

					el.classList.add('disabled');
					el.appendChild(label);
					el.appendChild(help);

				} else {
					if ( info.type == "boolean" ) {
						var swit = document.createElement('a'),
							label = document.createElement('span');

						swit.className = 'switch';
						swit.classList.toggle('active', val);
						swit.innerHTML = "<span></span>";

						label.className = 'switch-label';
						label.innerHTML = info.name;

						el.appendChild(swit);
						el.appendChild(label);

						swit.addEventListener("click", toggle_basic_setting.bind(this, swit, key));

					} else if ( info.type === "select" ) {
						var select = document.createElement('select'),
							label = document.createElement('span');

						label.className = 'option-label';
						label.innerHTML = info.name;

						for(var ok in info.options) {
							var op = document.createElement('option');
							op.value = JSON.stringify(ok);
							if ( val === ok )
								op.setAttribute('selected', true);
							op.innerHTML = info.options[ok];
							select.appendChild(op);
						}

						select.addEventListener('change', option_basic_setting.bind(this, select, key));

						el.appendChild(label);
						el.appendChild(select);

					} else {
						el.classList.add("option");
						var link = document.createElement('a');
						link.innerHTML = info.name;
						link.href = "#";
						el.appendChild(link);

						link.addEventListener("click", info.method.bind(this));
					}

					if ( info.help ) {
						var help = document.createElement('span');
						help.className = 'help';
						help.innerHTML = info.help;
						el.appendChild(help);
					}
				}

				menu.appendChild(el);
			}

			container.appendChild(menu);
		}
	},

	render_advanced: function(view, container) {
		var settings = {},
			categories = [],
			is_android = navigator.userAgent.indexOf('Android') !== -1;

		for(var key in FFZ.settings_info) {
			if ( ! FFZ.settings_info.hasOwnProperty(key) )
				continue;

			var info = FFZ.settings_info[key],
				cat = info.category || "Miscellaneous",
				cs = settings[cat];

			if ( info.visible !== undefined && info.visible !== null ) {
				var visible = info.visible;
				if ( typeof info.visible == "function" )
					visible = info.visible.bind(this)();

				if ( ! visible )
					continue;
			}

			if ( is_android && info.no_mobile )
				continue;

			if ( ! cs ) {
				categories.push(cat);
				cs = settings[cat] = [];
			}

			cs.push([key, info]);
		}

		categories.sort(function(a,b) {
			var a = a.toLowerCase(),
				b = b.toLowerCase();

			if ( a === "debugging" )
				a = "zzz" + a;

			if ( b === "debugging" )
				b = "zzz" + b;

			if ( a < b ) return -1;
			else if ( a > b ) return 1;
			return 0;
		});

		var f = this,
			current_page = this._ffz_settings_page || categories[0];

		for(var ci=0; ci < categories.length; ci++) {
			var category = categories[ci],
				cset = settings[category],

				menu = document.createElement('div'),
				heading = document.createElement('div');

			heading.className = 'heading';
			menu.className = 'chat-menu-content collapsable';

			menu.setAttribute('data-category', category);
			menu.classList.toggle('collapsed', current_page !== category);

			heading.innerHTML = category;
			menu.appendChild(heading);

			menu.addEventListener('click', function() {
				if ( ! this.classList.contains('collapsed') )
					return;

				var t = this,
					old_selection = container.querySelectorAll('.chat-menu-content:not(.collapsed)');
				for(var i=0; i < old_selection.length; i++)
					old_selection[i].classList.add('collapsed');

				f._ffz_settings_page = t.getAttribute('data-category');
				t.classList.remove('collapsed');
				setTimeout(function(){t.scrollIntoViewIfNeeded()});
			});

			cset.sort(function(a,b) {
				var a = a[1],
					b = b[1],

					at = a.type === "boolean" ? 1 : 2,
					bt = b.type === "boolean" ? 1 : 2,

					an = a.name.toLowerCase(),
					bn = b.name.toLowerCase();

				if ( at < bt ) return -1;
				else if ( at > bt ) return 1;

				else if ( an < bn ) return -1;
				else if ( an > bn ) return 1;

				return 0;
			});

			for(var i=0; i < cset.length; i++) {
				var key = cset[i][0],
					info = cset[i][1],
					el = document.createElement('p'),
					val = this.settings.get(key);

				el.className = 'clearfix';

				if ( this.has_bttv && info.no_bttv ) {
					var label = document.createElement('span'),
						help = document.createElement('span');
					label.className = 'switch-label';
					label.innerHTML = info.name;

					help = document.createElement('span');
					help.className = 'help';
					help.innerHTML = 'Disabled due to incompatibility with BetterTTV.';

					el.classList.add('disabled');
					el.appendChild(label);
					el.appendChild(help);

				} else {
					if ( info.type == "boolean" ) {
						var swit = document.createElement('a'),
							label = document.createElement('span');

						swit.className = 'switch';
						swit.classList.toggle('active', val);
						swit.innerHTML = "<span></span>";

						label.className = 'switch-label';
						label.innerHTML = info.name;

						el.appendChild(swit);
						el.appendChild(label);

						swit.addEventListener("click", toggle_setting.bind(this, swit, key));

					} else if ( info.type === "select" ) {
						var select = document.createElement('select'),
							label = document.createElement('span');

						label.className = 'option-label';
						label.innerHTML = info.name;

						for(var ok in info.options) {
							var op = document.createElement('option');
							op.value = JSON.stringify(ok);
							if ( val === ok )
								op.setAttribute('selected', true);
							op.innerHTML = info.options[ok];
							select.appendChild(op);
						}

						select.addEventListener('change', option_setting.bind(this, select, key));

						el.appendChild(label);
						el.appendChild(select);

					} else {
						el.classList.add("option");
						var link = document.createElement('a');
						link.innerHTML = info.name;
						link.href = "#";
						el.appendChild(link);

						link.addEventListener("click", info.method.bind(this));
					}

					if ( info.help ) {
						var help = document.createElement('span');
						help.className = 'help';
						help.innerHTML = info.help;
						el.appendChild(help);
					}
				}

				menu.appendChild(el);
			}

			container.appendChild(menu);
		}
	},

	name: "Settings",
	icon: constants.GEAR,
	sort_order: 99999,
	wide: true,
	sub_menu: true
	};


// --------------------
// Tracking Updates
// --------------------

FFZ.prototype._setting_update = function(e) {
	if ( ! e )
		e = window.event;

	if ( ! e.key || e.key.substr(0, 12) !== "ffz_setting_" )
		return;

	var ls_key = e.key,
		key = ls_key.substr(12),
		val = undefined,
		info = FFZ.settings_info[key];

	if ( ! info ) {
		// Try iterating to find the key.
		for(key in FFZ.settings_info) {
			if ( ! FFZ.settings_info.hasOwnProperty(key) )
				continue;

			info = FFZ.settings_info[key];
			if ( info.storage_key == ls_key )
				break;
		}

		// Not us.
		if ( info.storage_key != ls_key )
			return;
	}

	this.log("Updated Setting: " + key);

	try {
		val = JSON.parse(e.newValue);
	} catch(err) {
		this.log('Error loading new value for "' + key + '": ' + err);
		val = info.value || undefined;
	}

	this.settings[key] = val;
	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, false);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}



// --------------------
// Settings Access
// --------------------

FFZ.prototype._setting_get = function(key) {
	return this.settings[key];
}


FFZ.prototype._setting_set = function(key, val) {
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key),
		jval = JSON.stringify(val);

	this.settings[key] = val;
	localStorage.setItem(ls_key, jval);

	this.log('Changed Setting "' + key + '" to: ' + jval);

	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}


FFZ.prototype._setting_del = function(key) {
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key),
		val = undefined;

	if ( localStorage.hasOwnProperty(ls_key) )
		localStorage.removeItem(ls_key);

	delete this.settings[key];

	if ( info )
		val = this.settings[key] = info.hasOwnProperty("value") ? info.value : undefined;

	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}
},{"./FileSaver":1,"./constants":5}],21:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;

FFZ.prototype._ws_open = false;
FFZ.prototype._ws_delay = 0;
FFZ.prototype._ws_last_iframe = 0;

FFZ.ws_commands = {};
FFZ.ws_on_close = [];


// ----------------
// Socket Creation
// ----------------

FFZ.prototype.ws_iframe = function() {
	this._ws_last_iframe = Date.now();
	var ifr = document.createElement('iframe'),
		f = this;

	ifr.src = 'http://catbag.frankerfacez.com';
	ifr.style.visibility = 'hidden';
	document.body.appendChild(ifr);
	setTimeout(function() {
		document.body.removeChild(ifr);
		if ( ! f._ws_open )
			f.ws_create();
	}, 2000);
}


FFZ.prototype.ws_create = function() {
	var f = this, ws;

	this._ws_last_req = 0;
	this._ws_callbacks = {};
	this._ws_pending = this._ws_pending || [];

	try {
		ws = this._ws_sock = new WebSocket("ws://catbag.frankerfacez.com/");
	} catch(err) {
		this._ws_exists = false;
		return this.log("Error Creating WebSocket: " + err);
	}

	this._ws_exists = true;

	ws.onopen = function(e) {
		f._ws_open = true;
		f._ws_delay = 0;
		f._ws_last_iframe = Date.now();
		f.log("Socket connected.");

		// Check for incognito. We don't want to do a hello in incognito mode.
		var fs = window.RequestFileSystem || window.webkitRequestFileSystem;
		if (!fs)
			// Assume not.
			f.ws_send("hello", ["ffz_" + FFZ.version_info, localStorage.ffzClientId], f._ws_on_hello.bind(f));

		else
			fs(window.TEMPORARY, 100,
				f.ws_send.bind(f, "hello", ["ffz_" + FFZ.version_info, localStorage.ffzClientId], f._ws_on_hello.bind(f)),
				f.log.bind(f, "Operating in Incognito Mode."));


		var user = f.get_user();
		if ( user )
			f.ws_send("setuser", user.login);

		// Join the right channel if we're in the dashboard.
		if ( f.is_dashboard ) {
			var match = location.pathname.match(/\/([^\/]+)/);
			if ( match ) {
				f.ws_send("sub", match[1]);
				f.ws_send("sub_channel", match[1]);
			}
		}

		// Send the current rooms.
		for(var room_id in f.rooms) {
			if ( ! f.rooms.hasOwnProperty(room_id) || ! f.rooms[room_id] )
				continue;

			f.ws_send("sub", room_id);

			if ( f.rooms[room_id].needs_history ) {
				f.rooms[room_id].needs_history = false;
				if ( ! f.has_bttv && f.settings.chat_history )
					f.ws_send("chat_history", [room_id,25], f._load_history.bind(f, room_id));
			}
		}

		// Send the channel(s).
		if ( f._cindex ) {
			var channel_id = f._cindex.get('controller.id'),
				hosted_id = f._cindex.get('controller.hostModeTarget.id');

			if ( channel_id )
				f.ws_send("sub_channel", channel_id);

			if ( hosted_id )
				f.ws_send("sub_channel", hosted_id);
		}

		// Send any pending commands.
		var pending = f._ws_pending;
		f._ws_pending = [];

		for(var i=0; i < pending.length; i++) {
			var d = pending[i];
			f.ws_send(d[0], d[1], d[2]);
		}
	}

	ws.onclose = function(e) {
		f.log("Socket closed. (Code: " + e.code + ", Reason: " + e.reason + ")");
		f._ws_open = false;

		// When the connection closes, run our callbacks.
		for(var i=0; i < FFZ.ws_on_close.length; i++) {
			try {
				FFZ.ws_on_close[i].bind(f)();
			} catch(err) {
				f.log("Error on Socket Close Callback: " + err);
			}
		}

		if ( f._ws_delay > 10000 ) {
			var ua = navigator.userAgent.toLowerCase();
			if ( Date.now() - f._ws_last_iframe > 1800000 && !(ua.indexOf('chrome') === -1 && ua.indexOf('safari') !== -1) )
				return f.ws_iframe();
		}

		// We never ever want to not have a socket.
		if ( f._ws_delay < 60000 )
			f._ws_delay += (Math.floor(Math.random()*10) + 5) * 1000;
		else
			// Randomize delay.
			f._ws_delay = (Math.floor(Math.random()*60)+30)*1000;

		setTimeout(f.ws_create.bind(f), f._ws_delay);
	}

	ws.onmessage = function(e) {
		// Messages are formatted as REQUEST_ID SUCCESS/FUNCTION_NAME[ JSON_DATA]
		var cmd, data, ind = e.data.indexOf(" "),
			msg = e.data.substr(ind + 1),
			request = parseInt(e.data.slice(0, ind));

		ind = msg.indexOf(" ");
		if ( ind === -1 )
			ind = msg.length;

		cmd = msg.slice(0, ind);
		msg = msg.substr(ind + 1);
		if ( msg )
			data = JSON.parse(msg);

		if ( request === -1 ) {
			// It's a command from the server.
			var command = FFZ.ws_commands[cmd];
			if ( command )
				command.bind(f)(data);
			else
				f.log("Invalid command: " + cmd, data, false, true);

		} else {
			var success = cmd === 'True',
				has_callback = typeof f._ws_callbacks[request] === "function";

			if ( ! has_callback )
				f.log("Socket Reply to " + request + " - " + (success ? "SUCCESS" : "FAIL"), data, false, true);

			else {
				try {
					f._ws_callbacks[request](success, data);
				} catch(err) {
					f.error("Callback for " + request + ": " + err);
				}
				
				f._ws_callbacks[request] = undefined;
			}
		}
	}
}


FFZ.prototype.ws_send = function(func, data, callback, can_wait) {
	if ( ! this._ws_open ) {
		if ( can_wait ) {
			var pending = this._ws_pending = this._ws_pending || [];
			pending.push([func, data, callback]);
			return true;
		} else
			return false;
	}

	var request = ++this._ws_last_req;
	data = data !== undefined ? " " + JSON.stringify(data) : "";

	if ( callback )
		this._ws_callbacks[request] = callback;

	try {
		this._ws_sock.send(request + " " + func + data);
	} catch(err) {
		this.log("Socket Send Error: " + err);
		return false;
	}

	return request;
}


// ----------------
// HELLO Response
// ----------------

FFZ.prototype._ws_on_hello = function(success, data) {
	if ( ! success )
		return this.log("Error Saying Hello: " + data);

	localStorage.ffzClientId = data;
	this.log("Client ID: " + data);

	var survey = {},
		set = survey['settings'] = {};

	for(var key in FFZ.settings_info)
		set[key] = this.settings[key];

	set["keywords"] = this.settings.keywords.length;
	set["banned_words"] = this.settings.banned_words.length;


	// Detect BTTV.
	survey['bttv'] = this.has_bttv || !!document.head.querySelector('script[src*="betterttv"]');


	// Client Info
	survey['user-agent'] = navigator.userAgent;
	survey['screen'] = [screen.width, screen.height];
	survey['language'] = navigator.language;
	survey['platform'] = navigator.platform;

	this.ws_send("survey", [survey]);
}



// ----------------
// Authorization
// ----------------

FFZ.ws_commands.do_authorize = function(data) {
	// Try finding a channel we can send on.
	var conn;
	for(var room_id in this.rooms) {
		if ( ! this.rooms.hasOwnProperty(room_id) )
			continue;

		var r = this.rooms[room_id];
		if ( r && r.room && !r.room.get('roomProperties.eventchat') && !r.room.get('isGroupRoom') && r.room.tmiRoom ) {
			var c = r.room.tmiRoom._getConnection();
			if ( c.isConnected ) {
				conn = c;
				break;
			}
		}
	}

	if ( conn )
		conn._send("PRIVMSG #frankerfacezauthorizer :AUTH " + data);
	else
		// Try again shortly.
		setTimeout(FFZ.ws_commands.do_authorize.bind(this, data), 5000);
}
},{}],22:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require("./utils"),
	constants = require("./constants"),
	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	helpers,

	SRCSETS = {};
	build_srcset = function(id) {
		if ( SRCSETS[id] )
			return SRCSETS[id];
		var out = SRCSETS[id] = TWITCH_BASE + id + "/1.0 1x, " + TWITCH_BASE + id + "/2.0 2x, " + TWITCH_BASE + id + "/3.0 4x";
		return out;
	},


	data_to_tooltip = function(data) {
		var set = data.set,
			set_type = data.set_type,
			owner = data.owner;

		if ( set_type === undefined )
			set_type = "Channel";

		if ( ! set )
			return data.code;

		else if ( set === "--global--" ) {
			set = "Twitch Global";
			set_type = null;

		} else if ( set == "--twitch-turbo--" || set == "turbo" || set == "--turbo-faces--" ) {
			set = "Twitch Turbo";
			set_type = null;
		}

		return "Emoticon: " + data.code + "\n" + (set_type ? set_type + ": " : "") + set + (owner ? "\nBy: " + owner.display_name : "");
	},

	build_tooltip = function(id) {
		var emote_data = this._twitch_emotes[id],
			set = emote_data ? emote_data.set : null;

		if ( ! emote_data )
			return "???";

		if ( typeof emote_data == "string" )
			return emote_data;

		if ( emote_data.tooltip )
			return emote_data.tooltip;

		return emote_data.tooltip = data_to_tooltip(emote_data);
	},

	load_emote_data = function(id, code, success, data) {
		if ( ! success )
			return code;

		if ( code )
			data.code = code;

		this._twitch_emotes[id] = data;
		var tooltip = build_tooltip.bind(this)(id);

		var images = document.querySelectorAll('img[data-emote="' + id + '"]');
		for(var x=0; x < images.length; x++)
			images[x].title = tooltip;
		
		return tooltip;
	},


	reg_escape = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	},

	LINK = /(?:https?:\/\/)?(?:[-a-zA-Z0-9@:%_\+~#=]+\.)+[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#!?&//=]*)/g,

	SEPARATORS = "[\\s`~<>!-#%-\\x2A,-/:;\\x3F@\\x5B-\\x5D_\\x7B}\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u0AF0\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166D\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E3B\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]",
	SPLITTER = new RegExp(SEPARATORS + "*," + SEPARATORS + "*"),

	
	LINK_SPLIT = /^(?:(https?):\/\/)?(?:(.*?)@)?([^\/:]+)(?::(\d+))?(.*?)(?:\?(.*?))?(?:\#(.*?))?$/,
	YOUTUBE_CHECK = /^(?:https?:\/\/)?(?:m\.|www\.)?youtu(?:be\.com|\.be)\/(?:v\/|watch\/|.*?(?:embed|watch).*?v=)?([a-zA-Z0-9\-_]+)$/,
	IMGUR_PATH = /^\/(?:gallery\/)?[A-Za-z0-9]+(?:\.(?:png|jpg|jpeg|gif|gifv|bmp))?$/,
	IMAGE_EXT = /\.(?:png|jpg|jpeg|gif|bmp)$/i,
	IMAGE_DOMAINS = [],
	
	is_image = function(href, any_domain) {
		var match = href.match(LINK_SPLIT);
		if ( ! match )
			return;

		var domain = match[3].toLowerCase(), port = match[4],
			path = match[5];

		// Don't allow non-standard ports.
		if ( port && port !== '80' && port !== '443' )
			return false;

		// imgur-specific checks.
		if ( domain === 'i.imgur.com' || domain === 'imgur.com' || domain === 'www.imgur.com' || domain === 'm.imgur.com' )
			return IMGUR_PATH.test(path);

		return any_domain ? IMAGE_EXT.test(path) : IMAGE_DOMAINS.indexOf(domain) !== -1; 
	}
	
	image_iframe = function(href, extra_class) {
		return '<iframe class="ffz-image-hover' + (extra_class ? ' ' + extra_class : '') + '" allowtransparency="true" src="' + constants.SERVER + 'script/image-proxy.html?' + utils.quote_attr(href) + '"></iframe>';
	},


	build_link_tooltip = function(href) {
		var link_data = this._link_data[href],
			tooltip;

		if ( ! link_data )
			return "";

		if ( link_data.tooltip )
			return link_data.tooltip;

		if ( link_data.type == "youtube" ) {
			tooltip = this.settings.link_image_hover ? image_iframe(link_data.full || href, 'ffz-yt-thumb') : '';
			tooltip += "<b>YouTube: " + utils.sanitize(link_data.title) + "</b><hr>";
			tooltip += "Channel: " + utils.sanitize(link_data.channel) + " | " + utils.time_to_string(link_data.duration) + "<br>";
			tooltip += utils.number_commas(link_data.views||0) + " Views | &#128077; " + utils.number_commas(link_data.likes||0) + " &#128078; " + utils.number_commas(link_data.dislikes||0);

		} else if ( link_data.type == "strawpoll" ) {
			tooltip = "<b>Strawpoll: " + utils.sanitize(link_data.title) + "</b><hr><table><tbody>";
			for(var key in link_data.items) {
				var votes = link_data.items[key],
					percentage = Math.floor((votes / link_data.total) * 100);
				tooltip += '<tr><td style="text-align:left">' + utils.sanitize(key) + '</td><td style="text-align:right">' + utils.number_commas(votes) + "</td></tr>";
			}
			tooltip += "</tbody></table><hr>Total: " + utils.number_commas(link_data.total);
			var fetched = utils.parse_date(link_data.fetched);
			if ( fetched ) {
				var age = Math.floor((fetched.getTime() - Date.now()) / 1000);
				if ( age > 60 )
					tooltip += "<br><small>Data was cached " + utils.time_to_string(age) + " ago.</small>";
			}


		} else if ( link_data.type == "twitch" ) {
			tooltip = "<b>Twitch: " + utils.sanitize(link_data.display_name) + "</b><hr>";
			var since = utils.parse_date(link_data.since);
			if ( since )
				tooltip += "Member Since: " + utils.date_string(since) + "<br>";
			tooltip += "<nobr>Views: " + utils.number_commas(link_data.views) + "</nobr> | <nobr>Followers: " + utils.number_commas(link_data.followers) + "</nobr>";


		} else if ( link_data.type == "twitch_vod" ) {
			tooltip = "<b>Twitch " + (link_data.broadcast_type == "highlight" ? "Highlight" : "Broadcast") + ": " + utils.sanitize(link_data.title) + "</b><hr>";
			tooltip += "By: " + utils.sanitize(link_data.display_name) + (link_data.game ? " | Playing: " + utils.sanitize(link_data.game) : " | Not Playing") + "<br>";
			tooltip += "Views: " + utils.number_commas(link_data.views) + " | " + utils.time_to_string(link_data.length);


		} else if ( link_data.type == "twitter" ) {
			tooltip = "<b>Tweet By: " + utils.sanitize(link_data.user) + "</b><hr>";
			tooltip += utils.sanitize(link_data.tweet);


		} else if ( link_data.type == "reputation" ) {
			tooltip = (this.settings.link_image_hover && is_image(link_data.full || href, this.settings.image_hover_all_domains)) ? image_iframe(link_data.full || href) : '';
			tooltip += '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';
			if ( link_data.trust < 50 || link_data.safety < 50 || (link_data.tags && link_data.tags.length > 0) ) {
				tooltip += "<hr>";
				var had_extra = false;
				if ( link_data.trust < 50 || link_data.safety < 50 ) {
					link_data.unsafe = true;
					tooltip += "<b>Potentially Unsafe Link</b><br>";
					tooltip += "Trust: " + link_data.trust + "% | Child Safety: " + link_data.safety + "%";
					had_extra = true;
				}

				if ( link_data.tags && link_data.tags.length > 0 )
					tooltip += (had_extra ? "<br>" : "") + "Tags: " + link_data.tags.join(", ");

				tooltip += "<br>Data Source: WOT";
			}


		} else if ( link_data.full ) {
			tooltip = (this.settings.link_image_hover && is_image(link_data.full || href, this.settings.image_hover_all_domains)) ? image_iframe(link_data.full || href) : '';
			tooltip += '<span style="word-wrap: break-word">' + utils.sanitize(link_data.full.toLowerCase()) + '</span>';
		}

		if ( ! tooltip )
			tooltip = '<span style="word-wrap: break-word">' + utils.sanitize(href.toLowerCase()) + '</span>';

		link_data.tooltip = tooltip;
		return tooltip;
	},

	load_link_data = function(href, success, data) {
		if ( ! success )
			return;

		this._link_data[href] = data;
		data.unsafe = false;

		var tooltip = build_link_tooltip.bind(this)(href), links,
			no_trail = href.charAt(href.length-1) == "/" ? href.substr(0, href.length-1) : null;

		if ( no_trail )
			links = document.querySelectorAll('span.message a[href="' + href + '"], span.message a[href="' + no_trail + '"], span.message a[data-url="' + href + '"], span.message a[data-url="' + no_trail + '"]');
		else
			links = document.querySelectorAll('span.message a[href="' + href + '"], span.message a[data-url="' + href + '"]');

		if ( ! this.settings.link_info )
			return;

		for(var x=0; x < links.length; x++) {
			if ( data.unsafe )
				links[x].classList.add('unsafe-link');

			if ( ! links[x].classList.contains('deleted-link') )
				links[x].title = tooltip;
		}
	};


FFZ.SRC_IDS = {},
FFZ.src_to_id = function(src) {
	if ( FFZ.SRC_IDS.hasOwnProperty(src) )
		return FFZ.SRC_IDS[src];

	var match = /\/emoticons\/v1\/(\d+)\/1\.0/.exec(src),
		id = match ? parseInt(match[1]) : null;

	if ( id === NaN )
		id = null;

	FFZ.SRC_IDS[src] = id;
	return id;
};


// ---------------------
// Settings
// ---------------------

var ts = new Date(0).toLocaleTimeString().toUpperCase();

FFZ.settings_info.twenty_four_timestamps = {
	type: "boolean",
	value: ts.lastIndexOf('PM') === -1 && ts.lastIndexOf('AM') === -1,

	category: "Chat Appearance",
	no_bttv: true,

	name: "24hr Timestamps",
	help: "Display timestamps in chat in the 24 hour format rather than 12 hour."
	};


FFZ.settings_info.show_deleted_links = {
	type: "boolean",
	value: false,

	category: "Chat Moderation",
	no_bttv: true,

	name: "Show Deleted Links",
	help: "Do not delete links based on room settings or link length."
	};


// ---------------------
// Setup
// ---------------------

FFZ.prototype.setup_tokenization = function() {
	// Tooltip Data
	this._twitch_emotes = {};
	this._twitch_emote_to_set = {};
	this._twitch_set_to_channel = {};
	this._link_data = {};
	
	this.load_twitch_emote_data();
	
	helpers = window.require && window.require("ember-twitch-chat/helpers/chat-line-helpers");
	if ( ! helpers )
		return this.log("Unable to get chat helper functions.");
	
	this.log("Hooking Ember chat line helpers.");

	var f = this;
	
	// Timestamp Display
	helpers.getTime = function(e) {
		if ( e === undefined || e === null )
			return '?:??';

		var hours = e.getHours(),
			minutes = e.getMinutes();
	
		if ( hours > 12 && ! f.settings.twenty_four_timestamps )
			hours -= 12;
		else if ( hours === 0 && ! f.settings.twenty_four_timestamps )
			hours = 12;
	
		return hours + ':' + (minutes < 10 ? '0' : '') + minutes;
	};


	// Linkify Messages
	helpers.linkifyMessage = function(tokens, delete_links) {
		var show_deleted = f.settings.show_deleted_links;
		
		return _.chain(tokens).map(function(token) {
			if ( ! _.isString(token) )
				return token;
			
			var matches = token.match(LINK);
			if ( ! matches || ! matches.length )
				return [token];
	
			return _.zip(
				token.split(LINK),
				_.map(matches, function(e) {
					var long = e.length > 255;
					if ( ! show_deleted && (delete_links || long) )
						return {isLink: true, isDeleted: true, isLong: long, href: e};
						//return {mentionedUser: '</span><a class="deleted-link" title="' + utils.quote_attr(e) + '" data-url="' + utils.quote_attr(e) + '" href="#">&lt;' + (e.length > 255 ? 'long link' : 'deleted link') + '&gt;</a><span class="mentioning">', own: true}
					return {isLink: true, href: e};
				})
			);
		}).flatten().compact().value();
	};
}


// ---------------------
// Twitch Emote Data
// ---------------------

FFZ.prototype.load_twitch_emote_data = function(tries) {
	jQuery.ajax(constants.SERVER + "script/twitch_emotes.json", {cache: false, context: this})
		.done(function(data) {
			for(var set_id in data) {
				var set = data[set_id];
				if ( ! set )
					continue;

				this._twitch_set_to_channel[set_id] = set.name;
				for(var i=0, l = set.emotes.length; i < l; i++)
					this._twitch_emote_to_set[set.emotes[i]] = set_id;
			}
			
			this._twitch_set_to_channel[0] = "--global--";
			this._twitch_set_to_channel[33] = "--turbo-faces--";
			this._twitch_set_to_channel[42] = "--turbo-faces--";

		}).fail(function(data) {
			if ( data.status === 404 )
				return;
			
			tries = (tries || 0) + 1;
			if ( tries < 10 )
				setTimeout(this.load_twitch_emote_data.bind(this, tries), 1000);
		});
}


// ---------------------
// Tokenization
// ---------------------

FFZ.prototype.tokenize_chat_line = function(msgObject, prevent_notification, delete_links) {
	if ( msgObject.cachedTokens )
		return msgObject.cachedTokens;

	var msg = msgObject.message,
		user = this.get_user(),
		room_id = msgObject.room,
		from_me = user && msgObject.from === user.login,
		emotes = msgObject.tags && msgObject.tags.emotes,

		tokens = [msg];

	// Standard tokenization
	if ( helpers && helpers.linkifyMessage ) {
		var labels = msg.labels || [], 
			mod_or_higher = labels.indexOf("owner") !== -1 ||
							labels.indexOf("staff") !== -1 ||
							labels.indexOf("admin") !== -1 ||
							labels.indexOf("global_mod") !== -1 ||
							labels.indexOf("mod") !== -1 ||
							msg.style === 'admin';

		tokens = helpers.linkifyMessage(tokens, delete_links && !mod_or_higher);
	}
		

	if ( user && user.login && helpers && helpers.mentionizeMessage )
		tokens = helpers.mentionizeMessage(tokens, user.login, from_me);

	if ( helpers && helpers.emoticonizeMessage )
		tokens = helpers.emoticonizeMessage(tokens, emotes);

	if ( this.settings.replace_bad_emotes )
		tokens = this.tokenize_replace_emotes(tokens);

	// FrankerFaceZ Extras
	tokens = this._remove_banned(tokens);
	tokens = this.tokenize_emotes(msgObject.from, room_id, tokens, from_me);

	if ( this.settings.parse_emoji )
		tokens = this.tokenize_emoji(tokens);

	// Capitalization
	var display = msgObject.tags && msgObject.tags['display-name'];
	if ( display && display.length )
		FFZ.capitalization[msgObject.from] = [display.trim(), Date.now()];


	// Mentions!
	if ( ! from_me ) {
		tokens = this.tokenize_mentions(tokens);

		for(var i=0; i < tokens.length; i++) {
			var token = tokens[i];
			if ( msgObject.style !== 'whisper' && (_.isString(token) || ! token.mentionedUser || token.own) )
				continue;

			// We have a mention!
			msgObject.ffz_has_mention = true;

			// If we have chat tabs, update the status.
			if ( room_id && ! this.has_bttv && this.settings.group_tabs && this._chatv && this._chatv._ffz_tabs ) {
				var el = this._chatv._ffz_tabs.querySelector('.ffz-chat-tab[data-room="' + room_id + '"]');
				if ( el && ! el.classList.contains('active') )
					el.classList.add('tab-mentioned');
			}

			// Display notifications if that setting is enabled. Also make sure
			// that we have a chat view because showing a notification when we
			// can't actually go to it is a bad thing.
			if ( this._chatv && this.settings.highlight_notifications && ! this.embed_in_dash && ! document.hasFocus() && ! prevent_notification ) {
				var room = this.rooms[room_id] && this.rooms[room_id].room,
					room_name;

				// Make sure we have UI for this channel.
				if ( (this.settings.group_tabs && (this.settings.pinned_rooms.indexOf(room_id) !== -1 || this._chatv._ffz_host )) || room.get('isGroupRoom') || room === this._chatv.get('controller.currentChannelRoom') ) {
					if ( room && room.get('isGroupRoom') )
						room_name = room.get('tmiRoom.displayName');
					else
						room_name = FFZ.get_capitalization(room_id);
	
					display = display || Twitch.display.capitalize(msgObject.from);
	
					if ( msgObject.style === 'action' )
						msg = '* ' + display + ' ' + msg;
					else
						msg = display + ': ' + msg;
	
					var f = this;
					if ( msgObject.style === 'whisper' )
						this.show_notification(
							msg,
							"Twitch Chat Whisper",
							"ffz_whisper_notice",
							(this.settings.notification_timeout*1000),
							function() {
								window.focus();
							}
						);
					else
						this.show_notification(
							msg,
							"Twitch Chat Mention in " + room_name,
							room_id,
							(this.settings.notification_timeout*1000),
							function() {
								window.focus();
								var cont = App.__container__.lookup('controller:chat');
								room && cont && cont.focusRoom(room);
							}
						);
				}
			}

			break;
		}
	}

	msgObject.cachedTokens = tokens;
	return tokens;
}


FFZ.prototype.tokenize_line = function(user, room, message, no_emotes, no_emoji) {
	if ( typeof message === "string" )
		message = [message];

	if ( helpers && helpers.linkifyMessage )
		message = helpers.linkifyMessage(message);

	if ( helpers && helpers.mentionizeMessage ) {
		var u = this.get_user();
		if ( u && u.login )
			message = helpers.mentionizeMessage(message, u.login, user === u.login);
	}

	if ( ! no_emotes ) {
		message = this.tokenize_emotes(user, room, message);
		if ( this.settings.replace_bad_emotes )
			message = this.tokenize_replace_emotes(message);
	}

	if ( this.settings.parse_emoji && ! no_emoji )
		message = this.tokenize_emoji(message);

	return message;
}


FFZ.prototype.render_tokens = function(tokens, render_links) {
	var f = this;
	return _.map(tokens, function(token) {
		if ( token.emoticonSrc ) {
			var tooltip, srcset, extra;
			if ( token.ffzEmote ) {
				var emote_set = f.emote_sets && f.emote_sets[token.ffzEmoteSet],
					emote = emote_set && emote_set.emoticons && emote_set.emoticons[token.ffzEmote];

				tooltip = emote ? utils.sanitize(f._emote_tooltip(emote)) : token.altText;
				srcset = emote ? emote.srcSet : token.srcSet;
				extra = ' data-ffz-emote="' + emote.id + '"';

			} else if ( token.ffzEmoji ) {
				var eid = token.ffzEmoji,
					emoji = f.emoji_data && f.emoji_data[eid];

				tooltip = emoji ? "Emoji: " + token.altText + "\nName: :" + emoji.short_name + ":" : token.altText;
				srcset = emoji ? emoji.srcSet : token.srcSet;
				extra = ' data-ffz-emoji="' + eid + '"';

			} else {
				var id = token.replacedId || FFZ.src_to_id(token.emoticonSrc),
					data = id && f._twitch_emotes && f._twitch_emotes[id];

				if ( data )
					tooltip = data.tooltip ? data.tooltip : token.altText;
				else {
					try {
						var set_id = f._twitch_emote_to_set[id];
						if ( set_id ) {
							tooltip = load_emote_data.bind(f)(id, token.altText, true, {
								code: token.altText,
								id: id,
								set: f._twitch_set_to_channel[set_id],
								set_id: set_id
							});
						} else {
							tooltip = f._twitch_emotes[id] = token.altText;
							f.ws_send("twitch_emote", id, load_emote_data.bind(f, id, token.altText));
						}
					} catch(err) {
						f.error("Error Generating Emote Tooltip: " + err);
					}
				}

				extra = ' data-emote="' + id + '"';

				if ( ! constants.EMOTE_REPLACEMENTS[id] )
					srcset = build_srcset(id);
			}

			return '<img class="emoticon tooltip"' + (extra||"") + ' src="' + utils.quote_attr(token.emoticonSrc) + '" ' + (srcset ? 'srcset="' + utils.quote_attr(srcset) + '" ' : '') + 'alt="' + utils.quote_attr(token.altText) + '" title="' + utils.quote_attr(tooltip) + '">';
		}

		if ( token.isLink ) {
			var text = token.title || (token.isLong && '<long link>') || (token.isDeleted && '<deleted link>') || token.href;
			
			if ( ! render_links && render_links !== undefined )
				return utils.sanitize(text);

			var href = token.href,
				tooltip, cls = '',
			
				ind_at = href.indexOf("@"),
				ind_sl = href.indexOf("/");
			
			if ( ind_at !== -1 && (ind_sl === -1 || ind_at < ind_sl) ) {
				// E-Mail Link
				cls = 'email-link';
				
				if ( f.settings.link_info ) {
					cls += ' tooltip';
					tooltip = 'E-Mail ' + href;
				}
				
				href = 'mailto:' + href;
				
			} else {
				// Web Link
				if ( ! href.match(/^https?:\/\//) )
					href = 'http://' + href; 
				
				if ( f.settings.link_info ) {
					cls = 'html-tooltip';
					
					var data = f._link_data && f._link_data[href];
					if ( data ) {
						tooltip = data.tooltip;
						if ( data.unsafe )
							cls += ' unsafe-link';
						
					} else {
						f._link_data = f._link_data || {};
						f._link_data[href] = true;
						f.ws_send("get_link", href, load_link_data.bind(f, href));
						if ( f.settings.link_image_hover && is_image(href, f.settings.image_hover_all_domains) )
							tooltip = image_iframe(href);
					}
					
				} else if ( f.settings.link_image_hover ) {
					cls = 'html-tooltip';
					if ( is_image(href, f.settings.image_hover_all_domains) )
						tooltip = image_iframe(href);
				}
			}
			

			// Deleted Links
			var actual_href = href;
			if ( token.isDeleted ) {
				cls = 'deleted-link ' + cls;
				tooltip = utils.sanitize(token.censoredHref || token.href);
				href = '#';
			}
			
			return '<a class="' + cls + '" data-url="' + utils.quote_attr(actual_href) + '" href="' + utils.quote_attr(href || '#') + '" title="' + utils.quote_attr(tooltip || '') + '" target="_blank">' + utils.sanitize(text) + '</a>';
		}

		if ( token.mentionedUser )
			return '<span class="' + (token.own ? "mentioning" : "mentioned") + '">' + utils.sanitize(token.mentionedUser) + "</span>";

		if ( token.deletedLink )
			return utils.sanitize(token.text);

		return utils.sanitize(token);
	}).join("");
}


// ---------------------
// Emoticon Processing
// ---------------------

FFZ.prototype.tokenize_replace_emotes = function(tokens) {
	// Replace bad Twitch emoticons with custom emoticons.
	var f = this;

	if ( _.isString(tokens) )
		tokens = [tokens];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! token || ! token.emoticonSrc || token.ffzEmote )
			continue;

		// Check for a few specific emoticon IDs.
		var emote_id = FFZ.src_to_id(token.emoticonSrc);
		if ( constants.EMOTE_REPLACEMENTS.hasOwnProperty(emote_id) ) {
			token.replacedId = emote_id;
			token.emoticonSrc = constants.EMOTE_REPLACEMENT_BASE + constants.EMOTE_REPLACEMENTS[emote_id];
		}
	}
	
	return tokens;
}


FFZ.prototype.tokenize_title_emotes = function(tokens) {
	var f = this,
		Channel = App.__container__.lookup('controller:channel'),
		possible = Channel && Channel.get('product.emoticons'),
		emotes = [];

	if ( _.isString(tokens) )
		tokens = [tokens];

	// Build a list of emotes that match.
	_.each(_.union(f.__twitch_global_emotes||[], possible), function(emote) {
		if ( ! emote || emote.state === "inactive" )
			return;

		var r = new RegExp("\\b" + emote.regex + "\\b");

		_.any(tokens, function(token) {
			return _.isString(token) && token.match(r);
		}) && emotes.push(emote);
	});

	// Include Global Emotes~!
	if ( f.__twitch_global_emotes === undefined || f.__twitch_global_emotes === null ) {
		f.__twitch_global_emotes = false;
		Twitch.api.get("chat/emoticon_images", {emotesets:"0,42"}).done(function(data) {
			if ( ! data || ! data.emoticon_sets || ! data.emoticon_sets[0] ) {
				f.__twitch_global_emotes = [];
				return;
			}

			var emotes = f.__twitch_global_emotes = [];
			data = data.emoticon_sets[0];
			for(var i=0; i < data.length; i++) {
				var em = data[i];
				emotes.push({regex: em.code, url: TWITCH_BASE + em.id + "/1.0"});
			}

			if ( f._cindex )
				f._cindex.ffzFixTitle();
		}).fail(function() {
			setTimeout(function(){f.__twitch_global_emotes = null;},5000);
		});;
	}

	if ( ! emotes.length )
		return tokens;

	if ( typeof tokens === "string" )
		tokens = [tokens];

	_.each(emotes, function(emote) {
		var eo = {isEmoticon:true, srcSet: emote.url + ' 1x', emoticonSrc: emote.url, altText: emote.regex};
		var r = new RegExp("\\b" + emote.regex + "\\b");

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(r), bits = [];
			tbits.forEach(function(val, ind) {
				bits.push(val);
				if ( ind !== tbits.length - 1 )
					bits.push(eo);
			});
			return bits;
		})));
	});

	return tokens;
}


FFZ.prototype.tokenize_emotes = function(user, room, tokens, do_report) {
	var f = this;

	// Get our sets.
	var sets = this.getEmotes(user, room),
		emotes = [];

	// Build a list of emotes that match.
	_.each(sets, function(set_id) {
		var set = f.emote_sets[set_id];
		if ( ! set )
			return;

		_.each(set.emoticons, function(emote) {
			_.any(tokens, function(token) {
				return _.isString(token) && token.match(emote.regex);
			}) && emotes.push(emote);
		});
	});

	// Don't bother proceeding if we have no emotes.
	if ( ! emotes.length )
		return tokens;

	// Now that we have all the matching tokens, do crazy stuff.
	if ( typeof tokens === "string" )
		tokens = [tokens];

	// This is weird stuff I basically copied from the old Twitch code.
	// Here, for each emote, we split apart every text token and we
	// put it back together with the matching bits of text replaced
	// with an object telling Twitch's line template how to render the
	// emoticon.
	_.each(emotes, function(emote) {
		var eo = {
			srcSet: emote.srcSet,
			emoticonSrc: emote.urls[1],
			ffzEmote: emote.id,
			ffzEmoteSet: emote.set_id,
			altText: (emote.hidden ? "???" : emote.name)
			};

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(emote.regex), bits = [];
			while(tbits.length) {
				var bit = tbits.shift();
				if ( tbits.length ) {
					bit += tbits.shift();
					if ( bit )
						bits.push(bit);

					tbits.shift();
					bits.push(eo);

					if ( do_report && room )
						f.add_usage(room, emote.id);

				} else
					bits.push(bit);
			}
			return bits;
		})));
	});

	return tokens;
}


// ---------------------
// Emoji Processing
// ---------------------

FFZ.prototype.tokenize_emoji = function(tokens) {
	if ( typeof tokens === "string" )
		tokens = [tokens];

	if ( ! this.emoji_data )
		return tokens;

	var f = this;

	return _.compact(_.flatten(_.map(tokens, function(token) {
		if ( _.isObject(token) )
			return token;

		var tbits = token.split(constants.EMOJI_REGEX), bits = [];
		while(tbits.length) {
			// Deal with the unmatched string first.
			var bit = tbits.shift();
			bit && bits.push(bit);

			if ( tbits.length ) {
				// We have an emoji too, so let's handle that.
				var match = tbits.shift(),
					variant = tbits.shift();

				if ( variant === '\uFE0E' ) {
					// Text Variant
					bits.push(match);

				} else {
					// Find the right image~!
					var eid = utils.emoji_to_codepoint(match, variant),
						data = f.emoji_data[eid];

					if ( data )
						bits.push(data.token);
					else
						bits.push(match + (variant || ""));
				}
			}
		}

		return bits;
	})));
}


// ---------------------
// Mention Parsing
// ---------------------

FFZ._regex_cache = {};

FFZ._get_regex = function(word) {
	return FFZ._regex_cache[word] = FFZ._regex_cache[word] || RegExp("\\b" + reg_escape(word) + "\\b", "ig");
}

FFZ._words_to_regex = function(list) {
	var regex = FFZ._regex_cache[list];
	if ( ! regex ) {
		var reg = "";
		for(var i=0; i < list.length; i++) {
			if ( ! list[i] )
				continue;

			reg += (reg ? "|" : "") + reg_escape(list[i]);
		}

		regex = FFZ._regex_cache[list] = new RegExp("(^|.*?" + SEPARATORS + ")(" + reg + ")(?=$|" + SEPARATORS + ")", "ig");
	}

	return regex;
}


FFZ.prototype.tokenize_mentions = function(tokens) {
	var mention_words = this.settings.keywords;
	if ( ! mention_words || ! mention_words.length )
		return tokens;

	if ( typeof tokens === "string" )
		tokens = [tokens];

	var regex = FFZ._words_to_regex(mention_words),
		new_tokens = [];

	for(var i=0; i < tokens.length; i++) {
		var token = tokens[i];
		if ( ! _.isString(token) ) {
			new_tokens.push(token);
			continue;
		}

		if ( ! token.match(regex) ) {
			new_tokens.push(token);
			continue;
		}

		token = token.replace(regex, function(all, prefix, match) {
			new_tokens.push(prefix);
			new_tokens.push({
				mentionedUser: match,
				own: false
				});

			return "";
		});

		if ( token )
			new_tokens.push(token);
	}

	return new_tokens;
}


// ---------------------
// Handling Bad Stuff
// ---------------------

FFZ.prototype._deleted_link_click = function(e) {
	if ( ! this.classList.contains("deleted-link") )
		return true;

	// Get the URL
	var href = this.getAttribute('data-url'),
		link = href,
		f = FrankerFaceZ.get();

	// Delete Old Stuff
	this.classList.remove('deleted-link');
	this.removeAttribute("data-url");
	this.removeAttribute("title");
	this.removeAttribute("original-title");

	// Process URL
	if ( href.indexOf("@") > -1 && (-1 === href.indexOf("/") || href.indexOf("@") < href.indexOf("/")) )
		href = "mailto:" + href;
	else if ( ! href.match(/^https?:\/\//) )
		href = "http://" + href;

	// Set up the Link
	this.href = href;
	this.target = "_new";
	this.textContent = link;

	// Now, check for a tooltip.
	var link_data = f._link_data[link];
	if ( link_data && typeof link_data != "boolean" ) {
		this.title = link_data.tooltip;
		if ( link_data.unsafe )
			this.classList.add('unsafe-link');
	}

	// Stop from Navigating
	e.preventDefault();
}
},{"./constants":5,"./utils":35}],23:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require("../constants");


// -------------------
// About Page
// -------------------

FFZ.menu_pages.about_changelog = {
	name: "Changelog",
	visible: false,
	wide: true,
	
	render: function(view, container) {
		var heading = document.createElement('div');

		heading.className = 'chat-menu-content center';
		heading.innerHTML = '<h1>FrankerFaceZ</h1><div class="ffz-about-subheading">change log</div>';
		
		jQuery.ajax(constants.SERVER + "script/changelog.html", {cache: false, context: this})
			.done(function(data) {
				container.appendChild(heading);
				container.innerHTML += data;
				
			}).fail(function(data) {
				var content = document.createElement('div');
				content.className = 'chat-menu-content menu-side-padding';
				content.textContent = 'There was an error loading the change log from the server.';

				container.appendChild(heading);
				container.appendChild(content);
			});
	}
};


FFZ.menu_pages.about = {
	name: "About",
	icon: constants.HEART,
	sort_order: 100000,

	render: function(view, container, inner, menu) {
		var room = this.rooms[view.get("context.currentRoom.id")],
			has_emotes = false, f = this;

		// Check for emoticons.
		if ( room && room.set ) {
			var set = this.emote_sets[room.set];
			if ( set && set.count > 0 )
				has_emotes = true;
		}

		// Heading
		var heading = document.createElement('div'),
			content = '';

		content += "<h1>FrankerFaceZ</h1>";
		content += '<div class="ffz-about-subheading">new ways to woof</div>';

		heading.className = 'chat-menu-content center';
		heading.innerHTML = content;
		container.appendChild(heading);

		var clicks = 0, head = heading.querySelector("h1");
		head && head.addEventListener("click", function() {
			head.style.cursor = "pointer";
			clicks++;
			if ( clicks >= 3 ) {
				clicks = 0;
				var el = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
				el && el.classList.toggle('ffz-flip');
			}
			setTimeout(function(){clicks=0;head.style.cursor=""},2000);
		});


		// Advertising
		var btn_container = document.createElement('div'),
			ad_button = document.createElement('a'),
			message = "To use custom emoticons in " + (has_emotes ? "this channel" : "tons of channels") + ", get FrankerFaceZ from http://www.frankerfacez.com";

		ad_button.className = 'button primary';
		ad_button.innerHTML = "Advertise in Chat";
		ad_button.addEventListener('click', this._add_emote.bind(this, view, message));

		btn_container.appendChild(ad_button);

		// Donate
		var donate_button = document.createElement('a');

		donate_button.className = 'button ffz-donate';
		donate_button.href = "https://www.frankerfacez.com/donate";
		donate_button.target = "_new";
		donate_button.innerHTML = "Donate";

		btn_container.appendChild(donate_button);
		btn_container.className = 'chat-menu-content center';
		container.appendChild(btn_container);

		// Credits
		var credits = document.createElement('div');

		content = '<table class="ffz-about-table">';
		content += '<tr><th colspan="4">Developers</th></tr>';
		content += '<tr><td>Dan Salvato</td><td><a class="twitch" href="http://www.twitch.tv/dansalvato" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/dansalvato1" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/user/dansalvato1" title="YouTube" target="_new">&nbsp;</a></td></tr>';
		content += '<tr><td>Stendec</td><td><a class="twitch" href="http://www.twitch.tv/sirstendec" title="Twitch" target="_new">&nbsp;</a></td><td><a class="twitter" href="https://twitter.com/SirStendec" title="Twitter" target="_new">&nbsp;</a></td><td><a class="youtube" href="https://www.youtube.com/channel/UCnxuvmK1DCPCXSJ-mXIh4KQ" title="YouTube" target="_new">&nbsp;</a></td></tr>';

		content += '<tr class="debug"><td><a href="#" id="ffz-changelog">Version ' + FFZ.version_info + '</a></td><td colspan="3"><a href="#" id="ffz-debug-logs">Logs</a></td></tr>';

		credits.className = 'chat-menu-content center';
		credits.innerHTML = content;

		// Functional Changelog
		credits.querySelector('#ffz-changelog').addEventListener('click', function() {
			f._ui_change_page(view, inner, menu, container, 'about_changelog');
		});

		// Make the Logs button functional.
		var getting_logs = false;
		credits.querySelector('#ffz-debug-logs').addEventListener('click', function() {
			if ( getting_logs )
				return;

			getting_logs = true;
			f._pastebin(f._log_data.join("\n"), function(url) {
				getting_logs = false;
				if ( ! url )
					alert("There was an error uploading the FrankerFaceZ logs.");
				else
					prompt("Your FrankerFaceZ logs have been uploaded to the URL:", url);
			});
		});

		container.appendChild(credits);
	}
}
},{"../constants":5}],24:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require("../constants");


// ---------------------
// Settings
// ---------------------

FFZ.basic_settings.dark_twitch = {
	type: "boolean",
	no_bttv: true,

	category: "General",
	name: "Dark Twitch",
	help: "Apply a dark background to channels and other related pages for easier viewing.",

	get: function() {
		return this.settings.dark_twitch;
	},

	set: function(val) {
		this.settings.set('dark_twitch', val);
		this.settings.set('dark_no_blue', val);
	}
};

FFZ.basic_settings.separated_chat = {
	type: "boolean",
	no_bttv: true,

	category: "Chat",
	name: "Separated Lines",
	help: "Use alternating rows and thin lines to visually separate chat messages for easier reading.",

	get: function() {
		return this.settings.chat_rows && this.settings.chat_separators !== '0';
	},

	set: function(val) {
		this.settings.set('chat_rows', val);
		this.settings.set('chat_separators', val ? '2' : '0');
	}
};

FFZ.basic_settings.minimalistic_chat = {
	type: "boolean",

	category: "Chat",
	name: "Minimalistic UI",
	help: "Hide all of chat except messages and the input box and reduce chat margins.",

	get: function() {
		return this.settings.minimal_chat && this.settings.chat_padding;
	},

	set: function(val) {
		this.settings.set('minimal_chat', val);
		this.settings.set('chat_padding', val);
	}
};

FFZ.basic_settings.high_contrast = {
	type: "boolean",

	category: "Chat",
	no_bttv: true,

	name: "High Contrast",
	help: "Display chat using white and black for maximum contrast. This is suitable for capturing and chroma keying chat to display on stream.",

	get: function() {
		return this.settings.high_contrast_chat !== '222';
	},

	set: function(val) {
		this.settings.set('high_contrast_chat', val ? '111': '222');
	}
};

FFZ.basic_settings.keywords = {
	type: "button",

	category: "Chat",
	no_bttv: true,

	name: "Highlight Keywords",
	help: "Set additional keywords that will be highlighted in chat.",

	method: function() {
		FFZ.settings_info.keywords.method.bind(this)();
	}
};

FFZ.basic_settings.banned_words = {
	type: "button",

	category: "Chat",
	no_bttv: true,

	name: "Banned Keywords",
	help: "Set a list of words that will be removed from chat messages, locally.",

	method: function() {
		FFZ.settings_info.banned_words.method.bind(this)();
	}
};



FFZ.settings_info.twitch_chat_dark = {
	type: "boolean",
	value: false,
	visible: false
	};


FFZ.settings_info.dark_twitch = {
	type: "boolean",
	value: false,

	no_bttv: true,
	//visible: function() { return ! this.has_bttv },

	category: "Appearance",
	name: "Dark Twitch",
	help: "Apply a dark background to channels and other related pages for easier viewing.",

	on_update: function(val) {
			var cb = document.querySelector('input.ffz-setting-dark-twitch');
			if ( cb )
				cb.checked = val;

			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-dark", val);

			var model = window.App ? App.__container__.lookup('controller:settings').get('model') : undefined;

			if ( val ) {
				this._load_dark_css();
				model && this.settings.set('twitch_chat_dark', model.get('darkMode'));
				model && model.set('darkMode', true);
			} else
				model && model.set('darkMode', this.settings.twitch_chat_dark);
		}
	};


FFZ.settings_info.dark_no_blue = {
	type: "boolean",
	value: false,

	//no_bttv: true,

	category: "Appearance",
	name: "Gray Chat (no blue)",
	help: "Make the dark theme for chat and a few other places on Twitch a bit darker and not at all blue.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-no-blue", val);
		}
	};


FFZ.settings_info.hide_recent_past_broadcast = {
	type: "boolean",
	value: false,

	//no_bttv: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Hide \"Watch Last Broadcast\"",
	help: "Hide the \"Watch Last Broadcast\" banner at the top of offline Twitch channels.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-hide-recent-past-broadcast", val);
		}
	};


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_dark = function() {
	document.body.classList.toggle("ffz-hide-recent-past-broadcast", this.settings.hide_recent_past_broadcast);
	document.body.classList.toggle("ffz-no-blue", this.settings.dark_no_blue);

	if ( this.has_bttv )
		return;

	document.body.classList.toggle("ffz-dark", this.settings.dark_twitch);
	if ( ! this.settings.dark_twitch )
		return;

	window.App && App.__container__.lookup('controller:settings').set('model.darkMode', true);
	this._load_dark_css();
}


FFZ.prototype._load_dark_css = function() {
	if ( this._dark_style )
		return;

	this.log("Injecting FrankerFaceZ Dark Twitch CSS.");

	var s = this._dark_style = document.createElement('link');

	s.id = "ffz-dark-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.SERVER + "script/dark.css?_=" + (constants.DEBUG ? Date.now() : FFZ.version_info));
	document.head.appendChild(s);
}
},{"../constants":5}],25:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	FOLLOW_GRAVITY = function(f, el) {
		return (f.settings.following_count && el.parentElement.getAttribute('data-name') === 'following' ? 'n' : '') + (f.settings.swap_sidebars ? 'e' : 'w');
	},

	WIDE_TIP = function(f, el) {
		return ( ! f.settings.following_count || (el.id !== 'header_following' && el.parentElement.getAttribute('data-name') !== 'following') ) ? '' : 'ffz-wide-tip';
	};


FFZ.settings_info.following_count = {
	type: "boolean",
	value: true,

	no_mobile: true,

	category: "Appearance",
	name: "Sidebar Following Data",
	help: "Display the number of live channels you're following on the sidebar, and list the channels in a tooltip.",

	on_update: function(val) {
			this._schedule_following_count();

			var Stream = window.App && App.__container__.resolve('model:stream'),
				Live = Stream && Stream.find("live");

			if ( Live ) {
				var total = Live.get('total') || 0;
				this._draw_following_count(total);
				this._draw_following_channels(Live.get('content'), total);;
			} else {
				this._update_following_count();
				this._draw_following_channels();
			}
		}
	};

// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_following_count = function(has_ember) {
	// Start it updating.
	if ( this.settings.following_count )
		this._schedule_following_count();

	// Tooltips~!
	this._install_following_tooltips();

	// If we don't have Ember, no point in trying this stuff.
	if ( ! has_ember )
		return this._update_following_count();

	this.log("Connecting to Live Streams model.");
	var Stream = window.App && App.__container__.resolve('model:stream');
	if ( ! Stream )
		return this.log("Unable to find Stream model.");

	var Live = Stream.find("live"),
		f = this;

	if ( ! Live )
		return this.log("Unable to find Live Streams collection.");

	Live.addObserver('total', function() { f._draw_following_count(this.get('total')); });
	Live.addObserver('content.length', function() { f._draw_following_channels(this.get('content'), this.get('total')); })

	Live.load();

	var total = Live.get('total'),
		streams = Live.get('content');
	if ( typeof total === "number" ) {
		this._draw_following_count(total);
		if ( streams && streams.length )
			this._draw_following_channels(streams, total);
	}
}


FFZ.prototype._schedule_following_count = function() {
	if ( ! this.settings.following_count ) {
		if ( this._following_count_timer ) {
			clearTimeout(this._following_count_timer);
			this._following_count_timer = undefined;
		}
		return;
	}

	if ( ! this._following_count_timer )
		this._following_count_timer = setTimeout(this._update_following_count.bind(this), 55000 + (10000*Math.random()));
}


FFZ.prototype._update_following_count = function() {
	if ( ! this.settings.following_count ) {
		if ( this._following_count_timer ) {
			clearTimeout(this._following_count_timer);
			this._following_count_timer = undefined;
		}
		return;
	}

	this._following_count_timer = setTimeout(this._update_following_count.bind(this), 55000 + (10000*Math.random()));

	var Stream = window.App && App.__container__.resolve('model:stream'),
		Live = Stream && Stream.find("live"),
		f = this;

	if ( Live )
		Live.load();
	else
		Twitch.api && Twitch.api.get("streams/followed", {limit:5, offset:0}, {version:3})
			.done(function(data) {
				f._draw_following_count(data._total);
				f._draw_following_channels(data.streams, data._total);
			}).fail(function() {
				f._draw_following_count();
				f._draw_following_channels();
			})
}


FFZ.prototype._build_following_tooltip = function(el) {
	if ( el.id !== 'header_following' && el.parentElement.getAttribute('data-name') !== 'following' )
		return el.getAttribute('original-title');

	if ( ! this.settings.following_count )
		return 'Following';

	var tooltip = (this.has_bttv ? '<span class="stat playing">FrankerFaceZ</span>' : '') + 'Following',
		bb = el.getBoundingClientRect(),
		height = document.body.clientHeight - (bb.bottom + 54),
		max_lines = Math.max(Math.floor(height / 36) - 1, 2),

		streams = this._tooltip_streams,
		total = this._tooltip_total || (streams && streams.length) || 0;


	if ( streams && streams.length ) {
		var c = 0;
		for(var i=0, l = streams.length; i < l; i++) {
			var stream = streams[i];
			if ( ! stream || ! stream.channel )
				continue;

			c += 1;
			if ( c > max_lines ) {
				tooltip += '<hr><span>And ' + utils.number_commas(total - max_lines) + ' more...</span>';
				break;
			}

			var up_since = this.settings.stream_uptime && stream.created_at && utils.parse_date(stream.created_at),
				uptime = up_since && Math.floor((Date.now() - up_since.getTime()) / 1000) || 0,
				minutes = Math.floor(uptime / 60) % 60,
				hours = Math.floor(uptime / 3600);

			tooltip += (i === 0 ? '<hr>' : '') +
				(uptime > 0 ? '<span class="stat">' + constants.CLOCK + ' ' + (hours > 0 ? hours + 'h' : '') + minutes + 'm</span>' : '') +
				'<span class="stat">' + constants.LIVE + ' ' + utils.number_commas(stream.viewers) + '</span>' +
				'<b>' + utils.sanitize(stream.channel.display_name || stream.channel.name) + '</b><br>' +
				'<span class="playing">' + (stream.channel.game ? 'Playing ' + utils.sanitize(stream.channel.game) : 'Not Playing') + '</span>';
		}
	} else
		tooltip += "<hr>No one you're following is online.";


	// Reposition the tooltip.
	setTimeout(function() {
		var tip = document.querySelector('.tipsy'),
			bb = tip.getBoundingClientRect(),

			left = parseInt(tip.style.left || '0'),
			right = bb.left + tip.scrollWidth;

		if ( bb.left < 5 )
			tip.style.left = (left - bb.left) + 5 + 'px';
		else if ( right > document.body.clientWidth - 5 )
			tip.style.left = (left - (5 + right - document.body.clientWidth)) + 'px';
	});

	return tooltip;
}


FFZ.prototype._install_following_tooltips = function() {
	var f = this,
		data = {
			html: true,
			className: function() { return WIDE_TIP(f, this); },
			title: function() { return f._build_following_tooltip(this); }
		};

	// Small
	var small_following = jQuery('#small_nav ul.game_filters li[data-name="following"] a');
	if ( small_following && small_following.length ) {
		var td = small_following.data('tipsy');
		if ( td && td.options ) {
			td.options = _.extend(td.options, data);
			td.options.gravity = function() { return FOLLOW_GRAVITY(f, this); };
		} else
			small_following.tipsy(_.extend({gravity: function() { return FOLLOW_GRAVITY(f, this); }}, data));
	}


	// Large
	var large_following = jQuery('#large_nav #nav_personal li[data-name="following"] a');
	if ( large_following && large_following.length ) {
		var td = large_following.data('tipsy');
		if ( td && td.options )
			td.options = _.extend(td.options, data);
		else
			large_following.tipsy(data);
	}


	// Heading
	var head_following = jQuery('#header_actions #header_following');
	if ( head_following && head_following.length ) {
		var td = head_following.data('tipsy');
		if ( td && td.options )
			td.options = _.extend(td.options, data);
		else
			head_following.tipsy(data);
	}
}


FFZ.prototype._draw_following_channels = function(streams, total) {
	this._tooltip_streams = streams;
	this._tooltip_total = total;
}


FFZ.prototype._draw_following_count = function(count) {
	// Small
	var small_following = document.querySelector('#small_nav ul.game_filters li[data-name="following"] a');
	if ( small_following ) {
		var badge = small_following.querySelector('.ffz-follow-count');
		if ( this.has_bttv || ! this.settings.following_count ) {
			if ( badge )
				badge.parentElement.removeChild(badge);
		} else {
			if ( ! badge ) {
				badge = document.createElement('span');
				badge.className = 'ffz-follow-count';
				small_following.appendChild(badge);
			}
			badge.innerHTML = count ? utils.format_unread(count) : '';
		}
	}


	// Large
	var large_following = document.querySelector('#large_nav #nav_personal li[data-name="following"] a');
	if ( large_following ) {
		var badge = large_following.querySelector('.ffz-follow-count');
		if ( this.has_bttv || ! this.settings.following_count ) {
			if ( badge )
				badge.parentElement.removeChild(badge);
		} else {
			if ( ! badge ) {
				badge = document.createElement('span');
				badge.className = 'ffz-follow-count';
				large_following.appendChild(badge);
			}
			badge.innerHTML = count ? utils.format_unread(count) : '';
		}
	}

	// Heading
	var head_following = document.querySelector('#header_actions #header_following');
	if ( head_following ) {
		var badge = head_following.querySelector('.ffz-follow-count');
		if ( this.has_bttv || ! this.settings.following_count ) {
			if ( badge )
				badge.parentElement.removeChild(badge);
		} else {
			if ( ! badge ) {
				badge = document.createElement('span');
				badge.className = 'ffz-follow-count';
				head_following.appendChild(badge);
			}
			badge.innerHTML = count ? utils.format_unread(count) : '';
		}
	}
}
},{"../constants":5,"../utils":35}],26:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),

	VALID_CHANNEL = /^[A-Za-z0-9_]+$/,
	TWITCH_URL = /^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]+)/i;


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_following = function() {
	this.log("Initializing following support.");
	this.follow_data = {};
	this.follow_sets = {};
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.follow_buttons = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Relevant Follow Buttons",
	help: 'Display additional Follow buttons for channels relevant to the stream, such as people participating in co-operative gameplay.',
	on_update: function(val) {
			this.rebuild_following_ui();
		}
	};


// ---------------
// Command
// ---------------

FFZ.ffz_commands.following = function(room, args) {
	args = args.join(" ").trim().toLowerCase().split(/[ ,]+/);

	var out = [];
	for(var i=0,l=args.length; i<l; i++) {
		var arg = args[i],
			match = arg.match(TWITCH_URL);
		if ( match )
			arg = match[1];

		if ( arg !== '' && out.indexOf(arg) === -1 )
			out.push(arg);
	}

	var user = this.get_user(), f = this;
	if ( ! user || (user.login !== room.id && user.login !== "sirstendec" && user.login !== "dansalvato")  )
		return "You must be logged in as the broadcaster to use this command.";

	if ( ! this.ws_send("update_follow_buttons", [room.id, out], function(success, data) {
		if ( ! success ) {
			f.room_message(room, "There was an error updating the following buttons.");
			return;
		}

		if ( data )
			f.room_message(room, "The following buttons have been updated.");
		else
			f.room_message(room, "The following buttons have been disabled.");
	}) )
		return "There was an error communicating with the server.";
}


// ---------------
// Socket Handler
// ---------------

FFZ.ws_on_close.push(function() {
	var controller = window.App && App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false;

	this.follow_sets = {};

	if ( ! controller )
		return;

	for(var channel_id in this.follow_data) {
		delete this.follow_data[channel_id];
		if ( channel_id === current_id || channel_id === current_host )
			need_update = true;

		if ( this.rooms && this.rooms[channel_id] && this.rooms[channel_id].extra_sets ) {
			var sets = this.rooms[channel_id].extra_sets;
			delete this.rooms[channel_id].extra_sets;

			for(var i=0; i < sets.length; i++) {
				var set = this.emote_sets[sets[i]];
				if ( set ) {
					set.users.removeObject(channel_id);
					if ( ! this.global_sets.contains(sets[i]) && ! set.users.length )
						this.unload_set(sets[i]);
				}
			}
		}
	}

	if ( need_update )
		this.rebuild_following_ui();
});


FFZ.ws_commands.follow_buttons = function(data) {
	var controller = window.App && App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false;

	this.follow_data = this.follow_data || {};

	for(var channel_id in data) {
		this.follow_data[channel_id] = data[channel_id];
		if ( channel_id === current_id || channel_id === current_host )
			need_update = true;
	}

	if ( need_update )
		this.rebuild_following_ui();
}


FFZ.ws_commands.follow_sets = function(data) {
	var controller = App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false,
		f = this;

	this.follow_sets = this.follow_sets || {};

	for(var room_id in data) {
		if ( ! this.rooms || ! this.rooms.hasOwnProperty(room_id) ) {
			this.follow_sets[room_id] = data[room_id];
			continue;
		}

		var old_sets = this.rooms[room_id].extra_sets || [],
			new_sets = this.rooms[room_id].extra_sets = data[room_id];

		// Unload sets we aren't using anymore.
		for(var i=0; i < old_sets.length; i++) {
			var sid = old_sets[i];
			if ( new_sets.indexOf(sid) !== -1 )
				continue;

			var set = this.emote_sets && this.emote_sets[sid];
			if ( set ) {
				set.users.removeObject(room_id);
				if ( ! this.global_sets.contains(sid) && ! set.users.length )
					this.unload_set(sid);
			}
		}

		// And load the new sets.
		for(var i=0; i < new_sets.length; i++) {
			var sid = new_sets[i],
				set = this.emote_sets && this.emote_sets[sid];

			if ( set ) {
				if ( set.users.indexOf(room_id) === -1 )
					set.users.push(room_id);
				continue;
			}

			setTimeout(
				this.load_set.bind(this, sid, function(success, data) {
					if ( success )
						data.users.push(room_id);
				}), Math.random()*2500);
		}
	}
}


// ---------------
// Following UI
// ---------------

FFZ.prototype.rebuild_following_ui = function() {
	var controller = App.__container__.lookup('controller:channel'),
		channel_id = controller && controller.get('id'),
		hosted_id = controller && controller.get('hostModeTarget.id');

	if ( ! this._cindex )
		return;

	if ( channel_id ) {
		var data = this.follow_data && this.follow_data[channel_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('.stats-and-actions .channel-actions'),
			cont = container && container.querySelector('#ffz-ui-following');

		if ( ! container || ! this.settings.follow_buttons || ! data || ! data.length ) {
			if ( cont )
				cont.parentElement.removeChild(cont);

		} else {
			if ( ! cont ) {
				cont = document.createElement('span');
				cont.id = 'ffz-ui-following';

				var before;
				try { before = container.querySelector(':scope > span'); }
				catch(err) { before = undefined; }

				if ( before )
					container.insertBefore(cont, before);
				else
					container.appendChild(cont);
			} else
				cont.innerHTML = '';

			var processed = [channel_id];
			for(var i=0; i < data.length && i < 10; i++) {
				var cid = data[i];
				if ( processed.indexOf(cid) !== -1 )
					continue;
				this._build_following_button(cont, cid);
				processed.push(cid);
			}
		}
	}


	if ( hosted_id ) {
		var data = this.follow_data && this.follow_data[hosted_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('#hostmode .channel-actions'),
			cont = container && container.querySelector('#ffz-ui-following');

		if ( ! container || ! this.settings.follow_buttons || ! data || ! data.length ) {
			if ( cont )
				cont.parentElement.removeChild(cont);

		} else {
			if ( ! cont ) {
				cont = document.createElement('span');
				cont.id = 'ffz-ui-following';

				var before;
				try { before = container.querySelector(':scope > span'); }
				catch(err) { before = undefined; }

				if ( before )
					container.insertBefore(cont, before);
				else
					container.appendChild(cont);
			} else
				cont.innerHTML = '';

			var processed = [hosted_id];
			for(var i=0; i < data.length && i < 10; i++) {
				var cid = data[i];
				if ( processed.indexOf(cid) !== -1 )
					continue;
				this._build_following_button(cont, cid);
				processed.push(cid);
			}
		}
	}
}


// ---------------
// UI Construction
// ---------------

FFZ.prototype._build_following_button = function(container, channel_id) {
	if ( ! VALID_CHANNEL.test(channel_id) )
		return this.log("Ignoring Invalid Channel: " + utils.sanitize(channel_id));
	
	var btn = document.createElement('a'), f = this,
		btn_c = document.createElement('div'),
		noti = document.createElement('a'),
		noti_c = document.createElement('div'),

		display_name,
		following = false,
		notifications = false,

		update = function() {
			btn_c.classList.toggle('is-following', following);
			btn.title = (following ? "Unf" : "F") + "ollow " + utils.sanitize(display_name);
			btn.innerHTML = (following ? "" : "Follow ") + utils.sanitize(display_name);
			noti_c.classList.toggle('hidden', !following);
		},

		check_following = function() {
			var user = f.get_user();
			if ( ! user || ! user.login ) {
				following = false;
				notification = false;
				btn_c.classList.add('is-initialized');
				return update();
			}

			Twitch.api.get("users/" + user.login + "/follows/channels/" + channel_id)
				.done(function(data) {
					following = true;
					notifications = data.notifications;
					btn_c.classList.add('is-initialized');
					update();
				}).fail(function(data) {
					following = false;
					notifications = false;
					btn_c.classList.add('is-initialized');
					update();
				});
		},

		do_follow = function(notice) {
			if ( notice !== false )
				notice = true;

			var user = f.get_user();
			if ( ! user || ! user.login )
				return null;

			notifications = notice;
			return Twitch.api.put("users/:login/follows/channels/" + channel_id, {notifications: notifications})
				.fail(check_following);
		},

		on_name = function(cap_name) {
			display_name = cap_name || channel_id;
			update();
		};

	btn_c.className = 'ember-follow follow-button';
	btn_c.appendChild(btn);

	// The drop-down button!
	noti.className = 'toggle-notification-menu js-toggle-notification-menu';
	noti.href = '#';

	noti_c.className = 'notification-controls v2 hidden';
	noti_c.appendChild(noti);

	// Event Listeners!
	btn.addEventListener('click', function(e) {
		var user = f.get_user();
		if ( ! user || ! user.login )
			// Show the login dialog~!
			return Ember.$.login({mpSourceAction: "follow-button", follow: channel_id});

		// Immediate update for nice UI.
		following = ! following;
		update();

		// Report it!
		f.ws_send("track_follow", [channel_id, following]);

		// Do it, and make sure it happened.
		if ( following )
			do_follow()
		else
			Twitch.api.del("users/:login/follows/channels/" + channel_id)
				.done(check_following);

		return false;
	});

	btn.addEventListener('mousedown', function(e) {
		if ( e.button !== 1 )
			return;
		
		e.preventDefault();
		window.open(Twitch.uri.profile(channel_id));
	});

	noti.addEventListener('click', function() {
		var sw = f._build_following_popup(noti_c, channel_id, notifications);
		if ( sw )
			sw.addEventListener('click', function() {
				var notice = ! notifications;
				sw.classList.toggle('active', notice);
				do_follow(notice);
				return false;
			});
		return false;
	});


	display_name = FFZ.get_capitalization(channel_id, on_name);
	update();
	
	setTimeout(check_following, Math.random()*5000);

	container.appendChild(btn_c);
	container.appendChild(noti_c);
}


FFZ.prototype._build_following_popup = function(container, channel_id, notifications) {
	var popup = this._popup, out = '',
		pos = container.offsetLeft + container.offsetWidth;


	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		this._popup_kill && this._popup_kill();
		delete this._popup_kill;

		if ( popup.id == "ffz-following-popup" && popup.getAttribute('data-channel') === channel_id )
			return null;
	}

	popup = this._popup = document.createElement('div');
	popup.id = 'ffz-following-popup';
	popup.setAttribute('data-channel', channel_id);

	popup.className = (pos >= 300 ? 'right' : 'left') + ' dropmenu notify-menu js-notify';

	out  = '<div class="header">You are following ' + FFZ.get_capitalization(channel_id) + '</div>';
	out += '<p class="clearfix">';
	out += '<a class="switch' + (notifications ? ' active' : '') + '"><span></span></a>';
	out += '<span class="switch-label">Notify me when the broadcaster goes live</span>';
	out += '</p>';

	popup.innerHTML = out;
	container.appendChild(popup);
	return popup.querySelector('a.switch');
}
},{"../utils":35}],27:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),

	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",

	fix_menu_position = function(container) {
		var swapped = document.body.classList.contains('ffz-sidebar-swap');

		var bounds = container.getBoundingClientRect(),
			left = parseInt(container.style.left || '0'),
			right = bounds.left + container.scrollWidth,
			moved = !!container.style.left;

		if ( swapped ) {
			if ( bounds.left < 20 ) {
				container.style.left = '';
				moved = false;
			} else if ( right > document.body.clientWidth )
				container.style.left = (left - (right - document.body.clientWidth)) + 'px';

		} else {
			if ( bounds.left < 0 )
				container.style.left = (left - bounds.left) + 'px';
			else if ( right > (document.body.clientWidth - 20) ) {
				container.style.left = '';
				moved = false;
			}
		}

		container.classList.toggle('ui-moved', moved);
	};


// --------------------
// Initializer
// --------------------

FFZ.prototype.setup_menu = function() {
	this.log("Installing mouse-up event to auto-close menus.");
	var f = this;

	jQuery(document).mouseup(function(e) {
		var popup = f._popup, parent;
		if ( ! popup ) return;
		if ( popup.id === 'ffz-chat-menu' && popup.style && popup.style.left )
			return;

		popup = jQuery(popup);
		parent = popup.parent();

		if ( ! parent.is(e.target) && parent.has(e.target).length === 0 ) {
			popup.remove();
			delete f._popup;
			f._popup_kill && f._popup_kill();
			delete f._popup_kill;
		}
	});

	document.body.classList.toggle("ffz-menu-replace", this.settings.replace_twitch_menu);

	// Add FFZ to the chat settings menu.

	this.log("Hooking the Ember Chat Settings view.");

	var Settings = window.App && App.__container__.resolve('view:settings');

	if ( ! Settings )
		return;

	Settings.reopen({
		didInsertElement: function() {
			this._super();

			try {
				this.ffzInit();
			} catch(err) {
				f.error("ChatSettings didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("ChatSettings willClearRender: " + err);
			}
			this._super();
		},

		ffzInit: function() {
			var view = this,
				el = this.get('element'),
				menu = el && el.querySelector('.dropmenu');

			if ( ! menu )
				return;

			var header = document.createElement('div'),
				content = document.createElement('div'),
				p, cb, a;

			header.className = 'list-header';
			header.innerHTML = 'FrankerFaceZ';

			content.className = 'chat-menu-content';

			// Dark Twitch
			p = document.createElement('p');
			p.className = 'no-bttv';
			cb = document.createElement('input');
			cb.type = "checkbox";
			cb.className = "ember-checkbox ffz-setting-dark-twitch";
			cb.checked = f.settings.dark_twitch;
			p.appendChild(cb);
			p.appendChild(document.createTextNode("Dark Twitch"));
			content.appendChild(p);

			cb.addEventListener("change", function(e) {
				f.settings.set("dark_twitch", this.checked);
			});


			// Channel Hosting
			p = document.createElement('p');
			//p.className = 'no-bttv';
			cb = document.createElement('input');
			cb.type = "checkbox";
			cb.className = "ember-checkbox ffz-setting-hosted-channels";
			cb.checked = f.settings.hosted_channels;
			p.appendChild(cb);
			p.appendChild(document.createTextNode("Channel Hosting"));
			content.appendChild(p);

			cb.addEventListener("change", function(e) {
				f.settings.set("hosted_channels", this.checked);
			});


			// More Settings
			p = document.createElement('p');
			a = document.createElement('a');
			a.href = '#';
			a.innerHTML = 'More Settings';
			p.appendChild(a);
			content.appendChild(p);

			a.addEventListener('click', function(e) {
				view.set('controller.model.hidden', true);
				f._last_page = 'settings';
				f.build_ui_popup(f._chatv);
				e.stopPropagation();
				return false;
			});

			menu.appendChild(header);
			menu.appendChild(content);
		},

		ffzTeardown: function() {
			// Nothing~!
		}
	});

	// For some reason, this doesn't work unless we create an instance of the
	// chat settings view and then destroy it immediately.
	try {
		Settings.create().destroy();
	} catch(err) { }

	// Modify all existing Chat Settings views.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof Settings) )
			continue;

		this.log("Manually updating existing Chat Settings view.", view);
		try {
			view.ffzInit();
		} catch(err) {
			this.error("setup: ChatSettings ffzInit: " + err);
		}
	}
}


FFZ.menu_pages = {};


// --------------------
// Create Menu
// --------------------

FFZ.prototype._fix_menu_position = function() {
	var container = document.querySelector('#ffz-chat-menu');
	if ( container )
		fix_menu_position(container);
}

FFZ.prototype.build_ui_popup = function(view) {
	var popup = this._popup;
	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		this._popup_kill && this._popup_kill();
		delete this._popup_kill;
		return;
	}

	// Start building the DOM.
	var container = document.createElement('div'),
		inner = document.createElement('div'),
		menu = document.createElement('ul'),

		dark = (this.has_bttv ? BetterTTV.settings.get('darkenedMode') : false);

	container.className = 'emoticon-selector chat-menu ffz-ui-popup';
	container.id = 'ffz-chat-menu';
	inner.className = 'emoticon-selector-box dropmenu';
	container.appendChild(inner);

	container.classList.toggle('dark', dark);


	// Menu Container
	var sub_container = document.createElement('div');
	sub_container.className = 'ffz-ui-menu-page';

	inner.appendChild(sub_container);

	// Render Menu Tabs
	menu.className = 'menu clearfix';
	inner.appendChild(menu);

	var heading = document.createElement('li');
	heading.className = 'title';
	heading.innerHTML = '<span class="title">Franker' + (constants.DEBUG ? 'Dev' : 'Face') + 'Z</span>';

	// Close Button
	var close_btn = document.createElement('span'),
		f = this;

	close_btn.className = 'ffz-handle ffz-close-button';
	heading.insertBefore(close_btn, heading.firstChild);

	var can_close = false;
	close_btn.addEventListener('mousedown', function() {
		var popup = f._popup;
		can_close = popup && popup.id === "ffz-chat-menu" && popup.style.left;
	});

	close_btn.addEventListener('click', function() {
		var popup = f._popup;
		if ( can_close && popup ) {
			popup.parentElement.removeChild(popup);
			delete f._popup;
			f._popup_kill && f._popup_kill();
			delete f._popup_kill;
		}
	});

	menu.appendChild(heading);

	// Draggable
	jQuery(container).draggable({
		handle: menu, cancel: 'li.item', axis:"x",
		stop: function(e) { fix_menu_position(this); }
		});

	// Get rid of the position: relative that draggable adds.
	container.style.position = '';

	var menu_pages = [];
	for(var key in FFZ.menu_pages) {
		if ( ! FFZ.menu_pages.hasOwnProperty(key) )
			continue;

		var page = FFZ.menu_pages[key];
		try {
			if ( !page || (page.hasOwnProperty("visible") && (!page.visible || (typeof page.visible == "function" && !page.visible.bind(this)(view)))) )
				continue;
		} catch(err) {
			this.error("menu_pages " + key + " visible: " + err);
			continue;
		}

		menu_pages.push([page.sort_order || 0, key, page]);
	}

	menu_pages.sort(function(a,b) {
		if ( a[0] < b[0] ) return 1;
		else if ( a[0] > b[0] ) return -1;

		var al = a[1].toLowerCase(),
			bl = b[1].toLowerCase();

		if ( al < bl ) return 1;
		if ( al > bl ) return -1;
		return 0;
	});

	for(var i=0; i < menu_pages.length; i++) {
		var key = menu_pages[i][1],
			page = menu_pages[i][2],
			el = document.createElement('li'),
			link = document.createElement('a');

		el.className = 'item' + (page.sub_menu ? ' has-sub-menu' : '');
		el.id = "ffz-menu-page-" + key;
		link.title = page.name;
		link.innerHTML = page.icon;

		jQuery(link).tipsy();

		link.addEventListener("click", this._ui_change_page.bind(this, view, inner, menu, sub_container, key));

		el.appendChild(link);
		menu.appendChild(el);
	}

	// Render Current Page
	var page = (this._last_page || "channel").split("_", 1)[0];
	this._ui_change_page(view, inner, menu, sub_container, page);

	// Add the menu to the DOM.
	this._popup = container;
	sub_container.style.maxHeight = Math.max(200, view.$().height() - 172) + "px";
	view.$('.chat-interface').append(container);
}


FFZ.prototype._ui_change_page = function(view, inner, menu, container, page) {
	this._last_page = page;
	container.innerHTML = "";
	container.setAttribute('data-page', page);

	// Allow settings to be wide. We need to know if chat is stand-alone.
	var app = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
	inner.style.maxWidth = (!FFZ.menu_pages[page].wide || (typeof FFZ.menu_pages[page].wide == "function" && !FFZ.menu_pages[page].wide.bind(this)())) ? "" : (app.offsetWidth < 640 ? (app.offsetWidth-40) : 600) + "px";

	var els = menu.querySelectorAll('li.active');
	for(var i=0; i < els.length; i++)
		els[i].classList.remove('active');

	var el = menu.querySelector('#ffz-menu-page-' + page);
	if ( el )
		el.classList.add('active');
	else
		this.log("No matching page: " + page);

	FFZ.menu_pages[page].render.bind(this)(view, container, inner, menu);

	// Re-position if necessary.
	var f = this;
	setTimeout(function(){f._fix_menu_position();});
}


// --------------------
// Channel Page
// --------------------

FFZ.menu_pages.channel = {
	render: function(view, inner) {
			// Get the current room.
			var room_id = view.get('controller.currentRoom.id'),
				room = this.rooms[room_id],
				has_product = false,
				f = this;

			// Check for a product.
			if ( this.settings.replace_twitch_menu ) {
				var product = room.room.get("product");
				if ( product && !product.get("error") ) {
					// We have a product, and no error~!
					has_product = true;
					var tickets = App.__container__.resolve('model:ticket').find('user', {channel: room_id}),
						is_subscribed = tickets ? tickets.get('content') : false,
						is_loaded = tickets ? tickets.get('isLoaded') : false,
						icon = room.room.get("badgeSet.subscriber.image"),

						grid = document.createElement("div"),
						header = document.createElement("div"),
						c = 0;

					// Weird is_subscribed check. Might be more accurate?
					is_subscribed = is_subscribed && is_subscribed.length > 0;

					// See if we've loaded. If we haven't loaded the ticket yet
					// then try loading it, and then re-render the menu.
					if ( tickets && ! is_subscribed && ! is_loaded ) {
						tickets.addObserver('isLoaded', function() {
							setTimeout(function(){
								if ( inner.getAttribute('data-page') !== 'channel' )
									return;

								inner.innerHTML = '';
								FFZ.menu_pages.channel.render.bind(f)(view, inner);
							},0);

						});

						tickets.load();
					}


					grid.className = "emoticon-grid";
					header.className = "heading";
					if ( icon )
						header.style.backgroundImage = 'url("' + icon + '")';

					header.innerHTML = '<span class="right">Twitch</span>Subscriber Emoticons';
					grid.appendChild(header);

					for(var emotes=product.get("emoticons") || [], i=0; i < emotes.length; i++) {
						var emote = emotes[i];
						if ( emote.state !== "active" )
							continue;

						var s = document.createElement('span'),
							can_use = is_subscribed || !emote.subscriber_only,
							img_set = 'image-set(url("' + TWITCH_BASE + emote.id + '/1.0") 1x, url("' + TWITCH_BASE + emote.id + '/2.0") 2x, url("' + TWITCH_BASE + emote.id + '/3.0") 4x)';

						s.className = 'emoticon tooltip' + (!can_use ? " locked" : "");

						s.style.backgroundImage = 'url("' + TWITCH_BASE + emote.id + '/1.0")';
						s.style.backgroundImage = '-webkit-' + img_set;
						s.style.backgroundImage = '-moz-' + img_set;
						s.style.backgroundImage = '-ms-' + img_set;
						s.style.backgroundImage = img_set;

						s.style.width = emote.width + "px";
						s.style.height = emote.height + "px";
						s.title = emote.regex;

						s.addEventListener('click', function(can_use, id, code, e) {
							if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
								window.open("https://twitchemotes.com/emote/" + id);
							else if ( can_use )
								this._add_emote(view, code);
							else
								return;
							e.preventDefault();
						}.bind(this, can_use, emote.id, emote.regex));

						grid.appendChild(s);
						c++;
					}

					if ( c > 0 )
						inner.appendChild(grid);

					if ( c > 0 && ! is_subscribed ) {
						var sub_message = document.createElement("div"),
							nonsub_message = document.createElement("div"),
							unlock_text = document.createElement("span"),
							sub_link = document.createElement("a");

						sub_message.className = "subscribe-message";
						nonsub_message.className = "non-subscriber-message";
						sub_message.appendChild(nonsub_message);

						unlock_text.className = "unlock-text";
						unlock_text.innerHTML = "Subscribe to unlock Emoticons";
						nonsub_message.appendChild(unlock_text);

						sub_link.className = "action subscribe-button button primary";
						sub_link.href = product.get("product_url");
						sub_link.innerHTML = '<span class="subscribe-text">Subscribe</span><span class="subscribe-price">' + product.get("price") + '</span>';
						nonsub_message.appendChild(sub_link);

						inner.appendChild(sub_message);
					} else if ( c > 0 ) {
						var last_content = tickets.get("content");
						last_content = last_content.length > 0 ? last_content[last_content.length-1] : undefined;
						if ( last_content && last_content.purchase_profile && !last_content.purchase_profile.will_renew ) {
							var ends_at = utils.parse_date(last_content.access_end || "");
								sub_message = document.createElement("div"),
								nonsub_message = document.createElement("div"),
								unlock_text = document.createElement("span"),
								end_time = ends_at ? Math.floor((ends_at.getTime() - Date.now()) / 1000) : null;

							sub_message.className = "subscribe-message";
							nonsub_message.className = "non-subscriber-message";
							sub_message.appendChild(nonsub_message);

							unlock_text.className = "unlock-text";
							unlock_text.innerHTML = "Subscription expires in " + utils.time_to_string(end_time, true, true);
							nonsub_message.appendChild(unlock_text);
							inner.appendChild(sub_message);
						}
					}
				}
			}

			// Do we have extra sets?
			var extra_sets = room && room.extra_sets || [];

			// Basic Emote Sets
			this._emotes_for_sets(inner, view, room && room.set && [room.set] || [], (this.feature_friday || has_product || extra_sets.length ) ? "Channel Emoticons" : null, "http://cdn.frankerfacez.com/script/devicon.png", "FrankerFaceZ");

			for(var i=0; i < extra_sets.length; i++) {
				// Look up the set name.
				var set = this.emote_sets[extra_sets[i]],
					name = set ? "Featured " + set.title : "Featured Channel";

				this._emotes_for_sets(inner, view, [extra_sets[i]], name, "http://cdn.frankerfacez.com/script/devicon.png", "FrankerFaceZ");
			}

			// Feature Friday!
			this._feature_friday_ui(room_id, inner, view);
		},

	name: "Channel",
	icon: constants.ZREKNARF
	};


// --------------------
// Emotes for Sets
// --------------------

FFZ.prototype._emotes_for_sets = function(parent, view, sets, header, image, sub_text) {
	var grid = document.createElement('div'), c = 0, f = this;
	grid.className = 'emoticon-grid';

	if ( header != null ) {
		var el_header = document.createElement('div');
		el_header.className = 'heading';

		if ( sub_text ) {
			var s = document.createElement("span");
			s.className = "right";
			s.appendChild(document.createTextNode(sub_text));
			el_header.appendChild(s);
		}

		el_header.appendChild(document.createTextNode(header));

		if ( image )
			el_header.style.backgroundImage = 'url("' + image + '")';

		grid.appendChild(el_header);
	}

	var emotes = [];
	for(var i=0; i < sets.length; i++) {
		var set = this.emote_sets[sets[i]];
		if ( ! set || ! set.emoticons )
			continue;

		for(var eid in set.emoticons) {
			if ( ! set.emoticons.hasOwnProperty(eid) || set.emoticons[eid].hidden )
				continue;

			emotes.push(set.emoticons[eid]);
		}
	}

	// Sort the emotes!
	emotes.sort(function(a,b) {
		var an = a.name.toLowerCase(),
			bn = b.name.toLowerCase();

		if ( an < bn ) return -1;
		else if ( an > bn ) return 1;
		return 0;
	});

	for(var i=0; i < emotes.length; i++) {
		var emote = emotes[i], srcset = null;

		if ( emote.urls[2] || emote.urls[4] ) {
			srcset = 'url("' + emote.urls[1] + '") 1x';
			if ( emote.urls[2] )
				srcset += ', url("' + emote.urls[2] + '") 2x';
			if ( emote.urls[4] )
				srcset += ', url("' + emote.urls[4] + '") 4x';
		}

		c++;
		var s = document.createElement('span');
		s.className = 'emoticon tooltip';
		s.style.backgroundImage = 'url("' + emote.urls[1] + '")';

		if ( srcset ) {
			var img_set = 'image-set(' + srcset + ')';
			s.style.backgroundImage = '-webkit-' + img_set;
			s.style.backgroundImage = '-moz-' + img_set;
			s.style.backgroundImage = '-ms-' + img_set;
			s.style.backgroundImage = img_set;
		}

		s.style.width = emote.width + "px";
		s.style.height = emote.height + "px";
		s.title = this._emote_tooltip(emote);

		s.addEventListener('click', function(id, code, e) {
			e.preventDefault();
			if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
				window.open("https://www.frankerfacez.com/emoticons/" + id);
			else
				this._add_emote(view, code);
		}.bind(this, emote.id, emote.name));

		grid.appendChild(s);
	}

	if ( !c ) {
		grid.innerHTML += "This channel has no emoticons.";
		grid.className = "emoticon-grid ffz-no-emotes center";
	}

	parent.appendChild(grid);
}


FFZ.prototype._add_emote = function(view, emote) {
	var input_el, text, room;

	if ( this.has_bttv ) {
		input_el = view.get('element').querySelector('textarea');
		text = input_el.value;

	} else {
		room = view.get('controller.currentRoom');
		text = room.get('messageToSend') || '';
	}

	text += (text && text.substr(-1) !== " " ? " " : "")  + (emote.name || emote);

	if ( input_el )
		input_el.value = text;
	else
		room.set('messageToSend', text);
}
},{"../constants":5,"../utils":35}],28:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants');

// --------------------
// Initialization
// --------------------

FFZ.prototype.build_ui_link = function(view) {
	var link = document.createElement('a');
	link.className = 'ffz-ui-toggle';
	link.innerHTML = constants.CHAT_BUTTON;

	link.addEventListener('click', this.build_ui_popup.bind(this, view));

	this.update_ui_link(link);
	return link;
}


FFZ.prototype.update_ui_link = function(link) {
	var controller = window.App && App.__container__.lookup('controller:chat');
	link = link || document.querySelector('a.ffz-ui-toggle');
	if ( !link || !controller )
		return;

	var room_id = controller.get('currentRoom.id'),
		room = this.rooms[room_id],
		has_emotes = false,

		dark = (this.has_bttv ? BetterTTV.settings.get('darkenedMode') : false),
		blue = (this.has_bttv ? BetterTTV.settings.get('showBlueButtons') : false),
		live = (this.feature_friday && this.feature_friday.live);


	// Check for emoticons.
	if ( room && room.set ) {
		var set = this.emote_sets[room.set];
		if ( set && set.count > 0 )
			has_emotes = true;
	}

	link.classList.toggle('no-emotes', ! has_emotes);
	link.classList.toggle('live', live);
	link.classList.toggle('dark', dark);
	link.classList.toggle('blue', blue);
}
},{"../constants":5}],29:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
	utils = require("../utils"),

	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	BANNED_SETS = {"00000turbo":true};


// -------------------
// Initialization
// -------------------

FFZ.basic_settings.replace_twitch_menu = {
	type: "boolean",

	category: "Chat",

	name: "Unified Emoticons Menu",
	help: "Completely replace the default Twitch emoticon menu and display global emoticons in the My Emoticons menu.",

	get: function() {
		return this.settings.replace_twitch_menu && this.settings.global_emotes_in_menu && this.settings.emoji_in_menu;
	},

	set: function(val) {
		this.settings.set('replace_twitch_menu', val);
		this.settings.set('global_emotes_in_menu', val);
		this.settings.set('emoji_in_menu', val);
	}
};

FFZ.settings_info.replace_twitch_menu = {
	type: "boolean",
	value: false,

	category: "Chat Input",

	name: "Replace Twitch Emoticon Menu",
	help: "Completely replace the default Twitch emoticon menu.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-menu-replace", val);
		}
	};


FFZ.settings_info.global_emotes_in_menu = {
	type: "boolean",
	value: false,

	category: "Chat Input",

	name: "Display Global Emotes in My Emotes",
	help: "Display the global Twitch emotes in the My Emoticons menu."
	};


FFZ.settings_info.emoji_in_menu = {
	type: "boolean",
	value: false,

	category: "Chat Input",

	name: "Display Emoji in My Emotes",
	help: "Display the supported emoji images in the My Emoticons menu."
	};


FFZ.settings_info.emote_menu_collapsed = {
	value: [],
	visible: false
}


FFZ.prototype.setup_my_emotes = function() {
	this._twitch_badges = {};
	this._twitch_badges["--global--"] = "//cdn.frankerfacez.com/script/twitch_logo.png";
	this._twitch_badges["--turbo-faces--"] = this._twitch_badges["turbo"] = "//cdn.frankerfacez.com/script/turbo_badge.png";
}


// -------------------
// Menu Page
// -------------------

FFZ.menu_pages.myemotes = {
	name: "My Emoticons",
	icon: constants.EMOTE,

	visible: function(view) {
		var user = this.get_user(),
			tmi = view.get('controller.currentRoom.tmiSession'),
			ffz_sets = user && this.users[user.login] && this.users[user.login].sets || [],
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'];

		return ffz_sets.length || (twitch_sets && Object.keys(twitch_sets).length);
	},

	render: function(view, container) {
		var tmi = view.get('controller.currentRoom.tmiSession'),
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'];

		// We don't have to do async stuff anymore cause we pre-load data~!
		return FFZ.menu_pages.myemotes.draw_menu.bind(this)(view, container, twitch_sets);
	},

	toggle_section: function(heading) {
		var menu = heading.parentElement,
			set_id = menu.getAttribute('data-set'),
			collapsed_list = this.settings.emote_menu_collapsed,
			is_collapsed = collapsed_list.indexOf(set_id) !== -1;

		if ( is_collapsed )
			collapsed_list.removeObject(set_id);
		else
			collapsed_list.push(set_id);

		this.settings.set('emote_menu_collapsed', collapsed_list);
		menu.classList.toggle('collapsed', !is_collapsed);
	},

	draw_emoji: function(view) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			f = this;

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">FrankerFaceZ</span>Emoji';
		heading.style.backgroundImage = 'url("' + constants.SERVER + '/emoji/1f4af-1x.png")';

		menu.className = 'emoticon-grid collapsable';
		menu.appendChild(heading);

		menu.setAttribute('data-set', 'emoji');
		menu.classList.toggle('collapsed', this.settings.emote_menu_collapsed.indexOf('emoji') !== -1);
		heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this); });

		var set = [];
		for(var eid in this.emoji_data)
			set.push(this.emoji_data[eid]);

		set.sort(function(a,b) {
			var an = a.short_name.toLowerCase(),
				bn = b.short_name.toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.raw < b.raw ) return -1;
			if ( a.raw > b.raw ) return 1;
			return 0;
		});

		for(var i=0; i < set.length; i++) {
			var emoji = set[i],
				em = document.createElement('span'),
				img_set = 'image-set(url("' + emoji.src + '") 1x, url("' + constants.SERVER + 'emoji/' + emoji.code + '-2x.png") 2x, url("' + constants.SERVER + 'emoji/' + emoji.code + '-4x.png") 4x)';

			em.className = 'emoticon tooltip';
			em.title = 'Emoji: ' + emoji.raw + '\nName: :' + emoji.short_name + ':';
			em.addEventListener('click', this._add_emote.bind(this, view, emoji.raw));

			em.style.backgroundImage = 'url("' + emoji.src + '")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroudnImage = img_set;

			menu.appendChild(em);
		}

		return menu;
	},

	draw_twitch_set: function(view, set_id, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			f = this,

			channel_id = this._twitch_set_to_channel[set_id], title;

		if ( channel_id === "twitch_unknown" )
			title = "Unknown Channel";
		else if ( channel_id === "--global--" )
			title = "Global Emoticons";
		else if ( channel_id === "turbo" || channel_id === "--turbo-faces--" )
			title = "Twitch Turbo";
		else
			title = FFZ.get_capitalization(channel_id, function(name) {
				heading.innerHTML = '<span class="right">Twitch</span>' + utils.sanitize(name);
			});

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">Twitch</span>' + utils.sanitize(title);

		if ( this._twitch_badges[channel_id] )
			heading.style.backgroundImage = 'url("' + this._twitch_badges[channel_id] + '")';
		else {
			var f = this;
			Twitch.api.get("chat/" + channel_id + "/badges", null, {version: 3})
				.done(function(data) {
					if ( data.subscriber && data.subscriber.image ) {
						f._twitch_badges[channel_id] = data.subscriber.image;
						localStorage.ffzTwitchBadges = JSON.stringify(f._twitch_badges);
						heading.style.backgroundImage = 'url("' + data.subscriber.image + '")';
					}
				});
		}

		menu.className = 'emoticon-grid collapsable';
		menu.appendChild(heading);

		menu.setAttribute('data-set', 'twitch-' + set_id);
		menu.classList.toggle('collapsed', this.settings.emote_menu_collapsed.indexOf('twitch-' + set_id) !== -1);
		heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this); });

		set.sort(function(a,b) {
			var an = a.code.toLowerCase(),
				bn = b.code.toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.id < b.id ) return -1;
			if ( a.id > b.id ) return 1;
			return 0;
		});

		for(var i=0; i < set.length; i++) {
			var emote = set[i],
				code = constants.KNOWN_CODES[emote.code] || emote.code,

				em = document.createElement('span'),
				img_set = 'image-set(url("' + TWITCH_BASE + emote.id + '/1.0") 1x, url("' + TWITCH_BASE + emote.id + '/2.0") 2x, url("' + TWITCH_BASE + emote.id + '/3.0") 4x)';

			em.className = 'emoticon tooltip';

			if ( this.settings.replace_bad_emotes && constants.EMOTE_REPLACEMENTS[emote.id] ) {
				em.style.backgroundImage = 'url("' + constants.EMOTE_REPLACEMENT_BASE + constants.EMOTE_REPLACEMENTS[emote.id] + '")';
			} else {
				em.style.backgroundImage = 'url("' + TWITCH_BASE + emote.id + '/1.0")';
				em.style.backgroundImage = '-webkit-' + img_set;
				em.style.backgroundImage = '-moz-' + img_set;
				em.style.backgroundImage = '-ms-' + img_set;
				em.style.backgroudnImage = img_set;
			}

			em.title = code;
			em.addEventListener("click", function(id, code, e) {
				e.preventDefault();
				if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
					window.open("https://twitchemotes.com/emote/" + id);
				else
					this._add_emote(view, code);
			}.bind(this, emote.id, emote.code));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_ffz_set: function(view, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			f = this,
			emotes = [];

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">FrankerFaceZ</span>' + set.title;
		heading.style.backgroundImage = 'url("' + (set.icon || '//cdn.frankerfacez.com/script/devicon.png') + '")';

		menu.className = 'emoticon-grid collapsable';
		menu.appendChild(heading);

		menu.setAttribute('data-set', 'ffz-' + set.id);
		menu.classList.toggle('collapsed', this.settings.emote_menu_collapsed.indexOf('ffz-' + set.id) !== -1);
		heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this); });

		for(var emote_id in set.emoticons)
			set.emoticons.hasOwnProperty(emote_id) && ! set.emoticons[emote_id].hidden && emotes.push(set.emoticons[emote_id]);

		emotes.sort(function(a,b) {
			var an = a.name.toLowerCase(),
				bn = b.name.toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.id < b.id ) return -1;
			if ( a.id > b.id ) return 1;
			return 0;
		});

		for(var i=0; i < emotes.length; i++) {
			var emote = emotes[i],

				em = document.createElement('span'),
				img_set = 'image-set(url("' + emote.urls[1] + '") 1x';

			if ( emote.urls[2] )
				img_set += ', url("' + emote.urls[2] + '") 2x';

			if ( emote.urls[4] )
				img_set += ', url("' + emote.urls[4] + '") 4x';

			img_set += ')';

			em.className = 'emoticon tooltip';
			em.style.backgroundImage = 'url("' + emote.urls[1] + '")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroudnImage = img_set;

			if ( emote.height )
				em.style.height = emote.height + "px";
			if ( emote.width )
				em.style.width = emote.width + "px";

			em.title = this._emote_tooltip(emote);
			em.addEventListener("click", function(id, code, e) {
				e.preventDefault();
				if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
					window.open("https://www.frankerfacez.com/emoticons/" + id);
				else
					this._add_emote(view, code);
			}.bind(this, emote.id, emote.name));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_menu: function(view, container, twitch_sets) {
		// Make sure we're still on the My Emoticons page. Since this is
		// asynchronous, the user could've tabbed away.
		if ( container.getAttribute('data-page') !== 'myemotes' )
			return;

		container.innerHTML = "";
		try {
			var user = this.get_user(),
				ffz_sets = this.getEmotes(user && user.login, null),
				sets = [];

			// Start with Twitch Sets
			for(var set_id in twitch_sets) {
				if ( ! twitch_sets.hasOwnProperty(set_id) || ( ! this.settings.global_emotes_in_menu && set_id === '0' ) )
					continue;

				var set = twitch_sets[set_id];
				if ( ! set.length )
					continue;

				sets.push([this._twitch_set_to_channel[set_id], FFZ.menu_pages.myemotes.draw_twitch_set.bind(this)(view, set_id, set)]);
			}

			// Emoji~!
			if ( this.settings.emoji_in_menu )
				sets.push(["emoji", FFZ.menu_pages.myemotes.draw_emoji.bind(this)(view)]);

			// Now, FFZ!
			for(var i=0; i < ffz_sets.length; i++) {
				var set_id = ffz_sets[i],
					set = this.emote_sets[set_id];

				if ( ! set || ! set.count || ( ! this.settings.global_emotes_in_menu && this.default_sets.indexOf(set_id) !== -1 ) )
					continue;

				sets.push([set.title.toLowerCase(), FFZ.menu_pages.myemotes.draw_ffz_set.bind(this)(view, set)]);
			}


			// Finally, sort and add them all.
			sets.sort(function(a,b) {
				var an = a[0], bn = b[0];
				if ( an === "turbo" || an === "--turbo-faces--" )
					an = "zza|" + an;
				else if ( an === "global" || an === "global emoticons" || an === "--global--" )
					an = "zzy|" + an;
				else if ( an === "emoji" )
					an = "zzz|" + an;

				if ( bn === "turbo" || bn === "--turbo-faces--" )
					bn = "zza|" + bn;
				else if ( bn === "global" || bn === "global emoticons" || bn === "--global--" )
					bn = "zzy|" + bn;
				else if ( bn === "emoji" )
					bn = "zzz|" + bn;

				if ( an < bn ) return -1;
				if ( an > bn ) return 1;
				return 0;
			});

			for(var i=0; i < sets.length; i++)
				container.appendChild(sets[i][1]);

		} catch(err) {
			this.error("myemotes draw_menu: " + err);
			container.innerHTML = "";

			var menu = document.createElement('div'),
				heading = document.createElement('div'),
				p = document.createElement('p');

			heading.className = 'heading';
			heading.innerHTML = 'Error Loading Menu';
			menu.appendChild(heading);

			p.className = 'clearfix';
			p.textContent = err;
			menu.appendChild(p);

			menu.className = 'chat-menu-content';
			container.appendChild(menu);
		}
	}
};
},{"../constants":5,"../utils":35}],30:[function(require,module,exports){
var FFZ = window.FrankerFaceZ;


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
},{}],31:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	utils = require('../utils');


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_races = function() {
	this.log("Initializing race support.");
	this.srl_races = {};
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.srl_races = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "SRL Race Information",
	help: 'Display information about <a href="http://www.speedrunslive.com/" target="_new">SpeedRunsLive</a> races under channels.',
	on_update: function(val) {
			this.rebuild_race_ui();
		}
	};


// ---------------
// Socket Handler
// ---------------

FFZ.ws_on_close.push(function() {
	var controller = window.App && App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false;

	if ( ! controller )
		return;

	for(var chan in this.srl_races) {
		delete this.srl_races[chan];
		if ( chan === current_id || chan === current_host )
			need_update = true;
	}

	if ( need_update )
		this.rebuild_race_ui();
});


FFZ.ws_commands.srl_race = function(data) {
	var controller = App.__container__.lookup('controller:channel'),
		current_id = controller && controller.get('id'),
		current_host = controller && controller.get('hostModeTarget.id'),
		need_update = false;

	this.srl_races = this.srl_races || {};

	for(var i=0; i < data[0].length; i++) {
		var channel_id = data[0][i];
		this.srl_races[channel_id] = data[1];
		if ( channel_id === current_id || channel_id === current_host )
			need_update = true;
	}

	if ( data[1] ) {
		var race = data[1],
			tte = race.twitch_entrants = {};

		for(var ent in race.entrants) {
			if ( ! race.entrants.hasOwnProperty(ent) ) continue;
			if ( race.entrants[ent].channel )
				tte[race.entrants[ent].channel] = ent;
			race.entrants[ent].name = ent;
		}
	}

	if ( need_update )
		this.rebuild_race_ui();
}


// ---------------
// Race UI
// ---------------

FFZ.prototype.rebuild_race_ui = function() {
	var controller = App.__container__.lookup('controller:channel'),
		channel_id = controller && controller.get('id'),
		hosted_id = controller && controller.get('hostModeTarget.id');

	if ( ! this._cindex )
		return;

	if ( channel_id ) {
		var race = this.srl_races && this.srl_races[channel_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('.stats-and-actions .channel-actions'),
			race_container = container && container.querySelector('#ffz-ui-race');

		if ( ! container || ! this.settings.srl_races || ! race ) {
			if ( race_container )
				race_container.parentElement.removeChild(race_container);

		} else {
			if ( ! race_container ) {
				race_container = document.createElement('span');
				race_container.id = 'ffz-ui-race';
				race_container.setAttribute('data-channel', channel_id);

				var btn = document.createElement('span');
				btn.className = 'button drop action';
				btn.title = "SpeedRunsLive Race";
				btn.innerHTML = '<span class="logo"></span>';

				btn.addEventListener('click', this._build_race_popup.bind(this, race_container, channel_id));

				race_container.appendChild(btn);
				container.appendChild(race_container);
			}

			this._update_race(race_container, true);
		}
	}

	if ( hosted_id ) {
		var race = this.srl_races && this.srl_races[hosted_id],

			el = this._cindex.get('element'),
			container = el && el.querySelector('#hostmode .channel-actions'),
			race_container = container && container.querySelector('#ffz-ui-race');

		if ( ! container || ! this.settings.srl_races || ! race ) {
			if ( race_container )
				race_container.parentElement.removeChild(race_container);

		} else {
			if ( ! race_container ) {
				race_container = document.createElement('span');
				race_container.id = 'ffz-ui-race';
				race_container.setAttribute('data-channel', hosted_id);

				var btn = document.createElement('span');
				btn.className = 'button drop action';
				btn.title = "SpeedRunsLive Race";
				btn.innerHTML = '<span class="logo"></span>';

				btn.addEventListener('click', this._build_race_popup.bind(this, race_container, hosted_id));

				race_container.appendChild(btn);
				container.appendChild(race_container);
			}

			this._update_race(race_container, true);
		}
	}
}


// ---------------
// Race Popup
// ---------------

FFZ.prototype._race_kill = function() {
	if ( this._race_timer ) {
		clearTimeout(this._race_timer);
		delete this._race_timer;
	}

	delete this._race_game;
	delete this._race_goal;
}


FFZ.prototype._build_race_popup = function(container, channel_id) {
	var popup = this._popup;
	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		this._popup_kill && this._popup_kill();
		delete this._popup_kill;

		if ( popup.id === "ffz-race-popup" && popup.getAttribute('data-channel') === channel_id )
			return;
	}

	if ( ! container )
		return;

	var el = container.querySelector('.button'),
		pos = el.offsetLeft + el.offsetWidth,
		race = this.srl_races[channel_id];

	var popup = document.createElement('div'), out = '';
	popup.id = 'ffz-race-popup';
	popup.setAttribute('data-channel', channel_id);
	popup.className = (pos >= 300 ? 'right' : 'left') + ' share dropmenu';

	this._popup_kill = this._race_kill.bind(this);
	this._popup = popup;

	var link = 'http://kadgar.net/live',
		has_entrant = false;
	for(var ent in race.entrants) {
		var state = race.entrants[ent].state;
		if ( race.entrants.hasOwnProperty(ent) && race.entrants[ent].channel && (state == "racing" || state == "entered") ) {
			link += "/" + race.entrants[ent].channel;
			has_entrant = true;
		}
	}

	var height = document.querySelector('.app-main.theatre') ? document.body.clientHeight - 300 : container.parentElement.offsetTop - 175,
		controller = App.__container__.lookup('controller:channel'),
		display_name = controller ? controller.get('display_name') : FFZ.get_capitalization(channel_id),
		tweet = encodeURIComponent("I'm watching " + display_name + " race " + race.goal + " in " + race.game + " on SpeedRunsLive!");

	out = '<div class="heading"><div></div><span></span></div>';
	out += '<div class="table" style="max-height:' + height + 'px"><table><thead><tr><th>#</th><th>Entrant</th><th>&nbsp;</th><th>Time</th></tr></thead>';
	out += '<tbody></tbody></table></div>';
	out += '<div class="divider"></div>';

	out += '<iframe class="twitter_share_button" style="width:130px; height:25px" src="https://platform.twitter.com/widgets/tweet_button.html?text=' + tweet + '%20Watch%20at&via=Twitch&url=http://www.twitch.tv/' + channel_id + '"></iframe>';

	out += '<p class="right"><a target="_new" href="http://www.speedrunslive.com/race/?id=' + race.id + '">SRL</a>';

	if ( has_entrant )
		out += ' &nbsp; <a target="_new" href="' + link + '">Multitwitch</a>';

	out += '</p>';
	popup.innerHTML = out;
	container.appendChild(popup);

	this._update_race(container, true);
}


FFZ.prototype._update_race = function(container, not_timer) {
	if ( this._race_timer && not_timer ) {
		clearTimeout(this._race_timer);
		delete this._race_timer;
	}

	if ( ! container )
		return;

	var channel_id = container.getAttribute('data-channel'),
		race = this.srl_races[channel_id];

	if ( ! race ) {
		// No race. Abort.
		container.parentElement.removeChild(container);
		if ( this._popup && this._popup.id === 'ffz-race-popup' && this._popup.getAttribute('data-channel') === channel_id ) {
			this._popup_kill && this._popup_kill();
			if ( this._popup ) {
				delete this._popup;
				delete this._popup_kill;
			}
		}
		return;
	}

	var entrant_id = race.twitch_entrants[channel_id],
		entrant = race.entrants[entrant_id],

		popup = container.querySelector('#ffz-race-popup'),
		now = Date.now() / 1000,
		elapsed = Math.floor(now - race.time);

	container.querySelector('.logo').innerHTML = utils.placement(entrant);

	if ( popup ) {
		var tbody = popup.querySelector('tbody'),
			timer = popup.querySelector('.heading span'),
			info = popup.querySelector('.heading div');

		tbody.innerHTML = '';
		var entrants = [], done = true;
		for(var ent in race.entrants) {
			if ( ! race.entrants.hasOwnProperty(ent) ) continue;
			if ( race.entrants[ent].state == "racing" )
				done = false;
			entrants.push(race.entrants[ent]);
		}

		entrants.sort(function(a,b) {
			var a_place = a.place || 9999,
				b_place = b.place || 9999,

				a_time = a.time || elapsed,
				b_time = b.time || elapsed;

			if ( a.state == "forfeit" || a.state == "dq" )
				a_place = 10000;

			if ( b.state == "forfeit" || b.state == "dq" )
				b_place = 10000;

			if ( a_place < b_place ) return -1;
			else if ( a_place > b_place ) return 1;

			else if ( a.name < b.name ) return -1;
			else if ( a.name > b.name ) return 1;

			else if ( a_time < b_time ) return -1;
			else if ( a_time > b_time ) return 1;
			});

		for(var i=0; i < entrants.length; i++) {
			var ent = entrants[i],
				name = '<a target="_new" href="http://www.speedrunslive.com/profiles/#!/' + utils.sanitize(ent.name) + '">' + ent.display_name + '</a>',
				twitch_link = ent.channel ? '<a target="_new" class="twitch" href="http://www.twitch.tv/' + utils.sanitize(ent.channel) + '"></a>' : '',
				hitbox_link = ent.hitbox ? '<a target="_new" class="hitbox" href="http://www.hitbox.tv/' + utils.sanitize(ent.hitbox) + '"></a>' : '',
				time = elapsed ? utils.time_to_string(ent.time||elapsed) : "",
				place = utils.place_string(ent.place),
				comment = ent.comment ? utils.sanitize(ent.comment) : "";

			tbody.innerHTML += '<tr' + (comment ? ' title="' + comment + '"' : '') + ' class="' + ent.state + '"><td>' + place + '</td><td>' + name + '</td><td>' + twitch_link + hitbox_link + '</td><td class="time">' + (ent.state == "forfeit" ? "Forfeit" : time) + '</td></tr>';
		}

		if ( this._race_game != race.game || this._race_goal != race.goal ) {
			this._race_game = race.game;
			this._race_goal = race.goal;

			var game = utils.sanitize(race.game),
				goal = utils.sanitize(race.goal);

			info.innerHTML = '<h2 title="' + game + '">' + game + "</h2><b>Goal: </b>" + goal;
		}

		if ( ! elapsed )
			timer.innerHTML = "Entry Open";
		else if ( done )
			timer.innerHTML = "Done";
		else {
			timer.innerHTML = utils.time_to_string(elapsed);
			this._race_timer = setTimeout(this._update_race.bind(this, container), 1000);
		}
	}
}
},{"../utils":35}],32:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants');

FFZ.prototype.setup_css = function() {
	this.log("Injecting main FrankerFaceZ CSS.");

	var s = this._main_style = document.createElement('link');

	s.id = "ffz-ui-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.SERVER + "script/style.css?_=" + (constants.DEBUG ? Date.now() : FFZ.version_info));
	document.head.appendChild(s);

	jQuery.noty.themes.ffzTheme = {
		name: "ffzTheme",
		style: function() {
			this.$bar.removeClass().addClass("noty_bar").addClass("ffz-noty").addClass(this.options.type);
			},
		callback: {
			onShow: function() {},
			onClose: function() {}
		}
	};
}
},{"../constants":5}],33:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// -------------------
// Subscriber Display
// -------------------

FFZ.prototype._update_subscribers = function() {
	if ( this._update_subscribers_timer ) {
		clearTimeout(this._update_subscribers_timer);
		delete this._update_subscribers_timer;
	}

	// Schedule an update.
	this._update_subscribers_timer = setTimeout(this._update_subscribers.bind(this), 60000);

	var user = this.get_user(), f = this,
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard && match && match[1];

	if ( this.has_bttv || ! id || id !== user.login ) {
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	}

	// Spend a moment wishing we could just hit the subscribers API from the
	// context of the web user.

	// Get the count!
	jQuery.ajax({url: "/broadcast/dashboard/partnership"}).done(function(data) {
		try {
			var html = document.createElement('span'), dash;

			html.innerHTML = data;
			dash = html.querySelector("#dash_main");

			var match = dash && dash.textContent.match(/([\d,\.]+) total active subscribers/),
				sub_count = match && match[1];

			if ( ! sub_count ) {
				var el = document.querySelector("#ffz-sub-display");
				if ( el )
					el.parentElement.removeChild(el);

				if ( f._update_subscribers_timer ) {
					clearTimeout(f._update_subscribers_timer);
					delete f._update_subscribers_timer;
				}

				return;
			}

			var el = document.querySelector('#ffz-sub-display span');
			if ( ! el ) {
				var cont = f.is_dashboard ? document.querySelector("#stats") : document.querySelector("#channel .stats-and-actions .channel-stats");
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-sub-display';
				stat.title = 'Active Channel Subscribers';

				stat.innerHTML = constants.STAR + ' ';

				el = document.createElement('span');
				stat.appendChild(el);

				Twitch.api.get("chat/" + id + "/badges", null, {version: 3})
					.done(function(data) {
						if ( data.subscriber && data.subscriber.image ) {
							stat.innerHTML = '';
							stat.appendChild(el);

							stat.style.backgroundImage = 'url("' + data.subscriber.image + '")';
							stat.style.backgroundRepeat = 'no-repeat';
							stat.style.paddingLeft = '23px';
							stat.style.backgroundPosition = '0 50%';
						}
					});

				cont.appendChild(stat);
				jQuery(stat).tipsy(f.is_dashboard ? {"gravity":"s"} : undefined);
			}

			el.innerHTML = sub_count;

		} catch(err) {
			f.error("_update_subscribers: " + err);
		}
	}).fail(function(){
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	});;
}

},{"../constants":5,"../utils":35}],34:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// ------------
// FFZ Viewers
// ------------

FFZ.ws_commands.chatters = function(data) {
	var channel = data[0], count = data[1];

	var controller = window.App && App.__container__.lookup('controller:channel'),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard ? match && match[1] : controller && controller.get && controller.get('id');

	if ( ! this.is_dashboard ) {
		var room = this.rooms && this.rooms[channel];
		if ( room ) {
			room.ffz_chatters = count;
			if ( this._cindex )
				this._cindex.ffzUpdateChatters();
		}
		return;
	}

	this._dash_chatters = count;
}

FFZ.ws_commands.viewers = function(data) {
	var channel = data[0], count = data[1];

	var controller = window.App && App.__container__.lookup('controller:channel'),
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard ? match && match[1] : controller && controller.get && controller.get('id');

	if ( ! this.is_dashboard ) {
		var room = this.rooms && this.rooms[channel];
		if ( room ) {
			room.ffz_viewers = count;
			if ( this._cindex )
				this._cindex.ffzUpdateChatters();
		}
		return;
	}

	this._dash_viewers = count;

	if ( ! this.settings.chatter_count || id !== channel )
		return;

	var view_count = document.querySelector('#ffz-ffzchatter-display'),
		content = constants.ZREKNARF + ' ' + utils.number_commas(count) + (typeof this._dash_chatters === "number" ? ' (' + utils.number_commas(this._dash_chatters) + ')' : "");

	if ( view_count )
		view_count.innerHTML = content;
	else {
		var parent = document.querySelector("#stats");
		if ( ! parent )
			return;

		view_count = document.createElement('span');
		view_count.id = "ffz-ffzchatter-display";
		view_count.className = 'ffz stat';
		view_count.title = 'Viewers (In Chat) with FrankerFaceZ';
		view_count.innerHTML = content;

		parent.appendChild(view_count);
		jQuery(view_count).tipsy(this.is_dashboard ? {"gravity":"s"} : undefined);
	}
}
},{"../constants":5,"../utils":35}],35:[function(require,module,exports){
var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


var sanitize_el = document.createElement('span'),

	sanitize = function(msg) {
		sanitize_el.textContent = msg;
		return sanitize_el.innerHTML;
	},
	
	R_QUOTE = /"/g,
	R_SQUOTE = /'/g,
	R_AMP = /&/g,
	R_LT = /</g,
	R_GT = />/g,
	
	quote_attr = function(msg) {
		return msg.replace(R_AMP, "&amp;").replace(R_QUOTE, "&quot;").replace(R_SQUOTE, "&apos;").replace(R_LT, "&lt;").replace(R_GT, "&gt;");
	},

	pluralize = function(value, singular, plural) {
		plural = plural || 's';
		singular = singular || '';
		return value === 1 ? singular : plural;
	},

	place_string = function(num) {
		if ( num == 1 ) return '1st';
		else if ( num == 2 ) return '2nd';
		else if ( num == 3 ) return '3rd';
		else if ( num == null ) return '---';
		return num + "th";
	},

	date_regex = /^(\d{4}|\+\d{6})(?:-?(\d{2})(?:-?(\d{2})(?:T(\d{2})(?::?(\d{2})(?::?(\d{2})(?:(?:\.|,)(\d{1,}))?)?)?(Z|([\-+])(\d{2})(?::?(\d{2}))?)?)?)?)?$/,

	parse_date = function(str) {
		var parts = str.match(date_regex);
		if ( ! parts )
			return null;

		parts[7] = (parts[7] && parts[7].length) ? parts[7].substr(0, 3) : 0;

		var unix = Date.UTC(parts[1], parts[2] - 1, parts[3], parts[4], parts[5], parts[6], parts[7]);

		// Check Offset
		if ( parts[9] ) {
			var offset = (parts[9] == "-" ? 1 : -1) * 60000 * (60*parts[10] + 1*parts[11]);
			unix += offset;
		}

		return new Date(unix);
	},


	// IRC Messages
	splitIRCMessage = function(msgString) {
		msgString = $.trim(msgString);
		var split = {raw: msgString};

		var tagsEnd = -1;
		if ( msgString.charAt(0) === '@' ) {
			tagsEnd = msgString.indexOf(' ');
			split.tags = msgString.substr(1, tagsEnd - 1);
		}

		var prefixStart = tagsEnd + 1,
			prefixEnd = -1;

		if ( msgString.charAt(prefixStart) === ':' ) {
			prefixEnd = msgString.indexOf(' ', prefixStart);
			split.prefix = msgString.substr(prefixStart + 1, prefixEnd - (prefixStart + 1));
		}

		var trailingStart = msgString.indexOf(' :', prefixStart);
		if ( trailingStart >= 0 ) {
			split.trailing = msgString.substr(trailingStart + 2);
		} else {
			trailingStart = msgString.length;
		}

		var commandAndParams = msgString.substr(prefixEnd + 1, trailingStart - prefixEnd - 1).split(' ');
		split.command = commandAndParams[0];
		if ( commandAndParams.length > 1 )
			split.params = commandAndParams.slice(1);

		return split;
	},


	ESCAPE_CHARS = {
		':': ';',
		s: ' ',
		r: '\r',
		n: '\n',
		'\\': '\\'
	},

	unescapeTag = function(tag) {
		var result = '';
		for(var i=0; i < tag.length; i++) {
			var c = tag.charAt(i);
			if ( c === '\\' ) {
				if ( i === tag.length - 1 )
					throw 'Improperly escaped tag';

				c = ESCAPE_CHARS[tag.charAt(i+1)];
				if ( c === undefined )
					throw 'Improperly escaped tag';

				i++;
			}
			result += c;
		}

		return result;
	},

	parseTag = function(tag, value) {
		switch(tag) {
			case 'slow':
				try {
					return parseInt(value);
				} catch(err) { return 0; }
			case 'subs-only':
			case 'r9k':
			case 'subscriber':
			case 'turbo':
				return value === '1';
			default:
				try {
					return unescapeTag(value);
				} catch(err) { return ''; }
		}
	},

	parseIRCTags = function(tagsString) {
		var tags = {},
			keyValues = tagsString.split(';');

		for(var i=0; i < keyValues.length; ++i) {
			var kv = keyValues[i].split('=');
			if ( kv.length === 2 )
				tags[kv[0]] = parseTag(kv[0], kv[1]);
		}

		return tags;
	},


	EMOJI_CODEPOINTS = {},
	emoji_to_codepoint = function(icon, variant) {
		if ( EMOJI_CODEPOINTS[icon] && EMOJI_CODEPOINTS[icon][variant] )
			return EMOJI_CODEPOINTS[icon][variant];

		var ico = variant === '\uFE0F' ? icon.slice(0, -1) : (icon.length === 3 && icon.charAt(1) === '\uFE0F' ? icon.charAt(0) + icon.charAt(2) : icon),
			r = [], c = 0, p = 0, i = 0;

		while ( i < ico.length ) {
			c = ico.charCodeAt(i++);
			if ( p ) {
				r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
				p = 0;
			} else if ( 0xD800 <= c && c <= 0xDBFF) {
				p = c;
			} else {
				r.push(c.toString(16));
			}
		}

		var es = EMOJI_CODEPOINTS[icon] = EMOJI_CODEPOINTS[icon] || {},
			out = es[variant] = r.join("-");

		return out;
	};


module.exports = {
	update_css: function(element, id, css) {
		var all = element.innerHTML,
			start = "/*BEGIN " + id + "*/",
			end = "/*END " + id + "*/",
			s_ind = all.indexOf(start),
			e_ind = all.indexOf(end),
			found = s_ind !== -1 && e_ind !== -1 && e_ind > s_ind;

		if ( !found && !css )
			return;

		if ( found )
			all = all.substr(0, s_ind) + all.substr(e_ind + end.length);

		if ( css )
			all += start + css + end;

		element.innerHTML = all;
	},


	splitIRCMessage: splitIRCMessage,
	parseIRCTags: parseIRCTags,

	emoji_to_codepoint: emoji_to_codepoint,

	parse_date: parse_date,

	number_commas: function(x) {
		var parts = x.toString().split(".");
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		return parts.join(".");
	},

	place_string: place_string,

	placement: function(entrant) {
		if ( entrant.state == "forfeit" ) return "Forfeit";
		else if ( entrant.state == "dq" ) return "DQed";
		else if ( entrant.place ) return place_string(entrant.place);
		return "";
	},

	sanitize: sanitize,
	quote_attr: quote_attr,

	date_string: function(date) {
		return date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate();
	},

	pluralize: pluralize,

	human_time: function(elapsed, factor) {
		factor = factor || 1;
		elapsed = Math.floor(elapsed);

		var years = Math.floor((elapsed*factor) / 31536000) / factor;
		if ( years >= 1 )
			return years + ' year' + pluralize(years);

		var days = Math.floor((elapsed %= 31536000) / 86400);
		if ( days >= 1 )
			return days + ' day' + pluralize(days);

		var hours = Math.floor((elapsed %= 86400) / 3600);
		if ( hours >= 1 )
			return hours + ' hour' + pluralize(hours);

		var minutes = Math.floor((elapsed %= 3600) / 60);
		if ( minutes >= 1 )
			return minutes + ' minute' + pluralize(minutes);

		var seconds = elapsed % 60;
		if ( seconds >= 1 )
			return seconds + ' second' + pluralize(seconds);

		return 'less than a second';
	},

	time_to_string: function(elapsed, separate_days, days_only, no_hours) {
		var seconds = elapsed % 60,
			minutes = Math.floor(elapsed / 60),
			hours = Math.floor(minutes / 60),
			days = "";

		minutes = minutes % 60;

		if ( separate_days ) {
			days = Math.floor(hours / 24);
			hours = hours % 24;
			if ( days_only && days > 0 )
				return days + " days";

			days = ( days > 0 ) ? days + " days, " : "";
		}

		return days + ((!no_hours || days || hours) ? ((hours < 10 ? "0" : "") + hours + ':') : '') + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
	},

	format_unread: function(count) {
		if ( count < 1 )
			return "";

		else if ( count >= 99 )
			return "99+";

		return "" + count;
	}
}
},{"./constants":5}]},{},[18]);window.ffz = new FrankerFaceZ()}(window));