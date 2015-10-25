var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
	utils = require("../utils"),

	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
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
	value: false,

	category: "Chat Input",

	name: "Display Emoji in My Emotes",
	help: "Display the supported emoji images in the My Emoticons menu."
	};


FFZ.settings_info.emote_menu_collapsed = {
	value: [],
	visible: false
}


FFZ.prototype.setup_my_emotes = function() {
	this._twitch_badges = {};
	this._twitch_badges["--global--"] = "//cdn.frankerfacez.com/script/twitch_logo.png";
	this._twitch_badges["--turbo-faces--"] = this._twitch_badges["turbo"] = "//cdn.frankerfacez.com/script/turbo_badge.png";
}


// -------------------
// Menu Page
// -------------------

FFZ.menu_pages.myemotes = {
	name: "My Emoticons",
	icon: constants.EMOTE,

	visible: function(view) {
		var user = this.get_user(),
			tmi = view.get('controller.currentRoom.tmiSession'),
			ffz_sets = user && this.users[user.login] && this.users[user.login].sets || [],
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'],

			sk = twitch_sets && Object.keys(twitch_sets);

		if ( sk && ! this.settings.global_emotes_in_menu && sk.indexOf('0') !== -1 )
			sk.removeObject('0');

		return ffz_sets.length || (sk && sk.length) || this.settings.emoji_in_menu;
	},

	render: function(view, container) {
		var tmi = view.get('controller.currentRoom.tmiSession'),
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'];

		// We don't have to do async stuff anymore cause we pre-load data~!
		return FFZ.menu_pages.myemotes.draw_menu.bind(this)(view, container, twitch_sets);
	},

	toggle_section: function(heading) {
		var menu = heading.parentElement,
			set_id = menu.getAttribute('data-set'),
			collapsed_list = this.settings.emote_menu_collapsed,
			is_collapsed = collapsed_list.indexOf(set_id) !== -1;

		if ( is_collapsed )
			collapsed_list.removeObject(set_id);
		else
			collapsed_list.push(set_id);

		this.settings.set('emote_menu_collapsed', collapsed_list);
		menu.classList.toggle('collapsed', !is_collapsed);
	},

	draw_emoji: function(view) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			f = this,
			settings = this.settings.parse_emoji || 1;


		heading.className = 'heading';
		heading.innerHTML = '<span class="right">Unicode</span>Emoji';
		heading.style.backgroundImage = 'url("' + constants.SERVER + 'emoji/' + (settings === 2 ? 'noto-' : 'tw-') + '1f4af.svg")';
		heading.style.backgroundSize = "18px";

		menu.className = 'emoticon-grid collapsable';
		menu.appendChild(heading);

		menu.setAttribute('data-set', 'emoji');
		menu.classList.toggle('collapsed', this.settings.emote_menu_collapsed.indexOf('emoji') !== -1);
		heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this); });

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

			if ( (settings === 1 && ! emoji.tw) || (settings === 2 && ! emoji.noto) )
				continue;

			em.className = 'emoticon tooltip';
			em.title = 'Emoji: ' + emoji.raw + '\nName: ' + emoji.name + (emoji.short_name ? '\nShort Name: :' + emoji.short_name + ':' : '');
			em.addEventListener('click', this._add_emote.bind(this, view, emoji.raw));

			em.style.backgroundImage = 'url("' + (settings === 2 ? emoji.noto_src : emoji.tw_src) + '")';
			em.style.backgroundSize = "18px";

			menu.appendChild(em);
		}

		return menu;
	},

	draw_twitch_set: function(view, set_id, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			f = this,

			channel_id = this._twitch_set_to_channel[set_id], title;

		if ( channel_id === "twitch_unknown" )
			title = "Unknown Channel";
		else if ( channel_id === "--global--" )
			title = "Global Emoticons";
		else if ( channel_id === "turbo" || channel_id === "--turbo-faces--" )
			title = "Twitch Turbo";
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
			Twitch.api.get("chat/" + channel_id + "/badges", null, {version: 3})
				.done(function(data) {
					if ( data.subscriber && data.subscriber.image ) {
						f._twitch_badges[channel_id] = data.subscriber.image;
						localStorage.ffzTwitchBadges = JSON.stringify(f._twitch_badges);
						heading.style.backgroundImage = 'url("' + data.subscriber.image + '")';
					}
				});
		}

		menu.className = 'emoticon-grid collapsable';
		menu.appendChild(heading);

		menu.setAttribute('data-set', 'twitch-' + set_id);
		menu.classList.toggle('collapsed', this.settings.emote_menu_collapsed.indexOf('twitch-' + set_id) !== -1);
		heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this); });

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

				em = document.createElement('span'),
				img_set = 'image-set(url("' + TWITCH_BASE + emote.id + '/1.0") 1x, url("' + TWITCH_BASE + emote.id + '/2.0") 2x, url("' + TWITCH_BASE + emote.id + '/3.0") 4x)';

			em.className = 'emoticon tooltip';

			if ( this.settings.replace_bad_emotes && constants.EMOTE_REPLACEMENTS[emote.id] ) {
				em.style.backgroundImage = 'url("' + constants.EMOTE_REPLACEMENT_BASE + constants.EMOTE_REPLACEMENTS[emote.id] + '")';
			} else {
				em.style.backgroundImage = 'url("' + TWITCH_BASE + emote.id + '/1.0")';
				em.style.backgroundImage = '-webkit-' + img_set;
				em.style.backgroundImage = '-moz-' + img_set;
				em.style.backgroundImage = '-ms-' + img_set;
				em.style.backgroudnImage = img_set;
			}

			em.title = code;
			em.addEventListener("click", function(id, c, e) {
				e.preventDefault();
				if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons )
					window.open("https://twitchemotes.com/emote/" + id);
				else
					this._add_emote(view, c);
			}.bind(this, emote.id, code));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_ffz_set: function(view, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			f = this,
			emotes = [],

			menu_id = set.hasOwnProperty('source_ext') ? 'ffz-ext-' + set.source_ext + '-' + set.source_id : 'ffz-' + set.id,
			icon = set.icon || (set.hasOwnProperty('source_ext') && '//cdn.frankerfacez.com/emoji/tw-1f4ac.svg') || '//cdn.frankerfacez.com/script/devicon.png';

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">' + (utils.sanitize(set.source) || 'FrankerFaceZ') + '</span>' + set.title;

		heading.style.backgroundImage = 'url("' + icon + '")';
		if ( icon.indexOf('.svg') !== -1 )
			heading.style.backgroundSize = "18px";

		menu.className = 'emoticon-grid collapsable';
		menu.appendChild(heading);

		menu.setAttribute('data-set', menu_id);
		menu.classList.toggle('collapsed', this.settings.emote_menu_collapsed.indexOf(menu_id) !== -1);
		heading.addEventListener('click', function() { FFZ.menu_pages.myemotes.toggle_section.bind(f)(this); });

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

				em = document.createElement('span'),
				img_set = 'image-set(url("' + emote.urls[1] + '") 1x';

			if ( emote.urls[2] )
				img_set += ', url("' + emote.urls[2] + '") 2x';

			if ( emote.urls[4] )
				img_set += ', url("' + emote.urls[4] + '") 4x';

			img_set += ')';

			em.className = 'emoticon tooltip';
			em.style.backgroundImage = 'url("' + emote.urls[1] + '")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroudnImage = img_set;

			if ( emote.height )
				em.style.height = emote.height + "px";
			if ( emote.width )
				em.style.width = emote.width + "px";

			em.title = this._emote_tooltip(emote);
			em.addEventListener("click", function(id, code, e) {
				e.preventDefault();
				if ( (e.shiftKey || e.shiftLeft) && f.settings.clickable_emoticons && ! set.hasOwnProperty('source_ext') )
					window.open("https://www.frankerfacez.com/emoticons/" + id);
				else
					this._add_emote(view, code);
			}.bind(this, emote.id, emote.name));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_menu: function(view, container, twitch_sets) {
		// Make sure we're still on the My Emoticons page. Since this is
		// asynchronous, the user could've tabbed away.
		if ( container.getAttribute('data-page') !== 'myemotes' )
			return;

		container.innerHTML = "";
		try {
			var user = this.get_user(),
				ffz_sets = this.getEmotes(user && user.login, null),
				sets = [];

			// Start with Twitch Sets
			for(var set_id in twitch_sets) {
				if ( ! twitch_sets.hasOwnProperty(set_id) || ( ! this.settings.global_emotes_in_menu && set_id === '0' ) )
					continue;

				var set = twitch_sets[set_id];
				if ( ! set.length )
					continue;

				sets.push([this._twitch_set_to_channel[set_id], FFZ.menu_pages.myemotes.draw_twitch_set.bind(this)(view, set_id, set)]);
			}

			// Emoji~!
			if ( this.settings.emoji_in_menu )
				sets.push(["emoji", FFZ.menu_pages.myemotes.draw_emoji.bind(this)(view)]);

			// Now, FFZ!
			for(var i=0; i < ffz_sets.length; i++) {
				var set_id = ffz_sets[i],
					set = this.emote_sets[set_id];

				if ( ! set || ! set.count || ( ! this.settings.global_emotes_in_menu && this.default_sets.indexOf(set_id) !== -1 ) )
					continue;

				sets.push([set.title.toLowerCase(), FFZ.menu_pages.myemotes.draw_ffz_set.bind(this)(view, set)]);
			}


			// Finally, sort and add them all.
			sets.sort(function(a,b) {
				var an = a[0], bn = b[0];
				if ( an === "turbo" || an === "--turbo-faces--" )
					an = "zza|" + an;
				else if ( an === "global" || an === "global emoticons" || an === "--global--" )
					an = "zzy|" + an;
				else if ( an === "emoji" )
					an = "zzz|" + an;

				if ( bn === "turbo" || bn === "--turbo-faces--" )
					bn = "zza|" + bn;
				else if ( bn === "global" || bn === "global emoticons" || bn === "--global--" )
					bn = "zzy|" + bn;
				else if ( bn === "emoji" )
					bn = "zzz|" + bn;

				if ( an < bn ) return -1;
				if ( an > bn ) return 1;
				return 0;
			});

			for(var i=0; i < sets.length; i++)
				container.appendChild(sets[i][1]);

		} catch(err) {
			this.error("myemotes draw_menu: " + err);
			container.innerHTML = "";

			var menu = document.createElement('div'),
				heading = document.createElement('div'),
				p = document.createElement('p');

			heading.className = 'heading';
			heading.innerHTML = 'Error Loading Menu';
			menu.appendChild(heading);

			p.className = 'clearfix';
			p.textContent = err;
			menu.appendChild(p);

			menu.className = 'chat-menu-content';
			container.appendChild(menu);
		}
	}
};