var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');



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
	Live.addObserver('content.length', function() { f._draw_following_channels(this.get('content'), this.get('total')); })

	Live.load();

	var total = Live.get('total'),
		streams = Live.get('content');
	if ( typeof total === "number" ) {
		this._draw_following_count(total);
		if ( streams && streams.length )
			this._draw_following_channels(streams, total);
	}
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
		this._following_count_timer = setTimeout(this._update_following_count.bind(this), 55000 + (10000*Math.random()));
}


FFZ.prototype._update_following_count = function() {
	if ( ! this.settings.following_count ) {
		if ( this._following_count_timer ) {
			clearTimeout(this._following_count_timer);
			this._following_count_timer = undefined;
		}
		return;
	}

	this._following_count_timer = setTimeout(this._update_following_count.bind(this), 55000 + (10000*Math.random()));

	var Stream = window.App && App.__container__.resolve('model:stream'),
		Live = Stream && Stream.find("live"),
		f = this;

	if ( Live )
		Live.load();
	else
		Twitch.api && Twitch.api.get("streams/followed", {limit:5, offset:0}, {version:3})
			.done(function(data) {
				f._draw_following_count(data._total);
				f._draw_following_channels(data.streams, data._total);
			}).fail(function() {
				f._draw_following_count();
				f._draw_following_channels();
			})
}


FFZ.prototype._draw_following_channels = function(streams, total) {
	// First, build the data.
	var tooltip = 'Following';

	if ( streams && streams.length ) {
		var c = 0;
		for(var i=0, l = streams.length; i < l; i++) {
			var stream = streams[i];
			if ( ! stream || ! stream.channel )
				continue;

			c += 1;
			if ( c > 5 ) {
				var ttl = total || streams.length;
				tooltip += '<hr><span>And ' + utils.number_commas(ttl - 5) + ' more...</span>';
				break;
			}

			tooltip += (i > 0 ? '<br>' : '<hr>') + '<span class="viewers">' + constants.LIVE + ' ' + utils.number_commas(stream.viewers) + '</span><b>' + utils.sanitize(stream.channel.display_name || stream.channel.name) + '</b><br><span class="playing">' + (stream.channel.game ? 'Playing ' + utils.sanitize(stream.channel.game) : 'Not Playing') + '</span>';
		}
	}


	// Small
	var small_following = jQuery('#small_nav ul.game_filters li[data-name="following"] a');
	if ( small_following && small_following.length ) {
		var data = small_following.data('tipsy');
		if ( data && data.options ) {
			data.options.gravity = function() { return this.parentElement.getAttribute('data-name') === 'following' ? 'nw': 'w'; };
			data.options.html = true;
			data.options.className = 'ffz-wide-tip';
		} else
			small_following.tipsy({html: true, className: 'ffz-wide-tip', gravity: 'nw'});

		small_following.attr('title', tooltip);
	}


	// Large
	var large_following = jQuery('#large_nav #nav_personal li[data-name="following"] a');
	if ( large_following && large_following.length ) {
		var data = large_following.data('tipsy');
		if ( data && data.options ) {
			data.options.html = true;
			data.options.className = 'ffz-wide-tip';
		} else
			large_following.tipsy({html:true, className: 'ffz-wide-tip'});

		large_following.attr('title', tooltip);
	}


	// Heading
	var head_following = jQuery('#header_actions #header_following');
	if ( head_following && head_following.length ) {
		var data = head_following.data('tipsy');
		if ( data && data.options ) {
			data.options.html = true;
			data.options.className = 'ffz-wide-tip';
		} else
			head_following.tipsy({html: true, className: 'ffz-wide-tip'});

		head_following.attr('title', tooltip);
	}
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