var FFZ = window.FrankerFaceZ,
	constants = require("./constants"),
	utils = require("./utils"),
	FileSaver = require("./FileSaver"),

	createElement = document.createElement.bind(document),

	make_ls = function(key) {
		return "ffz_setting_" + key;
	},

	favorite_setting = function(swit, key, info) {
		var ind = this.settings.favorite_settings.indexOf(key);

		if ( ind === -1 ) {
			this.settings.favorite_settings.push(key);
			swit.setAttribute('original-title', 'Unfavorite this Setting');
			swit.classList.add('active');
		} else {
			this.settings.favorite_settings.splice(ind,1);
			swit.setAttribute('original-title', 'Favorite this Setting');
			swit.classList.remove('active');
		}

		jQuery(swit).trigger('mouseout').trigger('mouseover');
		this.settings.set('favorite_settings', this.settings.favorite_settings);
	},

	toggle_setting = function(swit, key, info) {
		var val = !(info.get ? (typeof info.get === 'function' ? info.get.call(this) : this.settings.get(info.get)) : this.settings.get(key));
		if ( typeof info.set === "function" )
			info.set.call(this, val);
		else
			this.settings.set(info.set || key, val);

		swit.classList.toggle('active', val);
	},

	option_setting = function(select, key, info) {
		var val = JSON.parse(select.options[select.selectedIndex].value);
		if ( typeof info.set === "function" )
			info.set.call(this, val);
		else
			this.settings.set(info.set || key, val);
	};


// --------------------
// Initializer
// --------------------

FFZ.settings_info = {
	advanced_settings: { value: false, visible: false }
};

FFZ.basic_settings = {};

FFZ.prototype.load_settings = function() {
	this.log("Loading settings.");

	// Build a settings object.
	this.settings = {};

	// Helpers
	this.settings.get = this._setting_get.bind(this);
	this.settings.set = this._setting_set.bind(this);
	this.settings.del = this._setting_del.bind(this);
	this.settings.load = this._setting_load.bind(this);

	this.settings.get_twitch = this._setting_get_twitch.bind(this);


	var found_settings = false;

	for(var key in FFZ.settings_info) {
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		var info = FFZ.settings_info[key],
			ls_key = info && info.storage_key || make_ls(key);

		found_settings = found_settings || localStorage.hasOwnProperty(key);
		this._setting_load(key) || found_settings;
	}

	// Listen for Changes
	window.addEventListener("storage", this._setting_update.bind(this), false);
}


// --------------------
// Backup and Restore
// --------------------

FFZ.prototype.reset_settings = function() {
	if ( ! confirm(this.tr('Are you sure you wish to reset FrankerFaceZ?\n\nThis will force the tab to refresh.')) )
		return;

	// Clear Settings
	for(var key in FFZ.settings_info) {
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		this.settings.del(key);
	}

	// Clear Aliases
	this.aliases = {};
	localStorage.ffz_aliases = '{}';

	// TODO: Filters

	// Refresh
	window.location.reload();
}


FFZ.prototype._get_settings_object = function(skip_default) {
	var data = {
		version: 1,
		script_version: FFZ.version_info + '',
		aliases: this.aliases,
		filters: this.filters,
		settings: {}
		};

	for(var key in FFZ.settings_info) {
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		var info = FFZ.settings_info[key],
			ls_key = info.storage_key || make_ls(key);

		if ( localStorage.hasOwnProperty(ls_key) && (!skip_default || this.settings[key] !== info.value) )
			data.settings[key] = this.settings[key];
	}

	return data;
}


FFZ.prototype.save_settings_file = function() {
	var data = this._get_settings_object(),
		blob = new Blob(
			[JSON.stringify(data, null, 4)], {type: "application/json;charset=utf-8"});

	FileSaver.saveAs(blob, "ffz-settings.json");
}


FFZ.prototype.load_settings_file = function(file) {
	if ( typeof file === "string" )
		this._load_settings_file(file);
	else {
		var reader = new FileReader(),
			f = this;

		reader.onload = function(e) { f._load_settings_file(e.target.result); }
		reader.readAsText(file);
	}
}

FFZ.prototype._load_settings_file = function(data, hide_alert) {
	if ( typeof data === "string" )
		try {
			data = JSON.parse(data);
		} catch(err) {
			this.error("Error Loading Settings: " + err);
			if ( ! hide_alert )
				alert("There was an error attempting to read the provided settings data.");
			return [-1,-1,-1];
		}

	this.log("Loading Settings Data", data);

	var skipped = [], applied = [],
		aliases = 0;

	if ( data.settings ) {
		for(var key in data.settings) {
			if ( ! FFZ.settings_info.hasOwnProperty(key) ) {
				skipped.push(key);
				continue;
			}

			var info = FFZ.settings_info[key],
				val = data.settings[key];

			if ( info.process_value )
				val = info.process_value.call(this, val);

			if ( val !== this.settings.get(key) )
				this.settings.set(key, val);

			applied.push(key);
		}
	}

	if ( data.aliases ) {
		for(var key in data.aliases) {
			if ( this.aliases[key] === data.aliases[key] )
				continue;

			this.aliases[key] = data.aliases[key];
			aliases++;
		}

		if ( aliases )
			localStorage.ffz_aliases = JSON.stringify(this.aliases);
	}

	if ( data.filters ) {
		// TODO: Load filters!
	}

	// Do this in a timeout so that any styles have a moment to update.
	if ( ! hide_alert )
	   setTimeout(function(){
		  alert('Successfully loaded ' + applied.length + ' settings and skipped ' + skipped.length + ' settings. Added ' + aliases + ' user nicknames.');
	   });

	return [applied.length, skipped.length, aliases];
}


// --------------------
// Menu Page
// --------------------

var is_android = navigator.userAgent.indexOf('Android') !== -1,
	settings_renderer = function(settings_data, collapsable, collapsed_key, show_pin) {
		return function(view, container) {
			var f = this,
				settings = {},
				categories = [];

			// Searching!
			if ( show_pin ) {
				var search_cont = utils.createElement('div', 'ffz-filter-container'),
					search_input = utils.createElement('input', 'emoticon-selector__filter-input js-filter-input text text--full-width'),
					filtered_cont = utils.createElement('div', 'ffz-filter-children ffz-ui-sub-menu-page');

				search_input.placeholder = 'Search for Settings';
				search_input.type = 'text';

				filtered_cont.style.maxHeight = (parseInt(container.style.maxHeight) - 51) + 'px';

				search_cont.appendChild(search_input);
				container.appendChild(filtered_cont);
				container.appendChild(search_cont);

				container = filtered_cont;

				search_input.addEventListener('input', function(e) {
					var filter = search_input.value || '',
						groups = filtered_cont.querySelectorAll('.chat-menu-content');

					filter = filter.toLowerCase();

					for(var i=0; i < groups.length; i++) {
						var el = groups[i],
							settings = el.querySelectorAll('.ffz-setting'),
							hidden = true;

						for(var j=0; j < settings.length; j++) {
							var se = settings[j],
								shidden = filter.length && se.getAttribute('data-filter').indexOf(filter) === -1;

							se.classList.toggle('hidden', shidden);
							hidden = hidden && shidden;
						}

						var incompat = el.querySelector('.bttv-incompatibility'),
							settings = incompat && incompat.querySelectorAll('b'),
							incompat_hidden = true;

						if ( incompat ) {
							for(var j=0; j < settings.length; j++) {
								var se = settings[j],
									shidden = filter.length && se.getAttribute('data-filter').indexOf(filter) === -1;

								se.classList.toggle('hidden', shidden);
								incompat_hidden = incompat_hidden && shidden;
							}

							incompat.classList.toggle('hidden', incompat_hidden);
							hidden = hidden && incompat_hidden;
						}

						el.classList.toggle('collapsable', ! filter.length);
						el.classList.toggle('hidden', hidden);
					}
				});
			}

			for(var key in settings_data) {
				var info = settings_data[key],
					cat = info.category || "Miscellaneous",
					cat_store = settings[cat];

				if ( info.hasOwnProperty('visible') ) {
					var visible = info.visible;
					if ( typeof visible === "function" )
						visible = visible.call(this);

					if ( ! visible )
						continue;
				}

				if ( is_android && info.no_mobile )
					continue;

				if ( ! cat_store ) {
					categories.push(cat);
					cat_store = settings[cat] = [];
				}

				cat_store.push([key, info]);
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

			var current_category = collapsed_key ? this[collapsed_key] || true : categories[0];

			for(var ci=0; ci < categories.length; ci++) {
				var category = categories[ci],
					cset = settings[category],

					bttv_skipped = [],
					added = 0,

					menu = createElement('div'),
					heading = createElement('div');


				heading.className = 'heading';
				menu.className = 'chat-menu-content';
				menu.setAttribute('data-category', category);

				if ( collapsable ) {
					menu.classList.add('collapsable');
					menu.classList.toggle('collapsed', current_category !== category);
					menu.addEventListener('click', function(e) {
						var t = this;
						if ( ! t.classList.contains('collapsable') )
							return;

						else if ( ! t.classList.contains('collapsed') ) {
							if ( e.target.classList.contains('heading') ) {
								t.classList.add('collapsed');
								if ( collapsed_key )
									f[collapsed_key] = true;
							} else
								return;

						} else {
							jQuery(".chat-menu-content:not(.collapsed)", container).addClass("collapsed");
							t.classList.remove('collapsed');
							if ( collapsed_key )
								f[collapsed_key] = t.getAttribute('data-category');
						}

						setTimeout(function(){t.scrollIntoViewIfNeeded()});
					});
				}

				heading.innerHTML = category;
				menu.appendChild(heading);

				cset.sort(function(a,b) {
					var a = a[1],
						b = b[1],

						at = 2, //a.type === "boolean" ? 1 : 2,
						bt = 2, //b.type === "boolean" ? 1 : 2,

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

						el = createElement('p'),
						pin_btn = createElement('a'),
						val = info.get ? (typeof info.get === 'function' ? info.get.call(this) : this.settings.get(info.get)) : this.settings.get(key);

					el.className = 'ffz-setting clearfix';

					if ( (info.no_bttv === 6 && this.has_bttv_6) ||
						 (info.no_bttv === 7 && this.has_bttv_7) ||
						 (info.no_bttv === true && this.has_bttv) ) {
						bttv_skipped.push([info.name, info.help]);
						continue;
					} else if ( (info.require_bttv === 6 && ! this.has_bttv_6) ||
								(info.require_bttv === 7 && ! this.has_bttv_7) ||
								(info.require_bttv === true && ! this.has_bttv) ) {
						continue;
					} else {
						if ( show_pin ) {
							var faved = this.settings.favorite_settings.indexOf(key) !== -1;
							pin_btn.className = 'pin-switch html-tooltip';
							pin_btn.classList.toggle('active', faved);
							pin_btn.addEventListener('click', favorite_setting.bind(this, pin_btn, key, info));
							pin_btn.title = (faved ? 'Unf' : 'F') + 'avorite this Setting';
							pin_btn.innerHTML = constants.STAR;
						}

						if ( info.type === "boolean" ) {
							var swit = createElement('a'),
								label = createElement('span');

							swit.className = 'switch';
							swit.classList.toggle('active', val);
							swit.appendChild(createElement('span'))

							label.className = 'switch-label';
							label.innerHTML = info.name;

							el.appendChild(swit);
							if ( show_pin )
								el.appendChild(pin_btn);
							el.appendChild(label);

							swit.addEventListener('click', toggle_setting.bind(this, swit, key, info))

						} else if ( info.type === "select" ) {
							var select = createElement('select'),
								label = createElement('span');

							label.className = 'option-label';
							label.innerHTML = info.name;

							var op_list = [];

							for(var ok in info.options) {
								var op = createElement('option'),
									desc = info.options[ok],
									sort_key = 0;

								op.value = JSON.stringify(ok);
								if ( val == ok )
									op.setAttribute('selected', true);

								if ( typeof desc === "object" ) {
									op.innerHTML = desc[0];
									sort_key = desc[1];
								} else
									op.innerHTML = desc;

								op_list.push([sort_key, op]);
							}

							op_list.sort(function(a,b) {return a[0] - b[0]});

							for(var op_i=0; op_i < op_list.length; op_i++)
								select.appendChild(op_list[op_i][1]);

							select.addEventListener('change', option_setting.bind(this, select, key, info));

							if ( show_pin )
								el.appendChild(pin_btn);
							el.appendChild(label);
							el.appendChild(select);

						} else if ( typeof info.method === "function" ) {
							el.classList.add("option");
							var link = createElement('a');
							link.innerHTML = info.name;
							link.href = '#';

							if ( show_pin )
								el.appendChild(pin_btn);
							el.appendChild(link);

							link.addEventListener('click', info.method.bind(this));

						} else
							continue;

						if ( info.help || info.experiment_warn || (this.has_bttv && info.warn_bttv) ) {
							var help = document.createElement('span');
							help.className = 'help';
							var parts = [];
							if ( info.experiment_warn )
								parts.push('<b>Note:</b> This affects an active Twitch experiment. Give feedback at: <a href="mailto:feedback@twitch.tv">feedback@twitch.tv</a>');

							if ( this.has_bttv && info.warn_bttv )
								parts.push('<i>' + info.warn_bttv + '</i>');

							if ( info.help )
								parts.push(info.help);

							help.innerHTML = parts.join('<br>');
							el.appendChild(help);
						}
					}

					// Search by any of the present text.
					el.setAttribute('data-filter', el.textContent.toLowerCase());

					added++;
					menu.appendChild(el);
				}

				if ( ! added )
					continue;

				if ( bttv_skipped.length ) {
					var el = createElement('p'),
						label = createElement('span'),
						help = createElement('span');

					el.className = 'bttv-incompatibility clearfix disabled';
					label.className = 'switch-label';
					label.innerHTML = "Features Incompatible with BetterTTV";

					help.className = 'help';
					for(var i=0; i < bttv_skipped.length; i++) {
						var skipped = bttv_skipped[i],
							filter_text = skipped[0].toLowerCase() + (skipped[1] ? ' ' + skipped[1].toLowerCase() : '');
						help.innerHTML += '<b data-filter="' + utils.quote_attr(filter_text) + '"' + (skipped[1] ? ' class="html-tooltip" title="' + utils.quote_attr(skipped[1]) + '"' : '') + '>' + skipped[0] + '</b>';
					}

					el.appendChild(label);
					el.appendChild(help);
					menu.appendChild(el);
					//jQuery('.html-tooltip', el).tipsy({html: true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
					//jQuery('.ffz-tooltip', el).tipsy({live: true, html: true, title: this.render_tooltip(), gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
				}

				container.appendChild(menu);
			}
		}
	},

	render_basic = settings_renderer(FFZ.basic_settings, false, '_ffz_basic_settings_page'),
	render_advanced = settings_renderer(FFZ.settings_info, true, '_ffz_settings_page', true);


FFZ.settings_info.favorite_settings = {
	value: [],
	hidden: true
}


FFZ.menu_pages.settings = {
	name: "Settings",
	icon: constants.GEAR,
	sort_order: 99999,
	wide: true,

	default_page: function() { return this.settings.favorite_settings.length ? "favorites" : this.settings.advanced_settings ? 'advanced' : 'basic' },

	pages: {
		favorites: {
			name: "Favorites",
			sort_order: 1,

			render: function(view, container) {
				var favorites = this.settings.favorite_settings,
					count = 0;

				if ( ! this.has_bttv )
					count = favorites.length;
				else
					for(var i=0; i < favorites.length; i++)
						if ( FFZ.settings_info[favorites[i]] && ! FFZ.settings_info[favorites[i]].no_bttv )
							count++;

				if ( ! count ) {
					var el = utils.createElement('div');
					el.className = 'emoticon-grid ffz-no-emotes center';
					el.innerHTML = "You have no favorite settings.<br>" +
						'<img src=\"//cdn.frankerfacez.com/emoticon/26608/2\"><br>' +
						'To make a setting a favorite, find it on the <nobr>Advanced</nobr> tab and click the star icon to the right.';

					container.appendChild(el);
					return;
				}

				var favorite_settings = {};
				for(var i=0, l = favorites.length; i < l; i++) {
					var key = favorites[i],
						val = FFZ.settings_info[key];

					if ( val )
						favorite_settings[key] = val;
				}

				return settings_renderer(favorite_settings, false, '_ffz_favorite_settings_page').call(this, view, container);
			}
		},

		basic: {
			name: "Basic",
			sort_order: 2,

			render: function(view, container) {
				this.settings.set("advanced_settings", false);
				return render_basic.call(this, view, container);
			}
		},

		advanced: {
			name: "Advanced",
			sort_order: 3,

			render: function(view, container) {
				this.settings.set("advanced_settings", true);
				return render_advanced.call(this, view, container);
			}
		},

		backup: {
			name: "Backup & Restore",
			sort_order: 4,

			render: function(view, container) {
				var backup_head = createElement('div'),
					restore_head = createElement('div'),
					reset_head = createElement('div'),

					backup_cont = createElement('div'),
					restore_cont = createElement('div'),
					reset_cont = createElement('div'),

					backup_para = createElement('p'),
					backup_link = createElement('a'),
					backup_help = createElement('span'),

					restore_para = createElement('p'),
					restore_input = createElement('input'),
					restore_link = createElement('a'),
					restore_help = createElement('span'),

					reset_para = createElement('p'),
					reset_link = createElement('a'),
					reset_help = createElement('span'),
					f = this;


				backup_cont.className = 'chat-menu-content';
				backup_head.className = 'heading';
				backup_head.innerHTML = 'Backup Settings';
				backup_cont.appendChild(backup_head);

				backup_para.className = 'clearfix option';

				backup_link.href = '#';
				backup_link.innerHTML = 'Save to File';
				backup_link.addEventListener('click', this.save_settings_file.bind(this));

				backup_help.className = 'help';
				backup_help.innerHTML = 'This generates a JSON file containing all of your settings and prompts you to save it.';

				backup_para.appendChild(backup_link);
				backup_para.appendChild(backup_help);
				backup_cont.appendChild(backup_para);

				restore_cont.className = 'chat-menu-content';
				restore_head.className = 'heading';
				restore_head.innerHTML = 'Restore Settings';
				restore_cont.appendChild(restore_head);

				restore_para.className = 'clearfix option';

				restore_input.type = 'file';
				restore_input.addEventListener('change', function() { f.load_settings_file(this.files[0]); })

				restore_link.href = '#';
				restore_link.innerHTML = 'Restore from File';
				restore_link.addEventListener('click', function(e) { e.preventDefault(); restore_input.click(); });

				restore_help.className = 'help';
				restore_help.innerHTML = 'This loads settings from a previously generated JSON file.';

				restore_para.appendChild(restore_link);
				restore_para.appendChild(restore_help);
				restore_cont.appendChild(restore_para);

				reset_cont.className = 'chat-menu-content';
				reset_head.className = 'heading';
				reset_head.innerHTML = this.tr('Reset Settings');
				reset_cont.appendChild(reset_head);

				reset_para.className = 'clearfix option';

				reset_link.href = '#';
				reset_link.innerHTML = this.tr('Reset FrankerFaceZ');
				reset_link.addEventListener('click', this.reset_settings.bind(this));

				reset_help.className = 'help';
				reset_help.innerHTML = this.tr('This resets all of your FFZ data. That includes chat filters, nicknames for users, and settings.');

				reset_para.appendChild(reset_link);
				reset_para.appendChild(reset_help);
				reset_cont.appendChild(reset_para);

				container.appendChild(backup_cont);
				container.appendChild(restore_cont);
				container.appendChild(reset_cont);
			}
		}
	}
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

	if ( info.process_value )
		try {
			val = info.process_value.call(this, val);
		} catch(err) {
			this.log('Error processing value for setting "' + key + '": ' + err);
			return;
		}

	this.settings[key] = val;
	if ( info.on_update )
		try {
			info.on_update.call(this, val, false);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}



// --------------------
// Settings Access
// --------------------

FFZ.prototype._setting_load = function(key, default_value) {
	var info = FFZ.settings_info[key],
		ls_key = info && info.storage_key || make_ls(key),
		val = default_value || (info && info.hasOwnProperty("value") ? info.value : undefined);

	if ( localStorage.hasOwnProperty(ls_key) ) {
		try {
			val = JSON.parse(localStorage.getItem(ls_key));
		} catch(err) {
			this.log('Error loading value for "' + key + '": ' + err);
		}
	}

	if ( info && info.process_value )
		val = info.process_value.call(this, val);

	this.settings[key] = val;
	return val;
}


FFZ.prototype._setting_get = function(key) {
	if ( ! this.settings.hasOwnProperty(key) && FFZ.settings_info[key] )
		this._setting_load(key);

	return this.settings[key];
}

FFZ.prototype._setting_get_twitch = function(key) {
	var Settings = utils.ember_settings();
	return Settings && Settings.get(key);
}


FFZ.prototype._setting_set = function(key, val, suppress_log) {
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key);

	if ( info.process_value )
		try {
			val = info.process_value.call(this, val)
		} catch(err) {
			this.log('Error processing value for setting "' + key + '": ' + err);
			return false;
		}

	this.settings[key] = val;

	var jval = JSON.stringify(val);
	localStorage.setItem(ls_key, jval);

	if ( ! suppress_log )
		this.log('Changed Setting "' + key + '" to: ' + jval);

	if ( info.on_update )
		try {
			info.on_update.call(this, val, true);
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

	if ( info )
		val = this.settings[key] = info.hasOwnProperty("value") ? info.value : undefined;

	this.settings[key] = val;

	if ( info.on_update )
		try {
			info.on_update.call(this, val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}