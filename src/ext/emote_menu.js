var FFZ = window.FrankerFaceZ,
	utils = require('../utils');


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
	if ( this.has_bttv )
		return [];

	var twitch_user = this.get_user(),
		user_id = twitch_user ? twitch_user.login : null,
		controller = utils.ember_lookup('controller:chat'),
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

			var title = (set.source || "FrankerFaceZ") + " " + set.title,
				badge = set.icon || '//cdn.frankerfacez.com/script/devicon.png';

			emotes.push({text: emote.name, url: emote.urls[1],
				hidden: false, channel: title, badge: badge});
		}
	}

	return emotes;
}