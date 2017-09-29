var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// -------------------
// Subscriber Display
// -------------------

FFZ.prototype._update_subscribers = function() {
	if ( this._update_subscribers_timer )
		clearTimeout(this._update_subscribers_timer);

	var f = this,
		user = this.get_user();

	if ( this.has_bttv || ! user || ! user.login || this.dashboard_channel !== user.login )
		return jQuery("#ffz-sub-display").remove();

	// Schedule an update.
	this._update_subscribers_timer = setTimeout(this._update_subscribers.bind(this), 60000);

	// Get the count!
	utils.api.get("/api/channels/" + this.dashboard_channel + "/subscriber_count").done(function(data) {
		var el, sub_count = data && data.count;
		if ( typeof sub_count === "string" )
			sub_count = parseInt(sub_count.replace(/[,\.]/g, ""));

		if ( typeof sub_count !== "number" || isNaN(sub_count) || ! isFinite(sub_count) ) {
			jQuery("#ffz-sub-display").remove();

			var failed = f._failed_sub_checks = (f._failed_sub_checks || 0) + 1;
			if ( f._update_subscribers_timer && failed >= 5 ) {
				f.log("Subscriber count failed 5 times. Giving up.");
				clearTimeout(f._update_subscribers_timer);
				f._update_subscribers_timer = undefined;
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
			var cont = document.querySelector('#stats');
			if ( ! cont )
				return;

			var stat = utils.createElement('span', 'ffz stat', constants.STAR + ' ');
			stat.id = 'ffz-sub-display';
			stat.title = 'Subscribers';

			el = utils.createElement('span');
			stat.appendChild(el);

			utils.api.get("chat/" + f.dashboard_channel + "/badges", null, {version: 3})
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
			jQuery(stat).zipsy({gravity: 's'});
		}

		el.textContent = utils.number_commas(sub_count);

	}).fail(function(){
		jQuery("#ffz-sub-display").remove();
	});
}