var FFZ = window.FrankerFaceZ;


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.setup_line = function() {
	this.log("Hooking the Ember Line controller.");

	var Line = App.__container__.resolve('controller:line'),
		f = this;

	Line.reopen({
		tokenizedMessage: function() {
			// Add our own step to the tokenization procedure.
			return f._emoticonize(this, this._super());

		}.property("model.message", "isModeratorOrHigher", "controllers.emoticons.emoticons.[]")
		// TODO: Copy the new properties from the new Twitch!
	});


	this.log("Hooking the Ember Line view.");
	var Line = App.__container__.resolve('view:line');

	Line.reopen({
		didInsertElement: function() {
			this._super();

			var el = this.get('element');
			el.setAttribute('data-room', this.get('context.parentController.content.id'));
			el.setAttribute('data-sender', this.get('context.model.from'));

			f.render_badge(this);
		}
	});
}


// ---------------------
// Emoticon Replacement
// ---------------------

FFZ.prototype._emoticonize = function(controller, tokens) {
	var room_id = controller.get("parentController.model.id"),
		user_id = controller.get("model.from"),
		user = this.users[user_id],
		room = this.rooms[room_id],
		f = this;

	// Get our sets.
	var sets = _.union(user && user.sets || [], room && room.sets || [], f.global_sets),
		emotes = [];

	// Build a list of emotes that match.
	_.each(sets, function(set_id) {
		var set = f.emote_sets[set_id];
		if ( ! set )
			return;

		_.each(set.emotes, function(emote) {
			_.any(tokens, function(token) {
				return _.isString(token) && token.match(emote.regex);
			}) && emotes.push(emote);
		});
	});

	// Don't bother proceeding if we have no emotes.
	if ( ! emotes.length )
		return tokens;

	// Now that we have all the matching tokens, do crazy stuff.
	if ( typeof tokens == "string" )
		tokens = [tokens];

	// This is weird stuff I basically copied from the old Twitch code.
	// Here, for each emote, we split apart every text token and we
	// put it back together with the matching bits of text replaced
	// with an object telling Twitch's line template how to render the
	// emoticon.
	_.each(emotes, function(emote) {
		var eo = {isEmoticon:true, cls: emote.klass};

		tokens = _.compact(_.flatten(_.map(tokens, function(token) {
			if ( _.isObject(token) )
				return token;

			var tbits = token.split(emote.regex), bits = [];
			tbits.forEach(function(val, ind) {
				bits.push(val);
				if ( ind !== tbits.length - 1 )
					bits.push(eo);
			});
			return bits;
		})));
	});

	return tokens;
}