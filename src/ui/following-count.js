var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	FOLLOW_GRAVITY = function(f, el) {
		return (f.settings.following_count && el.parentElement.getAttribute('data-name') === 'following' ? 'n' : '') + (f.settings.swap_sidebars ? 'e' : 'w');
	},

	WIDE_TIP = function(f, el) {
		return ( ! f.settings.following_count || (el.id !== 'header_following' && el.parentElement.getAttribute('data-name') !== 'following') ) ? '' : 'ffz-wide-tip';
	};


FFZ.settings_info.following_count = {
	type: "boolean",
	value: true,

	no_mobile: true,

	category: "Appearance",
	name: "Sidebar Following Data",
	help: "Display the number of live channels you're following on the sidebar, and list the channels in a tooltip.",

	on_update: function(val) {
			this._schedule_following_count();

			var Stream = window.App && App.__container__.resolve('model:stream'),
				Live = Stream && Stream.find("live");

			if ( Live ) {
				var total = Live.get('total') || 0;
				this._draw_following_count(total);
				this._draw_following_channels(Live.get('content'), total);;
			} else {
				this._update_following_count();
				this._draw_following_channels();
			}
		}
	};

// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_following_count = function(has_ember) {
	// Start it updating.
	if ( this.settings.following_count )
		this._schedule_following_count();

	// Tooltips~!
	this._install_following_tooltips();

	// If we don't have Ember, no point in trying this stuff.
	if ( ! has_ember )
		return this._following_get_me();

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


FFZ.prototype._following_get_me = function(tries) {
	// get_user doesn't properly return an oauth token any longer, so we need to get me manually.
	if ( ! window.Twitch )
		// Wait around till the API shows up.
		return setTimeout(this._following_get_me.bind(this, tries), Math.floor(2000*Math.random()) + 500);

	var f = this;
	Twitch.api.get("/api/me").done(function(data) {
		f.log("Fetched User Data -- " + (data.name || data.login));
		f.__user = data;
		f._update_following_count();

	}).fail(function() {
		tries = (tries||0) + 1;
		if ( tries < 5 )
			return setTimeout(f._following_get_me.bind(f, tries), Math.floor(2000*Math.random()) + 500);
		f.log("Failed to get proper user object.");
	});
}


FFZ.prototype._schedule_following_count = function() {
	if ( ! this.settings.following_count ) {
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
	else {
		var a = {},
			u = this.get_user();

		a.Authorization = "OAuth " + u.chat_oauth_token;

		Twitch.api && Twitch.api.get("streams/followed", {limit:20, offset:0}, {version:3, headers: a})
			.done(function(data) {
				f._draw_following_count(data._total);
				f._draw_following_channels(data.streams, data._total);
			}).fail(function() {
				f._draw_following_count();
				f._draw_following_channels();
			})
	}
}


FFZ.prototype._build_following_tooltip = function(el) {
	if ( el.id !== 'header_following' && el.parentElement.getAttribute('data-name') !== 'following' )
		return el.getAttribute('original-title');

	if ( ! this.settings.following_count )
		return 'Following';

	var tooltip = (this.has_bttv ? '<span class="stat playing">FrankerFaceZ</span>' : '') + 'Following',
		bb = el.getBoundingClientRect(),
		height = document.body.clientHeight - (bb.bottom + 54),
		max_lines = Math.max(Math.floor(height / 36) - 1, 2),

		streams = this._tooltip_streams,
		total = this._tooltip_total || (streams && streams.length) || 0;


	if ( streams && streams.length ) {
		var c = 0;
		for(var i=0, l = streams.length; i < l; i++) {
			var stream = streams[i];
			if ( ! stream || ! stream.channel )
				continue;

			c += 1;
			if ( c > max_lines ) {
				tooltip += '<hr><span>And ' + utils.number_commas(total - max_lines) + ' more...</span>';
				break;
			}

			var up_since = this.settings.stream_uptime && stream.created_at && utils.parse_date(stream.created_at),
				now = Date.now() - (this._ws_server_offset || 0),
				uptime = up_since && Math.floor((now - up_since.getTime()) / 1000) || 0,
				minutes = Math.floor(uptime / 60) % 60,
				hours = Math.floor(uptime / 3600);

			tooltip += (i === 0 ? '<hr>' : '') +
				(uptime > 0 ? '<span class="stat">' + constants.CLOCK + ' ' + (hours > 0 ? hours + 'h' : '') + minutes + 'm</span>' : '') +
				'<span class="stat">' + constants.LIVE + ' ' + utils.number_commas(stream.viewers) + '</span>' +
				'<b>' + utils.sanitize(stream.channel.display_name || stream.channel.name) + '</b><br>' +
				'<span class="playing">' + (stream.channel.game ? 'Playing ' + utils.sanitize(stream.channel.game) : 'Not Playing') + '</span>';
		}
	} else
		tooltip += "<hr>No one you're following is online.";


	// Reposition the tooltip.
	setTimeout(function() {
		var tip = document.querySelector('.tipsy'),
			bb = tip.getBoundingClientRect(),

			left = parseInt(tip.style.left || '0'),
			right = bb.left + tip.scrollWidth;

		if ( bb.left < 5 )
			tip.style.left = (left - bb.left) + 5 + 'px';
		else if ( right > document.body.clientWidth - 5 )
			tip.style.left = (left - (5 + right - document.body.clientWidth)) + 'px';
	});

	return tooltip;
}


FFZ.prototype._install_following_tooltips = function() {
	var f = this,
		data = {
			html: true,
			className: function() { return WIDE_TIP(f, this); },
			title: function() { return f._build_following_tooltip(this); }
		};

	// Small
	var small_following = jQuery('#small_nav ul.game_filters li[data-name="following"] a');
	if ( small_following && small_following.length ) {
		var td = small_following.data('tipsy');
		if ( td && td.options ) {
			td.options = _.extend(td.options, data);
			td.options.gravity = function() { return FOLLOW_GRAVITY(f, this); };
		} else
			small_following.tipsy(_.extend({gravity: function() { return FOLLOW_GRAVITY(f, this); }}, data));
	}


	// Large
	var large_following = jQuery('#large_nav #nav_personal li[data-name="following"] a');
	if ( large_following && large_following.length ) {
		var td = large_following.data('tipsy');
		if ( td && td.options )
			td.options = _.extend(td.options, data);
		else
			large_following.tipsy(data);
	}


	// Heading
	var head_following = jQuery('#header_actions #header_following');
	if ( head_following && head_following.length ) {
		var td = head_following.data('tipsy');
		if ( td && td.options )
			td.options = _.extend(td.options, data);
		else
			head_following.tipsy(data);
	}
}


FFZ.prototype._draw_following_channels = function(streams, total) {
	this._tooltip_streams = streams;
	this._tooltip_total = total;
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