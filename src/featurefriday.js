var FFZ = window.FrankerFaceZ,
	constants = require('./constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.feature_friday = null;


// --------------------
// Check FF
// --------------------

FFZ.prototype.check_ff = function(tries) {
	if ( ! tries )
		this.log("Checking for Feature Friday data...");

	jQuery.ajax(constants.SERVER + "script/event.json", {cache: false, dataType: "json", context: this})
		.done(function(data) {
			return this._load_ff(data);
		}).fail(function(data) {
			if ( data.status == 404 )
				return this._load_ff(null);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return setTimeout(this.check_ff.bind(this, tries), 250);

			return this._load_ff(null);
		});
}


FFZ.ws_commands.reload_ff = function() {
	this.check_ff();
}


// --------------------
// Rendering UI
// --------------------

FFZ.prototype._feature_friday_ui = function(room_id, parent, view) {
	if ( ! this.feature_friday || this.feature_friday.channel == room_id )
		return;

	this._emotes_for_sets(parent, view, [this.feature_friday.set], "Feature Friday");

	// Before we add the button, make sure the channel isn't the
	// current channel.
	var Channel = App.__container__.lookup('controller:channel');
	if ( Channel && Channel.get('id') == this.feature_friday.channel )
		return;


	var ff = this.feature_friday, f = this,
		btnc = document.createElement('div'),
		btn = document.createElement('a');

	btnc.className = 'chat-menu-content';
	btnc.style.textAlign = 'center';

	var message = ff.display_name + (ff.live ? " is live now!" : "");

	btn.className = 'button primary';
	btn.classList.toggle('live', ff.live);
	btn.classList.toggle('blue', this.has_bttv && BetterTTV.settings.get('showBlueButtons'));

	btn.href = "http://www.twitch.tv/" + ff.channel;
	btn.title = message;
	btn.target = "_new";
	btn.innerHTML = "<span>" + message + "</span>";

	// Track the number of users to click this button.
	// btn.addEventListener('click', function() { f.track('trackLink', this.href, 'link'); });

	btnc.appendChild(btn);
	parent.appendChild(btnc);
}


// --------------------
// Loading Data
// --------------------

FFZ.prototype._load_ff = function(data) {
	// Check for previous Feature Friday data and remove it.
	if ( this.feature_friday ) {
		// Remove the global set, delete the data, and reset the UI link.
		this.global_sets.removeObject(this.feature_friday.set);

		var set = this.emote_sets[this.feature_friday.set];
		if ( set )
			set.global = false;

		this.feature_friday = null;
		this.update_ui_link();
	}

	// If there's no data, just leave.
	if ( ! data || ! data.set || ! data.channel )
		return;

	// We have our data! Set it up.
	this.feature_friday = {set: data.set, channel: data.channel, live: false,
			display_name: FFZ.get_capitalization(data.channel, this._update_ff_name.bind(this))};

	// Add the set.
	this.global_sets.push(data.set);
	this.load_set(data.set, this._update_ff_set.bind(this));

	// Check to see if the channel is live.
	this._update_ff_live();
}


FFZ.prototype._update_ff_live = function() {
	if ( ! this.feature_friday )
		return;

	var f = this;
	Twitch.api.get("streams/" + this.feature_friday.channel)
		.done(function(data) {
			f.feature_friday.live = data.stream != null;
			f.update_ui_link();
		})
		.always(function() {
			f.feature_friday.timer = setTimeout(f._update_ff_live.bind(f), 120000);
		});
}


FFZ.prototype._update_ff_set = function(success, set) {
	// Prevent the set from being unloaded.
	if ( set )
		set.global = true;
}


FFZ.prototype._update_ff_name = function(name) {
	if ( this.feature_friday )
		this.feature_friday.display_name = name;
}