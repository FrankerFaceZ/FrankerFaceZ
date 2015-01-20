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
		view.$('.textarea-contain').append(this.build_ui_link(view));
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
			this.$() && this.$('.textarea-contain').append(f.build_ui_link(this));
		},

		willClearRender: function() {
			this._super();
			this.$(".ffz-ui-toggle").remove();
		},

		ffzUpdateLink: Ember.observer('controller.currentRoom', function() {
			f.update_ui_link();
		})
	});
}