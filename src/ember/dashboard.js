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
	//this.update_views('component:dashboards/live/stream-stats', this.modify_dashboard_stats);
	//this.update_views('component:dashboards/live/stream-health', this.modify_dashboard_health);
}


FFZ.prototype.modify_dashboard_widget = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			var t = this;
			this.$(".dash-widget__header").click(function(e) {
				if ( ! f.settings.dash_widget_click_to_expand || e.target.tagName === 'button' || jQuery(e.target).parents('button').length || jQuery(e.target).parents('.balloon-wrapper').length )
					return;

				t.actions.collapseWidget.call(t);
			});
		}
	});
}