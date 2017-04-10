var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');

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
	var controller = utils.ember_lookup('controller:chat');
	link = link || document.querySelector('a.ffz-ui-toggle');
	if ( !link || !controller )
		return;

	var room_id = controller.get('currentRoom.id'),
		room = this.rooms[room_id],
		has_emotes = false,

		blue = (this.has_bttv_6 ? BetterTTV.settings.get('showBlueButtons') : false),
		live = (this.feature_friday && this.feature_friday.live);


	// Check for emoticons.
	if ( room && room.set ) {
		var set = this.emote_sets[room.set];
		if ( set && set.count > 0 )
			has_emotes = true;
	}

	link.classList.toggle('no-emotes', ! has_emotes);
	link.classList.toggle('live', live);
	link.classList.toggle('blue', blue);
	//link.classList.toggle('news', this._has_news);
}