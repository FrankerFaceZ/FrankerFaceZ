var FFZ = window.FrankerFaceZ;


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_router = function() {
	this.log("Hooking the Ember router.");
	if ( ! window.App )
		return;

	var f = this,
		Router = App.__container__.lookup('router:main');

	if ( Router )
		Router.reopen({
			ffzTransition: function() {
				try {
					document.body.setAttribute('data-current-path', App.get('currentPath'));
				} catch(err) {
					f.error("ffzTransition: " + err);
				}
			}.on('didTransition')
		});

	document.body.setAttribute('data-current-path', App.get('currentPath'));
}