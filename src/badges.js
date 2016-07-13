var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils'),

	SPECIAL_BADGES = ['staff', 'admin', 'global_mod'],
	OTHER_KNOWN = ['turbo', 'warcraft', 'bits'],

	NO_INVERT_BADGES = ['subscriber', 'ffz-badge-1'],
	INVERT_INVERT_BADGES = ['bits'],
	TRANSPARENT_BADGES = ['subscriber'],

	BTTV_TYPE_REPLACEMENTS = {
		'global-moderator': 'global_mod'
	},

	BADGE_POSITIONS = {
		'broadcaster': 0,
		'staff': 0,
		'admin': 0,
		'global_mod': 0,
		'mod': 1,
		'moderator': 1,
		'subscriber': 10,
	},

	BADGE_NAMES = {
		'global_mod': 'Global Moderator'
	},

	BADGE_KLASSES = {
		'global_mod': 'global-moderator'
	};


// --------------------
// Settings
// --------------------

FFZ.settings_info.show_badges = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	name: "Additional Badges",
	help: "Show additional badges for bots, FrankerFaceZ donors, and other special users."
};


FFZ.settings_info.hidden_badges = {
	type: "button",
	value: [],

	category: "Chat Appearance",
	name: "Hidden Badges",
	help: "Any badges added to this list will not be displayed in chat.",

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		var controller = utils.ember_lookup('controller:chat'),
			messages = controller && controller.get('currentRoom.messages');

		if ( ! messages )
			return;

		for(var i=0; i < messages.length; i++)
			messages[i]._line && messages[i]._line.ffzUpdateBadges();
	},

	method: function() {
		var f = this,
			service = utils.ember_lookup('service:badges'),
			badgeCollection = service && service.badgeCollection,
			old_val = f.settings.hidden_badges.join(", "),
			values = [];

		if ( badgeCollection ) {
			if ( badgeCollection.global )
				for(var badge in badgeCollection.global)
					if ( badgeCollection.global.hasOwnProperty(badge) && badge !== 'broadcasterName' )
						values.push('<code>' + badge + '</code>');

			if ( badgeCollection.channel )
				for(var badge in badgeCollection.channel)
					if ( badgeCollection.channel.hasOwnProperty(badge) && badge !== 'broadcasterName' )
						values.push('<code>' + badge + '</code>');
		}

		for(var badge_id in f.badges) {
			if ( ! f.badges.hasOwnProperty(badge_id) )
				continue;

			var badge = f.badges[badge_id],
				hide_key = (badge.source_ext ? f._apis[badge.source_ext].name_key : 'ffz') + '-' + (badge.name || badge.id);

			values.push('<code>' + hide_key + '</code>');
		}

		if ( this.has_bttv && window.BetterTTV ) {
			try {
				for(var badge_id in BetterTTV.chat.store.__badgeTypes)
					values.push('<code>bttv-' + badge_id + '</code>');

				values.push('<code>bot</code>');

			} catch(err) {
				this.error("Unable to load known BetterTTV badges.", err);
			}
		}

		utils.prompt(
			"Hidden Badges",
			"Please enter a comma-separated list of badges that you would like to be hidden in chat.</p><p><b>Possible Values:</b> " + _.unique(values).join(", "),
			old_val,
			function(new_val) {
				if ( new_val === null || new_val === undefined )
					return;

				f.settings.set("hidden_badges", _.unique(new_val.trim().toLowerCase().split(/\s*,\s*/)));
			}, 600
		)
	}
};


FFZ.settings_info.sub_notice_badges = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	name: "Old-Style Subscriber Notice Badges",
	no_bttv: true,

    help: "Display a subscriber badge on old-style chat messages about new subscribers.",

    on_update: function(val) {
		this.toggle_style('badges-sub-notice', ! this.has_bttv && ! val);
		this.toggle_style('badges-sub-notice-on', ! this.has_bttv && val);
	}
};


FFZ.settings_info.legacy_badges = {
	type: "select",
	options: {
		0: "Default",
		1: "Moderator Only",
		2: "Mod + Turbo",
		3: "All Legacy Badges"
	},
	value: 0,

	category: "Chat Appearance",

	name: "Legacy Badges",
	help: "Use the old, pre-vector chat badges from Twitch in place of the new.",

	process_value: function(val) {
		if ( val === false )
			return 0;
		else if ( val === true )
			return 3;
		else if ( typeof val === "string" )
			return parseInt(val || "0");
		return val;
	},

	on_update: function(val) {
		this.toggle_style('badges-legacy', val === 3);
		this.toggle_style('badges-legacy-mod', val !== 0);
		this.toggle_style('badges-legacy-turbo', val > 1);
	}
};


FFZ.settings_info.transparent_badges = {
	type: "select",
	options: {
		0: "Default",
		1: "Rounded",
		2: "Circular",
		3: "Circular (Color Only)",
		4: "Circular (Color Only, Small)",
		5: "Transparent"
	},

	value: 0,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Badge Style",
	help: "Make badges appear rounded, completely circular, or transparent with no background at all.",

	process_value: function(val) {
		if ( val === false )
			return 0;
		else if ( val === true )
			return 5;
		else if ( typeof val === "string" )
			return parseInt(val || "0");
		return val;
	},

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		this.toggle_style('badges-rounded', val === 1);
		this.toggle_style('badges-circular', val === 2 || val === 3 || val === 4);
		this.toggle_style('badges-blank', val === 3 || val === 4);
		this.toggle_style('badges-circular-small', val === 4);
		this.toggle_style('badges-transparent', val === 5);
		document.body.classList.toggle('ffz-transparent-badges', val === 5);
	}
};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_badges = function() {
	if ( ! this.has_bttv ) {
		var val = this.settings.transparent_badges;
		this.toggle_style('badges-rounded', val === 1);
		this.toggle_style('badges-circular', val === 2 || val === 3 || val === 4);
		this.toggle_style('badges-blank', val === 3 || val === 4);
		this.toggle_style('badges-circular-small', val === 4);
		this.toggle_style('badges-transparent', val === 5);
		document.body.classList.toggle('ffz-transparent-badges', val === 5);

        this.toggle_style('badges-sub-notice', ! this.settings.sub_notice_badges);
        this.toggle_style('badges-sub-notice-on', this.settings.sub_notice_badges);
	}

	this.toggle_style('badges-legacy', this.settings.legacy_badges === 3);
	this.toggle_style('badges-legacy-mod', this.settings.legacy_badges !== 0);
	this.toggle_style('badges-legacy-turbo', this.settings.legacy_badges > 1);

	this.log("Preparing badge system.");
	this.badges = {};

	this.log("Creating badge style element.");
	var s = this._badge_style = document.createElement('style');
	s.id = "ffz-badge-css";
	document.head.appendChild(s);

	this.log("Loading badges.");
	this.load_badges();
	//this.log("Adding legacy donor badges.");
	//this._legacy_add_donors();
}


// --------------------
// Reloading Badges
// --------------------

FFZ.ws_commands.reload_badges = function() {
	this.load_badges();
}


FFZ.ws_commands.set_badge = function(data) {
	var user_id = data[0],
		slot = data[1],
		badge = data[2],

		user = this.users[user_id] = this.users[user_id] || {},
		badges = user.badges = user.badges || {};

	if ( badge === undefined || badge === null )
		badges[slot] = null;
	else
		badges[slot] = badge;
}


// --------------------
// Badge Selection
// --------------------

FFZ.prototype.get_badges = function(user, room_id, badges, msg) {
	var data = this.users[user],
		hidden_badges = this.settings.hidden_badges;

	if ( ! data || ! data.badges || ! this.settings.show_badges )
		return badges;

	for(var slot in data.badges) {
		var badge = data.badges[slot];
		if ( ! data.badges.hasOwnProperty(slot) || ! badge )
			continue;

		var full_badge = this.badges[badge.id] || {},
			old_badge = badges[slot],

			hide_key = (full_badge.source_ext ? this._apis[full_badge.source_ext].name_key : 'ffz') + '-' + (full_badge.name || full_badge.id);

		if ( hidden_badges.indexOf(hide_key) !== -1 )
			continue;

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible === "function" )
				visible = visible.call(this, room_id, user, msg, badges);

			if ( ! visible )
				continue;
		}

		if ( old_badge ) {
			var replaces = badge.hasOwnProperty('replaces') ? badge.replaces : full_badge.replaces;
			if ( ! replaces )
				continue;

			old_badge.image = badge.image || full_badge.image;
			old_badge.klass += ' ffz-badge-replacement';
			old_badge.title += ', ' + (badge.title || full_badge.title);
			continue;
		}

		badges[slot] = {
			klass: 'ffz-badge-' + badge.id,
			title: badge.title || full_badge.title || ('Unknown FFZ Badge\nID: ' + badge.id),
			image: badge.image,
			full_image: full_badge.image,
			color: badge.color,
			no_invert: badge.no_invert || full_badge.no_invert,
			invert_invert: badge.invert_invert || full_badge.invert_invert,
			transparent: badge.transparent || full_badge.transparent || (badge.color || full_badge.color) === "transparent",
			extra_css: badge.extra_css
		};
	}

	return badges;
}


FFZ.prototype.get_line_badges = function(msg) {
	var badges = {},
		hidden_badges = this.settings.hidden_badges,

		last_id = -1,
		had_last = false,
        room = msg.get && msg.get('room') || msg.room,
        from = msg.get && msg.get('from') || msg.from,
        tags = msg.get && msg.get('tags') || msg.tags || {},
		badge_tag = tags.badges || {},

		service = utils.ember_lookup('service:badges'),
		badgeCollection = service && service.badgeCollection,

		globals = badgeCollection && badgeCollection.global || {},
		channel = badgeCollection && badgeCollection.channel || {};

	// Whisper Chat Lines have a non-associative array for some reason.
	if ( Array.isArray(badge_tag) ) {
		var val = badge_tag;
		badge_tag = {};
		for(var i=0; i < val.length; i++)
			badge_tag[val[i].id] = val[i].version;
	}

	// VoD Chat lines don't have the badges pre-parsed for some reason.
	else if ( typeof badge_tag === 'string' ) {
		var val = badge_tag.split(',');
		badge_tag = {};
		for(var i=0; i < val.length; i++) {
			var parts = val[i].split('/');
			if ( parts.length === 2 )
				badge_tag[parts[0]] = parts[1];
		}
	}

	for(var badge in badge_tag) {
		var version = badge_tag[badge];
		if ( ! badge_tag.hasOwnProperty(badge) || ! version )
			continue;

		var versions = channel[badge] || globals[badge],
			binfo = versions && versions.versions && versions.versions[version];

		if ( hidden_badges.indexOf(badge) !== -1 )
			continue;

		if ( BADGE_POSITIONS.hasOwnProperty(badge) )
			last_id = BADGE_POSITIONS[badge];
		else {
			last_id = had_last ? last_id + 1 : 15;
			had_last = true;
		}

		var is_known = BADGE_POSITIONS.hasOwnProperty(badge) || OTHER_KNOWN.indexOf(badge) !== -1;

		badges[last_id] = {
			klass: (BADGE_KLASSES[badge] || badge) + (is_known ? '' : ' unknown-badge') + ' version-' + version,
			title: binfo && binfo.title || BADGE_NAMES[badge] || badge.capitalize(),
			click_url: binfo && binfo.click_action === 'visit_url' && binfo.click_url,
			no_invert: NO_INVERT_BADGES.indexOf(badge) !== -1,
			invert_invert: INVERT_INVERT_BADGES.indexOf(badge) !== -1,
			transparent: TRANSPARENT_BADGES.indexOf(badge) !== -1
		};

		if ( ! is_known && binfo ) {
			badges[last_id].image = binfo.image_url_1x;
			badges[last_id].srcSet = 'url("' + binfo.image_url_1x + '") 1x, url("' + binfo.image_url_2x + '") 2x, url("' + binfo.image_url_4x + '") 4x';
		}
	}

	// FFZ Badges
	return this.get_badges(from, room, badges, msg);
}


FFZ.prototype.get_other_badges = function(user_id, room_id, user_type, has_sub, has_turbo) {
	var badges = {};

	if ( room_id && user_id === room_id )
		badges[0] = {klass: 'broadcaster', title: 'Broadcaster'};
	else
		for(var i=0, l = SPECIAL_BADGES.length; i < l; i++) {
			var mb = SPECIAL_BADGES[i];
			if ( user_type === mb ) {
				badges[0] = {klass: BADGE_KLASSES[mb] || mb, title: BADGE_NAMES[mb] || mb.capitalize()};
				break;
			}
		}

	if ( has_sub )
		badges[10] = {klass: 'subscriber', title: 'Subscriber', no_invert: true, transparent: true}
	if ( has_turbo )
		badges[15] = {klass: 'turbo', title: 'Turbo'}

	return this.get_badges(user_id, room_id, badges, null);
}


// --------------------
// Render Badge
// --------------------

FFZ.prototype.render_badges = function(badges) {
	var out = [];
	for(var key in badges) {
		var badge = badges[key],
			klass = badge.klass,
			css = badge.image ? 'background-image:url("' + utils.quote_attr(badge.image) + '");' : '';

		if ( badge.srcSet )
			css += 'background-image:-webkit-image-set(' + badge.srcSet + ');background-image:image-set(' + badge.srcSet + ');'

		if ( badge.color )
			css += 'background-color:' + badge.color + ';'

		if ( badge.extra_css )
			css += badge.extra_css;

		if ( badge.click_url )
			klass += ' click_url';

		if ( badge.no_invert )
			klass += ' no-invert';

		if ( badge.invert_invert )
			klass += ' invert-invert';

		if ( badge.transparent )
			klass += ' transparent';

		out.push('<div class="badge html-tooltip ' + utils.quote_attr(klass) + '"' + (badge.click_url ? ' data-url="' + utils.quote_attr(badge.click_url) + '"' : '') + (css ? ' style="' + utils.quote_attr(css) + '"' : '') + ' title="' + utils.quote_attr(badge.title) + '"></div>');
	}

	return out.join("");
}


// --------------------
// Extension Support
// --------------------

FFZ.prototype.bttv_badges = function(data) {
	if ( ! this.settings.show_badges )
		return;

	var user_id = data.sender,
		user = this.users[user_id],
		badges_out = [],
		insert_at = -1,

		hidden_badges = this.settings.hidden_badges,
		alpha = BetterTTV.settings.get('alphaTags');


	if ( ! data.badges )
		data.badges = [];

	// Determine where in the list to insert these badges.
	// Also, strip out banned badges while we're at it.
	for(var i=0; i < data.badges.length; i++) {
		var badge = data.badges[i],
			space_ind = badge.type.indexOf(' '),
			hidden_key = space_ind !== -1 ? badge.type.substr(0, space_ind) : badge.type;

		if ( hidden_key.indexOf('twitch-') === 0 )
			hidden_key = hidden_key.substr(7);

		if ( BTTV_TYPE_REPLACEMENTS.hasOwnProperty(hidden_key) )
			hidden_key = BTTV_TYPE_REPLACEMENTS[hidden_key];
		else {
			var ind = hidden_key.indexOf('-');
			if ( ind !== -1 )
				hidden_key = hidden_key.substr(0, ind);
		}

		if ( hidden_badges.indexOf(hidden_key) !== -1 ) {
			data.badges.splice(i, 1);
			i--;
			continue;
		}

		if ( insert_at === -1 && (badge.type === "subscriber" || badge.type === "turbo" || badge.type.substr(0, 7) === 'twitch-') )
			insert_at = i;
	}

	// If there's no user, we're done now.
	if ( ! user || ! user.badges )
		return;


	// We have a user. Start replacing badges.
	for (var slot in user.badges) {
		var badge = user.badges[slot];
		if ( ! user.badges.hasOwnProperty(slot) || ! badge )
			continue;

		var full_badge = this.badges[badge.id] || {},
			desc = badge.title || full_badge.title,
			style = "",

			hide_key = (full_badge.source_ext ? this._apis[full_badge.source_ext].name_key : 'ffz') + '-' + (full_badge.name || full_badge.id);

		if ( hidden_badges.indexOf(hide_key) !== -1 )
			continue;

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible === "function" )
				visible = visible.call(this, null, user_id);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var replaced = false;
			for(var i=0; i < data.badges.length; i++) {
				var b = data.badges[i];
				if ( b.type === full_badge.replaces_type ) {
					b.type = "ffz-badge-replacement " + b.type;
					b.description += ", " + (badge.title || full_badge.title) +
						'" style="background-image: url(' + utils.quote_attr('"' + (badge.image || full_badge.image) + '"') + ')';
					replaced = true;
					break;
				}
			}

			if ( replaced )
				continue;
		}

		if ( alpha && badge.transparent_image )
			style += 'background-image: url("' + badge.transparent_image + '");';
		else if ( badge.image )
			style += 'background-image: url("' + badge.image + '");';

		if ( badge.color && ! alpha )
			style += 'background-color: ' + badge.color + '; ';

		if ( badge.extra_css )
			style += badge.extra_css;

		if ( style )
			desc += '" style="' + utils.quote_attr(style);

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


// --------------------
// Badge Loading
// --------------------

FFZ.bttv_known_bots = ["nightbot","moobot","sourbot","xanbot","manabot","mtgbot","ackbot","baconrobot","tardisbot","deejbot","valuebot","stahpbot"];

FFZ.prototype.load_badges = function(callback, tries) {
	var f = this;
	jQuery.getJSON(constants.API_SERVER + "v1/badges")
		.done(function(data) {
			var badge_total = 0,
				badge_count = 0,
				badge_data = {};

			for(var i=0; i < data.badges.length; i++) {
				var badge = data.badges[i];
				if ( badge && badge.name ) {
					f._load_badge_json(badge.id, badge);
					badge_total++;
				}
			}

			if ( data.users )
				for(var badge_id in data.users)
					if ( data.users.hasOwnProperty(badge_id) && f.badges[badge_id] ) {
						var badge = f.badges[badge_id],
							users = data.users[badge_id];

						badge_data[badge.name] = users.length;

						for(var i=0; i < users.length; i++) {
							var user = users[i],
								ud = f.users[user] = f.users[user] || {},
								badges = ud.badges = ud.badges || {};

							badge_count++;
							badges[badge.slot] = {id: badge.id};
						}

						f.log('Added "' + badge.name + '" badge to ' + utils.number_commas(users.length) + ' users.');
					}

			// Special Badges
			var zw = f.users.zenwan = f.users.zenwan || {},
				badges = zw.badges = zw.badges || {};
			if ( ! badges[1] )
				badge_count++;
			badges[1] = {id: 2, image: "//cdn.frankerfacez.com/script/momiglee_badge.png", title: "WAN"};


			f.log("Loaded " + utils.number_commas(badge_count) + " total badges across " + badge_total + " types.");
			typeof callback === "function" && callback(true, badge_count, badge_total, badge_data);

		}).fail(function(data) {
			if ( data.status === 404 )
				return typeof callback === "function" && callback(false);

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return setTimeout(f.load_badges.bind(f, callback, tries), 500 + 500*tries);

			f.error("Unable to load badge data. [HTTP Status " + data.status + "]", data);
			typeof callback === "function" && callback(false);
		});
}


FFZ.prototype._load_badge_json = function(badge_id, data) {
	this.badges[badge_id] = data;
	if ( data.replaces ) {
		data.replaces_type = data.replaces;
		data.replaces = true;
	}

	if ( data.name === 'developer' )
		data.no_invert = true;

	if ( data.name === 'bot' )
		data.visible = function(r,user) { return !(this.has_bttv && FFZ.bttv_known_bots.indexOf(user)!==-1); };

	utils.update_css(this._badge_style, badge_id, utils.badge_css(data));
}



// --------------------
// Legacy Support
// --------------------

/*FFZ.prototype._legacy_add_donors = function() {
	// Developer Badge
	this.badges[0] = {id: 0, title: "FFZ Developer", color: "#FAAF19", image: "//cdn.frankerfacez.com/script/devicon.png", transparent_image: "//cdn.frankerfacez.com/script/devtransicon.png"};
	utils.update_css(this._badge_style, 0, badge_css(this.badges[0]));

	// Donor Badge
	this.badges[1] = {id: 1, title: "FFZ Donor", color: "#755000", image: "//cdn.frankerfacez.com/script/devicon.png"};
	utils.update_css(this._badge_style, 1, badge_css(this.badges[1]));

	// Bot Badge
	this.badges[2] = {id: 2, title: "Bot", color: "#595959", image: "//cdn.frankerfacez.com/script/boticon.png",
		replaces: true, replaces_type: "moderator",
		visible: function(r,user) { return !(this.has_bttv && FFZ.bttv_known_bots.indexOf(user)!==-1); }};

	utils.update_css(this._badge_style, 2, badge_css(this.badges[2]));

	// Load BTTV Bots
	for(var i=0; i < FFZ.bttv_known_bots.length; i++) {
		var name = FFZ.bttv_known_bots[i],
			user = this.users[name] = this.users[name] || {},
			badges = user.badges = user.badges || {};

		if ( ! badges[0] )
			badges[1] = {id:2};
	}

	// Special Badges
	this.users.sirstendec = {badges: {5: {id:0}}, sets: [4330]};
	this.users.zenwan = {badges: {1: {id:2, image: "//cdn.frankerfacez.com/script/momiglee_badge.png", title: "WAN"}}};

	this._legacy_load_bots();
	this._legacy_load_donors();
}

FFZ.prototype._legacy_load_bots = function(callback, tries) {
	jQuery.ajax(constants.SERVER + "script/bots.txt", {context: this})
		.done(function(data) {
			this._legacy_parse_badges(callback, data, 1, 2, "Bot (By: {})");

		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback === "function" && callback(false, 0);

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				this._legacy_load_bots(callback, tries);
		});
}

FFZ.prototype._legacy_load_donors = function(callback, tries) {
	jQuery.ajax(constants.SERVER + "script/donors.txt", {context: this})
		.done(function(data) {
			this._legacy_parse_badges(callback, data, 5, 1);

		}).fail(function(data) {
			if ( data.status == 404 )
				return typeof callback === "function" && callback(false, 0);

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return this._legacy_load_donors(callback, tries);
		});
}


FFZ.prototype._legacy_parse_badges = function(callback, data, slot, badge_id, title_template) {
	var title = this.badges[badge_id].title,
		count = 0,
		ds = null;

	title_template = title_template || '{}';

	if ( data != null ) {
		var lines = data.trim().split(/[ \t\n\r]+/);
		for(var i=0; i < lines.length; i++) {
			if ( ! /^\w/.test(lines[i]) )
				continue;

			var line_data = lines[i].split(";"),
				user_id = line_data[0],
				user = this.users[user_id] = this.users[user_id] || {},
				badges = user.badges = user.badges || {},
				sets = user.sets = user.sets || [];

			if ( ds !== null && sets.indexOf(ds) === -1 )
				sets.push(ds);

			if ( badges[slot] )
				continue;

			badges[slot] = {id: badge_id};
			if ( line_data.length > 1 )
				badges[slot].title = title_template.replace('{}', line_data[1]);
			count += 1;
		}
	}

	this.log('Added "' + title + '" badge to ' + utils.number_commas(count) + " users.");
	if ( callback )
		callback(true, count);

	return count;
}*/