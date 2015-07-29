var FFZ = window.FrankerFaceZ,
	constants = require("./constants");


	make_ls = function(key) {
		return "ffz_setting_" + key;
	},

	toggle_setting = function(swit, key) {
		var val = ! this.settings.get(key);
		this.settings.set(key, val);
		swit.classList.toggle('active', val);
	},
	
	option_setting = function(select, key) {
		this.settings.set(key, JSON.parse(select.options[select.selectedIndex].value));
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
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		var info = FFZ.settings_info[key],
			ls_key = info.storage_key || make_ls(key),
			val = info.hasOwnProperty("value") ? info.value : undefined;

		if ( localStorage.hasOwnProperty(ls_key) ) {
			try {
				val = JSON.parse(localStorage.getItem(ls_key));
			} catch(err) {
				this.log('Error loading value for "' + key + '": ' + err);
			}
		}

		if ( info.process_value )
			val = info.process_value.bind(this)(val);

		this.settings[key] = val;
	}

	// Helpers
	this.settings.get = this._setting_get.bind(this);
	this.settings.set = this._setting_set.bind(this);
	this.settings.del = this._setting_del.bind(this);

	// Listen for Changes
	window.addEventListener("storage", this._setting_update.bind(this), false);
}


// --------------------
// Menu Page
// --------------------

FFZ.menu_pages.settings = {
	render: function(view, container) {
			var settings = {},
				categories = [],
				is_android = navigator.userAgent.indexOf('Android') !== -1;

			for(var key in FFZ.settings_info) {
				if ( ! FFZ.settings_info.hasOwnProperty(key) )
					continue;

				var info = FFZ.settings_info[key],
					cat = info.category || "Miscellaneous",
					cs = settings[cat];

				if ( info.visible !== undefined && info.visible !== null ) {
					var visible = info.visible;
					if ( typeof info.visible == "function" )
						visible = info.visible.bind(this)();

					if ( ! visible )
						continue;
				}
				
				if ( is_android && info.no_mobile )
					continue;

				if ( ! cs ) {
					categories.push(cat);
					cs = settings[cat] = [];
				}

				cs.push([key, info]);
			}

			categories.sort(function(a,b) {
				var a = a.toLowerCase(),
					b = b.toLowerCase();

				if ( a === "debugging" )
					a = "zzz" + a;

				if ( b === "debugging" )
					b = "zzz" + b;

				if ( a < b ) return -1;
				else if ( a > b ) return 1;
				return 0;
			});

			var f = this,
				current_page = this._ffz_settings_page || categories[0]; 

			for(var ci=0; ci < categories.length; ci++) {
				var category = categories[ci],
					cset = settings[category],

					menu = document.createElement('div'),
					heading = document.createElement('div');

				heading.className = 'heading';
				menu.className = 'chat-menu-content collapsable';
				
				menu.setAttribute('data-category', category);
				menu.classList.toggle('collapsed', current_page !== category);

				heading.innerHTML = category;
				menu.appendChild(heading);

				menu.addEventListener('click', function() {
					if ( ! this.classList.contains('collapsed') )
						return;

					var t = this,
						old_selection = container.querySelectorAll('.chat-menu-content:not(.collapsed)');
					for(var i=0; i < old_selection.length; i++)
						old_selection[i].classList.add('collapsed');
					
					f._ffz_settings_page = t.getAttribute('data-category');
					t.classList.remove('collapsed');
					setTimeout(function(){t.scrollIntoViewIfNeeded()});
				});

				cset.sort(function(a,b) {
					var a = a[1],
						b = b[1],

						at = a.type === "boolean" ? 1 : 2,
						bt = b.type === "boolean" ? 1 : 2,

						an = a.name.toLowerCase(),
						bn = b.name.toLowerCase();

					if ( at < bt ) return -1;
					else if ( at > bt ) return 1;

					else if ( an < bn ) return -1;
					else if ( an > bn ) return 1;

					return 0;
				});

				for(var i=0; i < cset.length; i++) {
					var key = cset[i][0],
						info = cset[i][1],
						el = document.createElement('p'),
						val = this.settings.get(key);

					el.className = 'clearfix';

					if ( this.has_bttv && info.no_bttv ) {
						var label = document.createElement('span'),
							help = document.createElement('span');
						label.className = 'switch-label';
						label.innerHTML = info.name;

						help = document.createElement('span');
						help.className = 'help';
						help.innerHTML = 'Disabled due to incompatibility with BetterTTV.';

						el.classList.add('disabled');
						el.appendChild(label);
						el.appendChild(help);

					} else {
						if ( info.type == "boolean" ) {
							var swit = document.createElement('a'),
								label = document.createElement('span');

							swit.className = 'switch';
							swit.classList.toggle('active', val);
							swit.innerHTML = "<span></span>";

							label.className = 'switch-label';
							label.innerHTML = info.name;

							el.appendChild(swit);
							el.appendChild(label);

							swit.addEventListener("click", toggle_setting.bind(this, swit, key));

						} else if ( info.type === "select" ) {
							var select = document.createElement('select'),
								label = document.createElement('span');
							
							label.className = 'option-label';
							label.innerHTML = info.name;
							
							for(var ok in info.options) {
								var op = document.createElement('option');
								op.value = JSON.stringify(ok);
								if ( val === ok )
									op.setAttribute('selected', true);
								op.innerHTML = info.options[ok];
								select.appendChild(op);
							}
							
							select.addEventListener('change', option_setting.bind(this, select, key));
							
							el.appendChild(label);
							el.appendChild(select);

						} else {
							el.classList.add("option");
							var link = document.createElement('a');
							link.innerHTML = info.name;
							link.href = "#";
							el.appendChild(link);

							link.addEventListener("click", info.method.bind(this));
						}

						if ( info.help ) {
							var help = document.createElement('span');
							help.className = 'help';
							help.innerHTML = info.help;
							el.appendChild(help);
						}
					}

					menu.appendChild(el);
				}

				container.appendChild(menu);
			}
		},

	name: "Settings",
	icon: constants.GEAR,
	sort_order: 99999,
	wide: true
	};


// --------------------
// Tracking Updates
// --------------------

FFZ.prototype._setting_update = function(e) {
	if ( ! e )
		e = window.event;

	if ( ! e.key || e.key.substr(0, 12) !== "ffz_setting_" )
		return;

	var ls_key = e.key,
		key = ls_key.substr(12),
		val = undefined,
		info = FFZ.settings_info[key];

	if ( ! info ) {
		// Try iterating to find the key.
		for(key in FFZ.settings_info) {
			if ( ! FFZ.settings_info.hasOwnProperty(key) )
				continue;

			info = FFZ.settings_info[key];
			if ( info.storage_key == ls_key )
				break;
		}

		// Not us.
		if ( info.storage_key != ls_key )
			return;
	}

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
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key),
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
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key),
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