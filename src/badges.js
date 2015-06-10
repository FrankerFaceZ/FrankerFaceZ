var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils');


// --------------------
// Settings
// --------------------

FFZ.settings_info.show_badges = {
	type: "boolean",
	value: true,

	category: "Chat",
	name: "Additional Badges",
	help: "Show additional badges for bots, FrankerFaceZ donors, and other special users."
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_badges = function() {
	this.log("Preparing badge system.");
	this.badges = {};

	this.log("Creating badge style element.");
	var s = this._badge_style = document.createElement('style');
	s.id = "ffz-badge-css";
	document.head.appendChild(s);

	this.log("Adding legacy donor badges.");
	this._legacy_add_donors();
}


// --------------------
// Reloading Badges
// --------------------

FFZ.ws_commands.reload_badges = function() {
	this._legacy_load_bots();
	this._legacy_load_donors();
}


FFZ.ws_commands.set_badge = function(data) {
	var user_id = data[0],
		slot = data[1],
		badge = data[2],

		user = this.users[user_id] = this.users[user_id] || {},
		badges = user.badges = user.badges || {};

	if ( badge === undefined )
		delete badges[slot];
	else
		badges[slot] = badge;
}


// --------------------
// Badge CSS
// --------------------

var badge_css = function(badge) {
	return ".badges .ffz-badge-" + badge.id + " { background-color: " + badge.color + '; background-image: url("' + badge.image + '"); ' + (badge.extra_css || "") + '}';
}


// --------------------
// Render Badge
// --------------------

FFZ.prototype.bttv_badges = function(data) {
	if ( ! this.settings.show_badges )
		return;

	var user_id = data.sender,
		user = this.users[user_id],
		badges_out = [],
		insert_at = -1,
		alpha = BetterTTV.settings.get('alphaTags');

	if ( ! user || ! user.badges )
		return;

	// Determine where in the list to insert these badges.
	for(var i=0; i < data.badges.length; i++) {
		var badge = data.badges[i];
		if ( badge.type == "subscriber" || badge.type == "turbo" ) {
			insert_at = i;
			break;
		}
	}

	for (var slot in user.badges) {
		if ( ! user.badges.hasOwnProperty(slot) )
			continue;

		var badge = user.badges[slot],
			full_badge = this.badges[badge.id] || {},
			desc = badge.title || full_badge.title,
			style = "";

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible == "function" )
				visible = visible.bind(this)(null, user_id);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var replaced = false;
			for(var i=0; i < data.badges.length; i++) {
				var b = data.badges[i];
				if ( b.type == full_badge.replaces ) {
					b.type = "ffz-badge-replacement " + b.type;
					b.description += ", " + (badge.title || full_badge.title) +
						'" style="background-image: url(&quot;' + (badge.image || full_badge.image) + "&quot;)";
					replaced = true;
					break;
				}
			}

			if ( replaced )
				continue;
		}

		if ( badge.image )
			style += 'background-image: url(&quot;' + badge.image + '&quot;); ';

		if ( badge.color && ! alpha )
			style += 'background-color: ' + badge.color + '; ';

		if ( badge.extra_css )
			style += badge.extra_css;

		if ( style )
			desc += '" style="' + style;

		badges_out.push([(insert_at == -1 ? 1 : -1) * slot, {type: "ffz-badge-" + badge.id + (alpha ? " alpha" : ""), name: "", description: desc}]);
	}

	badges_out.sort(function(a,b){return a[0] - b[0]});

	if ( insert_at == -1 ) {
		while(badges_out.length)
			data.badges.push(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			data.badges.insertAt(insert_at, badges_out.shift()[1]);
	}
}


FFZ.prototype.render_badge = function(component) {
	if ( ! this.settings.show_badges )
		return;

	var user = component.get('msgObject.from'),
		room_id = App.__container__.lookup('controller:chat').get('currentRoom.id'),
		badges = component.$('.badges');

	var data = this.users[user];
	if ( ! data || ! data.badges )
		return;

	// If we don't have badges, add them.
	if ( ! badges.length ) {
		var b_cont = document.createElement('span'),
			from = component.$('.from');

		b_cont.className = 'badges float-left';

		if ( ! from )
			return;

		from.before(b_cont);
		badges = $(b_cont);
	}

	// Figure out where to place our badge(s).
	var before = badges.find('.badge').filter(function(i) {
		var t = this.title.toLowerCase();
		return t == "subscriber" || t == "turbo";
	}).first();

	var badges_out = [], reverse = !(!before.length);
	for ( var slot in data.badges ) {
		if ( ! data.badges.hasOwnProperty(slot) )
			continue;

		var badge = data.badges[slot],
			full_badge = this.badges[badge.id] || {};

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible == "function" )
				visible = visible.bind(this)(room_id, user);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var el = badges[0].querySelector('.badge.' + full_badge.replaces);
			if ( el ) {
				el.style.backgroundImage = 'url("' + (badge.image || full_badge.image) + '")';
				el.classList.add("ffz-badge-replacement");
				el.title += ", " + (badge.title || full_badge.title);
				continue;
			}
		}

		var el = document.createElement('div');
		el.className = 'badge float-left tooltip ffz-badge-' + badge.id;
		el.setAttribute('title', badge.title || full_badge.title);

		if ( badge.image )
			el.style.backgroundImage = 'url("' + badge.image + '")';

		if ( badge.color )
			el.style.backgroundColor = badge.color;

		if ( badge.extra_css )
			el.style.cssText += badge.extra_css;

		badges_out.push([((reverse ? 1 : -1) * slot), el]);
	}

	badges_out.sort(function(a,b){return a[0] - b[0]});

	if ( reverse ) {
		while(badges_out.length)
			badges.before(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			badges.append(badges_out.shift()[1]);
	}
}


// --------------------
// Legacy Support
// --------------------

FFZ.bttv_known_bots = ["nightbot","moobot","sourbot","xanbot","manabot","mtgbot","ackbot","baconrobot","tardisbot","deejbot","valuebot","stahpbot"];


FFZ.prototype._legacy_add_donors = function() {
	// Developer Badge
	this.badges[0] = {id: 0, title: "FFZ Developer", color: "#FAAF19", image: "//cdn.frankerfacez.com/script/devicon.png"};
	utils.update_css(this._badge_style, 0, badge_css(this.badges[0]));

	// Donor Badge
	this.badges[1] = {id: 1, title: "FFZ Donor", color: "#755000", image: "//cdn.frankerfacez.com/script/donoricon.png"};
	utils.update_css(this._badge_style, 1, badge_css(this.badges[1]));

	// Bot Badge
	this.badges[2] = {id: 2, title: "Bot", color: "#595959", image: "//cdn.frankerfacez.com/script/boticon.png",
		replaces: 'moderator',
		visible: function(r,user) { return !(this.has_bttv && FFZ.bttv_known_bots.indexOf(user)!==-1); }};
	utils.update_css(this._badge_style, 2, badge_css(this.badges[2]));

	// Load BTTV Bots
	for(var i=0; i < FFZ.bttv_known_bots.length; i++) {
		var name = FFZ.bttv_known_bots[i],
			user = this.users[name] = this.users[name] || {},
			badges = user.badges = user.badges || {};

		if ( ! badges[0] )
			badges[0] = {id:2};
	}

	// Special Badges
	this.users.sirstendec = {badges: {1: {id:0}}, sets: [4330]};
	this.users.zenwan = {badges: {0: {id:2, image: "//cdn.frankerfacez.com/script/momiglee_badge.png", title: "WAN"}}};

	this._legacy_load_bots();
	this._legacy_load_donors();
}

FFZ.prototype._legacy_load_bots = function(tries) {
	jQuery.ajax(constants.SERVER + "script/bots.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_badges(data, 0, 2);

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				this._legacy_load_bots(tries);
		});
}

FFZ.prototype._legacy_load_donors = function(tries) {
	jQuery.ajax(constants.SERVER + "script/donors.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_badges(data, 1, 1);

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return this._legacy_load_donors(tries);
		});
}


FFZ.prototype._legacy_parse_badges = function(data, slot, badge_id) {
	var title = this.badges[badge_id].title,
		count = 0;
		ds = null;

	if ( data != null ) {
		var lines = data.trim().split(/\W+/);
		for(var i=0; i < lines.length; i++) {
			var user_id = lines[i],
				user = this.users[user_id] = this.users[user_id] || {},
				badges = user.badges = user.badges || {},
				sets = user.sets = user.sets || [];

			if ( ds !== null && sets.indexOf(ds) === -1 )
				sets.push(ds);

			if ( badges[slot] )
				continue;

			badges[slot] = {id:badge_id};
			count += 1;
		}
	}

	this.log('Added "' + title + '" badge to ' + utils.number_commas(count) + " users.");
}