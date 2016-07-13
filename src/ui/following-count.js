var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	FOLLOWING_CONTAINERS = [
		['#small_nav ul.game_filters li[data-name="following"] a', true],
		['nav a.warp__tipsy[data-href="following"]', true],
		['#large_nav #nav_personal li[data-name="following"] a', false],
		['#header_actions #header_following', false]
	],

	FOLLOW_GRAVITY = function(f, el) {
		return (f.settings.following_count && (
					el.getAttribute('data-href') === 'following' ||
					el.parentElement.getAttribute('data-name') === 'following'
				) ? 'n' : '') +

				(f.settings.swap_sidebars ? 'e' : 'w');
	},

	WIDE_TIP = function(f, el) {
		return (f.settings.following_count && (
					el.id === 'header_following' ||
					el.getAttribute('data-href') === 'following' ||
					el.parentElement.getAttribute('data-name') === 'following'

				)) ? 'ffz-wide-tip' : '';
	};


FFZ.settings_info.following_count = {
	type: "boolean",
	value: true,

	no_mobile: true,

	category: "Sidebar",
	name: "Following Data",
	help: "Display the number of live channels you're following on the sidebar, and list the channels in a tooltip.",

	on_update: function(val) {
			this._schedule_following_count();

			var Stream = utils.ember_resolve('model:stream'),
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
	setTimeout(this._install_following_tooltips.bind(this), 2000);

	// If we don't have Ember, no point in trying this stuff.
	if ( this.is_dashboard || ! has_ember )
		return this._following_get_me();

	this.log("Connecting to Live Streams model.");
	var Stream = utils.ember_resolve('model:deprecated-stream');
	if ( ! Stream )
		return this.log("Unable to find Stream model.");

	var Live = Stream.find("live"),
		f = this;

	if ( ! Live )
		return this.log("Unable to find Live Streams collection.");

	Live.addObserver('total', function() { f._draw_following_count(this.get('total')); });
	Live.addObserver('content.length', function() { f._draw_following_channels(this.get('content'), this.get('total')); })

	Live.load();

	/*var Host = utils.ember_resolve('model:hist'),
		HostLive = Host && Host.find("following");

	if ( HostLive )
		HostLive.load();*/

	var init = function() {
		var total = Live.get('total'),
			streams = Live.get('content');
		if ( typeof total === "number" ) {
			f._draw_following_count(total);
			if ( streams && streams.length )
				f._draw_following_channels(streams, total);
		}
	}

	init()
	setTimeout(init, 2000);
}


FFZ.prototype._following_get_me = function(tries) {
	// get_user doesn't properly return an oauth token any longer, so we need to get me manually.
	if ( ! window.Twitch )
		// Wait around till the API shows up.
		return setTimeout(this._following_get_me.bind(this, tries), Math.floor(2000*Math.random()) + 500);

	var f = this;
	utils.api.get("/api/me").done(function(data) {
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

	var Stream = utils.ember_resolve('model:stream'),
		Live = Stream && Stream.find("live"),

		Host = utils.ember_resolve('model:host'),
		HostLive = Host && Host.find("following"),

		f = this;

	if ( ! this.is_dashboard && HostLive && document.body.getAttribute('data-current-path').indexOf('directory.following') !== -1 )
		HostLive.load();

	if ( ! this.is_dashboard && Live )
		Live.load();
	else {
		var u = this.get_user();

		utils.api.get("streams/followed", {limit:20, offset:0}, {version:3}, u && u.chat_oauth_token)
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
	if ( el.id !== 'header_following' && el.getAttribute('data-href') !== 'following' && el.parentElement.getAttribute('data-name') !== 'following' )
		return el.getAttribute('original-title');

	if ( ! this.settings.following_count )
		return 'Following';

	var tooltip = (this.has_bttv ? '<span class="stat playing">FrankerFaceZ</span>' : '') + 'Following',
		bb = el.getBoundingClientRect(),
		height = document.body.clientHeight - (bb.bottom + 50),
		max_lines = Math.max(Math.floor(height / 40) - 1, 2),

		/*Host = utils.ember_resolve('model:host'),
		HostLive = Host && Host.find("following"),*/

		streams = this._tooltip_streams,
		total = this._tooltip_total || (streams && streams.length) || 0,
		c = 0;

	if ( streams && streams.length ) {
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
				hours = Math.floor(uptime / 3600),
				tags = stream.channel.game === 'Creative' && this.tokenize_ctags(stream.channel.status, true);

			tooltip += (i === 0 ? '<hr>' : '') +
				(uptime > 0 ? '<span class="stat">' + constants.CLOCK + ' ' + (hours > 0 ? hours + 'h' : '') + minutes + 'm</span>' : '') +
				'<span class="stat">' + constants.LIVE + ' ' + utils.number_commas(stream.viewers) + '</span>' +
				'<b>' + utils.sanitize(stream.channel.display_name || stream.channel.name) + '</b><br>' +
				'<span class="playing">' + (stream.channel.game === 'Creative' ? 'Being Creative' : (stream.channel.game ? 'Playing ' + utils.sanitize(stream.channel.game) : 'Not Playing')) + (tags ? ' | ' + _.pluck(tags, "text").join(" ") : '') + '</span>';
		}
	} else {
		c++; // is a terrible programming language
		tooltip += "<hr>No one you're following is online.";
	}

	// If we have hosts, and room, try displaying some hosts.
	/*if ( HostLive && (c + 1) < max_lines && HostLive.get('content.length') > 0 ) {
		var t = HostLive.get('content.length');
		c++;
		tooltip += '<hr>Live Hosts';
		for(var i=0; i < t; i++) {
			var host = HostLive.get('content.' + i),
				stream = host && host.target;
			if ( ! stream )
				continue;

			c += 1;
			if ( c > max_lines ) {
				var sc = 1 + (streams && streams.length || 0);
				tooltip += '<hr><span>And ' + utils.number_commas(t - (max_lines - sc)) + ' more...</span>';
				break;
			}

			var hosting;
			if ( ! host.ffz_hosts || host.ffz_hosts.length === 1 )
				hosting = host.display_name;
			else
				hosting = utils.number_commas(host.ffz_hosts.length);

			tooltip += (i === 0 ? '<hr>' : '') +
				'<span class="stat">' + constants.LIVE + ' ' + utils.number_commas(stream.viewers) + '</span>' +
				hosting + ' hosting <b>' + utils.sanitize(stream.channel.display_name || stream.channel.name) + '</b><br>' +
				'<span class="playing">' + (stream.meta_game ? 'Playing ' + utils.sanitize(stream.meta_game) : 'Not Playing') + '</span>';
		}
	}*/

	// Reposition the tooltip.
	setTimeout(function() {
		var tip = document.querySelector('.tipsy');
		if ( ! tip )
			return;

		var bb = tip.getBoundingClientRect(),

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
		gravity = function() { return FOLLOW_GRAVITY(f, this) },
		data = {
			html: true,
			className: function() { return WIDE_TIP(f, this); },
			title: function() { return f._build_following_tooltip(this); }
		};

	for(var i=0; i < FOLLOWING_CONTAINERS.length; i++) {
		var following = jQuery(FOLLOWING_CONTAINERS[i][0]);
		if ( following && following.length ) {
			var td = following.data('tipsy');
			if ( td && td.options ) {
				td.options = _.extend(td.options, data);
				if ( FOLLOWING_CONTAINERS[i][1] )
					td.options.gravity = gravity;
			} else
				following.tipsy(FOLLOWING_CONTAINERS[i][1] ? _.extend({gravity: gravity}, data) : data);
		}
	}
}


FFZ.prototype._draw_following_channels = function(streams, total) {
	this._tooltip_streams = streams;
	this._tooltip_total = total;
}


FFZ.prototype._draw_following_count = function(count) {
	count = count ? utils.format_unread(count) : '';
	for(var i=0; i < FOLLOWING_CONTAINERS.length; i++) {
		var container = document.querySelector(FOLLOWING_CONTAINERS[i][0]),
			badge = container && container.querySelector('.ffz-follow-count');
		if ( ! container )
			continue;

		if ( this.has_bttv || ! this.settings.following_count ) {
			badge && container.removeChild(badge);
			continue;

		} else if ( ! badge ) {
			badge = utils.createElement('span', 'ffz-follow-count');
			container.appendChild(badge);
		}

		badge.innerHTML = count;
	}
}