var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils'),

	TimeFormat = Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: 'numeric'}),

	parse_schedule_dates = function(data) {
		for(var event_id in data) {
			var event = data[event_id];
			if ( ! event || ! data.hasOwnProperty(event_id) )
				continue;

			event.starttime = utils.parse_date(event.starttime);
			event.endtime = utils.parse_date(event.endtime);
		}

		return data
	};


// ---------------
// Settings
// ---------------

FFZ.settings_info.metadata_schedule = {
	type: "boolean",
	value: true,
	no_mobile: true,

	category: "Channel Metadata",
	name: "Event Schedule <small>(Beta)</small>",
	help: 'Display schedule information under the stream for channels that support it.',
	on_update: function(val) {
		if ( this._cindex )
			this._cindex.ffzUpdateMetadata('schedule');
	}
};


// ----------------
// Data Handler
// ----------------

FFZ.ws_on_close.push(function() {
	this._schedule_data = {};
	if ( this._cindex )
		this._cindex.ffzUpdateMetadata('schedule');
});


FFZ.ws_commands.event_schedule = function(data) {
	var schedules = this._schedule_data = this._schedule_data || {},
		has_schedule = data[1],
		important_events = data[2];

	if ( important_events )
		parse_schedule_dates(important_events);

	for(var i=0; i < data[0].length; i++)
		schedules[data[0][i]] = [has_schedule, important_events];

	if ( this._cindex )
		this._cindex.ffzUpdateMetadata('schedule');
}


// ----------------
// Event Schedules
// ----------------

FFZ.channel_metadata.schedule = {
	refresh: false,

	setup: function(view, channel) {
		var data = this._schedule_data,
			channel_id = channel.get('id'),
			cdata = data && data[channel_id] || [false, [null, null]];

		return [channel_id, cdata[0], cdata[1]];
	},

	order: 96,
	host_order: 5,

	button: true,

	static_label: constants.CLOCK,
	label: function(channel_id, has_schedule, important_events) {
		if ( ! this.settings.metadata_schedule || ! has_schedule )
			return null;

		return 'Schedule';
	},

	tooltip: function(channel_id, has_schedule, important_events) {
		var current = important_events[0],
			next = important_events[1],
			out = [],

			format = function(run) {
				return utils.sanitize(
					run.name + ' (' + run.category + ') by ' +
					utils.human_join(_.map(run.runners, function(x) {
						if ( typeof x === 'string' )
							return x;
						return x[1];
					}))
				);
			};

		if ( current )
			out.push('Now: ' + format(current));

		if ( next )
			out.push(
				utils.full_human_time((Date.now() - next.starttime) / 1000).capitalize() + ': ' +
				format(next));

		return out.join('<hr>');
	},

	popup: function(container, channel_id, has_schedule, important_events) {
		container.classList.add('balloon--xl');
		container.innerHTML = '<div class="ffz-loading-spinner"></div>';
		var t = this,
			loaded = false,
			fail = function() {
				if ( loaded || ! document.body.contains(container) || container.dataset.key !== 'schedule' )
					return;
				container.innerHTML = '<p>There was an error fetching schedule data from the server.</p>';
			};

		this.ws_send("get_schedule", channel_id, function(success, data) {
			if ( ! success )
				return fail();
			else if ( ! document.body.contains(container) || container.dataset.key !== 'schedule' )
				return;

			loaded = true;
			parse_schedule_dates(data);

			var scroller = utils.createElement('ol', 'scroller');
			container.innerHTML = '';
			container.appendChild(scroller);

			var runs = [];
			for(var run_id in data)
				runs.push([run_id, data[run_id]]);

			runs.sort(function(a,b) {
				var ao = a[1].order,
					bo = b[1].order;

				if ( ao < bo ) return -1;
				if ( ao > bo ) return 1;
				return 0;
			});

			var last_date;
			for(var i=0; i < runs.length; i++)
				last_date = FFZ.channel_metadata.schedule.draw_row.call(t, scroller, runs[i][0], runs[i][1], last_date);

			setTimeout(function() {
				var current = scroller.querySelector('.ffz-current-item');
				current && current.scrollIntoViewIfNeeded();
			});
		});

		setTimeout(fail, 5000);
	},

	draw_row: function(container, run_id, run, last_date) {
		var el = utils.createElement('li', 'ffz-schedule-row'),
			now = Date.now(),
			is_current = run.starttime <= now && run.endtime >= now,
			is_old = run.starttime < now,
			current_date = run.starttime.toLocaleDateString();

		if ( current_date !== last_date )
			container.appendChild(utils.createElement('div', 'ffz-schedule-row ffz-schedule-date', current_date));

		el.classList.toggle('ffz-current-item', is_current);
		el.classList.toggle('ffz-old-item', ! is_current && is_old);
		el.dataset.id = run_id;

		var meta = [
			'Length: ' + utils.sanitize(run.run_time)
		];

		if ( run.setup_time )
			meta.push('Setup: ' + utils.sanitize(run.setup_time));

		if ( run.coop )
			meta.push('Co-Op');

		if ( run.console )
			meta.push('Console: ' + utils.sanitize(run.console));

		el.innerHTML = '<div class="heading">' +
			'<h2>' + utils.sanitize(run.name) + ' <span>(' + utils.sanitize(run.category).replace(/ +/g, '&nbsp;') + ')</span></h2>' +
			'</div>' +
			'<time class="time-start html-tooltip" title="Start' + (is_old ? 'ed ' : 's ') + utils.quote_san(utils.full_human_time((now - run.starttime) / 1000)) + '." datetime="' + utils.quote_san(run.starttime) + '">' + utils.sanitize(TimeFormat.format(run.starttime)) + '</time>' +
			'<div class="meta">' + meta.join(' &mdash; ') + '</div>' +
			'<div class="runners">Runner' + utils.pluralize(run.runners) + ': ' +
				utils.human_join(_.map(run.runners, function(x) {
					if ( typeof x === 'string' )
						x = [x,x];

					if ( x[0] )
						return '<span><a target="_blank" href="https://twitch.tv/' + utils.quote_san(x[0]) + '">' + utils.sanitize(x[1]) + '</a></span>';
					return '<span>' + utils.sanitize(x[1]) + '</span>';
				})) +
			'</div>';

		container.appendChild(el);
		return current_date;
	}
}