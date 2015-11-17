var FFZ = window.FrankerFaceZ;


// --------------------
// Settings
// --------------------

FFZ.settings_info.portrait_mode = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Automatic (Use Window Aspect Ratio)",
		2: "Always On",
		3: "Automatic (Video Below)",
		4: "Always On (Video Below)"
	},

	value: 0,

	process_value: function(val) {
		if ( val === false )
			return 0;
		if ( val === true )
			return 1;
		if ( typeof val === "string" )
			return parseInt(val) || 0;
		return val;
	},

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,

	name: "Portrait Mode (Chat Below Video)",
	help: "Display the right sidebar beneath (or above) the video player for viewing in portrait orientations.",

	on_update: function(val) {
		if ( this.has_bttv )
			return;

		var Layout = window.App && App.__container__.lookup('controller:layout');
		if ( ! Layout )
			return;

		Layout.set('rawPortraitMode', val);
		this._fix_menu_position();
	}
}

FFZ.settings_info.portrait_warning = {
	value: false,
	visible: false
}


FFZ.settings_info.swap_sidebars = {
	type: "boolean",
	value: false,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,

	name: "Swap Sidebar Positions",
	help: "Swap the positions of the left and right sidebars, placing chat on the left.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-sidebar-swap", val);
			this._fix_menu_position();
		}
	};


FFZ.settings_info.flip_dashboard = {
	type: "boolean",
	value: false,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,

	name: "Swap Dashboard Positions",
	help: "Swap the positions of the left and right columns of the dashboard.",

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			document.body.classList.toggle("ffz-flip-dashboard", val);
		}
	};


FFZ.settings_info.right_column_width = {
	type: "button",
	value: 340,

	category: "Appearance",
	no_mobile: true,
	no_bttv: true,

	name: "Right Sidebar Width",
	help: "Set the width of the right sidebar for chat.",

	method: function() {
			var old_val = this.settings.right_column_width || 340,
				new_val = prompt("Right Sidebar Width\n\nPlease enter a new width for the right sidebar, in pixels. Minimum: 250, Default: 340", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var width = parseInt(new_val);
			if ( ! width || width === NaN )
				width = 340;

			this.settings.set('right_column_width', Math.max(250, width));
		},

	on_update: function(val) {
			if ( this.has_bttv )
				return;

			var Layout = App.__container__.lookup('controller:layout');
			if ( ! Layout )
				return;

			Layout.set('rightColumnWidth', val);
			Ember.propertyDidChange(Layout, 'contentWidth');
		}
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_layout = function() {
	if ( this.has_bttv )
		return;

	document.body.classList.toggle("ffz-sidebar-swap", this.settings.swap_sidebars);
	document.body.classList.toggle("ffz-portrait", this.settings.portrait_mode);

	this.log("Creating layout style element.");
	var s = this._layout_style = document.createElement('style');
	s.id = 'ffz-layout-css';
	document.head.appendChild(s);

	this.log("Hooking the Ember Layout controller.");
	var Layout = App.__container__.lookup('controller:layout'),
		f = this;

	if ( ! Layout )
		return;

	Layout.reopen({
		rightColumnWidth: 340,
		rawPortraitMode: 0,

		portraitVideoBelow: false,

		portraitMode: function() {
			var raw = this.get("rawPortraitMode");
			this.set('portraitVideoBelow', raw === 3 || raw === 4);

			if ( raw === 0 )
				return false;
			if ( raw === 2 || raw === 4 )
				return true;

			// Not sure if I should be adding some other value to offset the ratio. What feels best?
			var ratio = this.get("windowWidth") / (this.get("windowHeight") + 120 + 60);
			return ratio < 1;

		}.property("rawPortraitMode", "windowHeight", "windowWidth"),

		isTooSmallForRightColumn: function() {
			if ( ! f.has_bttv && this.get('portraitMode') ) {
				var size = this.get('playerSize'),
					height = size[1];

				// Make sure we have at least a bit of room for the chat.
				return this.get("windowHeight") < (height + 120 + 60 + 200);

			} else
				return this.get("windowWidth") < (1090 - this.get('rightColumnWidth'))

		}.property("windowWidth", "rightColumnWidth", "playerSize", "windowHeight"),

		contentWidth: function() {
			var left_width = this.get("isLeftColumnClosed") ? 50 : 240,
				right_width = ! f.has_bttv && this.get('portraitMode') ? 0 : this.get("isRightColumnClosed") ? 0 : this.get("rightColumnWidth");

			return this.get("windowWidth") - left_width - right_width - 60;

		}.property("windowWidth", "portraitMode", "isRightColumnClosed", "isLeftColumnClosed", "rightColumnWidth"),

		playerSize: function() {
			var h = this.get('windowHeight'),
				c = this.get('PLAYER_CONTROLS_HEIGHT'),
				r = this.get('contentWidth'),

				i = (9 * r / 16) + c,
				d = h - 120 - 60,
				c = h - 94 - 185,

				l = Math.floor(r),
				o = Math.floor(Math.min(i, d)),
				s = Math.floor(Math.min(i, c));

			return [l, o, s];
		}.property("contentWidth", "windowHeight", "portraitMode", "PLAYER_CONTROLS_HEIGHT"),

		playerStyle: function() {
			var size = this.get('playerSize'),
				width = size[0],
				height = size[1],
				host_height = size[2];

			return "<style>.dynamic-player, .dynamic-player object, .dynamic-player video{width:" + width + "px !important;height:" + height + "px !important} .dynamic-target-player,.dynamic-target-player object, .dynamic-target-player video{width:" + width + "px !important;height:" + host_height + "px !important}</style><style>.dynamic-player .player object{width:100% !important; height:100% !important}</style>";
		}.property("playerSize"),

		ffzPortraitWarning: function() {
			if ( ! f.settings.portrait_mode || f._portrait_warning || f.settings.portrait_warning || ! this.get('isTooSmallForRightColumn') )
				return;

			f._portrait_warning = true;
			f.show_message('Twitch\'s Chat Sidebar has been hidden as a result of FrankerFaceZ\'s Portrait Mode because the window is too wide.<br><br>Please <a href="#" onclick="ffz.settings.set(\'portrait_mode\',0);jQuery(this).parents(\'.ffz-noty\').remove();ffz._portrait_warning = false;return false">disable Portrait Mode</a> or make your window narrower.<br><br><a href="#" onclick="ffz.settings.set(\'portrait_warning\',true);jQuery(this).parents(\'.ffz-noty\').remove();return false">Do not show this message again</a>');

		}.observes("isTooSmallForRightColumn"),

		ffzUpdateCss: function() {
			// TODO: Fix this mess of duplicate code.
			var out = '';

			if ( ! f.has_bttv ) {
				if ( this.get('portraitMode') ) {
					var size = this.get('playerSize'),
						height = size[1],
						top = height + 120 + 60;

					if ( this.get('portraitVideoBelow') ) {
						var wh = this.get("windowHeight"),
							mch = wh - top;

						out = (this.get('isRightColumnClosed') ? '' : 'body[data-current-path^="user."] #left_col, ') +
						'body[data-current-path^="user."]:not(.ffz-sidebar-swap) #main_col:not(.expandRight) { margin-right: 0 !important; top: ' + mch + 'px; height: ' + top + 'px; }' +
						'body[data-current-path^="user."].ffz-sidebar-swap #main_col:not(.expandRight) { margin-left: 0 !important; top: ' + mch + 'px; height: ' + top + 'px; }' +
						'body[data-current-path^="user."] #right_col { width: 100%; height: ' + mch + 'px; left: 0; }';
					} else
						out = (this.get('isRightColumnClosed') ? '' : 'body[data-current-path^="user."] #left_col, ') +
						'body[data-current-path^="user."]:not(.ffz-sidebar-swap) #main_col:not(.expandRight) { margin-right: 0 !important; height: ' + top + 'px; }' +
						'body[data-current-path^="user."].ffz-sidebar-swap #main_col:not(.expandRight) { margin-left: 0 !important; height: ' + top + 'px; }' +
						'body[data-current-path^="user."] #right_col { width: 100%; top: ' + top + 'px; left: 0; }';

					// Theatre Mode Portrait
					if ( true ) { //this.get('theaterPortraitMode') ) {
						// Recalculate the player height, not including the title or anything special.
						var width = this.get("windowWidth"),
							wh = this.get("windowHeight"),
							height = (9 * width / 16);

						height = Math.floor(Math.max(wh * 0.1, Math.min(wh - 300, height)));

						if ( this.get('portraitVideoBelow') ) {
							var mch = this.get("windowHeight") - height;

							out += (this.get('isRightColumnClosed') ? '' : 'body[data-current-path^="user."] .app-main.theatre #left_col, ') +
							'body[data-current-path^="user."]:not(.ffz-sidebar-swap) .app-main.theatre #main_col:not(.expandRight) { margin-right: 0 !important; top: ' + mch + 'px; height: ' + height + 'px; }' +
							'body[data-current-path^="user."].ffz-sidebar-swap .app-main.theatre #main_col:not(.expandRight) { margin-left: 0 !important; top: ' + mch + 'px; height: ' + height + 'px; }' +
							'body[data-current-path^="user."] .app-main.theatre #right_col { width: 100%; height: ' + mch + 'px; left: 0; }';
						} else
							out += 'body[data-current-path^="user."]:not(.ffz-sidebar-swap) .app-main.theatre #main_col:not(.expandRight) { margin-right: 0 !important; height: ' + height + 'px; }' +
							'body[data-current-path^="user."].ffz-sidebar-swap .app-main.theatre #main_col:not(.expandRight) { margin-left: 0 !important; height: ' + height + 'px; }' +
							'body[data-current-path^="user."] .app-main.theatre #right_col { width: 100%; top: ' + height + 'px; left: 0; }';
					}

				} else {
					var width = this.get('rightColumnWidth');

					out = '#main_col.expandRight #right_close { left: none !important; }' +
						'#right_col { width: ' + width + 'px; }' +
						'body:not(.ffz-sidebar-swap) #main_col:not(.expandRight) { margin-right: ' + width + 'px; }' +
						'body.ffz-sidebar-swap #main_col:not(.expandRight) { margin-left: ' + width + 'px; }';
				}

				f._layout_style.innerHTML = out;
			}

		}.observes("isRightColumnClosed", "playerSize", "rightColumnWidth", "portraitMode", "windowHeight", "windowWidth"),

		ffzUpdatePortraitCSS: function() {
			var portrait = this.get("portraitMode");
			document.body.classList.toggle("ffz-portrait", ! f.has_bttv && portrait);

		}.observes("portraitMode"),

		ffzFixTabs: function() {
			if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs ) {
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
				},0);
			}
		}.observes("isRightColumnClosed", "rightColumnWidth", "portraitMode", "playerSize")
	});

	/*
	// Try modifying the closer.
	var rc = jQuery("#right_close");
	if ( ! rc || ! rc.length )
		return;

	rc.draggable({
		axis: "x",
		drag: Layout.ffzUpdateWidth.bind(Layout),
		stop: Layout.ffzUpdateWidth.bind(Layout)
		});*/


	// Force the layout to update.
	Layout.set('rightColumnWidth', this.settings.right_column_width);
	Layout.set('rawPortraitMode', this.settings.portrait_mode);

	// Force re-calculation of everything.
	Ember.propertyDidChange(Layout, 'windowWidth');
	Ember.propertyDidChange(Layout, 'windowHeight');
}