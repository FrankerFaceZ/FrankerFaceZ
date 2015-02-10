var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_chatview = function() {
	this.log("Hooking the Ember Chat view.");

	var Chat = App.__container__.resolve('view:chat');
	this._modify_cview(Chat);

	// For some reason, this doesn't work unless we create an instance of the
	// chat view and then destroy it immediately.
	Chat.create().destroy();

	// Modify all existing Chat views.
	for(var key in Ember.View.views) {
		if ( ! Ember.View.views.hasOwnProperty(key) )
			continue;

		var view = Ember.View.views[key];
		if ( !(view instanceof Chat) )
			continue;

		this.log("Adding UI link manually to Chat view.", view);
		try {
			view.$('.textarea-contain').append(this.build_ui_link(view));
		} catch(err) {
			this.error("setup: build_ui_link: " + err);
		}
	}
}


// --------------------
// Modify Chat View
// --------------------

FFZ.prototype._modify_cview = function(view) {
	var f = this;

	view.reopen({
		didInsertElement: function() {
			this._super();
			try {
				this.$() && this.$('.textarea-contain').append(f.build_ui_link(this));
			} catch(err) {
				f.error("didInsertElement: build_ui_link: " + err);
			}
		},

		willClearRender: function() {
			this._super();
			try {
				this.$(".ffz-ui-toggle").remove();
			} catch(err) {
				f.error("willClearRender: remove ui link: " + err);
			}
		},

		ffzUpdateLink: Ember.observer('controller.currentRoom', function() {
			try {
				f.update_ui_link();
			} catch(err) {
				f.error("ffzUpdateLink: update_ui_link: " + err);
			}
		})
	});
}