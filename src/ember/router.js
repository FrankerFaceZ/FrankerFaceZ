var FFZ = window.FrankerFaceZ,
	utils = require("../utils");


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_router = function() {
	this.log("Hooking the Ember router.");
	if ( ! window.App )
		return;

	var f = this,
		Router = utils.ember_lookup('router:main');

	if ( Router )
		Router.reopen({
			ffzTransition: function() {
				// TODO: Do this before the transition happens.
				if ( f._force_refresh ) {
					location.href = this.get('url');
					return;
				}

				// If we're coming from a page without app-main, make sure we install the
				// scroll listener.
				f.fix_scroll();
				f.try_modify_dashboard();

				try {
					document.body.setAttribute('data-current-path', App.get('currentPath'));
				} catch(err) {
					f.error("ffzTransition: " + err);
				}
			}.on('didTransition')
		});

	document.body.setAttribute('data-current-path', App.get('currentPath'));
}



FFZ.ws_commands.please_refresh = function() {
	this.log("Refreshing the page upon the next transition.");
	this._force_refresh = true;
}