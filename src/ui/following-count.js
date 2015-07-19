var FFZ = window.FrankerFaceZ,
	utils = require('../utils');



FFZ.settings_info.following_count = {
	type: "boolean",
	value: true,

	no_bttv: true,
	no_mobile: true,

	category: "Appearance",
	name: "Sidebar Following Count",
	help: "Display the number of live channels you're following on the sidebar.",

	on_update: function(val) {
			this._schedule_following_count();
			
			var Stream = window.App && App.__container__.resolve('model:stream'),
				Live = Stream && Stream.find("live");

			if ( Live )
				this._draw_following_count(Live.get('total') || 0);
			else
				this._update_following_count();
		}
	};

// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_following_count = function(has_ember) {
	// Start it updating.
	if ( this.settings.following_count )
		this._schedule_following_count();
	
	// If we don't have Ember, no point in trying this stuff.
	if ( ! has_ember )
		return this._update_following_count();

	this.log("Connecting to Live Streams model.");
	var Stream = window.App && App.__container__.resolve('model:stream');
	if ( ! Stream )
		return this.log("Unable to find Stream model.");

	var Live = Stream.find("live"),
		f = this;

	if ( ! Live )
		return this.log("Unable to find Live Streams collection.");

	Live.addObserver('total', function() { f._draw_following_count(this.get('total')); });
	Live.load();
	
	var total = Live.get('total');
	if ( typeof total === "number" )
		this._draw_following_count(total);
}


FFZ.prototype._schedule_following_count = function() {
	if ( this.has_bttv || ! this.settings.following_count ) {
		if ( this._following_count_timer ) {
			clearTimeout(this._following_count_timer);
			this._following_count_timer = undefined;
		}
		return;
	}

	if ( ! this._following_count_timer )
		this._following_count_timer = setTimeout(this._update_following_count.bind(this), 60000);
}


FFZ.prototype._update_following_count = function() {
	if ( ! this.settings.following_count ) {
		if ( this._following_count_timer ) {
			clearTimeout(this._following_count_timer);
			this._following_count_timer = undefined;
		}
		return;
	}

	this._following_count_timer = setTimeout(this._update_following_count.bind(this), 60000);
	
	var Stream = window.App && App.__container__.resolve('model:stream'),
		Live = Stream && Stream.find("live"),
		f = this;

	if ( Live )
		Live.load();
	else
		Twitch.api.get("streams/followed", {limit:1, offset:0}, {version:3})
			.done(function(data) {
				f._draw_following_count(data._total);
			}).fail(function() {
				f._draw_following_count();
			})
}


FFZ.prototype._draw_following_count = function(count) {
	// Small
	var small_following = document.querySelector('#small_nav ul.game_filters li[data-name="following"] a');
	if ( small_following ) {
		var badge = small_following.querySelector('.ffz-follow-count');
		if ( this.has_bttv || ! this.settings.following_count ) {
			if ( badge )
				badge.parentElement.removeChild(badge);
		} else {
			if ( ! badge ) {
				badge = document.createElement('span');
				badge.className = 'ffz-follow-count';
				small_following.appendChild(badge);
			}
			badge.innerHTML = count ? utils.format_unread(count) : '';
		}
	}
	
	
	// Large
	var large_following = document.querySelector('#large_nav #nav_personal li[data-name="following"] a');
	if ( large_following ) {
		var badge = large_following.querySelector('.ffz-follow-count');
		if ( this.has_bttv || ! this.settings.following_count ) {
			if ( badge )
				badge.parentElement.removeChild(badge);
		} else {
			if ( ! badge ) {
				badge = document.createElement('span');
				badge.className = 'ffz-follow-count';
				large_following.appendChild(badge);
			}
			badge.innerHTML = count ? utils.format_unread(count) : '';
		}
	}
	
	// Heading
	var head_following = document.querySelector('#header_actions #header_following');
	if ( head_following ) {
		var badge = head_following.querySelector('.ffz-follow-count');
		if ( this.has_bttv || ! this.settings.following_count ) {
			if ( badge )
				badge.parentElement.removeChild(badge);
		} else {
			if ( ! badge ) {
				badge = document.createElement('span');
				badge.className = 'ffz-follow-count';
				head_following.appendChild(badge);
			}
			badge.innerHTML = count ? utils.format_unread(count) : '';
		}
	}
}