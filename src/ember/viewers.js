var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),

	VIEWER_CATEGORIES = [
		['staff', 'Staff'],
		['admins', 'Admins'],
		['global_mods', 'Global Moderators'],
		['moderators', 'Moderators'],
		['viewers', 'Viewers']
	];


// --------------------
// Settings
// --------------------

FFZ.settings_info.sort_viewers = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	name: "Sort Viewer List",
	help: "Make sure the viewer list is alphabetically sorted and place the Broadcaster in their own category."
};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_viewers = function() {
	this.update_views('component:chat/twitch-chat-viewers', this.modify_viewer_list);
}


FFZ.prototype.modify_viewer_list = function(component) {
	var f = this;

	utils.ember_reopen_view(component, {
		lines: function() {
			var viewers = this._super();
			if ( ! f.settings.sort_viewers )
				return this._super();

			try {
				var viewers = [],
					has_broadcaster = false,
					raw_viewers = this.get('model.chatters') || {};

				// Get the broadcaster name.
				var Channel = utils.ember_lookup('controller:channel'),
					broadcaster = room_id = this.get('model.id');

				// We can get capitalization for the broadcaster from the channel.
				if ( Channel && Channel.get('channelModel.id') === room_id ) {
					var display_name = Channel.get('channelModel.displayName');
					if ( display_name )
						FFZ.capitalization[broadcaster] = [display_name, Date.now()];
				}

				// Iterate over everything~!
				for(var i=0; i < VIEWER_CATEGORIES.length; i++) {
					var data = raw_viewers[VIEWER_CATEGORIES[i][0]],
						label = VIEWER_CATEGORIES[i][1],
						first_user = true;

					if ( ! data || ! data.length )
						continue;

					for(var x=0; x < data.length; x++) {
						if ( data[x] === broadcaster ) {
							has_broadcaster = true;
							continue;
						}

						if ( first_user ) {
							viewers.push({category: i18n(label)});
							viewers.push({chatter: ""});
							first_user = false;
						}

						var display_name = FFZ.get_capitalization(data[x]);
						if ( display_name.trim().toLowerCase() !== data[x] )
							display_name = data[x];

						viewers.push({chatter: display_name});
					}
				}

				if ( has_broadcaster )
					viewers.splice(0, 0,
						{category: i18n("Broadcaster")},
						{chatter: ""},
						{chatter: FFZ.get_capitalization(broadcaster)});

				return viewers;

			} catch(err) {
				f.error("ViewersController lines: " + err);
				return this._super();
			}

		}.property("model.chatters")
	});
}