var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');
	styles = require('../compiled_styles');

FFZ.prototype.setup_css = function() {
	document.body.classList.toggle('ffz-flip-dashboard', this.settings.flip_dashboard);

	this.log("Injecting main FrankerFaceZ CSS.");

	var s = this._main_style = document.createElement('link');
	s.id = "ffz-main-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.SERVER + "script/style" + (this.is_clips ? '-clips' : '') + (constants.DEBUG ? "" : ".min") + ".css?_=" + (constants.DEBUG ? Date.now() : FFZ.version_info));
	document.head.appendChild(s);

	this.log("Readying toggleable styles.");
	this._toggle_style_state = {};

	s = this._toggle_style = document.createElement('style');
	s.type = "text/css";
	s.id = "ffz-toggle-css";
	document.head.appendChild(s);

	/*var s = this._main_style = document.createElement('style');

	s.textContent = styles.style;
	s.id = "ffz-main-css";

	document.head.appendChild(s);*/

	if ( window.jQuery && jQuery.noty )
		jQuery.noty.themes.ffzTheme = {
			name: "ffzTheme",
			style: function() {
				this.$bar.removeClass().addClass("noty_bar").addClass("ffz-noty").addClass(this.options.type);
				},
			callback: {
				onShow: function() {},
				onClose: function() {}
			}
		};
}


FFZ.prototype._scroll_fixed = null;

FFZ.prototype.fix_scroll = function() {
	if ( this._scroll_fixed )
		return;

	var f = this,
		main = document.querySelector('.app-main');

	if ( main ) {
		this._scroll_fixed = true;
		main.addEventListener('scroll', function() {
			if ( this.scrollTop !== 0 ) {
				f.log("The application scrolled wrongly. Correcting.");
				this.scrollTop = 0;
			}
		});
	}
}


FFZ.prototype.toggle_style = function(key, enabled) {
	var state = this._toggle_style_state[key];
	if ( (enabled && state) || (!enabled && !state) )
		return;

	this._toggle_style_state[key] = enabled;

	utils.update_css(this._toggle_style, key, enabled ? styles[key] || null : null);
}