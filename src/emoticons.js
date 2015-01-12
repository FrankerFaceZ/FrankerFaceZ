var FFZ = window.FrankerFaceZ,
	CSS = /\.([\w\-_]+)\s*?\{content:\s*?"([^"]+)";\s*?background-image:\s*?url\("([^"]+)"\);\s*?height:\s*?(\d+)px;\s*?width:\s*?(\d+)px;\s*?margin:([^;}]+);?([^}]*)\}/mg,
	constants = require('./constants'),
	utils = require('./utils');


var loaded_global = function(set_id, success, data) {
	if ( ! success )
		return;

	data.global = true;
	this.global_sets.push(set_id);
}

var check_margins = function(margins, height) {
	var mlist = margins.split(/ +/);
	if ( mlist.length != 2 )
		return margins;

	mlist[0] = parseFloat(mlist[0]);
	mlist[1] = parseFloat(mlist[1]);

	if ( mlist[0] == (height - 18) / -2 && mlist[1] == 0 )
		return null;

	return margins;
}


FFZ.prototype.setup_emoticons = function() {
	this.log("Preparing emoticon system.");

	this.emote_sets = {};
	this.global_sets = [];
	this._last_emote_id = 0;

	this.log("Creating emoticon style element.");
	var s = this._emote_style = document.createElement('style');
	s.id = "ffz-emoticon-css";
	document.head.appendChild(s);

	this.log("Loading global emote set.");
	this.load_set("global", loaded_global.bind(this, "global"));
}



FFZ.ws_commands.reload_set = function(set_id) {
	this.load_set(set_id);
}


FFZ.prototype.load_set = function(set_id, callback) {
	return this._legacy_load_set(set_id, callback);
}


FFZ.prototype.unload_set = function(set_id) {
	var set = this.emote_sets[set_id];
	if ( ! set )
		return;

	this.log("Unloading emoticons for set: " + set_id);

	utils.update_css(this._emote_style, set_id, null);
	delete this.emote_sets[set_id];

	for(var i=0; i < set.users.length; i++) {
		var room = this.rooms[set.users[i]];
		if ( room )
			room.sets.removeObject(set_id);
	}
}


var build_css = function(emote) {
	var margin = emote.margins;
	if ( ! margin )
		margin = ((emote.height - 18) / -2) + "px 0";
	return ".ffz-emote-" + emote.id + ' { background-image: url("' + emote.url + '"); height: ' + emote.height + "px; width: " + emote.width + "px; margin: " + margin + (emote.extra_css ? "; " + emote.extra_css : "") + "}\n";
}

FFZ.prototype._load_set_json = function(set_id, callback, data) {
	// Store our set.
	this.emote_sets[set_id] = data;
	data.users = [];
	data.global = false;

	// Iterate through all the emoticons, building CSS and regex objects as appropriate.
	var output_css = "";

	for(var key in data.emotes) {
		if ( ! data.emotes.hasOwnProperty(key) )
			continue;

		var emote = data.emotes[key];
		emote.klass = "ffz-emote-" + emote.id;

		if ( emote.name[emote.name.length-1] === "!" )
			emote.regex = new RegExp("\\b" + emote.name + "(?=\\W|$)", "g");
		else
			emote.regex = new RegExp("\\b" + emote.name + "\\b", "g");

		output_css += build_css(emote);
	}

	utils.update_css(this._emote_style, set_id, output_css + (data.extra_css || ""));
	this.log("Updated emoticons for set: " + set_id, data);

	if ( callback )
		callback(true, data);
}


FFZ.prototype._legacy_load_set = function(set_id, callback, tries) {
	jQuery.ajax(constants.SERVER + "channel/" + set_id + ".css", {cache: false, context:this})
		.done(function(data) {
			this._legacy_load_css(set_id, callback, data);

		}).fail(function(data) {
			if ( data.status == 404 )
				return callback && callback(false);

			tries = tries || 0;
			tries++;
			if ( tries < 10 )
				return this._legacy_load_set(set_id, callback, tries);

			return callback && callback(false);
		});
}


FFZ.prototype._legacy_load_css = function(set_id, callback, data) {
	var emotes = {}, output = {id: set_id, emotes: emotes, extra_css: null}, f = this;

	data.replace(CSS, function(match, klass, name, path, height, width, margins, extra) {
		height = parseInt(height); width = parseInt(width);
		margins = check_margins(margins, height);
		var hidden = path.substr(path.lastIndexOf("/") + 1, 1) === ".",
			id = ++f._last_emote_id,
			emote = {id: id, hidden: hidden, name: name, height: height, width: width, url: path, margins: margins, extra_css: extra};

		emotes[id] = emote;
		return "";
	});

	this._load_set_json(set_id, callback, output);
}