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

	// Schedule an update.
	this._update_subscribers_timer = setTimeout(this._update_subscribers.bind(this), 60000);

	var user = this.get_user(), f = this,
		match = this.is_dashboard ? location.pathname.match(/\/([^\/]+)/) : undefined,
		id = this.is_dashboard && match && match[1];

	if ( this.has_bttv || ! id || id !== user.login ) {
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	}

	// Spend a moment wishing we could just hit the subscribers API from the
	// context of the web user.

	// Get the count!
	jQuery.getJSON("/" + id + "/dashboard/revenue/summary_data").done(function(data) {
		var el, sub_count = data && data.data && data.data.total_subscriptions;
		if ( typeof sub_count === "string" )
			sub_count = parseInt(sub_count.replace(/[,\.]/g, ""));

		if ( typeof sub_count !== "number" || sub_count === 0 || sub_count === NaN || sub_count === Infinity ) {
			el = document.querySelector("#ffz-sub-display");
			if ( el )
				el.parentElement.removeChild(el);

			var failed = f._failed_sub_checks = (f._failed_sub_checks || 0) + 1;
			if ( f._update_subscribers_timer && failed >= 5 ) {
				f.log("Subscriber count failed 5 times. Giving up.");
				clearTimeout(f._update_subscribers_timer);
				delete f._update_subscribers_timer;
			}

			return;
		}

		// Graph this glorious data point
		if ( f._dash_chart ) {
			if ( ! f._dash_chart.series[3].options.showInLegend ) {
				f._dash_chart.series[3].options.showInLegend = true;
				f._dash_chart.legend.renderLegend();
			}

			f._dash_chart.series[3].addPoint({x: utils.last_minute(), y: sub_count});
		}

		el = document.querySelector('#ffz-sub-display span');
		if ( ! el ) {
			var cont = f.is_dashboard ? document.querySelector("#stats") : document.querySelector("#channel .stats-and-actions .channel-stats");
			if ( ! cont )
				return;

			var stat = document.createElement('span');
			stat.className = 'ffz stat';
			stat.id = 'ffz-sub-display';
			stat.title = 'Subscribers';

			stat.innerHTML = constants.STAR + ' ';

			el = document.createElement('span');
			stat.appendChild(el);

			utils.api.get("chat/" + id + "/badges", null, {version: 3})
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
			jQuery(stat).tipsy({gravity: f.is_dashboard ? "s" : utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
		}

		el.innerHTML = utils.number_commas(sub_count);

	}).fail(function(){
		var el = document.querySelector("#ffz-sub-display");
		if ( el )
			el.parentElement.removeChild(el);
		return;
	});
}