var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),

	IS_OSX = constants.IS_OSX,

	reported_sets = [],

	fix_menu_position = function(container) {
		var swapped = document.body.classList.contains('ffz-sidebar-swap') && ! document.body.classList.contains('ffz-portrait');

		var bounds = container.children[0].getBoundingClientRect(),
			left = parseInt(container.style.left || '0'),
			right = bounds.left + bounds.width,
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
	this.update_views('component:chat/chat-settings-menu', this.modify_chat_settings_menu);

	// Maximum Menu Height
	var Layout = utils.ember_lookup('service:layout');
	if ( Layout )
		Layout.addObserver('windowHeight', function() {
			var el = document.querySelector('.ember-chat .chat-settings');
			if ( el )
				el.style.maxHeight = (Layout.get('windowHeight') - 90) + 'px';
		});

}


FFZ.prototype.modify_chat_settings_menu = function(component) {
	var f = this,
		Layout = utils.ember_lookup('service:layout');

	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var view = this,
				el = this.get('element');

			var container = utils.createElement('div', ''),
				header = utils.createElement('div', 'list-header', 'FrankerFaceZ'),
				content = utils.createElement('div', 'chat-menu-content'),
				p, cb, a;

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
				if ( this.checked )
					f.settings.set("dark_no_blue", true);
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
				view.set('isHidden', true);
				f._last_page = 'settings';
				f.build_ui_popup(f._chatv);
				e.stopPropagation();
				return false;
			});

			container.appendChild(header);
			container.appendChild(content);

			container.classList.toggle('hidden', this.get('showDisplaySettings'));
			el.appendChild(container);
			this.ffz_menu = container;

			// Maximum Height
			if ( Layout && el )
				el.style.maxHeight = (Layout.get('windowHeight') - 90) + 'px';
		},

		ffz_update_visibility: function() {
			if ( this.ffz_menu )
				this.ffz_menu.classList.toggle('hidden', this.get('showDisplaySettings'));
		}.observes('showDisplaySettings'),

		ffz_destroy: function() {
			if ( this.ffz_menu ) {
				this.ffz_menu.parentElement.removeChild(this.ffz_menu);
				this.ffz_menu = null;
			}
		}
	});
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
		menu = document.createElement('ul');

	container.className = 'emoticon-selector chat-menu ffz-ui-popup';
	container.id = 'ffz-chat-menu';
	inner.className = 'emoticon-selector-box dropmenu';
	container.appendChild(inner);

	// Stuff
	//jQuery(inner).find('.html-tooltip').tipsy({live: true, html: true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 's')});
	//jQuery(inner).find('.ffz-tooltip').tipsy({live: true, html: true, title: this.render_tooltip(), gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});

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
			if ( !page || (page.hasOwnProperty("visible") && (!page.visible || (typeof page.visible == "function" && !page.visible.call(this, view)))) )
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

		el.className = 'item' + (page.sub_menu || page.pages ? ' has-sub-menu' : '');
		el.id = "ffz-menu-page-" + key;
		link.title = page.name;
		link.innerHTML = page.icon;

		jQuery(link).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});

		link.addEventListener("click", this._ui_change_page.bind(this, view, inner, menu, sub_container, key));

		el.appendChild(link);
		menu.appendChild(el);
	}

	// Add the menu to the DOM.
	sub_container.style.maxHeight = Math.max(200, view.$().height() - 172) + "px";
	view.$('.chat-interface').append(container);

	// Keep track of the pop-up.
	this._popup = container;
	this._popup_allow_parent = true;

	// Render Current Page
	var page = (this._last_page || "channel").split("_", 1)[0];
	this._ui_change_page(view, inner, menu, sub_container, page);
}


FFZ.prototype._ui_change_subpage = function(view, inner, menu, container, subpage) {
	var page = this._last_page,
		last_subpages = this._last_subpage = this._last_subpage || {};

	last_subpages[page] = subpage;

	container.innerHTML = "";
	container.setAttribute('data-page', subpage);

	// Get the data structure for this page.
	var page_data = FFZ.menu_pages[page],
		data = page_data.pages[subpage];

	// Render the page first. If there's an error, it won't update the other UI stuff.
	data.render.call(this, view, container, inner, menu);

	// Make sure the correct menu tab is selected
	jQuery('li.active', menu).removeClass('active');
	jQuery('#ffz-menu-page-' + page + '-subpage-' + subpage, menu).addClass('active');

	// Apply wideness - TODO: Revamp wide menus entirely for thin containers
	var is_wide = false,
		app = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");

	if ( data.hasOwnProperty('wide') )
		is_wide = data.wide || (typeof data.wide === "function" && data.wide.call(this));
	else if ( page_data.hasOwnProperty('wide') )
		is_wide = page_data.wide || (typeof page_data.wide === "function" && page_data.wide.call(this));

	inner.style.maxWidth = is_wide ? (app.offsetWidth < 640 ? (app.offsetWidth-40) : 600) + "px" : "";

	// Re-position if necessary.
	var f = this;
	setTimeout(function(){f._fix_menu_position();});
}


FFZ.prototype._ui_change_page = function(view, inner, menu, container, page) {
	this._last_page = page;
	container.innerHTML = "";
	container.setAttribute('data-page', page);

	// Get the data structure for the new page.
	var data = FFZ.menu_pages[page];

	// See if we're dealing with a sub-menu situation.
	if ( data.pages ) {
		// We need to render the sub-menu, and then call the _ui_change_sub_page method
		// to render the sub-page.
		var submenu = document.createElement('ul'),
			subcontainer = document.createElement('div'),

			height = parseInt(container.style.maxHeight || '0');

		if ( ! height )
			height = Math.max(200, view.$().height() - 172);

		if ( height && ! Number.isNaN(height) ) {
			height -= 37;
			subcontainer.style.maxHeight = height + 'px';
		}

		submenu.className = 'menu sub-menu clearfix';
		subcontainer.className = 'ffz-ui-sub-menu-page';

		// Building Tabs
		var subpages = [];
		for(var key in data.pages) {
			var subpage = data.pages[key];
			try {
				if ( ! subpage || (subpage.hasOwnProperty("visible") && (!subpage.visible || (typeof subpage.visible == "function" && !subpage.visible.call(this, view)))) )
					continue;
			} catch(err) {
				this.error("menu_pages " + page + " subpage " + key + " visible: " + err);
				continue;
			}

			subpages.push([subpage.sort_order || 0, key, subpage]);
		}

		subpages.sort(function(a,b) {
			if ( a[0] < b[0] ) return -1;
			else if ( a[0] > b[0] ) return 1;

			var al = a[1].toLowerCase(),
				bl = b[1].toLowerCase();

			if ( al < bl ) return -1;
			if ( al > bl ) return 1;
			return 0;
		});

		for(var i=0; i < subpages.length; i++) {
			var key = subpages[i][1],
				subpage = subpages[i][2],
				tab = document.createElement('li'),
				link = document.createElement('a');

			tab.className = 'item';
			tab.id = 'ffz-menu-page-' + page + '-subpage-' + key;
			link.innerHTML = subpage.name;
			link.addEventListener('click', this._ui_change_subpage.bind(this, view, inner, submenu, subcontainer, key));

			tab.appendChild(link);
			submenu.appendChild(tab);
		}

		// Add this to the container.
		container.appendChild(subcontainer);
		container.appendChild(submenu);

		// Activate a Tab
		var last_subpages = this._last_subpage = this._last_subpage || {},
			last_subpage = last_subpages[page] = last_subpages[page] || data.default_page || subpages[0][1];

		if ( typeof last_subpage === "function" )
			last_subpage = last_subpage.call(this);

		this._ui_change_subpage(view, inner, submenu, subcontainer, last_subpage);

		// Make sure the correct menu tab is selected
		jQuery('li.active', menu).removeClass('active');
		jQuery('#ffz-menu-page-' + page, menu).addClass('active');

		return;
	}

	// Render the page first. If there's an error, it won't update the other UI stuff.
	data.render.call(this, view, container, inner, menu);

	// Make sure the correct menu tab is selected
	jQuery('li.active', menu).removeClass('active');
	jQuery('#ffz-menu-page-' + page, menu).addClass('active');

	// Apply wideness - TODO: Revamp wide menus entirely for thin containers
	var is_wide = data.wide || (typeof data.wide === "function" && data.wide.call(this)),
		app = document.querySelector(".app-main") || document.querySelector(".ember-chat-container");

	inner.style.maxWidth = is_wide ? (app.offsetWidth < 640 ? (app.offsetWidth-40) : 600) + "px" : "";

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
			var controller = utils.ember_lookup('controller:chat'),
				room_id = controller.get('currentRoom.id'),
				room = this.rooms[room_id],
				has_product = false,
				f = this;

			// Check for a product.
			if ( this.settings.replace_twitch_menu ) {
				var product = room.room.get("product");
				if ( product && !product.get("error") ) {
					// We have a product, and no error~!
					has_product = true;
					var Ticket = utils.ember_resolve('model:ticket'),
						tickets = Ticket && Ticket.find('user', {channel: room_id}),
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


					grid.className = "emoticon-grid top-set";
					header.className = "heading";
					if ( icon ) {
						header.style.backgroundImage = 'url("' + icon + '")';
						if ( icon.indexOf('.svg') !== -1 )
							header.style.backgroundSize = '18px';
					}

					header.innerHTML = '<span class="right">Twitch</span>Subscriber Emoticons';
					grid.appendChild(header);

					var known_sets = [];

					for(var emotes=product.get("emoticons") || [], i=0; i < emotes.length; i++) {
						var emote = emotes[i];
						if ( emote.state !== "active" )
							continue;

						var s = document.createElement('span'),
							can_use = is_subscribed || !emote.subscriber_only,
							img_set = 'image-set(url("' + constants.TWITCH_BASE + emote.id + '/1.0") 1x, url("' + constants.TWITCH_BASE + emote.id + '/2.0") 2x), url("' + constants.TWITCH_BASE + emote.id + '/3.0") 4x)';

						s.className = 'emoticon ffz-tooltip ffz-tooltip-no-credit' + (!can_use ? " locked" : "");

						if ( known_sets.indexOf(emote.emoticon_set) === -1 )
							known_sets.push(emote.emoticon_set);

						if ( emote.emoticon_set ) {
							var favs = this.settings.favorite_emotes["twitch-" + emote.emoticon_set];
							s.classList.add('ffz-can-favorite');
							s.classList.toggle('ffz-favorite', favs && favs.indexOf(emote.id) !== -1 || false);
						}

						s.setAttribute('data-emote', emote.id);
						s.alt = emote.regex;

						s.style.backgroundImage = 'url("' + constants.TWITCH_BASE + emote.id + '/1.0")';
						s.style.backgroundImage = '-webkit-' + img_set;
						s.style.backgroundImage = '-moz-' + img_set;
						s.style.backgroundImage = '-ms-' + img_set;
						s.style.backgroundImage = img_set;

						s.style.width = (10+emote.width) + "px";
						s.style.height = (10+emote.height) + "px";

						s.addEventListener('click', function(can_use, id, code, emote_set, e) {
							if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
								window.open("https://twitchemotes.com/emote/" + id);
							else if ( can_use )
								this._add_emote(view, code, "twitch-" + emote_set, id, e);
							else
								return;
							e.preventDefault();
						}.bind(this, can_use, emote.id, emote.regex, emote.emoticon_set));

						grid.appendChild(s);
						c++;
					}

					if ( reported_sets.indexOf(product.get('id')) === -1 && known_sets.length ) {
						reported_sets.push(product.get('id'));
						this.log("Sets for " + product.get('id') + " [" + product.get('ticketProductId') + "]: " + JSON.stringify(known_sets));
						this.ws_send("report_twitch_set", [product.get('id'), product.get('ticketProductId'), known_sets]);
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

						sub_link.className = "action js-sub-button subscribe-button button button--purchase";
						sub_link.href = product.get("product_url");
						sub_link.innerHTML = '<span class="subscribe-text">Subscribe</span><span class="subscribe-price button__num-block">' + product.get("price") + '</span>';
						nonsub_message.appendChild(sub_link);

						inner.appendChild(sub_message);
					} else if ( c > 0 ) {
						var last_content = tickets.get("content");
						last_content = last_content.length > 0 ? last_content[last_content.length-1] : undefined;
						if ( last_content && last_content.purchase_profile && !last_content.purchase_profile.will_renew ) {
							var ends_at = utils.parse_date(last_content.access_end || ""),
								provider = last_content.purchase_profile && last_content.purchase_profile.payment_provider,
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

							if ( provider === "samus" )
								unlock_text.innerHTML += '<br>(Twitch Prime Free Sub)';

							nonsub_message.appendChild(unlock_text);
							inner.appendChild(sub_message);
						}
					}
				}
			}

			// Do we have extra sets?
			var extra_sets = _.union(room && room.extra_sets || [], room && room.ext_sets || [], []);

			// Basic Emote Sets
			this._emotes_for_sets(inner, view, room && room.set && [room.set] || [], (this.feature_friday || has_product || extra_sets.length ) ? "Channel Emoticons" : null, (room && room.moderator_badge) || "//cdn.frankerfacez.com/script/devicon.png", "FrankerFaceZ", ! has_product && extra_sets.length);

			for(var i=0; i < extra_sets.length; i++) {
				// Look up the set name.
				var set = this.emote_sets[extra_sets[i]],
					name = set ? (set.hasOwnProperty('source_ext') ? "" : "Featured ") + set.title : "Featured Channel";

				if ( ! set || ! set.count || set.hidden )
					continue;

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

FFZ.prototype._emotes_for_sets = function(parent, view, sets, header, image, sub_text, top_set) {
	var grid = document.createElement('div'), c = 0, f = this;
	grid.className = 'emoticon-grid';
	if ( top_set )
		grid.classList.add('top-set');

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
		s.className = 'emoticon ffz-tooltip';

		s.setAttribute('data-ffz-emote', emote.id);
		s.setAttribute('data-ffz-set', set.id);

		s.style.backgroundImage = 'url("' + emote.urls[1] + '")';

		if ( srcset ) {
			var img_set = 'image-set(' + srcset + ')';
			s.style.backgroundImage = '-webkit-' + img_set;
			s.style.backgroundImage = '-moz-' + img_set;
			s.style.backgroundImage = '-ms-' + img_set;
			s.style.backgroundImage = img_set;
		}

		s.style.width = (10+emote.width) + "px";
		s.style.height = (10+emote.height) + "px";

		s.addEventListener('click', function(id, code, e) {
			e.preventDefault();
			if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons ) {
				var url;
				if ( set.hasOwnProperty('source_ext') ) {
					var api = f._apis[set.source_ext];
					if ( api && api.emote_url_generator )
						url = api.emote_url_generator(set.source_id, id);
				} else
					url = "https://www.frankerfacez.com/emoticon/" + id;
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


FFZ.prototype._add_emote = function(view, emote, favorites_set, favorites_key, event) {
	if ( event && ((!IS_OSX && event.ctrlKey) || (IS_OSX && event.metaKey)) ) {
		var el = event.target;
		if ( ! el.classList.contains('locked') && el.classList.contains('ffz-can-favorite') && favorites_set && favorites_key ) {
			var favs = this.settings.favorite_emotes[favorites_set] = this.settings.favorite_emotes[favorites_set] || [],
				is_favorited = favs.indexOf(favorites_key) !== -1;

			if ( is_favorited )
				favs.removeObject(favorites_key);
			else
				favs.push(favorites_key);

			this.settings.set("favorite_emotes", this.settings.favorite_emotes, true);

			if ( el.classList.contains('ffz-is-favorite') && is_favorited ) {
				jQuery(el).trigger('mouseout');
				el.parentElement.removeChild(el);
			} else
				el.classList.toggle('ffz-favorite', ! is_favorited);
		}
		return;
	}

	var input_el, text, room;

	if ( this.has_bttv ) {
		input_el = view.get('element').querySelector('textarea');
		text = input_el.value;

	} else {
		var controller = utils.ember_lookup('controller:chat');
		room = controller.get('currentRoom');
		text = room.get('messageToSend') || '';
	}

	text += (text && text.substr(-1) !== " " ? " " : "")  + (emote.name || emote);

	if ( input_el )
		input_el.value = text;
	else
		room.set('messageToSend', text);
}