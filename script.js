(function wrapper(window, injectNeeded) {
'use strict';

// Script injection as necessary.
if ( injectNeeded ) {
	var script = document.createElement('script');
	script.textContent = '(' + wrapper + ')(window, false)';
	document.body.appendChild(script);
	document.body.removeChild(script);
	return;
}

// -----------------
// Global Variables
// -----------------

var CSS = /\.([\w\-_]+) \{content:.*?"([^"]+)";.*?background-image: url\("([^"]+)"\);.*?height:.*?(\d+).+?width:.*?(\d+)[^}]*\}/mg,
	IMGUR_KEY = 'e48d122e3437051', CACHE_LENGTH = 10800000,
	DEBUG = location.search.indexOf('frankerfacez') !== -1;


// -----------------
// The Constructor
// -----------------

var ffz = function() {
	this.alive = true;
	this.donors = {};
	this.getting = {};

	// Master Emoticon Storage
	this.emoticons = [];
	this.emotesets = {};

	// Channel Storage
	this.channels = {};

	// Global Sets Storage
	this.collections = {};
	this.globals = {};
	this.global_sets = [];
	this.styles = {};

	// Pending Styles -- For Super Early Initialization
	this.pending_styles = [];

	// Keep track of all logging too.
	this._log = [];
	this._log2 = [];

	// Now, let's do this!
	this.init(10);
};

ffz.prototype.last_set = 0;
ffz.prototype.last_emote = 0;
ffz.prototype.manger = null;

ffz.commands = {};


// -----------------
// Logging
// -----------------

ffz.prototype.log = function(msg) {
	this._log.push(msg);
	msg = "FFZ" + (this.alive ? ": " : " (Dead): ") + msg;
	console.log(msg);

	// Don't echo to chat if we're not debugging.
	if ( !DEBUG ) return;

	var chan;
	for(var name in this.channels) {
		if ( this.channels[name] && this.channels[name].room ) {
			chan = this.channels[name];
			break;
		}
	}

	if ( chan )
		chan.room.addTmiMessage(msg);
	else
		this._log2.push(msg);
};


// -----------------
// Initialization
// -----------------

ffz.prototype.init = function(increment, delay) {
	// This function exists to ensure FFZ doesn't run until it can properly
	// hook into the Twitch Ember application.
	if ( !this.alive ) return;

	// A secondary check for old chat.
	if ( window.CurrentChat && window.CurrentChat.emoticons ) {
		this.log("Detected old chat. Injecting old FFZ.");
		return this.inject_old();
	}

	var loaded = window.Ember != undefined && 
				 window.App != undefined &&
				 App.EmoticonsController != undefined && 
				 App.Room != undefined;

	if ( !loaded ) {
		// Only try loading for 60 seconds.
		if ( delay >= 60000 )
			this.log("Twitch API not detected in \"" + location.toString() + "\". Aborting.");
		else
			setTimeout(this.init.bind(this, increment, (delay||0) + increment),
				increment);
		return;
	}

	// Inject the old FFZ script if we can't use new chat.
	if ( App.hasOwnProperty('useNewChat') && !App.useNewChat ) {
		this.log("Detected old chat. Injecting old FFZ.");
		return this.inject_old();
	}

	this.setup();
};

ffz.prototype.inject_old = function() {
	if ( this._dom )
		document.removeEventListener("DOMContentLoaded", this._dom, false);

	if ( !document.body ) {
		this._dom = this.inject_old.bind(this);
		document.addEventListener("DOMContentLoaded", this._dom, false);
		return;
	}

	var s = document.createElement('script');
	s.src = "//commondatastorage.googleapis.com/frankerfacez/script/old-frankerfacez.js";
	document.body.appendChild(s);
	document.body.removeChild(s);
}

ffz.prototype.setup = function() {
	if ( !this.alive ) return;

	// Hook into the Ember application.
	this.log("Hooking Ember application.");
	this.modify_room();
	this.modify_viewers();
	this.modify_emotes();
	this.modify_lines();

	this.log("Loading data.");
	this.load_donors();
	this.load_emotes('global');

	if ( ! document.body ) {
		// We need to listen for the DOM to load in case any style elements
		// get created before we can add them.
		this.listen_dom = this.listen_dom.bind(this);
		document.addEventListener("DOMContentLoaded", this.listen_dom, false);
	}

	this.log("Initialization complete.");
};

ffz.prototype.destroy = function() {
	if ( !this.alive ) return;

	// TODO: Teardown stuff.

	// Mark us as dead and remove our reference.
	alive = false;
	if ( window.ffz === this )
		window.ffz = undefined;

	// And, before the door hits us... delete the log.
	delete this._log;
	delete this._log2;
}


// -----------------
// DOM Listening
// -----------------

ffz.prototype.listen_dom = function() {
	document.removeEventListener("DOMContentLoaded", this.listen_dom, false);

	// Check for waiting styles.
	while ( this.pending_styles.length )
		document.body.appendChild(this.pending_styles.pop());
}


// -----------------
// Commands
// -----------------

var msg = function(room, out) {
	out = out.split("\n");
	for(var i=0; i < out.length; i++)
		room.addMessage({style: 'ffz admin', from: 'FFZ', message: out[i]});
}

ffz.prototype.run_command = function(room, m) {
	var args = (m.substr(5) || "list").split(' '),
		cmd = args.shift().toLowerCase();

	this.log("Got FFZ Command: " + cmd + " " + JSON.stringify(args));

	var c = ffz.commands[cmd], out;
	if ( c )
		out = c.bind(this)(room, args);
	else
		out = "No such sub-command.";

	if ( out ) msg(room, out);
}

ffz.commands['help'] = function(room, args) {
	if ( args && args.length > 0 ) {
		var c = ffz.commands[args[0].toLowerCase()];
		if ( !c )
			return "No such sub-command: " + args[0];
		else if ( c && c.help == undefined )
			return "No help available for: " + args[0];
		else
			return c.help;
	}

	var l = [];
	for (var c in ffz.commands)
		ffz.commands.hasOwnProperty(c) ? l.push(c) : false;

	return "Available sub-commands are: " + l.join(", ");
}
ffz.commands['help'].help = "Usage: /ffz help [command]\nList available commands, or show help for a specific command.";

ffz.commands['log'] = function(room, args) {
	var out = "FrankerFaceZ Session Log\n\n" + this._log.join("\n");
	
	out += "\n\n--------------------------------------------------------------------------------\n" +
		"Internal State\n\n";

	out += "Channels:\n";
	for(var id in this.channels) {
		if ( !this.channels.hasOwnProperty(id) )
			continue;

		var chan = this.channels[id];
		if ( !chan ) {
			out += "  " + id + " (Unloaded)\n";
			continue;
		}

		out += "  " + id + ":\n";
		out += "    set_id: " + chan.set_id + "\n";
		
		if ( ! chan.set ) {
			out += "    set (Unloaded)\n";
		} else {
			out += "    set:\n";
			for(var i=0; i < chan.set.length; i++) {
				var e = chan.set[i];
				out += "      isEmoticon: " + e.isEmoticon + ", cls: " + JSON.stringify(e.cls) + ", regex: " + e.regex.toString() + "\n";
			}
			out += "\n";
		}

		if ( ! chan.style) {
			out += "    style (Unloaded)";
		} else {
			var s = chan.style.innerHTML.split("\n");
			out += "    style:\n";
			for (var i=0; i < s.length; i++)
				out += "      " + s[i] + "\n";
			out += "\n";
		}
	}

	out += "\nGlobal Sets:\n";
	for(var id in this.globals) {
		if ( !this.globals.hasOwnProperty(id) )
			continue;

		var set_id = this.globals[id];
		if ( !set_id ) {
			out += "  " + id + " (Unloaded)\n";
			continue;
		}

		out += "  " + id + ":\n";
		out += "    set_id: " + set_id + "\n";

		var set = this.emotesets[set_id];
		if ( !set ) {
			out += "    set (Unloaded)\n";
		} else {
			out += "    set:\n";
			for(var i=0; i < set.length; i++) {
				var e = set[i];
				out += "      isEmoticon: " + e.isEmoticon + ", cls: " + JSON.stringify(e.cls) + ", regex: " + e.regex.toString() + "\n";
			}
			out += "\n";
		}

		var style = this.styles[id];
		if ( !style ) {
			out += "    style (Unloaded)\n";
		} else {
			var s = style.innerHTML.split("\n");
			out += "    style:\n";
			for (var i=0; i < s.length; i++)
				out += "      " + s[i] + "\n";
			out += "\n";
		}
	}

	out += "\nEmotes:\n";
	for(var i=0; i < this.emoticons.length; i++) {
		var e = this.emoticons[i];
		out += "  " + e.text + " (" + e.image.id + ")\n";
		out += "     ffzset: " + e.ffzset + " (" + e.image.emoticon_set + ")\n";
		out += "    channel: " + e.channel + "\n";
		out += "      regex: " + e.regex.toString() + "\n";
		out += "     height: " + e.image.height + ", width: " + e.image.width + "\n";
		out += "        url: " + e.image.url + "\n"
		out += "       html: " + e.image.html + "\n\n";
	}

	window.open("data:text/plain," + encodeURIComponent(out), "_blank");
}
ffz.commands['log'].help = "Usage: /ffz log\nOpen a window with FFZ's debugging output.";

ffz.commands['list'] = function(room, args) {
	var output = '', filter;

	if ( args && args.length > 0 )
		filter = args.join(" ").toLowerCase();

	for(var name in this.collections) {
		if ( ! this.collections.hasOwnProperty(name) )
			return;

		var include;
		if ( filter )
			include = name.toLowerCase().indexOf(filter) !== -1;
		else
			include = name !== "FFZ Global Emotes";

		if ( !include )
			continue;

		var em = this.collections[name];
		output += name + "\n";
		for(var e in em) {
			if ( em.hasOwnProperty(e) ) {
				var emote = em[e], t = emote.text;
				t = t[0] + "\u200B" + t.substr(1);
				output += "  " + t + " = " + emote.text + "\n";
			}
		}
	}

	// Make sure we actually have output.
	if ( output.indexOf('\u200B') === -1 )
		return "There are no available FFZ channel emoticons. If this is in error, please try the /ffz reload command.";
	else
		return "The following emotes are available:\n" + output;
}
ffz.commands['list'].help = "Usage: /ffz list [global]\nList available FFZ emoticons. Use the global parameter to list ALL FFZ emoticons, or filter for a specific set.";

ffz.commands['global'] = function(room, args) {
	return ffz.commands['list'].bind(this)(room, ['global']); }
ffz.commands['global'].help = "Usage: /ffz global\nShorthand for /ffz list global. List ALL FFZ emoticons, including FFZ global emoticons.";

ffz.commands['reload'] = function(room, args) {
	for(var id in this.channels)
		if ( this.channels.hasOwnProperty(id) && this.channels[id] )
			this.load_emotes(id, true);

	this.load_emotes('global');
	this.load_donors();

	return "Attempting to reload FFZ data from the server.";
}
ffz.commands['reload'].help = "Usage: /ffz reload\nAttempt to reload FFZ emoticons and donors.";

ffz.commands['inject'] = function(room, args) {
	if ( !args || args.length !== 1 )
		return "/ffz inject requires exactly 1 argument.";

	var album = args[0].split('/').pop().split('?').shift().split('#').shift();
	room.addMessage({style: 'ffz admin', message: "Attempting to load test emoticons from imgur album \"" + album + "\"..."});

	// Make sure there's no cache hits.
	var res = "https://api.imgur.com/3/album/" + album;
	if ( window.localStorage )
		localStorage.removeItem("ffz_" + res);

	this.get(res, this.do_imgur.bind(this, room, album), 1,
		{'Accept': 'application/json', 'Authorization': 'Client-ID ' + IMGUR_KEY},
		5);
}
ffz.commands['inject'].help = "Usage: /ffz inject <album-id>\nLoads emoticons from an imgur album for testing. album-id can simply be the album URL. Ex: /ffz inject http://imgur.com/a/v4aZr";

ffz.prototype.do_imgur = function(room, album, data) {
	if ( data === undefined )
		return msg(room, "An error occurred communicating with Imgur.");
	else if ( !data )
		return msg(room, "The named album does not exist or is private.");

	// Get our data structure.
	data = JSON.parse(data).data;

	var images = data.images, css = "";
	for (var i=0; i < images.length; i++) {
		var im = images[i],
			name = im.title ? im.title : album + (i+1),
			marg = im.height > 18 ? (im.height - 18) / -2 : 0,
			desc = im.description ? im.description.trim().split(/(?:\W*\n\W*)+/) : undefined,
			extra_css = '';

		if ( desc ) {
			for (var q=0; q < desc.length; q++) {
				if ( desc[q].substr(0, 5).toLowerCase() === "css: " ) {
					extra_css = desc[q].substr(5);
					break;
				}
			}
		}

		css += ".imgur-" + album + "-" + (i+1) + ' {content: "' + name +
			'"; background-image: url("' + im.link + '"); height: ' + im.height +
			'px; width: ' + im.width + 'px; margin: ' + marg + 'px 0px; ' + extra_css + '}\n';
	}

	var count = this.process_css('imgur-' + album, 'FFZ Global Emotes - Imgur Album: ' + album, css);
	msg(room, "Loaded " + count + " emoticons from Imgur.");
	msg(room, ffz.commands['list'].bind(this)(room, [album]));
}


// -----------------
// Ember Hooks
// -----------------

ffz.prototype.modify_lines = function() {
	var f = this;
	App.LineView.reopen({
		didInsertElement: function() {
			this._super();
			// Check for Donor Messages
			var sender = this.get('context.model.from');
			if ( ! f.check_donor(sender) )
				return;

			// Create the FFZ Donor badge.
			var c = document.createElement('span');
			c.className = 'badge-container tooltip';
			c.setAttribute('title', 'FFZ Donor');

			var b = document.createElement('div');
			b.className = 'badge ffz-donor';
			c.appendChild(b);
			c.appendChild(document.createTextNode(' '));

			// Get the badge list.
			var badges = this.$('.badges');
			var before = badges.find('.badge-container').filter(function(i) {
				var t = this.title.toLowerCase();
				return t == "subscriber" || t == "turbo";
				}).first();

			if ( before.length )
				before.before(c);
			else
				badges.append(c);
		}
	});
}

ffz.prototype.modify_room = function() {
	var f = this;
	App.Room.reopen({
		init: function() {
			this._super();
			if ( f.alive )
				f.add_channel(this.id, this);
		},

		willDestroy: function() {
			this._super();
			if ( f.alive )
				f.remove_channel(this.id);
		},

		send: function(e) {
			if ( f.alive && (e.substr(0,5) == '/ffz ' || e == '/ffz') ) {
				// Clear the input box.
				this.set("messageToSend", "");
				f.run_command(this, e);
			} else
				return this._super(e);
		}
	});
	
	var inst = App.Room.instances;
	for(var n in inst) {
		if ( ! inst.hasOwnProperty(n) ) continue;
		var i = inst[n];
		if ( f.alive )
			f.add_channel(i.id, i);

		if ( i.tmiRoom && f.alive )
			f.alter_tmi(i.id, i.tmiRoom);
		else if ( i.viewers ) {
			i.viewers.reopen({
				tmiRoom: Ember.computed(function(key, val) {
					if ( arguments.length > 1 ) {
						this.tmiRoom = val;
						if ( f.alive )
							f.alter_tmi(this.id, val);
					}
					return undefined;
				})
			});
		}

		i.reopen({
			willDestroy: function() {
				this._super();
				if ( f.alive ) f.remove_channel(this.id);
			},
			send: function(e) {
				if ( f.alive && (e.substr(0,5) == "/ffz " || e == '/ffz') ) {
					this.set("messageToSend", "");
					f.run_command(this, e);
				} else
					return this._super(e);
			}
		});
	}
};

ffz.prototype.modify_viewers = function() {
	var f = this;
	App.Room.Viewers.reopen({
		tmiRoom: Ember.computed(function(key, val) {
			if ( arguments.length > 1 ) {
				this.tmiRoom = val;
				if ( f.alive )
					f.alter_tmi(this.id, val);
			}
			return undefined;
		})
	});
};

ffz.prototype.modify_emotes = function() {
	var f = this;
	App.EmoticonsController.reopen({
		_emoticons: [],

		init: function() {
			this._super();
			if ( f.alive ) {
				f.manager = this;
				for(var key in f.emotesets) {
					if ( f.emotesets.hasOwnProperty(key) )
						this.emoticonSets[key] = f.emotesets[key];
				}
			}
		},

		emoticons: Ember.computed(function(key, val) {
			if ( arguments.length > 1 ) {
				this._emoticons = val;
				f.log("Twitch standard emoticons loaded.");
			}
			return f.alive ? _.union(this._emoticons, f.emoticons) : this._emoticons;
		})
	});

	var ec = App.__container__.lookup("controller:emoticons");
	if ( ! ec ) return;

	f.manager = ec;
	for(var key in f.emotesets)
		if ( f.emotesets.hasOwnProperty(key) )
			ec.emoticonSets[key] = f.emotesets[key];

	ec.reopen({
		_emoticons: ec.emoticons,
		emoticons: Ember.computed(function(key, val) {
			if ( arguments.length > 1 ) {
				this._emoticons = val;
				f.log("Twitch standard emoticons loaded.");
			}
			return f.alive ? _.union(this._emoticons, f.emoticons) : this._emoticons;
		})
	});
};

// -----------------
// Channel Management
// -----------------

ffz.prototype.add_channel = function(id, room) {
	if ( !this.alive ) return;
	this.log("Registered channel: " + id);
	var chan = this.channels[id] = {id: id, room: room, tmi: null, style: null};

	// Do we have log messages?
	if ( this._log2.length > 0 ) {
		while ( this._log2.length )
			room.addTmiMessage(this._log2.shift());
	}

	// Load the emotes for this channel.
	this.load_emotes(id);
}

ffz.prototype.remove_channel = function(id) {
	var chan = this.channels[id];
	if ( !chan ) return;

	this.log("Removing channel: " + id);

	// Unload the associated emotes.
	this.unload_emotes(id);

	// If we have a tmiRoom for this channel, restore its getEmotes function.
	if ( chan.tmi )
		delete chan.tmi.getEmotes;

	// Delete this channel.
	this.channels[id] = false;
}

ffz.prototype.alter_tmi = function(id, tmi) {
	var chan = this.channels[id], f = this;
	if ( !chan || !this.alive ) return;

	// Store the TMI instance.
	if ( chan.tmi) return;
	chan.tmi = tmi;

	var tp = tmi.__proto__.getEmotes.bind(tmi);
	tmi.getEmotes = function(name) {
		return _.union([chan.set_id], f.global_sets, tp(name)||[]);
	}
}


// -----------------
// Emote Handling
// -----------------

ffz.prototype.load_emotes = function(group, refresh) {
	this.get("//commondatastorage.googleapis.com/frankerfacez/" + group + ".css",
		this.process_css.bind(this, group, undefined), refresh ? 1 : CACHE_LENGTH);
}

ffz.prototype.process_css = function(group, channel, data) {
	if ( !this.alive ) return 0;
	if ( data === undefined ) return 0;

	// Before we go anywhere, let's start clean.
	this.unload_emotes(group);

	// If data is null, we've got no emotes.
	if ( data == null )
		return 0;

	// Let's look up this group to see where it goes! Is it a channel?
	var chan = this.channels[group];
	if ( chan === false )
		// It's for an unloaded channel. Stop here.
		return;

	// Get our new stuff.
	var set_id = --this.last_set, set = [], channel,
		style = document.createElement('style');

	// Let's store our things right now.
	if ( chan ) {
		chan.set_id = set_id;
		chan.set = set;
		chan.style = style;
		channel = "FFZ Channel Emotes: " + group;

	} else {
		this.globals[group] = set_id;
		this.global_sets.push(set_id);
		this.styles[group] = style;

		if ( !channel )
			channel = "FFZ Global Emotes" + (group != "global" ? ": " + group : "");
	}

	// Register this set with the manager.
	this.emotesets[set_id] = set;
	if ( this.manager )
		this.manager.emoticonSets[set_id] = set;

	// Update the style.
	style.type = 'text/css';
	style.innerHTML = data;
	if ( document.body )
		document.body.appendChild(style);
	else
		this.pending_styles.push(style);

	// Parse out the usable emoticons.
	var count = 0, f = this;

	// Store our emotes in an extra place.
	var col = this.collections[channel] = [];

	data.replace(CSS, function(match, klass, name, path, height, width) {
		height = parseInt(height); width = parseInt(width);
		var image_data = {
			emoticon_set: set_id, height: height, width: width, url: path,
			html: '<span class="' + klass + ' emoticon" title="' + name + '"></span>',
			id: --f.last_emote}, regex;

		if ( name[name.length-1] === '!' )
			regex = new RegExp('\\b' + name + '(?=\\W|$)', 'g');
		else
			regex = new RegExp('\\b' + name + '\\b', 'g');

		var emote = {
			image: image_data, images: [image_data], text: name,
			channel: channel, hidden: false, regex: regex, ffzset: group};

		col.push(emote);
		f.emoticons.push(emote);
		set.push({isEmoticon: !0, cls: klass, regex: regex});
		count++;
	});

	this.log("Loaded " + count + " emotes from collection: " + group);

	// Notify the manager that we've added emotes.
	if ( this.manager )
		this.manager.notifyPropertyChange('emoticons');

	return count;
}


ffz.prototype.unload_emotes = function(group) {
	if ( !this.alive ) return;

	// Is it a channel?
	var chan = this.channels[group], set, set_id, style, channel;
	if ( chan === false )
		return;
	else if ( chan ) {
		// It's a channel.
		set = chan.set;
		set_id = chan.set_id;
		style = chan.style;
		channel = "FFZ Channel Emotes: " + group;

		// Clear it out.
		delete chan.set;
		delete chan.set_id;
		delete chan.style;

	} else {
		// It must be global.
		set_id = this.globals[group];
		set = this.emotesets[set_id];
		style = this.styles[group];
		channel = "FFZ Global Emotes" + (group != "global" ? ": " + group : "");

		// Clear out the basics.
		delete this.globals[group];
		delete this.styles[group];
		
		var ind = this.global_sets.indexOf(set_id);
		if ( ind !== -1 )
			this.global_sets.splice(ind, 1);
	}

	// Do we have a collection?
	if ( this.collections[channel] )
		delete this.collections[channel];

	// Do we have a style?
	if ( style )
		// Remove it from its parent.
		try { style.parentNode.removeChild(style); } catch(err) {}

	// Remove the emoteset from circulation.
	delete this.emotesets[set_id];
	if ( this.manager )
		delete this.manager.emoticonSets[set_id];

	// Remove every emote from this group.
	var filt = function(e) { return e.ffzgroup !== group; }
	this.emoticons = this.emoticons.filter(filt);

	// Update the emoticons with the manager.
	if ( this.manager )
		this.manager.notifyPropertyChange('emoticons');
}


// -----------------
// Donor Processing
// -----------------

ffz.prototype.check_donor = function(username) { return this.donors[username] || false; }

ffz.prototype.load_donors = function(refresh) {
	this.get("//commondatastorage.googleapis.com/frankerfacez/donors.txt",
		this.process_donors.bind(this), refresh ? 1 : CACHE_LENGTH);
}

ffz.prototype.process_donors = function(text) {
	if ( !this.alive ) return;
	this.donors = {};
	var count = 0;

	if ( text != null ) {
		var l = text.trim().split(/\W+/);
		for (var i=0; i < l.length; i++)
			this.donors[l[i]] = true;
		count += l.length;
	}

	this.log("Loaded " + count + " donors.");
}


// -----------------
// Networking
// -----------------

ffz.prototype.get = function(resource, callback, expires, headers, max_attempts) {
	if ( !this.alive ) return;
	if ( this.getting[resource] ) {
		this.log("Already getting resource: " + resource);
		return;
	}
	this.getting[resource] = true;

	max_attempts = max_attempts || 10;
	var age = 0, now = new Date().getTime();

	// First, immediately try using the resource from cache.
	if ( window.localStorage ) {
		var res = localStorage.getItem("ffz_" + resource);
		if ( res != null ) {
			this.log("Found resource in localStorage: " + resource);
			try {
				callback(JSON.parse(res));
			} catch(err) { this.log("Error in callback: " + err); }

			// Also, get the age to see if we need to fetch it again.
			age = parseInt(localStorage.getItem("ffz_age_" + resource)||0);
		}
	}

	if ( DEBUG || !age || (expires !== undefined && expires !== null && (now-age) > expires) ) {
		// Try getting it again.
		this.log("Resource expired. Fetching: " + resource);
		this.do_get(resource, callback, 0, headers, max_attempts);
	} else
		this.getting[resource] = false;
}

ffz.prototype.do_get = function(resource, callback, attempts, headers, max_attempts) {
	if ( !this.alive ) {
		this.getting[resource] = false;
		return;
	}

	var http = new XMLHttpRequest();
	http.open("GET", resource);

	if ( headers ) {
		for (var hdr in headers) {
			if ( headers.hasOwnProperty(hdr) )
				http.setRequestHeader(hdr, headers[hdr]);
		}
	}

	var f = this;
	function try_again() {
		var attempt = (attempts || 0) + 1, delay = 1000;
		if ( !max_attempts || attempt <= max_attempts ) {
			setTimeout(f.do_get.bind(f, resource, callback, attempt, headers, max_attempts), delay);
			return true;
		}
	}

	http.addEventListener("error", function(e) {
		if ( try_again() )
			return;

		f.getting[resource] = false;
		try {
			callback(undefined);
		} catch(err) { f.log("Error in callback: " + err); }
	}, false);

	http.addEventListener("load", function(e) {
		var result;
		if ( http.status === 200 ) {
			// Success!
			result = http.responseText;

			// Let's see if it was modified?
			if ( window.localStorage ) {
				var last = localStorage.getItem("ffz_last_" + resource),
					nl = http.getResponseHeader("Last-Modified");
				
				if ( last && last == nl ) {
					// No change! Let's go.
					f.log("Resource not modified: " + resource);
					localStorage.setItem("ffz_age_" + resource, new Date().getTime());
					f.getting[resource] = false;
					return;
				} else
					// Save it!
					localStorage.setItem("ffz_last_" + resource, nl);
			}

		} else if ( http.status === 304 ) {
			// Not Modified!
			f.log("Resource not modified: " + resource);
			if ( window.localStorage )
				localStorage.setItem("ffz_age_" + resource, new Date().getTime());
			f.getting[resource] = false;
			return;

		} else if ( http.status === 404 ) {
			// Not Found!
			result = null;

		} else {
			// Try Again
			if ( try_again() )
				return;
			result = undefined;
		}

		// Store it in localStorage if we can.
		if ( window.localStorage && result !== undefined ) {
			localStorage.setItem("ffz_" + resource, JSON.stringify(result));
			localStorage.setItem("ffz_age_" + resource, new Date().getTime());
		}

		// And send it along.
		f.getting[resource] = false;
		try {
			callback(result);
		} catch(err) { f.log("Error in callback: " + err); }
	}, false);

	http.send();
}


// Finally, initialize FFZ.
window.ffz = new ffz();
})(this.unsafeWindow || window, window.chrome ? true : false);