var FFZ = window.FrankerFaceZ;

FFZ.prototype.show_notification = function(message) {
	window.noty({
		text: message,
		theme: "ffzTheme",
		layout: "bottomCenter",
		closeWith: ["button"]
		}).show();
}


FFZ.ws_commands.message = function(message) {
	this.show_notification(message);
}