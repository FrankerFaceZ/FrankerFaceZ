var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants");

// ---------------------
// Settings
// ---------------------


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_vod_chat = function() {
	// Get the VOD Chat Service
	var f = this,
		VODService = utils.ember_lookup('service:vod-chat-service');

	if ( VODService )
		VODService.reopen({
			messageBufferSize: f.settings.scrollback_length,

			pushMessage: function(msg) {
				if ( msg.get("color") === null ) {
					var colors = this.get("colorSettings"),
						from = msg.get("from");

					if ( from ) {
						var clr = colors.get(from);
						if ( ! clr ) {
							clr = constants.CHAT_COLORS[Math.floor(Math.random() * constants.CHAT_COLORS.length)];
							colors.set(from, clr);
						}

						if ( typeof clr === 'string' )
							msg.set('color', clr);
					}
				}

				this.get("messages").pushObject(msg);

				var messages = this.get("messages"),
					len = this.get("messages.length"),
					limit = this.get("messageBufferSize");

				if ( len > limit )
					messages.removeAt(0, len - limit);
			}
		});
	else
		f.error("Unable to locate VOD Chat Service.");

	this.update_views('component:video/rechat/display-container', this.modify_vod_chat_display);
}


FFZ.prototype.modify_vod_chat_display = function(component) {
	var f = this,
		VODService = utils.ember_lookup('service:vod-chat-service');

	utils.ember_reopen_view(component, _.extend({
		ffz_init: function() {
			f._vodc = this;

			if ( f.settings.dark_twitch )
				this.$().parents('.chat-container').addClass('dark');

			this.parentView.addObserver('layout.isTheatreMode', function() {
				if ( f._vodc && f.settings.dark_twitch )
					setTimeout(function(){
						f._vodc.$().parents('.chat-container').addClass('dark');
					});
			});

			this.ffzUpdateBadges();

			// Load the room, if necessary.
			var room_id = this.get('video.channel.id');
			if ( room_id && ! f.rooms[room_id] ) {
				// Load the room model.
				f.log("Loading Room for VOD: " + room_id);
				var Room = utils.ember_resolve('model:room'),
					room = Room && Room.findOne(room_id);
				if ( room && App.currentPath === 'user.chat' )
					room.set('isEmbedChat', true);
			}

			if ( ! f.has_bttv_6 ) {
				this.ffzFixStickyBottom();
				this.ffzAddKeyHook();

				if ( f.settings.chat_hover_pause )
					this.ffzEnableFreeze();
			}
		},

		ffz_destroy: function() {
			if ( f._vodc === this )
				f._vodc = undefined;

			var room_id = this.get('video.channel.id'),
				room = f.rooms && f.rooms[room_id];

			// We don't need the chat room anymore, in theory. This will
			// check if the room is still important after a short delay.
			if ( room && room.room )
				room.room.ffzScheduleDestroy();

			this.ffzDisableFreeze();
			this.ffzRemoveKeyHook();
		},

		ffzUpdateBadges: function() {
			var t = this,
				channel_name = this.get('video.channel.id'),
				owner_name = this.get('video.owner.name'),
				owner_id = this.get('video.owner._id');

			if ( channel_name !== owner_name ) {
				t.set('ffzBadgeSet', null);
				return Ember.propertyDidChange(t, 'badgeStyle');
			}

			fetch("https://badges.twitch.tv/v1/badges/channels/" + owner_id + "/display?language=" + (Twitch.receivedLanguage || "en"), {
				headers: {
					'Client-ID': constants.CLIENT_ID
				}
			}).then(utils.json).then(function(data) {
				t.set('ffzBadgeSet', data.badge_sets);
				Ember.propertyDidChange(t, 'badgeStyle');
			});
		},

		badgeStyle: function() {
			var badges = this.get('ffzBadgeSet');
			if ( ! badges )
				return this._super();

			var room_id = this.get('video.channel.id'),
				output = [];

			for(var badge_id in badges) {
				var versions = badges[badge_id] && badges[badge_id].versions || {};
				for(var version in versions)
					output.push(utils.room_badge_css(room_id, badge_id, version, versions[version]));
			}

			return Ember.String.htmlSafe('<style>' + output.join('') + '</style>');

		}.property('badgeSet', 'ffzBadgeSet'),

		ffzFreezeUpdateBuffer: function(val) {
			if ( val === undefined )
				val = this.get('stuckToBottom');

			VODService && VODService.set("messageBufferSize", f.settings.scrollback_length + (val ? 0 : 150));
		},

		_scheduleScrollToBottom: function() {
			this._scrollToBottom();
		}

	}, FFZ.HoverPause));
}