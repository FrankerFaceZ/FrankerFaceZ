var FFZ = window.FrankerFaceZ;


// --------------------
// Initializer
// --------------------

FFZ.prototype.setup_menu = function() {
	this.log("Installing mouse-up event to auto-close menus.");
	var f = this;

	jQuery(document).mouseup(function(e) {
		var popup = f._popup, parent;
		if ( ! popup ) return;
		popup = jQuery(popup);
		parent = popup.parent();

		if ( ! parent.is(e.target) && parent.has(e.target).length === 0 ) {
			popup.remove();
			delete f._popup;
		}
	});
}


// --------------------
// Create Menu
// --------------------

FFZ.prototype.build_ui_popup = function(view) {
	var popup = this._popup;
	if ( popup ) {
		popup.parentElement.removeChild(popup);
		delete this._popup;
		return;
	}

	// Start building the DOM.
	var container = document.createElement('div'),
		inner = document.createElement('div');

	container.className = 'emoticon-selector chat-menu ffz-ui-popup';
	inner.className = 'emoticon-selector-box dropmenu';
	container.appendChild(inner);

	// TODO: Modularize for multiple menu pages!

	// Get the current room.
	var room_id = view.get('controller.currentRoom.id'),
		room = this.rooms[room_id];

	this.log("Menu for Room: " + room_id, room);

	// Add the header and ad button.
	var btn = document.createElement('a');
	btn.className = 'button glyph-only ffz-button';
	btn.title = 'Advertise for FrankerFaceZ in chat!';
	btn.href = '#';
	btn.innerHTML = '<svg class="svg-followers" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M8,13.5L1.5,7V4l2-2h3L8,3.5L9.5,2h3l2,2v3L8,13.5z" fill-rule="evenodd"></path></svg>';

	var hdr = document.createElement('div');
	hdr.className = 'list-header first';
	hdr.appendChild(btn);
	hdr.appendChild(document.createTextNode('FrankerFaceZ'));
	inner.appendChild(hdr);

	var c = this._emotes_for_sets(inner, view, room && room.menu_sets || []);

	if ( c === 0 )
		btn.addEventListener('click', this._add_emote.bind(this, view, "To use custom emoticons in tons of channels, get FrankerFaceZ from http://www.frankerfacez.com"));
	else
		btn.addEventListener('click', this._add_emote.bind(this, view, "To view this channel's emoticons, get FrankerFaceZ from http://www.frankerfacez.com"));

	// Feature Friday!
	this._feature_friday_ui(room_id, inner, view);

	// Add the menu to the DOM.
	this._popup = container;
	inner.style.maxHeight = Math.max(300, view.$().height() - 171) + "px";
	view.$('.chat-interface').append(container);
}


// --------------------
// Emotes for Sets
// --------------------

FFZ.prototype._emotes_for_sets = function(parent, view, sets, header, btn) {
	if ( header != null ) {
		var el_header = document.createElement('div');
		el_header.className = 'list-header';
		el_header.appendChild(document.createTextNode(header));

		if ( btn )
			el_header.appendChild(btn);

		parent.appendChild(el_header);
	}

	var grid = document.createElement('div'), c = 0;
	grid.className = 'emoticon-grid';

	for(var i=0; i < sets.length; i++) {
		var set = this.emote_sets[sets[i]];
		if ( ! set || ! set.emotes )
			continue;

		for(var eid in set.emotes) {
			var emote = set.emotes[eid];
			if ( !set.emotes.hasOwnProperty(eid) || emote.hidden )
				continue;

			c++;
			var s = document.createElement('span');
			s.className = 'emoticon tooltip';
			s.style.backgroundImage = 'url("' + emote.url + '")';
			s.style.width = emote.width + "px";
			s.style.height = emote.height + "px";
			s.title = emote.name;
			s.addEventListener('click', this._add_emote.bind(this, view, emote.name));
			grid.appendChild(s);
		}
	}

	if ( !c ) {
		grid.innerHTML = "This channel has no emoticons.";
		grid.className = "chat-menu-content ffz-no-emotes center";
	}

	parent.appendChild(grid);
}


FFZ.prototype._add_emote = function(view, emote) {
	var room = view.get('controller.currentRoom'),
		current_text = room.get('messageToSend') || '';

	if ( current_text && current_text.substr(-1) !== " " )
		current_text += ' ';

	room.set('messageToSend', current_text + (emote.name || emote));
}