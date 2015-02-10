var FFZ = window.FrankerFaceZ,
	constants = require('../constants');


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
			f._popup_kill && f._popup_kill();
			delete f._popup_kill;
		}
	});
}


FFZ.menu_pages = {};


// --------------------
// Create Menu
// --------------------

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
	inner.className = 'emoticon-selector-box dropmenu';
	container.appendChild(inner);

	container.classList.toggle('dark', dark);

	// Render Menu
	menu.className = 'menu clearfix';
	inner.appendChild(menu);

	var el = document.createElement('li');
	el.className = 'title';
	el.innerHTML = "<span>FrankerFaceZ</span>";
	menu.appendChild(el);

	el.addEventListener("click", this._add_emote.bind(this, view, "To use custom emoticons in tons of channels, get FrankerFaceZ from http://www.frankerfacez.com"));

	var sub_container = document.createElement('div');
	sub_container.className = 'ffz-ui-menu-page';
	inner.appendChild(sub_container);

	for(var key in FFZ.menu_pages) {
		var page = FFZ.menu_pages[key];
		if ( !page || (page.hasOwnProperty("visible") && (!page.visible || (typeof page.visible == "function" && !page.visible.bind(this)()))) )
			continue;

		var el = document.createElement('li'),
			link = document.createElement('a');

		el.className = 'item';
		el.id = "ffz-menu-page-" + key;
		link.title = page.name;
		link.innerHTML = page.icon;

		link.addEventListener("click", this._ui_change_page.bind(this, view, menu, sub_container, key));

		el.appendChild(link);
		menu.appendChild(el);
	}

	// Render Current Page
	this._ui_change_page(view, menu, sub_container, this._last_page || "channel");

	// Add the menu to the DOM.
	this._popup = container;
	sub_container.style.maxHeight = Math.max(100, view.$().height() - 162) + "px";
	view.$('.chat-interface').append(container);
}


FFZ.prototype._ui_change_page = function(view, menu, container, page) {
	this._last_page = page;
	container.innerHTML = "";

	var els = menu.querySelectorAll('li.active');
	for(var i=0; i < els.length; i++)
		els[i].classList.remove('active');

	var el = menu.querySelector('#ffz-menu-page-' + page);
	if ( el )
		el.classList.add('active');
	else
		this.log("No matching page: " + page);

	FFZ.menu_pages[page].render.bind(this)(view, container);
}


// --------------------
// Settings Page
// --------------------

FFZ.menu_pages.settings = {
	render: function(view, container) {
			var settings = {},
				categories = [];
			for(var key in FFZ.settings_info) {
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

				if ( ! cs ) {
					categories.push(cat);
					cs = settings[cat] = [];
				}

				cs.push([key, info]);
			}

			categories.sort(function(a,b) {
				var a = a.toLowerCase(),
					b = b.toLowerCase();

				if ( a < b ) return -1;
				else if ( a > b ) return 1;
				return 0;
				});

			for(var ci=0; ci < categories.length; ci++) {
				var category = categories[ci],
					cset = settings[category],

					menu = document.createElement('div'),
					heading = document.createElement('div');

				heading.className = 'heading';
				menu.className = 'chat-menu-content';
				heading.innerHTML = category;
				menu.appendChild(heading);

				cset.sort(function(a,b) {
					var ai = a[1],
						bi = b[1],

						an = ai.name.toLowerCase(),
						bn = bi.name.toLowerCase();

					if ( an < bn ) return -1;
					else if ( an > bn ) return 1;
					return 0;
					});


				for(var i=0; i < cset.length; i++) {
					var key = cset[i][0],
						info = cset[i][1],
						el = document.createElement('p'),
						val = this.settings.get(key);

					el.className = 'clearfix';

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

						swit.addEventListener("click", this._ui_toggle_setting.bind(this, swit, key));

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

					menu.appendChild(el);
				}

				container.appendChild(menu);
			}
		},

	name: "Settings",
	icon: constants.GEAR
	};


FFZ.prototype._ui_toggle_setting = function(swit, key) {
	var val = ! this.settings.get(key);
	this.settings.set(key, val);
	swit.classList.toggle('active', val);
}


// --------------------
// Favorites Page
// --------------------

/*FFZ.menu_pages.favorites = {
	render: function(view, container) {
	
		},

	name: "Favorites",
	icon: constants.HEART
	};*/


// --------------------
// Channel Page
// --------------------

FFZ.menu_pages.channel = {
	render: function(view, inner) {
			// Get the current room.
			var room_id = view.get('controller.currentRoom.id'),
				room = this.rooms[room_id];

			//this.track('trackEvent', 'Menu', 'Open', room_id);

			// Add the header and ad button.
			/*var btn = document.createElement('a');
			btn.className = 'button glyph-only ffz-button';
			btn.title = 'Advertise for FrankerFaceZ in chat!';
			btn.href = '#';
			btn.innerHTML = '<svg class="svg-followers" height="16px" version="1.1" viewBox="0 0 16 16" width="16px" x="0px" y="0px"><path clip-rule="evenodd" d="M8,13.5L1.5,7V4l2-2h3L8,3.5L9.5,2h3l2,2v3L8,13.5z" fill-rule="evenodd"></path></svg>';

			var hdr = document.createElement('div');
			hdr.className = 'list-header first';
			hdr.appendChild(btn);
			hdr.appendChild(document.createTextNode('FrankerFaceZ'));
			inner.appendChild(hdr);*/

			var c = this._emotes_for_sets(inner, view, room && room.menu_sets || []);

			/*if ( ! this._ws_exists ) {
				btn.className = "button ffz-button primary";
				btn.innerHTML = "Server Error";
				btn.title = "FFZ Server Error";
				btn.addEventListener('click', alert.bind(window, "The FrankerFaceZ client was unable to create a WebSocket to communicate with the FrankerFaceZ server.\n\nThis is most likely due to your browser's configuration either disabling WebSockets entirely or limiting the number of simultaneous connections. Please ensure that WebSockets have not been disabled."));

			} else {
				if ( c === 0 )
					btn.addEventListener('click', this._add_emote.bind(this, view, "To use custom emoticons in tons of channels, get FrankerFaceZ from http://www.frankerfacez.com"));
				else
					btn.addEventListener('click', this._add_emote.bind(this, view, "To view this channel's emoticons, get FrankerFaceZ from http://www.frankerfacez.com"));
			}*/

			// Feature Friday!
			this._feature_friday_ui(room_id, inner, view);
		},

	name: "Channel",
	icon: constants.ZREKNARF
	};


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