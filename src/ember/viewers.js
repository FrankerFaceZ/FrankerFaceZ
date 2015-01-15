var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_viewers = function() {
	this.log("Hooking the Ember Viewers controller.");

	var Viewers = App.__container__.resolve('controller:viewers');
	this._modify_viewers(Viewers);
}


FFZ.prototype._modify_viewers = function(controller) {
	var f = this;

	controller.reopen({
		lines: function() {
			var viewers = this._super(),
				categories = [],
				data = {},
				last_category = null;

			// Get the broadcaster name.
			var Channel = App.__container__.lookup('controller:channel'),
				room_id = this.get('parentController.model.id'),
				broadcaster = Channel && Channel.get('id');

			// We can get capitalization for the broadcaster from the channel.
			if ( broadcaster ) {
				var display_name = Channel.get('display_name');
				if ( display_name )
					FFZ.capitalization[broadcaster] = [display_name, Date.now()];
			}

			// If the current room isn't the channel's chat, then we shouldn't
			// display them as the broadcaster.
			if ( room_id != broadcaster )
				broadcaster = null;

			// Now, break the viewer array down into something we can use.
			for(var i=0; i < viewers.length; i++) {
				var entry = viewers[i];
				if ( entry.category ) {
					last_category = entry.category;
					categories.push(last_category);
					data[last_category] = [];

				} else {
					var viewer = entry.chatter.toLowerCase();
					if ( ! viewer )
						continue;

					// If the viewer is the broadcaster, give them their own
					// group. Don't put them with normal mods!
					if ( viewer == broadcaster ) {
						categories.unshift("Broadcaster");
						data["Broadcaster"] = [viewer];

					} else if ( data.hasOwnProperty(last_category) )
						data[last_category].push(viewer);
				}
			}

			// Now, rebuild the viewer list. However, we're going to actually
			// sort it this time.
			viewers = [];
			for(var i=0; i < categories.length; i++) {
				var category = categories[i],
					chatters = data[category];

				if ( ! chatters || ! chatters.length )
					continue;

				viewers.push({category: category});
				viewers.push({chatter: ""});

				// Push the chatters, capitalizing them as we go.
				chatters.sort();
				while(chatters.length)
					viewers.push({chatter: FFZ.get_capitalization(chatters.shift())});
			}

			return viewers;
		}.property("content.chatters")
	});
}