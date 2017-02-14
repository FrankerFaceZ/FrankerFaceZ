var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils'),

	SPECIAL_BADGES = ['staff', 'admin', 'global_mod'],
	OTHER_KNOWN = ['turbo', 'bits', 'premium'],

	CSS_BADGES = {
		staff: { 1: { color: "#200f33", use_svg: true } },
		admin: { 1: { color: "#faaf19", use_svg: true  } },
		global_mod: { 1: { color: "#0c6f20", use_svg: true } },
		broadcaster: { 1: { color: "#e71818", use_svg: true } },
		moderator: { 1: { color: "#34ae0a", use_svg: true } },
		twitchbot: { 1: { color: "#34ae0a" } },

		turbo: { 1: { color: "#6441a5", use_svg: true } },
		premium: { 1: { color: "#009cdc" } },

		bits: {
			1: { color: "#cbc8d0" },
			100: { color: "#ca7eff" },
			1000: { color: "#3ed8b3" },
			5000: { color: "#49acff" },
			10000: { color: "#ff271e" },
			25000: { color: "#f560ab" },
			50000: { color: "#ff881f" },
			75000: { color: "#16d03d" },
			100000: { color: "#ffcb13" },
			200000: { color: "#cbc8d0" },
			300000: { color: "#c97ffd" },
			400000: { color: "#3dd8b3" },
			500000: { color: "#48acfe" },
			600000: { color: "#ff281f" },
			700000: { color: "#f560ab" },
			800000: { color: "#ff881f" },
			900000: { color: "#16d03d" },
			1000000: { color: "#fecb11" }
		}
	},

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
		'twitchbot': 1,
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


FFZ.settings_info.loyalty_badges = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	name: "Display Subscriber Loyalty Badges",
	help: "Show different badge images for users that have been subscribed 3, 6, 12, and 24 months in supported channels.",

	on_update: function(val) {
		utils.toggle_cls('ffz-no-loyalty')(!val);
	}

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
					if ( badgeCollection.global.hasOwnProperty(badge) && badge !== 'broadcasterName' ) {
						var badge_data = badgeCollection.global[badge],
							version = Object.keys(badge_data.versions)[0];

						values.push([badge, f.render_badges(f.get_twitch_badges(badge + "/" + version))]);
					}

			if ( badgeCollection.channel )
				for(var badge in badgeCollection.channel)
					if ( badgeCollection.channel.hasOwnProperty(badge) && badge !== 'broadcasterName' ) {
						var badge_data = badgeCollection.channel[badge],
							version = Object.keys(badge_data.versions)[0];

						values.push([badge, f.render_badges(f.get_twitch_badges(badge + "/" + version))]);
					}
		}

		for(var badge_id in f.badges) {
			if ( ! f.badges.hasOwnProperty(badge_id) )
				continue;

			var badge = f.badges[badge_id],
				hide_key = (badge.source_ext ? f._apis[badge.source_ext].name_key : 'ffz') + '-' + (badge.name || badge.id),
				render_badge = {};

			render_badge[badge.slot] = f._get_badge_object({}, badge);
			values.push([hide_key, f.render_badges(render_badge)]);
		}

		if ( this.has_bttv && window.BetterTTV ) {
			try {
				for(var badge_id in BetterTTV.chat.store.__badgeTypes)
					values.push(['bttv-' + badge_id, null]);

				values.push(['bot', null]);

			} catch(err) {
				this.error("Unable to load known BetterTTV badges.", err);
			}
		}

		var already_used = [],
			output = [];

		for(var i=0; i < values.length; i++) {
			var badge = values[i];
			if ( already_used.indexOf(badge[0]) !== -1 )
				continue;

			already_used.push(badge[0]);
			output.push((badge[1] ? '<div class="ffz-hidden-badges badges">' + badge[1] + '</div>' : '') + '<code>' + badge[0] + '</code>');
		}

		utils.prompt(
			"Hidden Badges",
			"Please enter a comma-separated list of badges that you would like to be hidden in chat.</p><p><b>Possible Values:</b> " + output.join(", "),
			old_val,
			function(new_val) {
				if ( new_val === null || new_val === undefined )
					return;

				f.settings.set("hidden_badges", _.unique(new_val.trim().toLowerCase().split(/\s*,\s*/)).without(""));
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

	process_value: utils.process_int(0, 0, 3),

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
		5: "Transparent" //,
		//6: "Transparent (Colored)"
	},

	value: 0,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Badge Style",
	help: "Make badges appear rounded, completely circular, or transparent with no background at all.",

	process_value: utils.process_int(0, 0, 5),

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		this.toggle_style('badges-rounded', val === 1);
		this.toggle_style('badges-circular', val === 2 || val === 3 || val === 4);
		this.toggle_style('badges-blank', val === 3 || val === 4);
		this.toggle_style('badges-circular-small', val === 4);
		this.toggle_style('badges-transparent', val >= 5);
		document.body.classList.toggle('ffz-transparent-badges', val >= 5);

		// Update existing chat lines.
		var CL = utils.ember_resolve('component:chat/chat-line'),
			CW = utils.ember_resolve('component:twitch-conversations/conversation-window'),
			DP = utils.ember_resolve('component:chat/from-display-preview'),
			views = (CL || CW || DP) ? utils.ember_views() : [];

		for(var vid in views) {
			var view = views[vid];
			if ( CL && view instanceof CL && view.buildBadgesHTML )
				view.$('.badges').replaceWith(view.buildBadgesHTML());
			else if ( DP && view instanceof DP && view.ffzRenderBadges )
				view.ffzRenderBadges();
			else if ( CW && view instanceof CW && view.ffzReplaceBadges )
				view.ffzReplaceBadges();
		}
	}
};

// This requires -webkit-mask-image which isn't working in non-WebKit browsers.
if ( constants.IS_WEBKIT )
	FFZ.settings_info.transparent_badges.options[6] = "Transparent (Colored)";


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_badges = function() {
	this.log("Preparing badge system.");
	if ( ! this.has_bttv ) {
		var val = this.settings.transparent_badges;
		this.toggle_style('badges-rounded', val === 1);
		this.toggle_style('badges-circular', val === 2 || val === 3 || val === 4);
		this.toggle_style('badges-blank', val === 3 || val === 4);
		this.toggle_style('badges-circular-small', val === 4);
		this.toggle_style('badges-transparent', val >= 5);

		utils.toggle_cls('ffz-transparent-badges')(val >= 5);
		utils.toggle_cls('ffz-no-loyalty')(!this.settings.loyalty_badges);

		this.toggle_style('badges-sub-notice', ! this.settings.sub_notice_badges);
		this.toggle_style('badges-sub-notice-on', this.settings.sub_notice_badges);
	}

	this.toggle_style('badges-legacy', this.settings.legacy_badges === 3);
	this.toggle_style('badges-legacy-mod', this.settings.legacy_badges !== 0);
	this.toggle_style('badges-legacy-turbo', this.settings.legacy_badges > 1);

	this.log("Creating badge style element.");
	var s = this._badge_style = document.createElement('style');
	s.id = "ffz-badge-css";
	document.head.appendChild(s);

	this.log("Generating CSS for existing API badges.");
	for(var badge_id in this.badges)
		if ( this.badges.hasOwnProperty(badge_id) )
			utils.update_css(s, badge_id, utils.badge_css(this.badges[badge_id]));

	this.log("Generating CSS for existing Twitch badges.");
	for(var badge_id in CSS_BADGES) {
		var badge_data = CSS_BADGES[badge_id],
			klass = BADGE_KLASSES[badge_id] || badge_id;
		for(var version in badge_data)
			utils.update_css(s, 'twitch-' + badge_id + '-' + version, utils.cdn_badge_css(klass, version, badge_data[version]));
	}

	this.log("Loading badges.");
	this.load_badges();
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

	if ( typeof badge === "number" )
		badge = {id: badge};

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
		room = this.rooms[room_id],
		room_data = room && room.users && room.users[user],
		hidden_badges = this.settings.hidden_badges,
		badge_data = data && data.badges || {};

	if ( room_data && room_data.badges )
		badge_data = _.extend({}, badge_data, room_data.badges);

	if ( ! badge_data || ! this.settings.show_badges )
		return badges;

	for(var slot in badge_data) {
		var badge = badge_data[slot];
		if ( ! badge_data.hasOwnProperty(slot) || ! badge )
			continue;

		var badge_id = badge.real_id || badge.id,
			full_badge = this.badges[badge_id] || {},
			full_badge_id = full_badge.real_id || full_badge.id,
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

			old_badge.image = badge.image || null;
			old_badge.klass += ' ffz-badge-replacement ffz-replacer-ffz-badge-' + (badge_id || full_badge_id);
			old_badge.title += ', ' + (badge.title || full_badge.title);
			continue;
		}

		badges[slot] = this._get_badge_object(badge, full_badge);
	}

	return badges;
}

FFZ.prototype._get_badge_object = function(badge, full_badge) {
	var id = badge.real_id || badge.id || full_badge.real_id || full_badge.id;
	return {
		id: id,
		klass: 'ffz-badge-' + id,
		title: badge.title || full_badge.title || ('Unknown FFZ Badge\nID: ' + id),
		image: badge.image,
		full_image: full_badge.image,
		color: badge.color,
		no_tooltip: badge.no_tooltip || full_badge.no_tooltip,
		click_action: badge.click_action || full_badge.click_action,
		click_url: badge.click_url || full_badge.click_url,
		no_invert: badge.no_invert || full_badge.no_invert,
		no_color: badge.no_color || full_badge.no_color,
		invert_invert: badge.invert_invert || full_badge.invert_invert,
		transparent: badge.transparent || full_badge.transparent || (badge.color || full_badge.color) === "transparent",
		extra_css: (badge.extra_css || full_badge.extra_css)
	}
}


FFZ.prototype.get_line_badges = function(msg) {
	var room = msg.get && msg.get('room') || msg.room,
		from = msg.get && msg.get('from') || msg.from,
		tags = msg.get && msg.get('tags') || msg.tags || {},
		badge_tag = tags.badges || {};

	// Twitch Badges
	var badges = this.get_twitch_badges(badge_tag, room);

	// FFZ Badges
	return this.get_badges(from, room, badges, msg);
}


FFZ.prototype.get_twitch_badges = function(badge_tag, room_id) {
	var badges = {},
		hidden_badges = this.settings.hidden_badges,

		last_id = -1,
		had_last = false,

		service = utils.ember_lookup('service:badges'),
		badgeCollection = service && service.badgeCollection,

		globals = badgeCollection && badgeCollection.global || {},
		channel = badgeCollection && badgeCollection.channel || {};

	// Is this the right channel?
	if ( room_id && room_id !== channel.broadcasterName ) {
		var ffz_room = this.rooms && this.rooms[room_id];
		channel = ffz_room && ffz_room.badges || {};
	}

	// Whisper Chat Lines have a non-associative array for some reason.
	if ( Array.isArray(badge_tag) ) {
		var val = badge_tag;
		badge_tag = {};
		for(var i=0; i < val.length; i++)
			badge_tag[val[i].id] = val[i].version;
	}

	// VoD Chat lines don't have the badges pre-parsed for some reason.
	else if ( typeof badge_tag === 'string' )
		badge_tag = utils.parse_badge_tag(badge_tag);


	for(var badge in badge_tag) {
		var version = badge_tag[badge];
		if ( ! badge_tag.hasOwnProperty(badge) || version === undefined || version === null )
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
			no_invert: ! (versions && versions.allow_invert) && NO_INVERT_BADGES.indexOf(badge) !== -1,
			no_color: ! CSS_BADGES.hasOwnProperty(badge),
			invert_invert: (versions && versions.invert_invert) || INVERT_INVERT_BADGES.indexOf(badge) !== -1,
			transparent: TRANSPARENT_BADGES.indexOf(badge) !== -1
		};

		if ( ! is_known && binfo ) {
			badges[last_id].image = binfo.image_url_1x;
			if ( binfo.image_url_2x || binfo.image_url_4x )
				badges[last_id].srcSet = 'url("' + binfo.image_url_1x + '") 1x' + (binfo.image_url_2x ? ', url("' + binfo.image_url_2x + '") 2x' : '') + (binfo.image_url_4x ? ', url("' + binfo.image_url_4x + '") 4x' : '');
		}
	}

	return badges;
}


// --------------------
// Render Badge
// --------------------

FFZ.prototype.render_badges = function(badges) {
	var out = [],
		setting = this.settings.transparent_badges;

	for(var key in badges) {
		var badge = badges[key],
			klass = badge.klass,
			css = '',
			is_colored = !(badge.no_color !== undefined ? badge.no_color : badge.transparent);

		if ( badge.image )
			if ( is_colored && setting === 6 )
				css += (constants.IS_WEBKIT ? '-webkit-' : '') + 'mask-image:url("' + utils.quote_attr(badge.image) + '");';
			else
				css += 'background-image:url("' + utils.quote_attr(badge.image) + '");';

		if ( badge.srcSet )
			if ( is_colored && setting === 6 )
				css += (constants.IS_WEBKIT ? '-webkit-mask-image:-webkit-' : 'mask-image:') + 'image-set(' + badge.srcSet + ');';
			else
				css += 'background-image:' + (constants.IS_WEBKIT ? '-webkit-' : '') + 'image-set(' + badge.srcSet + ');';

		if ( badge.color )
			if ( is_colored && setting === 6 )
				css += 'background: linear-gradient(' + badge.color + ',' + badge.color + ');';
			else
				css += 'background-color:' + badge.color + ';'

		if ( badge.extra_css )
			css += badge.extra_css;

		if ( badge.click_url )
			klass += ' click_url';

		if ( badge.click_action )
			klass += ' click_action';

		if ( badge.no_invert )
			klass += ' no-invert';

		if ( badge.invert_invert )
			klass += ' invert-invert';

		if ( is_colored && setting === 6 )
			klass += ' colored';

		if ( badge.transparent )
			klass += ' transparent';

		out.push('<div class="badge ' + (badge.no_tooltip ? '' : 'html-tooltip ') + utils.quote_attr(klass) + '"' + (badge.id ? ' data-badge-id="' + badge.id + '"' : '') + (badge.click_url ? ' data-url="' + utils.quote_attr(badge.click_url) + '"' : '') + (css ? ' style="' + utils.quote_attr(css) + '"' : '') + ' title="' + utils.quote_attr(badge.title) + '"></div>');
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
		room = this.rooms[data.room],
		room_data = room && room.users && room.users[user_id],
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

	var badge_data = user && user.badges || {};
	if ( room_data && room_data.badges )
		badge_data = _.extend({}, badge_data, room_data.badges);

	// If there's no user, we're done now.
	if ( ! badge_data )
		return;

	// We have a user. Start replacing badges.
	for (var slot in badge_data) {
		var badge = badge_data[slot];
		if ( ! badge_data.hasOwnProperty(slot) || ! badge )
			continue;

		var badge_id = badge.real_id || badge.id,
			full_badge = this.badges[badge_id] || {},
			full_badge_id = full_badge.real_id || full_badge.id,
			desc = badge.title || full_badge.title,
			style = "",

			hide_key = (full_badge.source_ext ? this._apis[full_badge.source_ext].name_key : 'ffz') + '-' + (full_badge.name || full_badge.id);

		if ( hidden_badges.indexOf(hide_key) !== -1 )
			continue;

		if ( full_badge.visible !== undefined ) {
			var visible = full_badge.visible;
			if ( typeof visible === "function" )
				visible = visible.call(this, data.room, user_id);

			if ( ! visible )
				continue;
		}

		if ( full_badge.replaces ) {
			var replaced = false;
			for(var i=0; i < data.badges.length; i++) {
				var b = data.badges[i];
				if ( b.type === full_badge.replaces_type ) {
					b.type += " ffz-badge-replacement ffz-replacer-ffz-badge-" + (badge_id || full_badge_id);
					b.description += ", " + (badge.title || full_badge.title) +
						(badge.image ? '" style="background-image: url(' + utils.quote_attr('"' + badge.image + '"') + ')' : '');
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

		badges_out.push([(insert_at == -1 ? 1 : -1) * slot, {type: "ffz-badge-" + badge_id + (alpha ? " alpha" : ""), name: "", description: desc}]);
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

	if ( data.name === 'bot' )
		data.visible = function(r,user) { return !(this.has_bttv && FFZ.bttv_known_bots.indexOf(user)!==-1); };

	if ( data.name === 'developer' || data.name === 'supporter' )
		data.click_url = 'https://www.frankerfacez.com/donate';

	utils.update_css(this._badge_style, badge_id, utils.badge_css(data));
}