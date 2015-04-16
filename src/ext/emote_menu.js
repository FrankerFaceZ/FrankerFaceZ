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
		if ( ! set || ! set.emotes )
			continue;

		for(var emote_id in set.emotes) {
			if ( ! set.emotes.hasOwnProperty(emote_id) )
				continue;

			var emote = set.emotes[emote_id];
			if ( emote.hidden )
				continue;

			// TODO: Stop having to calculate this here.
			var title = set.title, badge = set.icon || null;
			if ( ! title ) {
				if ( set.id == "global" )
					title = "FrankerFaceZ Global Emotes";

				else if ( set.id == "globalevent" )
					title = "FrankerFaceZ Event Emotes";

				else if ( this.feature_friday && set.id == this.feature_friday.set )
					title = "FrankerFaceZ " + this.feature_friday.title + ": " + this.feature_friday.display_name;

				else
					title = "FrankerFaceZ Set: " + FFZ.get_capitalization(set.id);
			} else
				title = "FrankerFaceZ: " + title;

			emotes.push({text: emote.name, url: emote.url,
				hidden: false, channel: title, badge: badge});
		}
	}

	return emotes;
}