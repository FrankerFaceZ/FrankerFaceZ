var FFZ = window.FrankerFaceZ,
	constants = require("../constants"),
	utils = require("../utils"),

	TWITCH_BASE = "http://static-cdn.jtvnw.net/emoticons/v1/",
	BANNED_SETS = {"00000turbo":true};


// -------------------
// Initialization
// -------------------

FFZ.settings_info.global_emotes_in_menu = {
	type: "boolean",
	value: false,

	name: "Display Global Emotes in My Emotes",
	help: "Display the global Twitch emotes in the My Emoticons menu."
	};


FFZ.settings_info.emoji_in_menu = {
	type: "boolean",
	value: false,

	name: "Display Emoji in My Emotes",
	help: "Display the supported emoji images in the My Emoticons menu."
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
	this._twitch_set_to_channel[33] = "turbo_faces";
	this._twitch_set_to_channel[42] = "turbo_faces";

	this._twitch_badges["global"] = "//cdn.frankerfacez.com/script/twitch_logo.png";
	this._twitch_badges["turbo_faces"] = this._twitch_badges["turbo"] = "//cdn.frankerfacez.com/script/turbo_badge.png";
}


// -------------------
// Menu Page
// -------------------

FFZ.menu_pages.my_emotes = {
	name: "My Emoticons",
	icon: constants.EMOTE,

	visible: function(view) {
		var user = this.get_user(),
			tmi = view.get('controller.currentRoom.tmiSession'),
			ffz_sets = user && this.users[user.login] && this.users[user.login].sets || [],
			twitch_sets = (tmi && tmi.getEmotes() || {'emoticon_sets': {}})['emoticon_sets'];

		return ffz_sets.length || (twitch_sets && Object.keys(twitch_sets).length);
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

		var f = this,
			fail = function() {
				if ( ! needed_sets.length )
					return;

				needed_sets = [];
				var ts = {};
				for(var set_id in twitch_sets)
				if ( f._twitch_set_to_channel[set_id] )
					ts[set_id] = twitch_sets[set_id];

				return FFZ.menu_pages.my_emotes.draw_menu.bind(f)(view, container, ts);
			};

		if ( ! this.ws_send("twitch_sets", needed_sets, function(success, data) {
			if ( ! needed_sets.length )
				return;

			needed_sets = [];
			if ( success ) {
				for(var set_id in data) {
					if ( ! data.hasOwnProperty(set_id) )
						continue;

					f._twitch_set_to_channel[set_id] = data[set_id];
				}

				localStorage.ffzTwitchSets = JSON.stringify(f._twitch_set_to_channel);
				return FFZ.menu_pages.my_emotes.draw_menu.bind(f)(view, container, twitch_sets);
			} else
				fail();
		}) )
			fail()
		else
			setTimeout(fail, 2000);
	},

	draw_emoji: function(view) {
		var heading = document.createElement('div'),
			menu = document.createElement('div');

		heading.className = 'heading';
		heading.innerHTML = '<span class="right">FrankerFaceZ</span>Emoji';

		menu.className = 'emoticon-grid';
		menu.appendChild(heading);
		
		var set = [];
		for(var eid in this.emoji_data)
			set.push(this.emoji_data[eid]);
		
		set.sort(function(a,b) {
			var an = a.short_name.toLowerCase(),
				bn = b.short_name.toLowerCase();

			if ( an < bn ) return -1;
			else if ( an > bn ) return 1;
			if ( a.raw < b.raw ) return -1;
			if ( a.raw > b.raw ) return 1;
			return 0;
		});
		
		for(var i=0; i < set.length; i++) {
			var emoji = set[i],
				em = document.createElement('span'),
				img_set = 'image-set(url("' + emoji.src + '") 1x, url("' + constants.SERVER + 'emoji/' + emoji.code + '-2x.png") 2x, url("' + constants.SERVER + 'emoji/' + emoji.code + '-4x.png") 4x)';

			em.className = 'emoticon tooltip';
			em.title = 'Emoji: ' + emoji.raw + '\nName: :' + emoji.short_name + ':';
			em.addEventListener('click', this._add_emote.bind(this, view, emoji.raw));
			
			em.style.backgroundImage = 'url("' + emoji.src + '")';
			em.style.backgroundImage = '-webkit-' + img_set;
			em.style.backgroundImage = '-moz-' + img_set;
			em.style.backgroundImage = '-ms-' + img_set;
			em.style.backgroudnImage = img_set;
			
			menu.appendChild(em);
		}

		return menu;
	},

	draw_twitch_set: function(view, set_id, set) {
		var heading = document.createElement('div'),
			menu = document.createElement('div'),

			channel_id = this._twitch_set_to_channel[set_id], title;

		if ( channel_id === "global" )
			title = "Global Emoticons";
		else if ( channel_id === "turbo" || channel_id === "turbo_faces" )
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

		menu.className = 'emoticon-grid';
		menu.appendChild(heading);

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

			em.title = this._emote_tooltip(emote);
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

			// Emoji~!
			if ( this.settings.emoji_in_menu )
				sets.push(["emoji", FFZ.menu_pages.my_emotes.draw_emoji.bind(this)(view)]);

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
				if ( an === "turbo" || an === "turbo_faces" )
					an = "zza|" + an;
				else if ( an === "global" || an === "global emoticons" )
					an = "zzz|" + an;

				if ( bn === "turbo" || bn === "turbo_faces" )
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