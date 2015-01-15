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
	var controller = App.__container__.lookup('controller:chat');
	link = link || document.querySelector('a.ffz-ui-toggle');
	if ( !link || !controller ) return this.log("No button.");

	var room_id = controller.get('currentRoom.id'),
		room = this.rooms[room_id],
		has_emotes = false,

		dark = (this.has_bttv ? BetterTTV.settings.get('darkenedMode') : false),
		blue = (this.has_bttv ? BetterTTV.settings.get('showBlueButtons') : false);


	// Check for emoticons.
	if ( room && room.sets.length ) {
		for(var i=0; i < room.sets.length; i++) {
			var set = this.emote_sets[room.sets[i]];
			if ( set && set.count > 0 ) {
				has_emotes = true;
				break;
			}
		}
	}

	link.classList.toggle('no-emotes', ! has_emotes);
	link.classList.toggle('dark', dark);
	link.classList.toggle('blue', blue);
}