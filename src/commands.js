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
		f._legacy_load_bots(function(success, count) {
			done(count || 0);
		});
	}));

	promises.push(new Promise(function(done, fail) {
		f._legacy_load_donors(function(success, count) {
			done(count || 0);
		});
	}));


	// Emote Sets
	for(var set_id in this.emote_sets) {
		var es = this.emote_sets[set_id];
		if ( es.hasOwnProperty('source_ext') )
			continue;

		promises.push(new Promise(function(done, fail) {
			f.load_set(set_id, done);
		}));
	}


	// Do it!
	Promise.all(promises).then(function(results) {
		var success = 0,
			bots = results[0],
			donors = results[1],
			total = results.length - 2;

		if ( results.length > 2 ) {
			for(var i=2; i < results.length; i++) {
				if ( results[i] )
					success++;
			}
		}

		f.room_message(room, "Loaded " + utils.number_commas(bots) + " new bot badge" + utils.pluralize(bots) + " and " + utils.number_commas(donors) + " new donor badge" + utils.pluralize(donors) + ". Successfully reloaded " + utils.number_commas(success) + " of " + utils.number_commas(total) + " emoticon set" + utils.pluralize(total) + ".");
	})
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


/*FFZ.ffz_commands.massunban = function(room, args) {
	args = args.join(" ").trim();



}*/