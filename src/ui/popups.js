var FFZ = window.FrankerFaceZ;


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_popups = function() {
	this.log("Installing mouse-up event to auto-close pop-ups.");
	var f = this;

	jQuery(document).mouseup(function(e) {
		if ( e.button && e.button !== 0 )
			return;

		var popup = f._popup,
			parent = f._popup_parent;

		if ( ! popup )
			f._last_popup = undefined;

		if ( ! popup || popup === e.target || popup.contains(e.target) )
			return;

		if ( popup.id === 'ffz-chat-menu' && popup.style && popup.style.left )
			return;

		if ( f._popup_allow_parent ) {
			var parent = f._popup_parent || popup.parentElement;
			if ( parent && ( parent === e.target || parent.contains(e.target) ) )
				return;
		}

		f.close_popup();
	});
}


// ---------------
// Management
// ---------------

FFZ.prototype.close_popup = function() {
	var popup = this._popup;
	this._last_popup = popup;
	if ( ! popup )
		return;

	popup.parentElement.removeChild(popup);

	if ( this._popup_kill )
		try {
			this._popup_kill();
		} catch(err) {
			this.error("_popup_kill: " + err);
		}

	this._popup = undefined;
	this._popup_parent = undefined;
	this._popup_kill = undefined;
	this._popup_allow_parent = undefined;
	return popup;
}


FFZ.prototype.show_popup = function(el, position, container, cleanup, allow_parent, dont_insert_handler) {
	if ( this._popup )
		this.close_popup();

	this._popup = el;
	this._popup_allow_parent = allow_parent || false;
	this._popup_kill = cleanup;

	container = container || document.querySelector('.app-main') || document.body;

	var bounds = container.getBoundingClientRect();

	el.style.display = 'block';
	el.style.position = 'absolute';
	el.style.left = (position[0] - bounds.left) + 'px';
	el.style.top = (position[1] - bounds.top) + 'px';

	container.appendChild(el);
}