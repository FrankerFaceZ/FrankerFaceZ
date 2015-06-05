var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
	utils = require("../utils"),

	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	BANNED_SETS = {"00000turbo":true},

	KNOWN_CODES = {
		"#-?[\\\\/]": "#-/",
		":-?(?:7|L)": ":-7",
		"\\&lt\\;\\]": "<]",
		"\\:-?(S|s)": ":-S",
		"\\:-?\\\\": ":-\\",
		"\\:\\&gt\\;": ":>",
		"B-?\\)": "B-)",
		"\\:-?[z|Z|\\|]": ":-Z",
		"\\:-?\\)": ":-)",
		"\\:-?\\(": ":-(",
		"\\:-?(p|P)": ":-P",
		"\\;-?(p|P)": ";-P",
		"\\&lt\\;3": "<3",
		"\\:-?[\\\\/]": ":-/",
		"\\;-?\\)": ";-)",
		"R-?\\)": "R-)",
		"[o|O](_|\\.)[o|O]": "O.o",
		"\\:-?D": ":-D",
		"\\:-?(o|O)": ":-O",
		"\\&gt\\;\\(": ">(",
		"Gr(a|e)yFace": "GrayFace"
		},

	get_emotes = function(ffz) {
		var Chat = App.__container__.lookup('controller:chat'),
			room_id = Chat.get('currentRoom.id'),
			room = ffz.rooms[room_id],
			tmiSession = room ? room.room.tmiSession : null,

			set_ids = tmiSession && tmiSession._emotesParser && tmiSession._emotesParser.emoticonSetIds || "0",
			user = ffz.get_user(),
			user_sets = user && ffz.users[user.login] && ffz.users[user.login].sets || [];

		// Remove the 'default' set.
		set_ids = set_ids.split(",").removeObject("0");

		if ( ffz.settings.global_emotes_in_menu ) {
			set_ids.push("0");
			user_sets = _.union(user_sets, ffz.default_sets);
		}

		return [set_ids, user_sets];
	};


// -------------------
// Initialization
// -------------------

FFZ.settings_info.global_emotes_in_menu = {
	type: "boolean",
	value: false,

	name: "Display Global Emotes in My Emotes",
	help: "Display the global Twitch emotes in the My Emoticons menu."
	};


FFZ.prototype.setup_my_emotes = function() {
	this._twitch_set_to_channel = {};
	this._twitch_badges = {};

	if ( localStorage.ffzTwitchSets ) {
		try {
			this._twitch_set_to_channel = JSON.parse(localStorage.ffzTwitchSets);
			this._twitch_badges = JSON.parse(localStorage.ffzTwitchBadges);
		} catch(err) { }
	}

	this._twitch_set_to_channel[0] = "global";
	this._twitch_set_to_channel[33] = "tfaces";
	this._twitch_set_to_channel[42] = "tfaces";

	this._twitch_badges["global"] = "//cdn.frankerfacez.com/script/twitch_logo.png";
	this._twitch_badges["tfaces"] = this._twitch_badges["turbo"] = "//cdn.frankerfacez.com/script/turbo_badge.png";
}


// -------------------
// Menu Page
// -------------------

FFZ.menu_pages.my_emotes = {
	name: "My Emoticons",
	icon: constants.EMOTE,

	visible: function() {
		var emotes = get_emotes(this);
		return emotes[0].length > 0 || emotes[1].length > 0;
	},

	render: function(view, container) {
		var tmi = view.get('controller.currentRoom.tmiSession'),
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'],
			needed_sets = [];

		for(var set_id in twitch_sets)
			if ( twitch_sets.hasOwnProperty(set_id) && ! this._twitch_set_to_channel.hasOwnProperty(set_id) )
				needed_sets.push(set_id);

		if ( ! needed_sets.length )
			return FFZ.menu_pages.my_emotes.draw_menu.bind(this)(view, container, twitch_sets);

		container.innerHTML = JSON.stringify(needed_sets);
	},

	draw_twitch_set: function(view, set_id, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),

			channel_id = this._twitch_set_to_channel[set_id], title;

		if ( channel_id === "global" )
			title = "Global Emoticons";
		else if ( channel_id === "turbo" )
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
						heading.style.backgroundImage = 'url("' + data.subscriber.image + '")';
					}
				});
		}

		menu.className = 'emoticon-grid';
		menu.appendChild(heading);

		for(var i=0; i < set.length; i++) {
			var emote = set[i],
				code = KNOWN_CODES[emote.code] || emote.code,

				em = document.createElement('span'),
				img_set = 'image-set(url("' + TWITCH_BASE + emote.id + '/1.0") 1x, url("' + TWITCH_BASE + emote.id + '/2.0") 2x, url("' + TWITCH_BASE + emote.id + '/3.0") 4x)';

			em.className = 'emoticon tooltip';
			em.style.backgroundImage = 'url("' + TWITCH_BASE + emote.id + '/1.0")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroudnImage = img_set;

			em.title = code;
			em.addEventListener("click", this._add_emote.bind(this, view, code));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_ffz_set: function(view, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),
			emotes = [];

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">FrankerFaceZ</span>' + set.title;
		heading.style.backgroundImage = 'url("' + (set.icon || '//cdn.frankerfacez.com/script/devicon.png') + '")';

		menu.className = 'emoticon-grid';
		menu.appendChild(heading);

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

			em.title = emote.tooltip || emote.name;
			em.addEventListener("click", this._add_emote.bind(this, view, emote.name));
			menu.appendChild(em);
		}

		return menu;
	},

	draw_menu: function(view, container, twitch_sets) {
		// Make sure we're still on the My Emoticons page. Since this is
		// asynchronous, the user could've tabbed away.
		if ( container.getAttribute('data-page') !== 'my_emotes' )
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

				sets.push([this._twitch_set_to_channel[set_id], FFZ.menu_pages.my_emotes.draw_twitch_set.bind(this)(view, set_id, set)]);
			}


			// Now, FFZ!
			for(var i=0; i < ffz_sets.length; i++) {
				var set_id = ffz_sets[i],
					set = this.emote_sets[set_id];

				if ( ! set || ! set.count || ( ! this.settings.global_emotes_in_menu && this.default_sets.indexOf(set_id) !== -1 ) )
					continue;

				sets.push([set.title.toLowerCase(), FFZ.menu_pages.my_emotes.draw_ffz_set.bind(this)(view, set)]);
			}


			// Finally, sort and add them all.
			sets.sort(function(a,b) {
				var an = a[0], bn = b[0];
				if ( an === "turbo" || an === "tfaces" )
					an = "zza|" + an;
				else if ( an === "global" || an === "global emoticons" )
					an = "zzz|" + an;

				if ( bn === "turbo" || bn === "tfaces" )
					bn = "zza|" + bn;
				else if ( bn === "global" || bn === "global emoticons" )
					bn = "zzz|" + bn;

				if ( an < bn ) return -1;
				if ( an > bn ) return 1;
				return 0;
			});

			for(var i=0; i < sets.length; i++)
				container.appendChild(sets[i][1]);

		} catch(err) {
			this.error("my_emotes draw_menu: " + err);
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