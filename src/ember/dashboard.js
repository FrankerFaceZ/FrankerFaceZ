var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.dash_widget_click_to_expand = {
	type: "boolean",
	value: true,

	category: "Dashboard",
	name: "Click-to-Expand Widgets",
	help: "Expand and contract widgets when you click anywhere in their header, not just when you click the toggle button."
}


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_dashboard = function() {
	// Standalone Mode
	if ( location.search === '?standalone' )
		utils.toggle_cls('ffz-minimal-dashboard')(true);

	this.update_views('component:dashboards/live-widget', this.modify_dashboard_widget);
	this.update_views('component:dashboards/live/stream-stats', this.make_uptime_great_again);
}


FFZ.prototype.make_uptime_great_again = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_update: function() {
			this.ffzFixUptime();
		},

		ffzFixUptime: function() {
			var online = this.get('channel.stream.createdAt'),
				now = Date.now() - (f._ws_server_offset || 0),
				uptime = online && Math.floor((now - online.getTime()) / 1000) || -1,
				setting = f.settings.stream_uptime;

			this.set('timeLive', uptime >= 0 ? utils.time_to_string(uptime, false, false, false, true) : 'Offline');
		},

		_reloadStream: function() {
			var t = this;
			this.get('channel.stream').then(function(stream) {
				t.isDestroyed || stream.reload().then(function(stream) {
					t.isDestroyed || t.ffzFixUptime();
				});
			})
		}
	});
}


FFZ.prototype.modify_dashboard_widget = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var t = this;
			this.$(".dash-widget__header").click(function(e) {
				if ( ! f.settings.dash_widget_click_to_expand || e.target.tagName === 'button' || jQuery(e.target).parents('button').length )
					return;

				t.actions.collapseWidget.call(t);
			});
		}
	});
}