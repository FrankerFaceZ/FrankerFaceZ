var FFZ = window.FrankerFaceZ,
	utils = require("../utils"),
	constants = require("../constants");

// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_ember_wrapper = function() {
	this._views_to_update = [];
	this._ember_finalized = false;
}


FFZ.prototype.update_views = function(klass, modifier, if_not_exists, immediate, no_modify_existing) {
	var original_klass;
	if ( typeof klass === 'string' ) {
		original_klass = klass;
		klass = utils.ember_resolve(klass);
		if ( ! klass && if_not_exists ) {
			if ( typeof if_not_exists === "function" )
				if_not_exists.call(this, klass, modifier);
			else {
				klass = Ember.Component.extend({});
				App.__registry__.register(original_klass, klass);
			}
		}

		if ( ! klass ) {
			this.error("Unable to locate the Ember " + original_klass);
			return false;
		}
	} else
		original_klass = klass.toString();

	if ( this._ember_finalized || immediate || ! this._views_to_update )
		this._update_views([[original_klass, klass, modifier, no_modify_existing || false]]);
	else
		this._views_to_update.push([original_klass, klass, modifier, no_modify_existing || false]);

	return true;
}


FFZ.prototype.finalize_ember_wrapper = function() {
	this._ember_finalized = true;
	var views = this._views_to_update;
	this._views_to_update = null;
	this._update_views(views);
}


FFZ.prototype._update_views = function(klasses) {
	this.log("Updating Ember classes and instances.", klasses);
	var updated_instances = 0,
		updated_klasses = 0;

	// Modify all pending classes and clear them from cache.
	for(var i=0; i < klasses.length; i++) {
		klasses[i][2].call(this, klasses[i][1]);
		updated_klasses++;

		try {
			klasses[i][1].create().destroy()
		} catch(err) {
			if ( constants.DEBUG )
				this.log("There was an error creating and destroying an instance of the Ember class \"" + klasses[i][0] + "\" to clear its cache.", err);
		}
	}

	// Iterate over all existing views and update them as necessary.
	var views = utils.ember_views();
	for(var view_id in views) {
		var view = views[view_id];
		if ( ! view )
			continue;

		for(var i=0; i < klasses.length; i++)
			if ( view instanceof klasses[i][1] ) {
				updated_instances++;

				try {
					if ( ! view.ffz_modified && ! klasses[i][3] )
						klasses[i][2].call(this, view);

					var func = view.ffz_update || view.ffz_init;
					if ( func )
						func.call(view);

				} catch(err) {
					this.error("An error occured when updating an existing Ember instance of: " + klasses[i][0], err);
				}

				break;
			}
	}

	this.log("Updated " + utils.number_commas(updated_instances) + " existing instances across " + updated_klasses + " classes.");
}