var FFZ = window.FrankerFaceZ,


	make_ls = function(key) {
		return "ffz_setting_" + key;
	};


// --------------------
// Initializer
// --------------------

FFZ.settings_info = {};

FFZ.prototype.load_settings = function() {
	this.log("Loading settings.");

	// Build a settings object.
	this.settings = {};

	for(var key in FFZ.settings_info) {
		var ls_key = make_ls(key),
			info = FFZ.settings_info[key],
			val = info.hasOwnProperty("value") ? info.value : undefined;

		if ( localStorage.hasOwnProperty(ls_key) ) {
			try {
				val = JSON.parse(localStorage.getItem(ls_key));
			} catch(err) {
				this.log('Error loading value for "' + key + '": ' + err);
			}
		}

		this.settings[key] = val;
	}

	// Helpers
	this.settings.get = this._setting_get.bind(this);
	this.settings.set = this._setting_set.bind(this);
	this.settings.del = this._setting_del.bind(this);

	// Listen for Changes
	window.addEventListener("storage", this._setting_update.bind(this));
}


// --------------------
// Tracking Updates
// --------------------

FFZ.prototype._setting_update = function(e) {
	if ( ! e )
		e = window.event;

	this.log("Storage Event", e);

	if ( ! e.key || e.key.substr(0, 12) !== "ffz_setting_" )
		return;

	var ls_key = e.key,
		key = ls_key.substr(12),
		val = undefined,
		info = FFZ.settings_info[key];

	this.log("Updated Setting: " + key);

	try {
		val = JSON.parse(e.newValue);
	} catch(err) {
		this.log('Error loading new value for "' + key + '": ' + err);
		val = info.value || undefined;
	}

	this.settings[key] = val;
	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, false);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}



// --------------------
// Settings Access
// --------------------

FFZ.prototype._setting_get = function(key) {
	return this.settings[key];
}


FFZ.prototype._setting_set = function(key, val) {
	var ls_key = make_ls(key),
		info = FFZ.settings_info[key],
		jval = JSON.stringify(val);

	this.settings[key] = val;
	localStorage.setItem(ls_key, jval);

	this.log('Changed Setting "' + key + '" to: ' + jval);

	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}


FFZ.prototype._setting_del = function(key) {
	var ls_key = make_ls(key),
		info = FFZ.settings_info[key],
		val = undefined;

	if ( localStorage.hasOwnProperty(ls_key) )
		localStorage.removeItem(ls_key);

	delete this.settings[key];

	if ( info )
		val = this.settings[key] = info.hasOwnProperty("value") ? info.value : undefined;

	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}