var FFZ = window.FrankerFaceZ;


// --------------------
// Settings
// --------------------

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
		
		isTooSmallForRightColumn: function() {
			return this.get("windowWidth") < (1090 - this.get('rightColumnWidth'))
		}.property("windowWidth", "rightColumnWidth"),
		
		contentWidth: function() {
			var left_width = this.get("isLeftColumnClosed") ? 50 : 240,
				right_width = this.get("isRightColumnClosed") ? 0 : this.get("rightColumnWidth");

			return this.get("windowWidth") - left_width - right_width - 60;
			
		}.property("windowWidth", "isRightColumnClosed", "isLeftColumnClosed", "rightColumnWidth"),
		
		/*ffzUpdateWidth: _.throttle(function() {
			var rc = document.querySelector('#right_close');
			if ( ! rc )
				return;
			
			var left_width = this.get("isLeftColumnClosed") ? 50 : 240,
				right_width;
			
			if ( f.settings.swap_sidebars )
				right_width = rc.offsetLeft; // + this.get('rightColumnWidth') - 5;
			else
				right_width = document.body.offsetWidth - rc.offsetLeft - left_width - 25;
			
			if ( right_width < 250 ) {
				// Close it!
				
			}

			this.set('rightColumnWidth', right_width);
			Ember.propertyDidChange(Layout, 'contentWidth');
		}, 200),*/
		
		ffzUpdateCss: function() {
			var width = this.get('rightColumnWidth');
			
			f._layout_style.innerHTML = '#main_col.expandRight #right_close { left: none !important; } #right_col { width: ' + width + 'px; } body:not(.ffz-sidebar-swap) #main_col:not(.expandRight) { margin-right: ' + width + 'px; } body.ffz-sidebar-swap #main_col:not(.expandRight) { margin-left: ' + width + 'px; }';

		}.observes("rightColumnWidth"),
		
		ffzFixTabs: function() {
			if ( f.settings.group_tabs && f._chatv && f._chatv._ffz_tabs ) {
				setTimeout(function() {
					f._chatv && f._chatv.$('.chat-room').css('top', f._chatv._ffz_tabs.offsetHeight + "px");
				},0);
			}
		}.observes("isRightColumnClosed", "rightColumnWidth")
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
	Ember.propertyDidChange(Layout, 'contentWidth');
}