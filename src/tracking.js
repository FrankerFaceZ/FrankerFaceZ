var FFZ = window.FrankerFaceZ,
	constants = require('./constants'),
	PIWIK = ("https:" == document.location.protocol ? 'https:' : 'http:') + '//sir.stendec.me/ffz_piwik/';


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_piwik = function() {
	if ( window._paq != undefined ) {
		this.log("Piwik is already present. Disabling analytics.");
		this._tracking = false;
		return;
	}

	if ( localStorage['ffzTracking'] == "false" ) {
		this.log("The user has opted out of tracking. Disabling analytics.");
		this._tracking = false;
		return;
	}

	this.log("Initializing Piwik.");
	this._tracking = true;
	var _paq = window._paq = [];

	_paq.push(['setSiteId', 1]);
	_paq.push(['setTrackerUrl', PIWIK + 'piwik.php']);

	if ( this.has_bttv )
		_paq.push(['setCustomVariable', '3', 'BetterTTV', BetterTTV.info.versionString()]);

	var user = this.get_user(), f = this;
	if ( user ) {
		_paq.push(['setCustomVariable', '1', 'Partnered', user.is_partner ? "Yes" : "No"])
		_paq.push(['setCustomVariable', '2', 'User Type', user.is_staff ? "Staff" : (user.is_admin ? "Admin" : "User")]);
		_paq.push(['setUserId', user.login]);

		Twitch.api.get("channels/" + user.login)
			.done(function(data) {
				if ( data.logo )
					f.track('setCustomVariable', '4', 'Avatar', data.logo);
			}).always(function() { f.track_page(); });

	} else
		this.track_page();

	// If someone turned analytics back ON, track that.
	if ( localStorage['ffzTracking'] == "true" ) {
		this.track('trackEvent', 'Analytics', 'Enable');
		localStorage.removeItem('ffzTracking');
	}

	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.defer = true;
	script.async = true;
	script.src = PIWIK + 'piwik.js';
	document.head.appendChild(script);
}


// --------------------
// Command
// --------------------

FFZ.chat_commands.analytics = function(room, args) {
	var enabled, args = args && args.length ? args[0].toLowerCase() : null;
	if ( args == "y" || args == "yes" || args == "true" || args == "on" )
		enabled = true;
	else if ( args == "n" || args == "no" || args == "false" || args == "off" )
		enabled = false;

	if ( enabled === undefined )
		return "Analytics are currently " + (localStorage.ffzTracking != "false" ? "enabled." : "disabled.");

	// Track that someone turned off analytics.
	if ( this._tracking && ! enabled && localStorage.ffzTracking != "false" )
		this.track('trackEvent', 'Analytics', 'Disable');

	localStorage.ffzTracking = enabled;

	return "Analytics are now " + (enabled ? "enabled" : "disabled") + ". Please refresh your browser.";
}

FFZ.chat_commands.analytics.help = "Usage: /ffz analytics <on|off>\nEnable or disable FrankerFaceZ analytics. We collect some data about your browser and how you use FrankerFaceZ to help us improve the script. Turn off analytics if you'd rather we not.";



// --------------------
// Tracking Helpers
// --------------------

FFZ.prototype.track = function() {
	if ( ! this._tracking )
		return;

	window._paq && _paq.push(Array.prototype.slice.call(arguments));
}


FFZ.prototype.track_page = function() {
	if ( ! this._tracking )
		return;

	if ( this._old_url )
		this.track('setReferrerUrl', this._old_url);

	this._old_url = document.location.toString();
	this.track('setCustomUrl', this._old_url);

	this.track('deleteCustomVariable', '1', 'page');
	this.track('deleteCustomVariable', '3', 'page');

	var routes = App.__container__.resolve('router:main').router.currentHandlerInfos;
	if ( ! routes || routes.length == 0 )
		return;

	var last = routes[routes.length - 1];
	if ( last.name == "channel.index" && last.context ) {
		var following = last.context.get("isFollowing.isFollowing");
		if ( following !== undefined && following !== null )
			this.track('setCustomVariable', '1', 'Following', (following ? "Yes" : "No"), 'page');

		var game = last.context.get("game");
		if ( game )
			this.track("setCustomVariable", "3", "Game", game, "page");

		this.track("trackPageView", document.title);
	}
}