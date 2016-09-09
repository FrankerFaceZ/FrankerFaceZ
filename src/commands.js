var FFZ = window.FrankerFaceZ,
	utils = require('./utils');


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
// Data Reload
// -----------------

FFZ.ffz_commands.reload = function(room, args) {
	var f = this,
		promises = [];

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


/*FFZ.ffz_commands.massunban = function(room, args) {
	var user = this.get_user();
	if ( ! user || (user.login !== room.id && ! user.is_admin && ! user.is_staff) )
		return "You must be the broadcaster to use massunban.";


}*/


/*FFZ.ffz_commands.massunban = function(room, args) {
	args = args.join(" ").trim();



}*/