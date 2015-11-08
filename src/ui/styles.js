var FFZ = window.FrankerFaceZ,
	constants = require('../constants');
	//styles = require('../styles');

FFZ.prototype.setup_css = function() {
	document.body.classList.toggle('ffz-flip-dashboard', this.settings.flip_dashboard);

	this.log("Injecting main FrankerFaceZ CSS.");

	var s = this._main_style = document.createElement('link');
	s.id = "ffz-main-css";
	s.setAttribute('rel', 'stylesheet');
	s.setAttribute('href', constants.DIRECT_SERVER + "script/style.css?_=" + (constants.DEBUG ? Date.now() : FFZ.version_info));
	document.head.appendChild(s);

	/*var s = this._main_style = document.createElement('style');

	s.textContent = styles.style;
	s.id = "ffz-ui-css";

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