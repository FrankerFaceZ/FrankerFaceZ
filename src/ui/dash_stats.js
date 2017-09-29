var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	update_viewer_count = function(text) {
		var vc = jQuery("#channel_viewer_count");
		vc.text() === 'Hidden' || vc.text(text);
	};


// -------------------
// Settings
// -------------------

FFZ.settings_info.dashboard_graph = {
	type: "boolean",
	value: true,

	no_mobile: true,
	no_bttv: true,

	category: "Dashboard",
	name: "Statistics Graph <small>(Requires Refresh)</small>",
	help: "Display a graph of your viewers, followers, and chat activity over time."
}


// -------------------
// Collecting Chat
// -------------------

FFZ.msg_commands.chat_message = function(data) {
	if ( ! this.dashboard_channel || data.room !== this.dashboard_channel )
		return;

	this._stat_chat_lines++;
	if ( this._stat_chatters.indexOf(data.from) === -1 )
		this._stat_chatters.push(data.from);
}


FFZ.msg_commands.chatter_count = function(data) {
	if ( ! this.dashboard_channel || data.room !== this.dashboard_channel )
		return;

	var el = document.querySelector('#ffz-chatter-display span');
	if ( ! this.settings.chatter_count || this.has_bttv || ! this.is_dashboard || ! data.chatters ) {
		if ( el )
			jQuery(el).parent().remove();
		return;
	}

	if ( ! el ) {
		var cont = document.querySelector('#stats');
		if ( ! cont )
			return;

		var stat = utils.createElement('span', 'ffz stat', constants.ROOMS + ' ');
		stat.id = 'ffz-chatter-display';
		stat.title = 'Currently in Chat';

		el = utils.createElement('span');
		stat.appendChild(el);

		cont.appendChild(stat);
		jQuery(stat).zipsy({gravity: 's'});
	}

	el.textContent = utils.number_commas(data.chatters);
}


// -------------------
// Initialization
// -------------------

FFZ.prototype.setup_dash_stats = function() {
	this._stat_chat_lines = 0;
	this._stat_chatters = [];
	this._stat_last_game = null;
	this._stat_last_status = null;

	this._update_dash_stats_timer = setTimeout(this.update_dash_stats.bind(this), 0);

	var f = this,
		stats = document.querySelector('#stats');

	if ( this.has_bttv || ! stats || ! window.Highcharts || ! this.settings.dashboard_graph )
		return;

	f.log("Adding dashboard statistics chart.");

	// Build a chart, under stats.
	var container = document.createElement('div');
	container.id = "chart_container";
	container.className = 'ffz-stat-chart';
	stats.parentElement.insertBefore(container, stats.nextSibling);

	Highcharts.setOptions({global: {useUTC: false}});

	// Load chart visibility
	var vis = {};
	if ( localStorage.ffz_dash_chart_visibility )
		vis = JSON.parse(localStorage.ffz_dash_chart_visibility);

	var date_format = this.settings.twenty_four_timestamps ? "%H:%M" : "%l:%M",
		chart = this._dash_chart = new Highcharts.Chart({
		chart: {
			type: 'line',
			zoomType: "x",
			animation: false,
			renderTo: container,
			height: 200
		},

		title: { text: null },
		credits: { enabled: false },
		exporting: { enabled: false },
		legend: {
			backgroundColor: "#fff"
		},

		xAxis: {
			type: 'datetime',
			tickPixelInterval: 150,
			dateTimeLabelFormats: {
				millisecond: date_format,
				second: date_format,
				minute: date_format
			}
		},

		tooltip: {
			formatter: function() {
				if ( this.point )
					this.points = [this.point];

				var s = [],
					key = this.points[0].key || this.points[0].x;

				if ( key ) {
					if ( typeof key === "number" )
						key = Highcharts.dateFormat((f.settings.twenty_four_timestamps ? "%H:%M" : "%l:%M %P"), key);

					s.push('<span style="font-size:10px">' + key + '</span>');
				}

				for(var i=0; i < this.points.length; i++) {
					var point = this.points[i],
						series = point.series,
						to = series.tooltipOptions,
						y = point.text || point.y;

					if ( ! to || ! to.enabled || y === undefined || y === null )
						continue;

					if ( typeof y === "number" )
						y = utils.number_commas(y);

					s.push('<span style="color:' + series.color + '">' + series.name + '</span>: <b>' + y + '</b>');
				}

				return s.join("<br>");
			},
			crosshairs: true,
			shared: true
		},

		yAxis: [
			{title: { text: null }, min: 0},
			{title: { text: null }, min: 0},
			{title: { text: null }, min: 0, opposite: true},
			{title: { text: null }, min: 0, opposite: true}
		],

		series: [
			{
				type: 'flags',
				name: 'Status',
				showInLegend: false,
				shape: 'squarepin',
				data: [],
				zIndex: 5
			},
			{name: "Viewers", data: [], zIndex: 4, visible: vis.hasOwnProperty('viewers')?vis.viewers:true},
			{name: "Followers", data: [], yAxis: 1, zIndex: 3, visible: vis.hasOwnProperty('followers')?vis.followers:true},
			{name: "Subscribers", data: [], zIndex: 3, showInLegend: false, visible: vis.hasOwnProperty('subscribers')?vis.subscribers:true},
			{name: "Chat Lines", type: 'area', data: [], yAxis: 2, visible: vis.hasOwnProperty('chat_lines')?vis.chat_lines:false, zIndex: 1},
			{name: "Chatters", data: [], yAxis: 3, visible: vis.hasOwnProperty('chatters')?vis.chatters:false, zIndex: 2}
		]
	});
}


FFZ.prototype._dash_chart_chatters = function(force) {
	var now = utils.last_minute(),
		series = this._dash_chart.series[4],
		len = series.data.length,
		last_point = len > 0 && series.data[len-1],
		rendered = false;

	if ( ! force && ! this._stat_chat_lines && len > 0 && last_point.y === 0 ) {
		series.addPoint({x: now, y: null}, false);
		this._dash_chart.series[5].addPoint({x: now, y: null}, false);
		rendered = true;

	} else if ( force || this._stat_chat_lines || len > 0 && last_point && last_point.y !== null ) {
		if ( this._stat_chat_lines !== 0 && last_point && last_point.y === null ) {
			series.addPoint({x:now-60000, y: 0}, false);
			this._dash_chart.series[5].addPoint({x:now-60000, y: 0}, false);
		}

		series.addPoint({x: now, y: this._stat_chat_lines || 0}, false);
		this._dash_chart.series[5].addPoint({x: now, y: this._stat_chatters.length || 0}, false);
		rendered = true;
	}

	this._stat_chat_lines = 0;
	this._stat_chatters = [];
	return rendered;
}


FFZ.prototype._remove_dash_chart = function() {
	if ( ! this._dash_chart )
		return;

	this.log("Removing dashboard statistics chart.");

	this._dash_chart.destroy();
	this._dash_chart = null;
	jQuery("#chart_container.ffz-stat-chart").remove();
}


FFZ.prototype.update_dash_stats = function() {
	var f = this,
		id = this.dashboard_channel;

	if ( this.has_bttv || ! id )
		return this._remove_dash_chart();

	this._update_dash_stats_timer = setTimeout(this.update_dash_stats.bind(this), 60000);

	if ( f._dash_chart ) {
		var series = f._dash_chart.series;
		localStorage.ffz_dash_chart_visibility = JSON.stringify({
			viewers: series[1].visble,
			followers: series[2].visible,
			subscribers: series[3].visible,
			chat_lines: series[4].visible,
			chatters: series[5].visible
		});
	}

	utils.api.get("streams/" + id , {}, {version: 3})
		.done(function(data) {
			var viewers = null,
				followers = null,
				game = null,
				status = null;

			if ( ! data || ! data.stream )
				!f.has_bttv && update_viewer_count("Offline");

			else {
				!f.has_bttv && update_viewer_count(utils.number_commas(data.stream.viewers));
				viewers = data.stream.viewers;

				var chan = data.stream.channel;
				if ( chan ) {
					followers = chan.hasOwnProperty('followers') ? chan.followers || 0 : null;
					game = chan.game || "Not Playing";
					status = chan.status || "Untitled Broadcast";

					if ( chan.views )
						jQuery("#views_count span").text(utils.number_commas(chan.views));
					if ( followers )
						jQuery("#followers_count span").text(utils.number_commas(followers));
				}
			}

			if ( f._dash_chart ) {
				var now = utils.last_minute(),
					force_draw;

				// If the game or status changed, we need to insert a pin.
				if ( f._stat_last_game !== game || f._stat_last_status !== status ) {
					f._dash_chart.series[0].addPoint({x: now, title: game, text: status}, false);
					f._stat_last_game = game;
					f._stat_last_status = status;
				}

				force_draw = utils.maybe_chart(f._dash_chart.series[1], {x: now, y: viewers}, false);
				force_draw = f._dash_chart_chatters(force_draw) || force_draw;

				utils.maybe_chart(f._dash_chart.series[2], {x: now, y: followers}, false, force_draw);

				f._dash_chart.redraw();
			}
		}).fail(function() {
			if ( f._dash_chart ) {
				f._dash_chart_chatters();
				f._dash_chart.redraw();
			}
		});
}