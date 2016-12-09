var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils'),

	KNOWN_COMMANDS = ['ffz', 'unban', 'ban', 'timeout', 'r9kbeta', 'r9kbetaoff', 'slow', 'slowoff', 'subscribers', 'subscribersoff', 'mod', 'unmod', 'me', 'emotesonly', 'emotesonlyoff', 'host', 'unhost', 'commercial'],

	STATUS_CODES = {
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not Found",
		500: "Internal Server Error"
	},

	format_result = function(response) {
		if ( typeof response === "string" )
			return response;

		else if ( Array.isArray(response) )
			return _.map(response, format_result).join(", ");

		return JSON.stringify(response);
	},

	ObjectPath = require('./ObjectPath');


FFZ.ObjectPath = ObjectPath;

// -----------------
// Settings
// -----------------

FFZ.settings_info.command_aliases = {
	type: "button",
	value: [],

	category: "Chat Moderation",
	no_bttv: true,

	name: "Command Aliases",
	help: "Define custom commands for chat that are shortcuts for other commands or messages to send in chat.",

	on_update: function() {
		this.cache_command_aliases();
	},

	method: function() {
			var f = this,
				old_val = [],
				input = utils.createElement('textarea');

			input.style.marginBottom = '20px';

			for(var i=0; i < this.settings.command_aliases.length; i++) {
				var pair = this.settings.command_aliases[i],
					name = pair[0],
					command = pair[1],
					label = pair[2];

				old_val.push(name + (label ? ' ' + label : '') + '=' + command);
			}

			utils.prompt(
				"Command Aliases",
					"Please enter a list of custom commands that you would like to use in Twitch chat. " +
					"One item per line. To send multiple commands, separate them with <code>&lt;LINE&gt;</code>. " +
					"Variables, such as arguments you provide running the custom command, can be inserted into the output.<hr>" +

					"All custom commands require names. Names go at the start of each line, and are separated from " +
					"the actual command by an equals sign. Do not include the leading slash or dot. Those are automatically included. " +
					"You can also include a description of the arguments after the name but before the equals-sign " +
					"to include a helpful reminder when using tab-completion with the command.<br>" +
					"<strong>Example:</strong> <code>boop &lt;user&gt;=/timeout {0} 15 Boop!</code><hr>" +

					"<code>{0}</code>, <code>{1}</code>, <code>{2}</code>, etc. will be replaced with any arguments you've supplied. " +
					"Follow an argument index with a <code>$</code> to also include all remaining arguments.<br>" +
					"<strong>Example:</strong> <code>boop=/timeout {0} 15 {1$}</code><hr>" +

					"<strong>Allowed Variables</strong><br><table><tbody>" +
					"<tr><td><code>{room}</code></td><td>chat room's name</td>" +
					"<td><code>{room_name}</code></td><td>chat room's name</td></tr>" +
					"<tr><td><code>{room_display_name}</code></td><td>chat room's display name</td>" +
					"<td><code>{room_id}</code></td><td>chat room's numeric ID</td></tr>" +
					"</tbody></table>",
				old_val.join("\n"),
				function(new_val) {
					if ( new_val === null || new_val === undefined )
						return;

					var vals = new_val.trim().split(/\s*\n\s*/g),
						output = [];

					for(var i=0; i < vals.length; i++) {
						var cmd = vals[i];
						if ( cmd.charAt(0) === '.' || cmd.charAt(0) === '/' )
							cmd = cmd.substr(1);

						var name,
							label,
							name_match = /^([^=]+)=/.exec(cmd);

						if ( ! cmd || ! cmd.length )
							continue;

						if ( name_match ) {
							var ind = name_match[1].indexOf(' ');
							if ( ind === -1 ) {
								name = name_match[1].toLowerCase();
								label = null;
							} else {
								name = name_match[1].substr(0,ind).toLowerCase();
								label = name_match[1].substr(ind).trim();
							}

							cmd = cmd.substr(name_match[0].length);
						}

						output.push([name, cmd, label]);
					}

					f.settings.set("command_aliases", output);

				}, 600, input);
		}
	};


FFZ.prototype._command_aliases = {};

FFZ.prototype.cache_command_aliases = function() {
	var aliases = this._command_aliases = {};
	for(var i=0; i < this.settings.command_aliases.length; i++) {
		var pair = this.settings.command_aliases[i],
			name = pair[0],
			command = pair[1],
			label = pair[2];

		// Skip taken/invalid names.
		if ( ! name || ! name.length || aliases[name] || KNOWN_COMMANDS.indexOf(name) !== -1 )
			continue;

		aliases[name] = [command, label];
	}

	if ( this._inputv )
		Ember.propertyDidChange(this._inputv, 'ffz_commands');
}



// -----------------
// Log Export
// -----------------

FFZ.ffz_commands.log = function(room, args) {
	var f = this;
	this.get_debugging_info().then(function(result) {
		f._pastebin(result).then(function(url) {
			f.room_message(room, "Your FrankerFaceZ logs have been pasted to: " + url);
		}).catch(function() {
			f.room_message(room, "An error occured uploading the logs to a pastebin.");
		});
	});
};


// -----------------
// Data Reload
// -----------------

FFZ.ffz_commands.reload = function(room, args) {
	var f = this,
		promises = [];

	// Feature Friday. There's no feedback possible so don't use a promise.
	this.check_ff();

	// Badge Information
	promises.push(new Promise(function(done, fail) {
		f.load_badges(function(success, badge_count, badge_total, badge_data) {
			done(success ? [badge_count, badge_total, badge_data] : [0, 0, {}]);
		});
	}));


	// Emote Sets
	for(var set_id in this.emote_sets) {
		var es = this.emote_sets[set_id];
		if ( ! es || es.hasOwnProperty('source_ext') )
			continue;

		promises.push(new Promise(function(done, fail) {
			f.load_set(set_id, done);
		}));
	}


	// Do it!
	Promise.all(promises).then(function(results) {
		try {
			var success = 0,
				badge_count = results[0][0],
				badge_total = results[0][1],
				badges = results[0][2],
				total = results.length - 1,
				badge_string = [];

			if ( results.length > 1 ) {
				for(var i=1; i < results.length; i++) {
					if ( results[i] )
						success++;
				}
			}

			for(var key in badges) {
				if ( badges.hasOwnProperty(key) )
					badge_string.push(key + ': ' + badges[key])
			}

			f.room_message(room, "Loaded " + utils.number_commas(badge_count) + " badge" + utils.pluralize(badge_count) + " across " + utils.number_commas(badge_total) + " badge type" + utils.pluralize(badge_total) + (badge_string.length ? " (" + badge_string.join(", ") + ")" : "") + ". Successfully reloaded " + utils.number_commas(success) + " of " + utils.number_commas(total) + " emoticon set" + utils.pluralize(total) + ".");

		} catch(err) {
			f.room_message(room, "An error occured running the command.");
			f.error("Error Running FFZ Reload", err);
		}
	})
}


// -----------------
// Moderation Cards
// -----------------

FFZ.chat_commands.card = function(room, args) {
	if ( ! args || ! args.length || args.length > 1 )
		return "Usage: /card <username>";

	if ( ! this._roomv )
		return "An error occured. (We don't have the Room View.)";

	// Get the position of the input box.
	var el = this._roomv.get('element'),
		ta = el && el.querySelector('textarea'),
		bounds = ta && ta.getBoundingClientRect(),

		x = 0, y = 0, bottom, right;

	if ( ! bounds )
		bounds = el && el.getBoundingClientRect() || document.body.getBoundingClientRect();

	if ( bounds ) {
		if ( bounds.left > 400 ) {
			right = bounds.left - 40;
			bottom = bounds.top + bounds.height;
		} else {
			x = bounds.left - 20;
			bottom = bounds.top - 20;
		}
	}

	this._roomv.get('controller').send('showModOverlay', {
		top: y,
		left: x,
		bottom: bottom,
		right: right,
		sender: args[0]
	});
}

FFZ.chat_commands.card.label = '/card &lt;user&gt;';
FFZ.chat_commands.card.info = 'Open Moderation Card';


FFZ.chat_commands.rules = function(room, args) {
	var f = this,
		r = room.room;

	r.waitForRoomProperties().then(function() {
		var rules = r.get("roomProperties.chat_rules");
		if ( ! rules || ! rules.length )
			return f.room_message(room, "This chat room does not have rules set.");

		r.set("chatRules", rules);
		r.set("shouldDisplayChatRules", true);
	});
}

FFZ.chat_commands.rules.info = 'Show Chat Room Rules';


FFZ.chat_commands.open_link = function(room, args) {
	if ( ! args || ! args.length )
		return "Usage: /open_link <url>";

	var wnd = window.open(args.join(" "), "_blank");
	wnd.opener = null;
}

FFZ.chat_commands.open_link.label = '/open_link &lt;url&gt;';
FFZ.chat_commands.open_link.info = 'Open URL in Tab';


FFZ.chat_commands.fetch_link = function(room, args) {
	if ( ! args || ! args.length )
		return "Usage: /fetch_link <url> [template]\nTemplates use http://objectpath.org/ to format data. Default Template is \"Response: #$#\"";

	var f = this,
		url = args.shift(),
		headers = {};

	if ( /https?:\/\/[^.]+\.twitch\.tv\//.test(url) )
		headers['Client-ID'] = constants.CLIENT_ID;

	jQuery.ajax({
		url: url,
		headers: headers,

		success: function(data) {
			f.log("Response Received", data);
			args = (args && args.length) ? args.join(" ").split(/#/g) : ["Response: ", "$"];

			if ( typeof data === "string" )
				data = [data];

			var is_special = true,
				output = [],
				op = new ObjectPath(data);

			for(var i=0; i < args.length; i++) {
				var segment = args[i];
				is_special = !is_special;
				if ( ! is_special )
					output.push(segment);
				else
					try {
						output.push(format_result(op.execute(segment)));
					} catch(err) {
						f.log("Error", err);
						output.push("[Error: " + (err.message || err) + "]");
					}
			}

			f.room_message(room, output.join(''));

		},
		error: function(xhr) {
			f.log("Request Error", xhr);
			f.room_message(room, "Request Failed: " + (xhr.status === 0 ? 'Unknown Error. ' + (url.indexOf('https') === -1 ? 'Please make sure you\'re making HTTPS requests.' : 'Likely a CORS problem. Check your browser\'s Networking console for more.') : xhr.status + ' ' + (STATUS_CODES[xhr.status] || '' )));
		}
	});
}

FFZ.chat_commands.fetch_link.label = '/fetch_link &lt;url&gt; <i>[template]</i>';
FFZ.chat_commands.fetch_link.info = 'Fetch URL and Display in Chat';


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


// -----------------
// Mass Unbanning
// -----------------

FFZ.prototype.get_banned_users = function() {
	var f = this;
	return new Promise(function(succeed, fail) {
		var user = f.get_user();
		if ( ! user )
			return fail();

		jQuery.get("/settings/channel").done(function(data) {
			try {
				var dom = new DOMParser().parseFromString(data, 'text/html'),
					users = _.pluck(dom.querySelectorAll('.ban .obj'), 'textContent');

				succeed(_.map(users, function(x) { return x.trim() }));

			} catch(err) {
				f.error("Failed to parse banned users", err);
				fail();
			}

		}).fail(function(err) {
			f.error("Failed to load banned users", err);
			fail();
		})
	});
}



 // ---------------------
 // Group Chat Renaming
 // ---------------------
FFZ.chat_commands.renamegroup = function(room, args) {
		// Shorten the FFZ instance
		var f = this;

		// Join the arguments and check to see if something was entered
		var newname = args.join(' ');
		if ( ! newname.length ) {
			return "Usage: /renamegroup <name>\nThis command must be used inside a group chat that you are owner of."
		}

		// Are we in a group chat and are we the owner?
		if ( ! room.room.get('isGroupRoom') ) {
			return "You must be in a group chat to use renamegroup."
		}
		if ( ! room.room.get('isOwner') ) {
			return "You must be the owner of the current group chat to use renamegroup."
		}

		// Check that the length of the arguments is less than 120 bytes
		if ( unescape(encodeURIComponent(newname)).length > 120 ) {
			return "You entered a room name that was too long."
		}

		// Set the group name
		room.room.tmiRoom.session._depotApi.put(
			"/rooms/" + room.id,
			{display_name:newname}
		)
    return( "Room renamed to \"" + newname + "\"" )
}

/*FFZ.ffz_commands.massunban = function(room, args) {
	var user = this.get_user();
	if ( ! user || (user.login !== room.id && ! user.is_admin && ! user.is_staff) )
		return "You must be the broadcaster to use massunban.";


}*/


/*FFZ.ffz_commands.massunban = function(room, args) {
	args = args.join(" ").trim();



}*/
