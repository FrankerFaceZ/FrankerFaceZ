var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	utils = require('./utils');


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
// Badge CSS
// --------------------

var badge_css = function(badge) {
	return ".badges .ffz-badge-" + badge.id + " { background-color: " + badge.color + '; background-image: url("' + badge.image + '"); ' + (badge.extra_css || "") + '}';
}


// --------------------
// Render Badge
// --------------------

FFZ.prototype.render_badge = function(view) {
	var user = view.get('context.model.from'),
		room_id = view.get('context.parentController.content.id'),
		badges = view.$('.badges');

	var data = this.users[user];
	if ( ! data || ! data.badges )
		return;

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
			before.before(badges_out.shift()[1]);
	} else {
		while(badges_out.length)
			badges.append(badges_out.shift()[1]);
	}
}


// --------------------
// Legacy Support
// --------------------

FFZ.prototype._legacy_add_donors = function(tries) {
	this.badges[1] = {id: 1, title: "FFZ Donor", color: "#755000", image: "http://cdn.frankerfacez.com/channel/global/donoricon.png"};
	utils.update_css(this._badge_style, 1, badge_css(this.badges[1]));

	// Developer Badges
	// TODO: Upload the badge to the proper CDN.
	this.badges[0] = {id: 0, title: "FFZ Developer", color: "#FAAF19", image: "http://sir.stendec.me/devicon.png"};
	utils.update_css(this._badge_style, 0, badge_css(this.badges[0]));
	this.users.sirstendec = {badges: {0: {id:0}}};

	jQuery.ajax(constants.SERVER + "script/donors.txt", {cache: false, context: this})
		.done(function(data) {
			this._legacy_parse_donors(data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return;

			tries = (tries || 0) + 1;
			if ( tries < 10 )
				return this._legacy_add_donors(tries);
		});
}


FFZ.prototype._legacy_parse_donors = function(data) {
	var count = 0;
	if ( data != null ) {
		var lines = data.trim().split(/\W+/);
		for(var i=0; i < lines.length; i++) {
			var user_id = lines[i],
				user = this.users[user_id] = this.users[user_id] || {},
				badges = user.badges = user.badges || {};

			if ( badges[0] )
				continue;

			badges[0] = {id:1};
			count += 1;
		}
	}

	this.log("Added donor badge to " + utils.number_commas(count) + " users.");
}