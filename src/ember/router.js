var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_router = function() {
	this.log("Hooking the Ember router.");

	var f = this;
	App.__container__.lookup('router:main').reopen({
		ffzTransition: function() {
			try {
				f.track_page();
			} catch(err) {
				f.error("ffzTransition: " + err);
			}
		}.on('didTransition')
	});
}