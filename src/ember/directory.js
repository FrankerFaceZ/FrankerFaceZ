var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.directory_logos = {
	type: "boolean",
	value: false,

	category: "Appearance",
	no_mobile: true,

	name: "Directory Logos",
	help: "Display channel logos in the Twitch directory."
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_directory = function() {
	this.log("Hooking the Ember Directory View.");

	var ChannelView = App.__container__.resolve('view:channel');
	if ( ChannelView )
		this._modify_directory_live(ChannelView);

	var HostView = App.__container__.resolve('view:host');
	if ( HostView )
		this._modify_directory_host(HostView);

	var VideoView = App.__container__.resolve('view:video');
	if ( VideoView )
		this._modify_directory_video(VideoView);

	// TODO: Process existing views.
}


FFZ.prototype._modify_directory_video = function(dir) {
	var f = this;
	dir.reopen({
		didInsertElement: function() {
			this._super();

			f.log("New Video View", this);
			window.v = this;
		}
	});

	try {
		dir.create().destroy();
	} catch(err) { }
}


FFZ.prototype._modify_directory_live = function(dir) {
	var f = this;
	dir.reopen({
		didInsertElement: function() {
			this._super();

			var el = this.get('element'),
				meta = el && el.querySelector('.meta'),
				thumb = el && el.querySelector('.thumb'),
				cap = thumb && thumb.querySelector('.cap');


			if ( f.settings.stream_uptime && f.settings.stream_uptime < 3 && cap ) {
				var t_el = this._ffz_uptime = document.createElement('div');
				t_el.className = 'overlay_info length live';

				jQuery(t_el).tipsy({html: true});

				cap.appendChild(t_el);
				this._ffz_uptime_timer = setInterval(this.ffzUpdateUptime.bind(this), 1000);
				this.ffzUpdateUptime();
			}

			if ( f.settings.directory_logos ) {
				el.classList.add('ffz-directory-logo');

				var link = document.createElement('a'),
					logo = document.createElement('img'),
					t = this,
					target = this.get('context.model.channel.name');

				logo.className = 'profile-photo';
				logo.src = this.get('context.model.channel.logo') || "http://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_150x150.png";
				logo.alt = this.get('context.model.channel.display_name');

				link.href = '/' + target;
				link.addEventListener('click', function(e) {
					var Channel = App.__container__.resolve('model:channel');
					if ( ! Channel )
						return;

					e.preventDefault();
					t.get('controller').transitionTo('channel.index', Channel.find({id: target}).load());
					return false;
				});

				link.appendChild(logo);
				meta.insertBefore(link, meta.firstChild);
			}
		},

		willClearRender: function() {
			if ( this._ffz_uptime ) {
				this._ffz_uptime.parentElement.removeChild(this._ffz_uptime);
				this._ffz_uptime = null;
			}

			if ( this._ffz_uptime_timer )
				clearInterval(this._ffz_uptime_timer);

			this._super();
		},


		ffzUpdateUptime: function() {
			var raw_created = this.get('context.model.created_at'),
				up_since = raw_created && utils.parse_date(raw_created),
				uptime = up_since && Math.floor((Date.now() - up_since.getTime()) / 1000) || 0;

			if ( uptime > 0 ) {
				this._ffz_uptime.innerHTML = constants.CLOCK + utils.time_to_string(uptime, false, false, false, f.settings.stream_uptime === 1);
				this._ffz_uptime.setAttribute('original-title', 'Stream Uptime <nobr>(since ' + up_since.toLocaleString() + ')</nobr>');;
			} else {
				this._ffz_uptime.setAttribute('original-title', '');
				this._ffz_uptime.innerHTML = '';
			}
		}
	});

	try {
		dir.create().destroy();
	} catch(err) { }
}


FFZ.prototype._modify_directory_host = function(dir) {
	var f = this;
	dir.reopen({
		didInsertElement: function() {
			this._super();

			var el = this.get('element'),
				meta = el && el.querySelector('.meta'),
				thumb = el && el.querySelector('.thumb'),
				cap = thumb && thumb.querySelector('.cap');


			if ( f.settings.directory_logos ) {
				el.classList.add('ffz-directory-logo');

				var link = document.createElement('a'),
					logo = document.createElement('img'),
					t = this,
					target = this.get('context.model.target.channel.name');

				logo.className = 'profile-photo';
				logo.src = this.get('context.model.target.channel.logo') || "http://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_150x150.png";
				logo.alt = this.get('context.model.target.channel.display_name');

				link.href = '/' + target;
				link.addEventListener('click', function(e) {
					var Channel = App.__container__.resolve('model:channel');
					if ( ! Channel )
						return;

					e.preventDefault();
					t.get('controller').transitionTo('channel.index', Channel.find({id: target}).load());
					return false;
				});

				link.appendChild(logo);
				meta.insertBefore(link, meta.firstChild);
			}
		}
	});

	try {
		dir.create().destroy();
	} catch(err) { }
}