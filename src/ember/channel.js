var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_channel = function() {
	this.channels = {};

	this.log("Creating channel style element.");
	var s = this._channel_style = document.createElement('style');
	s.id = "ffz-channel-css";
	document.head.appendChild(s);

	this.log("Hooking the Ember Channel view.");

	var Channel = App.__container__.lookup('controller:channel'),
		f = this;

	if ( ! Channel )
		return;

	Channel.reopen({
		ffzUpdateUptime: function() {
			f.update_uptime();
		}.observes("isLive", "content.id").on("init")

		/*ffzUpdateInfo: function() {
			f.log("Updated! ID: " + this.get("content.id"));
			f.update_stream_info(true);
		}.observes("content.id").on("init")*/
	});

	// Do uptime the first time.
	this.update_uptime();
	//this.update_stream_info(true);
}


// ---------------
// Settings
// ---------------

FFZ.settings_info.stream_uptime = {
	type: "boolean",
	value: false,

	category: "Channel Metadata",
	name: "Stream Uptime",
	help: 'Display the stream uptime under a channel by the viewer count.',
	on_update: function(val) {
			this.update_uptime();
		}
	};


// --------------------
// Stream Data Update
// --------------------

/*FFZ.prototype.update_stream_info = function(just_schedule) {
	if ( this._stream_info_update ) {
		clearTimeout(this._stream_info_update);
		delete this._stream_info_update;
	}

	this._stream_info_update = setTimeout(this.update_stream_info.bind(this), 90000);

	if ( just_schedule )
		return;

	var Channel = App.__container__.lookup('controller:channel'),
		channel_id = Channel ? Channel.get('content.id') : undefined,
		f = this;
	if ( ! channel_id )
		return;

	Twitch.api.get("streams/" + channel_id, {}, {version: 3})
		.done(function(data) {
			var channel_id = Channel.get('content.id'), d = data.stream;
			if ( ! data.stream || d.channel.name != channel_id )
				return;

			// Override the data in Twitch. We can't just .load() the stream
			// because that resets the whole channel layout, resetting the
			// video player. Twitch pls fix
			var old_created = Channel.get('content.stream.created_at');

			Channel.set('content.stream.created_at', d.created_at);
			Channel.set('content.stream.average_fps', d.average_fps);
			Channel.set('content.stream.viewers', d.viewers);
			Channel.set('content.stream.video_height', d.video_height);
			Channel.set('content.stream.csGoSkill', Twitch.uri.csGoSkillImg(("0" + d.skill).slice(-2)));

			Channel.set('content.stream.game', d.game);
			Channel.set('content.stream.gameUrl', Twitch.uri.game(d.game));
			Channel.set('content.stream.gameBoxart', Twitch.uri.gameBoxArtJpg(d.game));


			// Update the uptime display.
			if ( f.settings.stream_uptime && old_created != d.created_at )
				f.update_uptime(true) && f.update_uptime();
		});
}*/


// --------------------
// Uptime Display
// --------------------

FFZ.prototype.update_uptime = function(destroy) {
	if ( this._uptime_update ) {
		clearTimeout(this._uptime_update);
		delete this._uptime_update;
	}

	var Channel = App.__container__.lookup('controller:channel');
	if ( destroy || ! this.settings.stream_uptime || ! Channel || ! Channel.get('isLiveAccordingToKraken') ) {
		var el = document.querySelector("#ffz-uptime-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	}

	// Schedule an update.
	this._update_uptime = setTimeout(this.update_uptime.bind(this), 1000);

	// Determine when the channel last went live.
	var online = Channel.get('content.stream.created_at');
	if ( ! online ) return;

	online = utils.parse_date(online);
	if ( ! online ) return;

	var uptime = Math.floor((Date.now() - online.getTime()) / 1000);
	if ( uptime < 0 ) return;

	var el = document.querySelector("#ffz-uptime-display span");
	if ( ! el ) {
		var cont = document.querySelector("#channel .stats-and-actions .channel-stats");
		if ( ! cont ) return;

		var stat = document.createElement("span");
		stat.className = "ffz stat";
		stat.id = "ffz-uptime-display";
		stat.title = "Stream Uptime <nobr>(since " + online.toLocaleString() + ")</nobr>";

		stat.innerHTML = constants.CLOCK + " ";
		el = document.createElement("span");
		stat.appendChild(el);

		var viewers = cont.querySelector(".live-count");
		if ( viewers )
			cont.insertBefore(stat, viewers.nextSibling);
		else {
			try {
				viewers = cont.querySelector("script:nth-child(0n+2)");
				cont.insertBefore(stat, viewers.nextSibling);
			} catch(err) {
				cont.insertBefore(stat, cont.childNodes[0]);
			}
		}

		jQuery(stat).tipsy({html:true});
	}

	el.innerHTML = utils.time_to_string(uptime);
}