var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// -------------------
// Subscriber Display
// -------------------

FFZ.prototype._update_subscribers = function() {
	if ( this._update_subscribers_timer ) {
		clearTimeout(this._update_subscribers_timer);
		delete this._update_subscribers_timer;
	}

	var user = this.get_user(), f = this,
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard && match && match[1];

	if ( this.has_bttv || ! id || id !== user.login ) {
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	}

	// Schedule an update.
	this._update_subscribers_timer = setTimeout(this._update_subscribers.bind(this), 60000);

	// Spend a moment wishing we could just hit the subscribers API from the
	// context of the web user.

	// Get the count!
	jQuery.ajax({url: "/broadcast/dashboard/partnership"}).done(function(data) {
		try {
			var html = document.createElement('span'), dash;

			html.innerHTML = data;
			dash = html.querySelector("#dash_main");

			var match = dash && dash.textContent.match(/([\d,\.]+) total active subscribers/),
				sub_count = match && match[1];

			if ( ! sub_count ) {
				var el = document.querySelector("#ffz-sub-display");
				if ( el )
					el.parentElement.removeChild(el);

				if ( f._update_subscribers_timer ) {
					clearTimeout(f._update_subscribers_timer);
					delete f._update_subscribers_timer;
				}

				return;
			}

			var el = document.querySelector('#ffz-sub-display span');
			if ( ! el ) {
				var cont = f.is_dashboard ? document.querySelector("#stats") : document.querySelector("#channel .stats-and-actions .channel-stats");
				if ( ! cont )
					return;

				var stat = document.createElement('span');
				stat.className = 'ffz stat';
				stat.id = 'ffz-sub-display';
				stat.title = 'Active Channel Subscribers';

				stat.innerHTML = constants.STAR + ' ';

				el = document.createElement('span');
				stat.appendChild(el);

				Twitch.api.get("chat/" + id + "/badges", null, {version: 3})
					.done(function(data) {
						if ( data.subscriber && data.subscriber.image ) {
							stat.innerHTML = '';
							stat.appendChild(el);

							stat.style.backgroundImage = 'url("' + data.subscriber.image + '")';
							stat.style.backgroundRepeat = 'no-repeat';
							stat.style.paddingLeft = '23px';
							stat.style.backgroundPosition = '0 50%';
						}
					});

				cont.appendChild(stat);
				jQuery(stat).tipsy(f.is_dashboard ? {"gravity":"s"} : undefined);
			}

			el.innerHTML = utils.number_commas(parseInt(sub_count));

		} catch(err) {
			f.error("_update_subscribers: " + err);
		}
	}).fail(function(){
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	});;
}
