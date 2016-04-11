var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants'),

	parse_emotes = function(emotes) {
		var output = {};
		if ( ! emotes || ! emotes.length )
			return output;

		for(var i=0; i < emotes.length; i++) {
			var emote = emotes[i];
			if ( ! emote || ! emote.id )
				continue;

			var entries = output[emote.id] = output[emote.id] || [];
			entries.push([emote.start, emote.end]);
		}

		return output;
	};


FFZ.prototype.setup_feed_cards = function() {
	var FeedCard = utils.ember_resolve('component:feed-card');
	if ( ! FeedCard )
		return;

	this._modify_feed_card(FeedCard);

	try { FeedCard.create().destroy();
	} catch(err) { }

	this.rerender_feed_cards();
}


FFZ.prototype.rerender_feed_cards = function(for_set) {
	var FeedCard = utils.ember_resolve('component:feed-card'),
		views = utils.ember_views();

	if ( ! FeedCard )
		return;

	for(var view_id in views) {
		var view = views[view_id];
		if ( view instanceof FeedCard ) {
			try {
				if ( ! view.ffzInit )
					this._modify_feed_card(view);
				view.ffzInit(for_set);
			} catch(err) {
				this.error("setup component:feed-card ffzInit: " + err)
			}
		}
	}
}


FFZ.prototype._modify_feed_card = function(component) {
	var f = this;
	component.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.ffzInit();
			} catch(err) {
				f.error("component:feed-card ffzInit: " + err);
			}
		},

		ffzInit: function(for_set) {
			var el = this.get('element'),
				message = this.get('post.body'),
				emotes = parse_emotes(this.get('post.emotes')),
				user_id = this.get('post.user.login'),
				room_id = this.get('channelId'),
				pbody = el && el.querySelector('.activity-body');

			if ( ! message || ! el || ! pbody )
				return;

			// If this is for a specific emote set, only rerender if it matters.
			if ( for_set && f.rooms && f.rooms[room_id] ) {
				var sets = f.getEmotes(user_id, room_id);
				if ( sets.indexOf(for_set) === -1 )
					return;
			}

			var tokens = f.tokenize_feed_body(message, emotes, user_id, room_id),
				output = f.render_tokens(tokens, true, false);

			pbody.innerHTML = '<p>' + output + '</p>';

			jQuery('.ffz-tooltip', pbody).tipsy({html: true, title: f.render_tooltip(), gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
			jQuery('.html-tooltip', pbody).tipsy({html: true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
		}
	});
}