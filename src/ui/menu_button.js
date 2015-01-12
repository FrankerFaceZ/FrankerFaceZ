var FFZ = window.FrankerFaceZ,
	constants = require('../constants');

// --------------------
// Initialization
// --------------------

FFZ.prototype.build_ui_link = function(view) {
	// TODO: Detect dark mode from BTTV.

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
	if ( !link || !controller ) return;

	var room_id = controller.get('currentRoom.id'),
		room = this.rooms[room_id],
		has_emotes = room && room.sets.length > 0;

	if ( has_emotes )
		link.classList.remove('no-emotes');
	else
		link.classList.add('no-emotes');
}