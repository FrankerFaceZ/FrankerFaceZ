var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.fix_tooltips = function() {
	// First, override the tooltip mixin.
	var TipsyTooltip = utils.ember_resolve('component:tipsy-tooltip');
	if ( TipsyTooltip ) {
		this.log("Modifying Tipsy-Tooltip component to use gravity.");
		TipsyTooltip.reopen({
			didInsertElement: function() {
				var gravity = this.get("gravity");
				if ( ! gravity || typeof gravity === "string" )
					gravity = utils.tooltip_placement(constants.TOOLTIP_DISTANCE, gravity || 's');

				this.$().tipsy({
					gravity: gravity
				});
			}
		})
	}

	// Iterate all existing tipsy stuff~!
	this.log('Fixing already existing tooltips.');
	if ( ! window.jQuery || ! jQuery.cache )
		return;

	for(var obj_id in jQuery.cache) {
		var obj = jQuery.cache[obj_id];
		if ( obj && obj.data && obj.data.tipsy && obj.data.tipsy.options && typeof obj.data.tipsy.options.gravity !== "function" )
			obj.data.tipsy.options.gravity = utils.tooltip_placement(constants.TOOLTIP_DISTANCE, obj.data.tipsy.options.gravity || 's');
	}
}