var FFZ = window.FrankerFaceZ,
	constants = require("./constants"),
	FileSaver = require("./FileSaver");


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
	},


	toggle_basic_setting = function(swit, key) {
		var getter = FFZ.basic_settings[key].get,
			val = !(typeof getter === 'function' ? getter.bind(this)() : this.settings.get(getter)),

			setter = FFZ.basic_settings[key].set;

		if ( typeof setter === 'function' )
			setter.bind(this)(val);
		else
			this.settings.set(setter, val);

		swit.classList.toggle('active', val);
	},

	option_basic_setting = function(select, key) {
		FFZ.basic_settings[key].set.bind(this)(JSON.parse(select.options[select.selectedIndex].value));
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

	for(var key in FFZ.settings_info) {
		if ( ! FFZ.settings_info.hasOwnProperty(key) )
			continue;

		this._setting_load(key);
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


FFZ.prototype.save_settings_file = function() {
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

		if ( localStorage.hasOwnProperty(ls_key) )
			data.settings[key] = this.settings[key];
	}

	var blob = new Blob([JSON.stringify(data, null, 4)], {type: "application/json;charset=utf-8"});
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

FFZ.prototype._load_settings_file = function(data) {
	try {
		data = JSON.parse(data);
	} catch(err) {
		this.error("Error Loading Settings: " + err);
		return alert("There was an error attempting to read the provided settings data.");
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
				val = info.process_value.bind(this)(val);

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
	setTimeout(function(){
		alert('Successfully loaded ' + applied.length + ' settings and skipped ' + skipped.length + ' settings. Added ' + aliases + ' user nicknames.');
	});
}


// --------------------
// Menu Page
// --------------------

FFZ.menu_pages.settings = {
	render: function(view, container) {
		// Bottom Bar
		var menu = document.createElement('ul'),
			page = document.createElement('div'),

			tab_basic = document.createElement('li'),
			link_basic = document.createElement('a'),

			tab_adv = document.createElement('li'),
			link_adv = document.createElement('a'),

			tab_save = document.createElement('li'),
			link_save = document.createElement('a'),

			height = parseInt(container.style.maxHeight || '0');


		// Height Calculation
		if ( ! height )
			height = Math.max(200, view.$().height() - 172);

		if ( height && height !== NaN ) {
			height -= 37;
			page.style.maxHeight = height + 'px';
		}

		// Menu Building
		page.className = 'ffz-ui-sub-menu-page';
		menu.className = 'menu sub-menu clearfix';

		tab_basic.className = 'item';
		tab_basic.id = 'ffz-settings-page-basic';
		link_basic.innerHTML = 'Basic';
		tab_basic.appendChild(link_basic);

		tab_adv.className = 'item';
		tab_adv.id = 'ffz-settings-page-advanced';
		link_adv.innerHTML = 'Advanced';
		tab_adv.appendChild(link_adv);

		tab_save.className = 'item';
		tab_save.id = 'ffz-settings-page-save';
		link_save.textContent = 'Backup & Restore';
		tab_save.appendChild(link_save);

		menu.appendChild(tab_basic);
		menu.appendChild(tab_adv);
		menu.appendChild(tab_save);

		var cp = FFZ.menu_pages.settings.change_page;

		link_basic.addEventListener('click', cp.bind(this, view, container, menu, page, 'basic'));
		link_adv.addEventListener('click', cp.bind(this, view, container, menu, page, 'advanced'));
		link_save.addEventListener('click', cp.bind(this, view, container, menu, page, 'save'));

		if ( this.settings.advanced_settings )
			link_adv.click();
		else
			link_basic.click();

		container.appendChild(page);
		container.appendChild(menu);
	},

	change_page: function(view, container, menu, page, key) {
		page.innerHTML = '';
		page.setAttribute('data-page', key);

		var els = menu.querySelectorAll('li.active');
		for(var i=0, l = els.length; i < l; i++)
			els[i].classList.remove('active');

		var el = menu.querySelector('#ffz-settings-page-' + key);
		if ( el )
			el.classList.add('active');

		FFZ.menu_pages.settings['render_' + key].bind(this)(view, page);

		if ( key === 'advanced' )
			this.settings.set('advanced_settings', true);
		else if ( key === 'basic' )
			this.settings.set('advanced_settings', false);
	},

	render_save: function(view, container) {
		var backup_head = document.createElement('div'),
			restore_head = document.createElement('div'),
			reset_head = document.createElement('div'),

			backup_cont = document.createElement('div'),
			restore_cont = document.createElement('div'),
			reset_cont = document.createElement('div'),

			backup_para = document.createElement('p'),
			backup_link = document.createElement('a'),
			backup_help = document.createElement('span'),

			restore_para = document.createElement('p'),
			restore_input = document.createElement('input'),
			restore_link = document.createElement('a'),
			restore_help = document.createElement('span'),

			reset_para = document.createElement('p'),
			reset_link = document.createElement('a'),
			reset_help = document.createElement('span'),
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
	},

	render_basic: function(view, container) {
		var settings = {},
			categories = [],
			is_android = navigator.userAgent.indexOf('Android') !== -1;

		for(var key in FFZ.basic_settings) {
			if ( ! FFZ.basic_settings.hasOwnProperty(key) )
				continue;

			var info = FFZ.basic_settings[key],
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
			current_page = this._ffz_basic_settings_page || categories[0];

		for(var ci=0; ci < categories.length; ci++) {
			var category = categories[ci],
				cset = settings[category],

				menu = document.createElement('div'),
				heading = document.createElement('div');

			heading.className = 'heading';
			menu.className = 'chat-menu-content'; // collapsable';

			menu.setAttribute('data-category', category);
			//menu.classList.toggle('collapsed', current_page !== category);

			heading.innerHTML = category;
			menu.appendChild(heading);

			/*menu.addEventListener('click', function() {
				if ( ! this.classList.contains('collapsed') )
					return;

				var t = this,
					old_selection = container.querySelectorAll('.chat-menu-content:not(.collapsed)');
				for(var i=0; i < old_selection.length; i++)
					old_selection[i].classList.add('collapsed');

				f._ffz_basic_settings_page = t.getAttribute('data-category');
				t.classList.remove('collapsed');
				setTimeout(function(){t.scrollIntoViewIfNeeded()});
			});*/

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
					val = info.type !== "button" && typeof info.get === 'function' ? info.get.bind(this)() : this.settings.get(info.get);

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

						swit.addEventListener("click", toggle_basic_setting.bind(this, swit, key));

					} else if ( info.type === "select" ) {
						var select = document.createElement('select'),
							label = document.createElement('span');

						label.className = 'option-label';
						label.innerHTML = info.name;

						for(var ok in info.options) {
							var op = document.createElement('option');
							op.value = JSON.stringify(ok);
							if ( val == ok )
								op.setAttribute('selected', true);
							op.innerHTML = info.options[ok];
							select.appendChild(op);
						}

						select.addEventListener('change', option_basic_setting.bind(this, select, key));

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

	render_advanced: function(view, container) {
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
							if ( val == ok )
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
	wide: true,
	sub_menu: true
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
			val = info.process_value.bind(this)(val);
		} catch(err) {
			this.log('Error processing value for setting "' + key + '": ' + err);
			return;
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
		val = info.process_value.bind(this)(val);

	this.settings[key] = val;
}


FFZ.prototype._setting_get = function(key) {
	return this.settings[key];
}


FFZ.prototype._setting_set = function(key, val) {
	var info = FFZ.settings_info[key],
		ls_key = info.storage_key || make_ls(key);

	if ( info.process_value )
		try {
			val = info.process_value.bind(this)(val)
		} catch(err) {
			this.log('Error processing value for setting "' + key + '": ' + err);
			return false;
		}

	this.settings[key] = val;

	var jval = JSON.stringify(val);
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

	if ( info )
		val = this.settings[key] = info.hasOwnProperty("value") ? info.value : undefined;

	this.settings[key] = val;

	if ( info.on_update )
		try {
			info.on_update.bind(this)(val, true);
		} catch(err) {
			this.log('Error running updater for setting "' + key + '": ' + err);
		}
}