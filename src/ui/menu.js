var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),

	fix_menu_position = function(container) {
		var swapped = document.body.classList.contains('ffz-sidebar-swap') && ! document.body.classList.contains('ffz-portrait');

		var bounds = container.getBoundingClientRect(),
			left = parseInt(container.style.left || '0'),
			right = bounds.left + container.scrollWidth,
			moved = !!container.style.left;

		if ( swapped ) {
			if ( bounds.left < 20 ) {
				container.style.left = '';
				moved = false;
			} else if ( right > document.body.clientWidth )
				container.style.left = (left - (right - document.body.clientWidth)) + 'px';

		} else {
			if ( bounds.left < 0 )
				container.style.left = (left - bounds.left) + 'px';
			else if ( right > (document.body.clientWidth - 20) ) {
				container.style.left = '';
				moved = false;
			}
		}

		container.classList.toggle('ui-moved', moved);
	};


// --------------------
// Initializer
// --------------------

FFZ.prototype.setup_menu = function() {
	document.body.classList.toggle("ffz-menu-replace", this.settings.replace_twitch_menu);

	// Add FFZ to the chat settings menu.

	this.log("Hooking the Ember Chat Settings view.");

	var Settings = window.App && App.__container__.resolve('view:settings'),
		Layout = window.App && App.__container__.lookup('controller:layout'),
		f = this;

	if ( ! Settings )
		return;

	Settings.reopen({
		didInsertElement: function() {
			this._super();

			try {
				this.ffzInit();
			} catch(err) {
				f.error("ChatSettings didInsertElement: " + err);
			}
		},

		willClearRender: function() {
			try {
				this.ffzTeardown();
			} catch(err) {
				f.error("ChatSettings willClearRender: " + err);
			}
			this._super();
		},

		ffzInit: function() {
			var view = this,
				el = this.get('element'),
				menu = el && el.querySelector('.dropmenu');

			if ( ! menu )
				return;

			var header = document.createElement('div'),
				content = document.createElement('div'),
				p, cb, a;

			header.className = 'list-header';
			header.innerHTML = 'FrankerFaceZ';

			content.className = 'chat-menu-content';

			// Dark Twitch
			p = document.createElement('p');
			p.className = 'no-bttv';
			cb = document.createElement('input');
			cb.type = "checkbox";
			cb.className = "ember-checkbox ffz-setting-dark-twitch";
			cb.checked = f.settings.dark_twitch;
			p.appendChild(cb);
			p.appendChild(document.createTextNode("Dark Twitch"));
			content.appendChild(p);

			cb.addEventListener("change", function(e) {
				f.settings.set("dark_twitch", this.checked);
			});


			// Channel Hosting
			p = document.createElement('p');
			//p.className = 'no-bttv';
			cb = document.createElement('input');
			cb.type = "checkbox";
			cb.className = "ember-checkbox ffz-setting-hosted-channels";
			cb.checked = f.settings.hosted_channels;
			p.appendChild(cb);
			p.appendChild(document.createTextNode("Channel Hosting"));
			content.appendChild(p);

			cb.addEventListener("change", function(e) {
				f.settings.set("hosted_channels", this.checked);
			});


			// More Settings
			p = document.createElement('p');
			a = document.createElement('a');
			a.href = '#';
			a.innerHTML = 'More Settings';
			p.appendChild(a);
			content.appendChild(p);

			a.addEventListener('click', function(e) {
				view.set('controller.settings.hidden', true);
				f._last_page = 'settings';
				f.build_ui_popup(f._chatv);
				e.stopPropagation();
				return false;
			});

			menu.appendChild(header);
			menu.appendChild(content);

			// Maximum Height
			var e = el.querySelector('.chat-settings');
			if ( Layout && e )
				e.style.maxHeight = (Layout.get('windowHeight') - 90) + 'px';

		},

		ffzTeardown: function() {
			// Nothing~!
		}
	});

	// Maximum height~!
	if ( Layout )
		Layout.addObserver('windowHeight', function() {
			var el = document.querySelector('.ember-chat .chat-settings');
			if ( el )
				el.style.maxHeight = (Layout.get('windowHeight') - 90) + 'px';
		});


	// For some reason, this doesn't work unless we create an instance of the
	// chat settings view and then destroy it immediately.
	try {
		Settings.create().destroy();
	} catch(err) { }

	// Modify all existing Chat Settings views.
	var views = window.App && App.__container__.lookup('-view-registry:main') || Ember.View.views;
	for(var key in views) {
		if ( ! views.hasOwnProperty(key) )
			continue;

		var view = views[key];
		if ( !(view instanceof Settings) )
			continue;

		this.log("Manually updating existing Chat Settings view.", view);
		try {
			view.ffzInit();
		} catch(err) {
			this.error("setup: ChatSettings ffzInit: " + err);
		}
	}
}


FFZ.menu_pages = {};


// --------------------
// Create Menu
// --------------------

FFZ.prototype._fix_menu_position = function() {
	var container = document.querySelector('#ffz-chat-menu');
	if ( container )
		fix_menu_position(container);
}

FFZ.prototype.build_ui_popup = function(view) {
	var popup = this._popup ? this.close_popup() : this._last_popup;
	if ( popup && popup.id === 'ffz-chat-menu' )
		return;

	// Start building the DOM.
	var container = document.createElement('div'),
		inner = document.createElement('div'),
		menu = document.createElement('ul'),

		dark = (this.has_bttv ? BetterTTV.settings.get('darkenedMode') : false);

	container.className = 'emoticon-selector chat-menu ffz-ui-popup';
	container.id = 'ffz-chat-menu';
	inner.className = 'emoticon-selector-box dropmenu';
	container.appendChild(inner);

	container.classList.toggle('dark', dark);

	// Stuff
	jQuery(inner).find('.html-tooltip').tipsy({live: true, html: true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 's')});


	// Menu Container
	var sub_container = document.createElement('div');
	sub_container.className = 'ffz-ui-menu-page';

	inner.appendChild(sub_container);

	// Render Menu Tabs
	menu.className = 'menu clearfix';
	inner.appendChild(menu);

	var heading = document.createElement('li');
	heading.className = 'title';
	heading.innerHTML = '<span class="title">Franker' + (constants.DEBUG ? 'Dev' : 'Face') + 'Z</span>';

	// Close Button
	var close_btn = document.createElement('span'),
		f = this;

	close_btn.className = 'ffz-handle ffz-close-button';
	heading.insertBefore(close_btn, heading.firstChild);

	var can_close = false;
	close_btn.addEventListener('mousedown', function() {
		var popup = f._popup;
		can_close = popup && popup.id === "ffz-chat-menu" && popup.style.left;
	});

	close_btn.addEventListener('click', function() {
		var popup = f._popup;
		if ( can_close && popup )
			f.close_popup();
	});

	menu.appendChild(heading);

	// Draggable
	jQuery(container).draggable({
		handle: menu, cancel: 'li.item', axis:"x",
		stop: function(e) { fix_menu_position(this); }
		});

	// Get rid of the position: relative that draggable adds.
	container.style.position = '';

	var menu_pages = [];
	for(var key in FFZ.menu_pages) {
		if ( ! FFZ.menu_pages.hasOwnProperty(key) )
			continue;

		var page = FFZ.menu_pages[key];
		try {
			if ( !page || (page.hasOwnProperty("visible") && (!page.visible || (typeof page.visible == "function" && !page.visible.bind(this)(view)))) )
				continue;
		} catch(err) {
			this.error("menu_pages " + key + " visible: " + err);
			continue;
		}

		menu_pages.push([page.sort_order || 0, key, page]);
	}

	menu_pages.sort(function(a,b) {
		if ( a[0] < b[0] ) return 1;
		else if ( a[0] > b[0] ) return -1;

		var al = a[1].toLowerCase(),
			bl = b[1].toLowerCase();

		if ( al < bl ) return 1;
		if ( al > bl ) return -1;
		return 0;
	});

	for(var i=0; i < menu_pages.length; i++) {
		var key = menu_pages[i][1],
			page = menu_pages[i][2],
			el = document.createElement('li'),
			link = document.createElement('a');

		el.className = 'item' + (page.sub_menu ? ' has-sub-menu' : '');
		el.id = "ffz-menu-page-" + key;
		link.title = page.name;
		link.innerHTML = page.icon;

		jQuery(link).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});

		link.addEventListener("click", this._ui_change_page.bind(this, view, inner, menu, sub_container, key));

		el.appendChild(link);
		menu.appendChild(el);
	}


	var page = (this._last_page || "channel").split("_", 1)[0];

	// Do we have news?
	if ( this._has_news ) {
		// Render news, then set the page back so our default doesn't change.
		this._ui_change_page(view, inner, menu, sub_container, 'about_news');
		this._last_page = page;

	} else
		// Render Current Page
		this._ui_change_page(view, inner, menu, sub_container, page);


	// Add the menu to the DOM.
	sub_container.style.maxHeight = Math.max(200, view.$().height() - 172) + "px";
	view.$('.chat-interface').append(container);

	// Keep track of the pop-up.
	this._popup = container;
	this._popup_allow_parent = true;
}


FFZ.prototype._ui_change_page = function(view, inner, menu, container, page) {
	this._last_page = page;
	container.innerHTML = "";
	container.setAttribute('data-page', page);

	// Allow settings to be wide. We need to know if chat is stand-alone.
	var app = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");
	inner.style.maxWidth = (!FFZ.menu_pages[page].wide || (typeof FFZ.menu_pages[page].wide == "function" && !FFZ.menu_pages[page].wide.bind(this)())) ? "" : (app.offsetWidth < 640 ? (app.offsetWidth-40) : 600) + "px";

	var els = menu.querySelectorAll('li.active');
	for(var i=0; i < els.length; i++)
		els[i].classList.remove('active');

	var el = menu.querySelector('#ffz-menu-page-' + page);
	if ( el )
		el.classList.add('active');
	else
		this.log("No matching page: " + page);

	FFZ.menu_pages[page].render.bind(this)(view, container, inner, menu);

	// Re-position if necessary.
	var f = this;
	setTimeout(function(){f._fix_menu_position();});
}


// --------------------
// Channel Page
// --------------------

FFZ.menu_pages.channel = {
	render: function(view, inner) {
			// Get the current room.
			var room_id = view.get('controller.currentRoom.id'),
				room = this.rooms[room_id],
				has_product = false,
				f = this;

			// Check for a product.
			if ( this.settings.replace_twitch_menu ) {
				var product = room.room.get("product");
				if ( product && !product.get("error") ) {
					// We have a product, and no error~!
					has_product = true;
					var tickets = App.__container__.resolve('model:ticket').find('user', {channel: room_id}),
						is_subscribed = tickets ? tickets.get('content') : false,
						is_loaded = tickets ? tickets.get('isLoaded') : false,
						icon = room.room.get("badgeSet.subscriber.image"),

						grid = document.createElement("div"),
						header = document.createElement("div"),
						c = 0;

					// Weird is_subscribed check. Might be more accurate?
					is_subscribed = is_subscribed && is_subscribed.length > 0;

					// See if we've loaded. If we haven't loaded the ticket yet
					// then try loading it, and then re-render the menu.
					if ( tickets && ! is_subscribed && ! is_loaded ) {
						tickets.addObserver('isLoaded', function() {
							setTimeout(function(){
								if ( inner.getAttribute('data-page') !== 'channel' )
									return;

								inner.innerHTML = '';
								FFZ.menu_pages.channel.render.bind(f)(view, inner);
							},0);

						});

						tickets.load();
					}


					grid.className = "emoticon-grid";
					header.className = "heading";
					if ( icon ) {
						header.style.backgroundImage = 'url("' + icon + '")';
						if ( icon.indexOf('.svg') !== -1 )
							header.style.backgroundSize = '18px';
					}

					header.innerHTML = '<span class="right">Twitch</span>Subscriber Emoticons';
					grid.appendChild(header);

					for(var emotes=product.get("emoticons") || [], i=0; i < emotes.length; i++) {
						var emote = emotes[i];
						if ( emote.state !== "active" )
							continue;

						var s = document.createElement('span'),
							can_use = is_subscribed || !emote.subscriber_only,
							img_set = 'image-set(url("' + constants.TWITCH_BASE + emote.id + '/1.0") 1x, url("' + constants.TWITCH_BASE + emote.id + '/2.0") 2x), url("' + constants.TWITCH_BASE + emote.id + '/3.0") 4x)';

						s.className = 'emoticon html-tooltip' + (!can_use ? " locked" : "");

						s.style.backgroundImage = 'url("' + constants.TWITCH_BASE + emote.id + '/1.0")';
						s.style.backgroundImage = '-webkit-' + img_set;
						s.style.backgroundImage = '-moz-' + img_set;
						s.style.backgroundImage = '-ms-' + img_set;
						s.style.backgroundImage = img_set;

						s.style.width = emote.width + "px";
						s.style.height = emote.height + "px";
						s.title = (this.settings.emote_image_hover ? '<img class="emoticon ffz-image-hover" src="' + constants.TWITCH_BASE + emote.id + '/3.0?_=preview">' : '') + emote.regex;

						s.addEventListener('click', function(can_use, id, code, e) {
							if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
								window.open("https://twitchemotes.com/emote/" + id);
							else if ( can_use )
								this._add_emote(view, code);
							else
								return;
							e.preventDefault();
						}.bind(this, can_use, emote.id, emote.regex));

						grid.appendChild(s);
						c++;
					}

					if ( c > 0 )
						inner.appendChild(grid);

					if ( c > 0 && ! is_subscribed ) {
						var sub_message = document.createElement("div"),
							nonsub_message = document.createElement("div"),
							unlock_text = document.createElement("span"),
							sub_link = document.createElement("a");

						sub_message.className = "subscribe-message";
						nonsub_message.className = "non-subscriber-message";
						sub_message.appendChild(nonsub_message);

						unlock_text.className = "unlock-text";
						unlock_text.innerHTML = "Subscribe to unlock Emoticons";
						nonsub_message.appendChild(unlock_text);

						sub_link.className = "action subscribe-button button primary";
						sub_link.href = product.get("product_url");
						sub_link.innerHTML = '<span class="subscribe-text">Subscribe</span><span class="subscribe-price">' + product.get("price") + '</span>';
						nonsub_message.appendChild(sub_link);

						inner.appendChild(sub_message);
					} else if ( c > 0 ) {
						var last_content = tickets.get("content");
						last_content = last_content.length > 0 ? last_content[last_content.length-1] : undefined;
						if ( last_content && last_content.purchase_profile && !last_content.purchase_profile.will_renew ) {
							var ends_at = utils.parse_date(last_content.access_end || "");
								sub_message = document.createElement("div"),
								nonsub_message = document.createElement("div"),
								unlock_text = document.createElement("span"),
								now = Date.now() - (this._ws_server_offset || 0),
								end_time = ends_at ? Math.floor((ends_at.getTime() - now) / 1000) : null;

							sub_message.className = "subscribe-message";
							nonsub_message.className = "non-subscriber-message";
							sub_message.appendChild(nonsub_message);

							unlock_text.className = "unlock-text";
							unlock_text.innerHTML = "Subscription expires in " + utils.time_to_string(end_time, true, true);
							nonsub_message.appendChild(unlock_text);
							inner.appendChild(sub_message);
						}
					}
				}
			}

			// Do we have extra sets?
			var extra_sets = _.union(room && room.extra_sets || [], room && room.ext_sets || [], []);

			// Basic Emote Sets
			this._emotes_for_sets(inner, view, room && room.set && [room.set] || [], (this.feature_friday || has_product || extra_sets.length ) ? "Channel Emoticons" : null, "http://cdn.frankerfacez.com/script/devicon.png", "FrankerFaceZ");

			for(var i=0; i < extra_sets.length; i++) {
				// Look up the set name.
				var set = this.emote_sets[extra_sets[i]],
					name = set ? (set.hasOwnProperty('source_ext') ? "" : "Featured ") + set.title : "Featured Channel";

				this._emotes_for_sets(inner, view, [extra_sets[i]], name, set.icon || "//cdn.frankerfacez.com/script/devicon.png", set.source || "FrankerFaceZ");
			}

			// Feature Friday!
			this._feature_friday_ui(room_id, inner, view);
		},

	name: "Channel",
	icon: constants.ZREKNARF
	};


// --------------------
// Emotes for Sets
// --------------------

FFZ.prototype._emotes_for_sets = function(parent, view, sets, header, image, sub_text) {
	var grid = document.createElement('div'), c = 0, f = this;
	grid.className = 'emoticon-grid';

	if ( header != null ) {
		var el_header = document.createElement('div');
		el_header.className = 'heading';

		if ( sub_text ) {
			var s = document.createElement("span");
			s.className = "right";
			s.appendChild(document.createTextNode(sub_text));
			el_header.appendChild(s);
		}

		el_header.appendChild(document.createTextNode(header));

		if ( image ) {
			el_header.style.backgroundImage = 'url("' + image + '")';
			if ( image.indexOf('.svg') !== -1 )
				el_header.style.backgroundSize = '18px';
		}

		grid.appendChild(el_header);
	}

	var emotes = [];
	for(var i=0; i < sets.length; i++) {
		var set = this.emote_sets[sets[i]];
		if ( ! set || ! set.emoticons )
			continue;

		for(var eid in set.emoticons) {
			if ( ! set.emoticons.hasOwnProperty(eid) || set.emoticons[eid].hidden )
				continue;

			emotes.push(set.emoticons[eid]);
		}
	}

	// Sort the emotes!
	emotes.sort(function(a,b) {
		var an = a.name.toLowerCase(),
			bn = b.name.toLowerCase();

		if ( an < bn ) return -1;
		else if ( an > bn ) return 1;
		return 0;
	});

	for(var i=0; i < emotes.length; i++) {
		var emote = emotes[i], srcset = null;

		if ( emote.urls[2] || emote.urls[4] ) {
			srcset = 'url("' + emote.urls[1] + '") 1x';
			if ( emote.urls[2] )
				srcset += ', url("' + emote.urls[2] + '") 2x';
			if ( emote.urls[4] )
				srcset += ', url("' + emote.urls[4] + '") 4x';
		}

		c++;
		var s = document.createElement('span');
		s.className = 'emoticon html-tooltip';
		s.style.backgroundImage = 'url("' + emote.urls[1] + '")';

		if ( srcset ) {
			var img_set = 'image-set(' + srcset + ')';
			s.style.backgroundImage = '-webkit-' + img_set;
			s.style.backgroundImage = '-moz-' + img_set;
			s.style.backgroundImage = '-ms-' + img_set;
			s.style.backgroundImage = img_set;
		}

		s.style.width = emote.width + "px";
		s.style.height = emote.height + "px";
		s.title = this._emote_tooltip(emote);

		s.addEventListener('click', function(id, code, e) {
			e.preventDefault();
			if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons ) {
				var url;
				if ( set.hasOwnProperty('source_ext') ) {
					var api = f._apis[set.source_ext];
					if ( api && api.emote_url_generator )
						url = api.emote_url_generator(set.source_id, id);
				} else
					url = "https://www.frankerfacez.com/emoticons/" + id;
				if ( url )
					window.open(url);
			} else
				this._add_emote(view, code);
		}.bind(this, emote.id, emote.name));

		grid.appendChild(s);
	}

	if ( !c ) {
		grid.innerHTML += "This channel has no emoticons.";
		grid.className = "emoticon-grid ffz-no-emotes center";
	}

	parent.appendChild(grid);
}


FFZ.prototype._add_emote = function(view, emote) {
	var input_el, text, room;

	if ( this.has_bttv ) {
		input_el = view.get('element').querySelector('textarea');
		text = input_el.value;

	} else {
		room = view.get('controller.currentRoom');
		text = room.get('messageToSend') || '';
	}

	text += (text && text.substr(-1) !== " " ? " " : "")  + (emote.name || emote);

	if ( input_el )
		input_el.value = text;
	else
		room.set('messageToSend', text);
}