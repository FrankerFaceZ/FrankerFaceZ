var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
	utils = require("../utils"),

	BANNED_SETS = {"00000turbo":true};


// -------------------
// Initialization
// -------------------

FFZ.basic_settings.replace_twitch_menu = {
	type: "boolean",

	category: "Chat",

	name: "Unified Emoticons Menu",
	help: "Completely replace the default Twitch emoticon menu and display global emoticons in the My Emoticons menu.",

	get: function() {
		return this.settings.replace_twitch_menu && this.settings.global_emotes_in_menu && this.settings.emoji_in_menu;
	},

	set: function(val) {
		this.settings.set('replace_twitch_menu', val);
		this.settings.set('global_emotes_in_menu', val);
		this.settings.set('emoji_in_menu', val);
	}
};

FFZ.settings_info.replace_twitch_menu = {
	type: "boolean",
	value: false,

	category: "Chat Input",

	name: "Replace Twitch Emoticon Menu",
	help: "Completely replace the default Twitch emoticon menu.",

	on_update: function(val) {
			document.body.classList.toggle("ffz-menu-replace", val);
		}
	};


FFZ.settings_info.global_emotes_in_menu = {
	type: "boolean",
	value: false,

	category: "Chat Input",

	name: "Display Global Emotes in My Emotes",
	help: "Display the global Twitch emotes in the My Emoticons menu."
	};


FFZ.settings_info.emoji_in_menu = {
	type: "boolean",
	value: true,

	category: "Chat Input",

	name: "Display Emoji in My Emotes",
	help: "Display the supported emoji images in the My Emoticons menu."
	};


FFZ.settings_info.emote_menu_collapsed = {
	storage_key: "ffz_setting_my_emoticons_collapsed_sections",
	value: [],
	visible: false
}


FFZ.settings_info.favorite_emotes = {
	value: {},
	visible: false
}


FFZ.prototype.setup_my_emotes = function() {
	this._twitch_badges = {};
	this._twitch_badges["--global--"] = "//cdn.frankerfacez.com/script/twitch_logo.png";
	this._twitch_badges["--turbo-faces--"] = this._twitch_badges["turbo"] = "//cdn.frankerfacez.com/script/turbo_badge.png";
	this._twitch_badges["--prime-faces--"] = this._twitch_badges["--prime--"] = "//cdn.frankerfacez.com/badges/twitch/premium/1/1.png";
	this._twitch_badges["--curse--"] = "//cdn.frankerfacez.com/script/curse_logo.png";
}


// -------------------
// Menu Page
// -------------------

FFZ.menu_pages.myemotes = {
	name: "My Emoticons",
	icon: constants.EMOTE,

	has_sets: function(view) {
		var user = this.get_user(),
			controller = utils.ember_lookup('controller:chat'),
			tmi = controller && controller.get('currentRoom.tmiSession'),
			ffz_sets = user && this.users[user.login] && this.users[user.login].sets || [],
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'],

			sk = twitch_sets && Object.keys(twitch_sets);

		if ( sk && ! this.settings.global_emotes_in_menu && sk.indexOf('0') !== -1 )
			sk.removeObject('0');

		return ffz_sets.length || (sk && sk.length);
	},

	visible: function(view) {
		return this.settings.emoji_in_menu || FFZ.menu_pages.myemotes.has_sets.call(this, view);
	},

	default_page: function() {
		for(var key in this.settings.favorite_emotes)
			if ( this.settings.favorite_emotes[key] && this.settings.favorite_emotes[key].length )
				return 'favorites';

		return 'all';
	},

	pages: {
		favorites: {
			name: "Favorites",
			sort_order: 1,

			render: function(view, container) {
				FFZ.menu_pages.myemotes.render_lists.call(this, view, container, true);

				var el = document.createElement("div");
				el.className = "emoticon-grid ffz-no-emotes center";
				el.innerHTML = "You have no favorite emoticons.<br> <img src=\"//cdn.frankerfacez.com/emoticon/26608/2\"><br>To make an emote a favorite, find it on the <nobr>All Emoticons</nobr> tab and <nobr>" + (constants.IS_OSX ? '⌘' : 'Ctrl') + "-Click</nobr> it.";
				container.appendChild(el);
			}
		},

		all: {
			name: "All Emoticons",
			sort_order: 2,

			visible: function(view) {
				return FFZ.menu_pages.myemotes.has_sets.call(this, view);
			},

			render: function(view, container) {
				FFZ.menu_pages.myemotes.render_lists.call(this, view, container, false);
			}
		},

		emoji: {
			name: "Emoji",
			sort_order: 3,
			visible: function() { return this.settings.emoji_in_menu },

			render: function(view, container) {
				var sets = [];

				for(var cat in constants.EMOJI_CATEGORIES) {
					var menu = FFZ.menu_pages.myemotes.draw_emoji.call(this, view, cat, false);
					if ( menu )
						sets.push([cat, menu]);
				}

				sets.sort(function(a,b) {
					var an = a[0], bn = b[0];
					if ( an < bn ) return -1;
					if ( an > bn ) return 1;
					return 0;
				});

				if ( sets.length )
					sets[0][1].classList.add('top-set');

				for(var i=0; i < sets.length; i++)
					container.appendChild(sets[i][1]);
			}
		}
	},

	render_lists: function(view, container, favorites_only) {
		var controller = utils.ember_lookup('controller:chat'),
			tmi = controller && controller.get('currentRoom.tmiSession'),
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'],

			user = this.get_user(),
			ffz_sets = this.getEmotes(user && user.login, null),
			sets = [];

		// Start with Twitch Sets
		for(var set_id in twitch_sets) {
			if ( ! twitch_sets.hasOwnProperty(set_id) || ( ! this.settings.global_emotes_in_menu && set_id === '0' ) )
				continue;

			// Skip the Twitch Turbo set if we have Twitch Prime. They're identical.
			if ( set_id == 793 && twitch_sets.hasOwnProperty(19194) )
				continue;

			var favorites_list = this.settings.favorite_emotes["twitch-" + set_id];
			if ( favorites_only && (! favorites_list || ! favorites_list.length) )
				continue;

			var set = twitch_sets[set_id];
			if ( ! set.length )
				continue;

			var menu_id = this._twitch_set_to_channel[set_id].toLowerCase(),
				sort_key = 0,
				menu = FFZ.menu_pages.myemotes.draw_twitch_set.call(this, view, set_id, set, favorites_only);

			if ( menu_id.indexOf('global') !== -1 )
				sort_key = 100;
			else if ( menu_id.substr(0,2) === '--' || menu_id === 'turbo' )
				sort_key = 75;

			if ( menu )
				sets.push([[sort_key, menu_id], menu]);
		}

		// Emoji~!
		if ( favorites_only && this.settings.emoji_in_menu ) {
			var favorites_list = this.settings.favorite_emotes["emoji"];
			if ( favorites_list && favorites_list.length ) {
				var menu = FFZ.menu_pages.myemotes.draw_emoji.call(this, view, null, favorites_only);
				if ( menu )
					sets.push([[200, "emoji"], menu]);
			}
		}

		// Now, FFZ!
		for(var i=0; i < ffz_sets.length; i++) {
			var set_id = ffz_sets[i],
				set = this.emote_sets[set_id],

				menu_id = set.hasOwnProperty('source_ext') ? 'ffz-ext-' + set.source_ext + '-' + set.source_id : 'ffz-' + set.id,
				favorites_list = this.settings.favorite_emotes[menu_id];

			if ( favorites_only && (! favorites_list || ! favorites_list.length) )
				continue;

			if ( ! set || ! set.count || set.hidden || ( ! this.settings.global_emotes_in_menu && this.default_sets.indexOf(set_id) !== -1 ) )
				continue;

			var menu_id = set.title.toLowerCase(),
				sort_key = set.sort,
				menu = FFZ.menu_pages.myemotes.draw_ffz_set.call(this, view, set, favorites_only);

			if ( sort_key === undefined || sort_key === null ) {
				if ( menu_id.indexOf('global') !== -1 )
					sort_key = 100;
				else
					sort_key = 0;
			}

			if ( menu )
				sets.push([[sort_key, menu_id], menu]);
		}


		if ( ! sets.length )
			return false;


		// Finally, sort and add them all.
		sets.sort(function(a,b) {
			var ask = a[0][0],
				an = a[0][1],

				bsk = b[0][0],
				bn = b[0][1];

			if ( ask < bsk ) return -1;
			if ( ask > bsk ) return 1;

			if ( an < bn ) return -1;
			if ( an > bn ) return 1;
			return 0;
		});

		if ( favorites_only ) {
			var grid = document.createElement('div');
			grid.className = 'emoticon-grid favorites-grid';
			for(var i=0; i < sets.length; i++)
				grid.appendChild(sets[i][1]);

			container.appendChild(grid);

		} else if ( sets.length ) {
			sets[0][1].classList.add('top-set');
			for(var i=0; i < sets.length; i++)
				container.appendChild(sets[i][1]);
		}

		return true;
	},

	toggle_section: function(heading, container) {
		var menu = heading.parentElement,
			set_id = menu.getAttribute('data-set'),
			collapsed_list = this.settings.emote_menu_collapsed,
			is_collapsed = collapsed_list.indexOf(set_id) === -1;

		if ( ! is_collapsed )
			collapsed_list.removeObject(set_id);
		else
			collapsed_list.push(set_id);

		this.settings.set('emote_menu_collapsed', collapsed_list, true);
		menu.classList.toggle('collapsed', !is_collapsed);

		if ( is_collapsed )
			menu.appendChild(container);
		else
			menu.removeChild(container);
	},

	draw_emoji: function(view, cat, favorites_only) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			menu_id = 'emoji' + (cat ? '-' + cat : ''),
			emotes = favorites_only ? document.createDocumentFragment() : document.createElement('div'),
			collapsed = ! favorites_only && this.settings.emote_menu_collapsed.indexOf(menu_id) === -1,
			f = this,
			settings = this.settings.parse_emoji || 1,

			favorites = this.settings.favorite_emotes["emoji"] || [],
			c = 0;

		menu.className = 'emoticon-grid';
		menu.setAttribute('data-set', menu_id);

		if ( ! favorites_only ) {
			heading.className = 'heading';
			heading.innerHTML = '<span class="right">Unicode</span>' + (cat ? utils.sanitize(constants.EMOJI_CATEGORIES[cat]) : 'Emoji');
			heading.style.backgroundImage = 'url("' + constants.SERVER + 'emoji/' + (settings === 3 ? 'one/' : (settings === 2 ? 'noto-' : 'tw/')) + (constants.EMOJI_LOGOS[cat] || '1f4af') + '.svg")';
			heading.style.backgroundSize = "18px";

			menu.classList.add('collapsable');
			menu.appendChild(heading);
			menu.classList.toggle('collapsed', collapsed);
		  heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this, emotes); });
		}

		var set = [];

		for(var eid in this.emoji_data)
			set.push(this.emoji_data[eid]);

		set.sort(function(a,b) {
			var an = (a.name || "").toLowerCase(),
				bn = (b.name || "").toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.raw < b.raw ) return -1;
			if ( a.raw > b.raw ) return 1;
			return 0;
		});

		for(var i=0; i < set.length; i++) {
			var emoji = set[i],
				em = document.createElement('span');

			if ( (cat && cat !== emoji.cat) || (settings === 1 && ! emoji.tw) || (settings === 2 && ! emoji.noto) || (settings === 3 && ! emoji.one) )
				continue;

			var is_favorite = favorites.indexOf(emoji.raw) !== -1,
				src = settings === 3 ? emoji.one_src : (settings === 2 ? emoji.noto_src : emoji.tw_src),
				image = this.settings.emote_image_hover ? '<img class="emoticon ffz-image-hover" src="' + src + '">' : '';

			if ( favorites_only && ! is_favorite )
				continue;

			em.className = 'emoticon emoji ffz-tooltip ffz-can-favorite';
			em.classList.toggle('ffz-favorite', is_favorite);
			em.classList.toggle('ffz-is-favorite', favorites_only);

			em.setAttribute('data-ffz-emoji', emoji.code);
			em.alt = emoji.raw;

			em.addEventListener('click', this._add_emote.bind(this, view, emoji.raw, "emoji", emoji.raw));

			em.style.backgroundImage = 'url("' + src + '")';
			em.style.backgroundSize = "18px";

			c++;
			emotes.appendChild(em);
		}

		if ( ! c )
			return;

		if ( favorites_only )
			return emotes;

		if ( ! collapsed )
			menu.appendChild(emotes);

		return menu;
	},

	draw_twitch_set: function(view, set_id, set, favorites_only) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			emotes = favorites_only ? document.createDocumentFragment() : document.createElement('div'),
			collapsed = ! favorites_only && this.settings.emote_menu_collapsed.indexOf('twitch-' + set_id) === -1,
			f = this,

			channel_id = this._twitch_set_to_channel[set_id], title,
			favorites = this.settings.favorite_emotes["twitch-" + set_id] || [],
			c = 0;

		menu.className = 'emoticon-grid';
		menu.setAttribute('data-set', 'twitch-' + set_id);

		if ( ! favorites_only ) {
			if ( channel_id === "twitch_unknown" )
				title = "Unknown Channel";
			else if ( channel_id === "--global--" )
				title = "Global Emoticons";
			else if ( channel_id === "turbo" || channel_id === "--turbo-faces--" )
				title = "Twitch Turbo";
			else if ( channel_id === "--prime--" || channel_id === "--prime-faces--" )
				title = "Twitch Prime";
			else if ( channel_id === "--curse--" )
				title = "Curse Emoticons";
			else
				title = FFZ.get_capitalization(channel_id, function(name) {
					heading.innerHTML = '<span class="right">Twitch</span>' + utils.sanitize(name);
				});

			heading.className = 'heading';
			heading.innerHTML = '<span class="right">Twitch</span>' + utils.sanitize(title);

			if ( this._twitch_badges[channel_id] )
				heading.style.backgroundImage = 'url("' + this._twitch_badges[channel_id] + '")';
			else {
				var f = this;
				utils.api.get("chat/" + channel_id + "/badges", null, {version: 3})
					.done(function(data) {
						if ( data.subscriber && data.subscriber.image ) {
							f._twitch_badges[channel_id] = data.subscriber.image;
							localStorage.ffzTwitchBadges = JSON.stringify(f._twitch_badges);
							heading.style.backgroundImage = 'url("' + data.subscriber.image + '")';
						}
					});
			}

			menu.classList.add('collapsable');
			menu.appendChild(heading);
			menu.classList.toggle('collapsed', collapsed);
			heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this, emotes); });
		}

		set.sort(function(a,b) {
			var an = a.code.toLowerCase(),
				bn = b.code.toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.id < b.id ) return -1;
			if ( a.id > b.id ) return 1;
			return 0;
		});

		for(var i=0; i < set.length; i++) {
			var emote = set[i],
				code = constants.KNOWN_CODES[emote.code] || emote.code,
				is_favorite = favorites.indexOf(emote.id) !== -1;

			if ( favorites_only && ! is_favorite )
				continue;

			var em = document.createElement('span'),
				img_set = 'image-set(url("' + constants.TWITCH_BASE + emote.id + '/1.0") 1x, url("' + constants.TWITCH_BASE + emote.id + '/2.0") 2x)';

			em.className = 'emoticon ffz-tooltip ffz-can-favorite';
			em.setAttribute('data-emote', emote.id);
			em.alt = code;

			em.classList.toggle('ffz-favorite', is_favorite);
			em.classList.toggle('ffz-is-favorite', favorites_only);
			em.classList.toggle('ffz-tooltip-no-credit', ! favorites_only);

			if ( this.settings.replace_bad_emotes && constants.EMOTE_REPLACEMENTS[emote.id] ) {
				em.style.backgroundImage = 'url("' + constants.EMOTE_REPLACEMENT_BASE + constants.EMOTE_REPLACEMENTS[emote.id] + '")';
			} else {
				em.style.backgroundImage = 'url("' + constants.TWITCH_BASE + emote.id + '/1.0")';
				em.style.backgroundImage = '-webkit-' + img_set;
				em.style.backgroundImage = '-moz-' + img_set;
				em.style.backgroundImage = '-ms-' + img_set;
				em.style.backgroundImage = img_set;
			}

			em.addEventListener("click", function(id, c, e) {
				e.preventDefault();
				if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
					window.open("https://twitchemotes.com/emote/" + id);
				else
					this._add_emote(view, c, "twitch-" + set_id, id, e);
			}.bind(this, emote.id, code));

			c++;
			emotes.appendChild(em);
		}

		if ( ! c )
			return;

		if ( favorites_only )
			return emotes;

		if ( ! collapsed )
			menu.appendChild(emotes);

		return menu;
	},

	draw_ffz_set: function(view, set, favorites_only) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			emote_container = favorites_only ? document.createDocumentFragment() : document.createElement('div'),
			f = this,
			emotes = [],

			menu_id = set.hasOwnProperty('source_ext') ? 'ffz-ext-' + set.source_ext + '-' + set.source_id : 'ffz-' + set.id,
			favorites = this.settings.favorite_emotes[menu_id] || [],
			c = 0,
			icon = set.icon || (set.hasOwnProperty('source_ext') && this._apis[set.source_ext] && this._apis[set.source_ext].icon) || '//cdn.frankerfacez.com/script/devicon.png',
			collapsed = ! favorites_only && this.settings.emote_menu_collapsed.indexOf(menu_id) === -1;

		menu.className = 'emoticon-grid';
		menu.setAttribute('data-set', menu_id);

		if ( ! favorites_only ) {
			menu.classList.add('collapsable');

			heading.className = 'heading';
			heading.innerHTML = '<span class="right">' + (utils.sanitize(set.source) || 'FrankerFaceZ') + '</span>' + set.title;

			heading.style.backgroundImage = 'url("' + icon + '")';
			if ( icon.indexOf('.svg') !== -1 )
				heading.style.backgroundSize = "18px";

			menu.appendChild(heading);
			menu.classList.toggle('collapsed', collapsed);
			heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this, emote_container); });
		}

		for(var emote_id in set.emoticons)
			set.emoticons.hasOwnProperty(emote_id) && ! set.emoticons[emote_id].hidden && emotes.push(set.emoticons[emote_id]);

		emotes.sort(function(a,b) {
			var an = a.name.toLowerCase(),
				bn = b.name.toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.id < b.id ) return -1;
			if ( a.id > b.id ) return 1;
			return 0;
		});

		for(var i=0; i < emotes.length; i++) {
			var emote = emotes[i],
				is_favorite = favorites.indexOf(emote.id) !== -1;

			if ( favorites_only && ! is_favorite )
				continue;

			var em = document.createElement('span'),
				img_set = 'image-set(url("' + emote.urls[1] + '") 1x';

			if ( emote.urls[2] )
				img_set += ', url("' + emote.urls[2] + '") 2x';

			if ( emote.urls[4] )
				img_set += ', url("' + emote.urls[4] + '") 4x';

			img_set += ')';

			em.className = 'emoticon ffz-tooltip ffz-can-favorite';
			em.classList.toggle('ffz-favorite', is_favorite);
			em.classList.toggle('ffz-is-favorite', favorites_only);

			em.setAttribute('data-ffz-emote', emote.id);
			em.setAttribute('data-ffz-set', set.id);

			em.style.backgroundImage = 'url("' + emote.urls[1] + '")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroundImage = img_set;

			if ( emote.height )
				em.style.height = (10+emote.height) + "px";
			if ( emote.width )
				em.style.width = (10+emote.width) + "px";

			em.addEventListener("click", function(id, code, e) {
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
					this._add_emote(view, code, menu_id, id, e);
			}.bind(this, emote.id, emote.name));

			c++;
			emote_container.appendChild(em);
		}

		if ( ! c )
			return;

		if ( favorites_only )
			return emote_container;

		if ( ! collapsed )
			menu.appendChild(emote_container);

		return menu;
	}
};