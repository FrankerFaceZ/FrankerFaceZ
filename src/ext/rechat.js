var FFZ = window.FrankerFaceZ,
	constants = require('../constants'),
	utils = require('../utils');


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_rechat = function() {
	if ( this.has_bttv || navigator.userAgent.indexOf('Android') !== -1 )
		return;

	this._rechat_listening = false;

	this.log("Installing ReChat mutation observer.");

	var f = this;
	this._rechat_observer = new MutationObserver(function(mutations) {
		for(var i=0; i < mutations.length; i++) {
			var mutation = mutations[i];
			if ( mutation.type !== "childList" )
				continue;

			for(var x=0; x < mutation.addedNodes.length; x++) {
				var added = mutation.addedNodes[x];
				if ( added.nodeType !== added.ELEMENT_NODE || added.tagName !== "DIV" )
					continue;

				// Is this a ReChat line?
				if ( added.classList.contains('rechat-chat-line') && ! added.classList.contains('ffz-processed') )
					f.process_rechat_line(added);
			}
		}
	});

	this.log("Starting ReChat check loop.");
	this._rechat_interval = setInterval(this.find_rechat.bind(this), 1000);
	this.find_rechat();
}


// --------------------
// ReChat Detection
// --------------------

FFZ.prototype.find_rechat = function() {
	var el = !this.has_bttv ? document.querySelector('.rechat-chat-line') : null;

	// If there's no change, don't continue.
	if ( !!el === this._rechat_listening )
		return;

	// If we're no longer listening, stop the observer and quit.
	if ( ! el ) {
		this._rechat_observer.disconnect();
		this._rechat_listening = false;
		return;
	}

	// We're newly listening. Process all existing ReChat chat lines
	// and darken the container if required, also enable the observer.
	var container = jQuery(el).parents('.chat-container');
	if ( ! container.length )
		return;

	container = container[0];

	// Look-up dark mode.
	var dark_chat = this.settings.dark_twitch;
	if ( ! dark_chat ) {
		var model = window.App ? App.__container__.lookup('controller:settings').get('model') : undefined;
		dark_chat = model && model.get('darkMode');
	}

	container.classList.toggle('dark', dark_chat);
	jQuery(container).find('.chat-lines').addClass('ffz-scrollbar');

	// Tooltips
	jQuery(container).find('.tooltip').tipsy({live: true, gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
	jQuery(container).find('.html-tooltip').tipsy({live: true, html: true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});

	// Load the room data.
	var room_id = el.getAttribute('data-room');
	if ( room_id && ! this.rooms[room_id] )
		this.load_room(room_id, this._reprocess_rechat.bind(this, container));

	// Do stuff.
	var lines = container.querySelectorAll('.rechat-chat-line');
	for(var i=0; i < lines.length; i++) {
		var line = lines[i];
		if ( line.classList.contains('ffz-processed') )
			continue;

		this.process_rechat_line(line);
	}

	// Start observing.
	this._rechat_observer.observe(container, {
		childList: true,
		subtree: true
	});

	this._rechat_listening = true;
}


// --------------------
// ReChat Lines
// --------------------

FFZ.prototype._reprocess_rechat = function(container) {
	var lines = container.querySelectorAll('.rechat-chat-line');
	for(var i=0; i < lines.length; i++)
		this.process_rechat_line(lines[i], true);
}


FFZ.prototype.process_rechat_line = function(line, reprocess) {
	if ( ! reprocess && line.classList.contains('ffz-processed') )
		return;

	line.classList.add('ffz-processed');

	var user_id = line.getAttribute('data-sender'),
		room_id = line.getAttribute('data-room'),

		Layout = App.__container__.lookup('controller:layout'),
		Settings = App.__container__.lookup('controller:settings'),
		is_dark = (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('model.darkMode')),

		badges_el = line.querySelector('.badges'),
		from_el = line.querySelector('.from'),
		message_el = line.querySelector('.message'),

		badges = {},
		had_badges = !!badges_el,

		raw_color = from_el && FFZ.Color.RGB.fromCSS(from_el.style.color),
		colors = raw_color && this._handle_color(raw_color),

		alias = this.aliases[user_id];


	if ( ! badges_el ) {
		badges_el = document.createElement('span');
		badges_el.className = 'badges float-left';
		line.insertBefore(badges_el, from_el || line.firstElementChild);
	}

	if ( ! reprocess || ! had_badges ) {
		// Read existing known badges.
		var existing = badges_el.querySelectorAll('.badge');
		for(var i=0; i < existing.length; i++) {
			var badge = existing[i];
			if ( badge.classList.contains('broadcaster') )
				badges[0] = {klass: 'broadcaster', title: 'Broadcaster'};
			else if ( badge.classList.contains('staff') )
				badges[0] = {klass: 'staff', title: 'Staff'};
			else if ( badge.classList.contains('admin') )
				badges[0] = {klass: 'admin', title: 'Admin'};
			else if ( badge.classList.contains('global-moderator') )
				badges[0] = {klass: 'global-moderator', title: 'Global Moderator'};
			else if ( badge.classList.contains('moderator') )
				badges[0] = {klass: 'moderator', title: 'Moderator'};
			else if ( badge.classList.contains('subscriber') )
				badges[10] = {klass: 'subscriber', title: 'Subscriber'};
			else if ( badge.classList.contains('turbo') )
				badges[15] = {klass: 'turbo', title: 'Turbo'};
		}

		if ( user_id && user_id === room_id )
			badges[0] = {klass: 'broadcaster', title: 'Broadcaster'};

		if ( user_id )
			badges = this._render_badges(user_id, room_id, badges);

		var output = '';
		for(var key in badges) {
			var badge = badges[key],
				css = badge.iamge ? 'background-image:url(&quot;' + badge.image + '&quot;);' : '';

			if ( badge.color )
				css += 'background-color:' + badge.color + ';';

			if ( badge.extra_css )
				css += badge.extra_css;

			output += '<div class="badge float-left tooltip ' + badge.klass + '"' + (css ? ' style="' + css + '"' : '') + ' title="' + badge.title + '"></div>';
		}

		badges_el.innerHTML = output;
	}

	if ( ! reprocess && from_el ) {
		from_el.style.fontWeight = "";
		if ( colors ) {
			from_el.classList.add('has_color');
			from_el.style.color = is_dark ? colors[1] : colors[0];
		}

		if ( alias ) {
			from_el.classList.add('ffz-alias');
			from_el.title = from_el.textContent;
			from_el.textContent = alias;
		}
	}

	if ( ! message_el )
		return;

	if ( ! reprocess && message_el.style.color ) {
		message_el.classList.add('has-color');
		message_el.style.color = is_dark ? colors[1] : colors[0];
	}

	var raw_tokens = line.getAttribute('data-tokens'),
		tokens = raw_tokens ? JSON.parse(raw_tokens) : [];

	if ( ! raw_tokens ) {
		for(var i=0; i < message_el.childNodes.length; i++) {
			var node = message_el.childNodes[i];

			if ( node.nodeType === node.TEXT_NODE )
				tokens.push(node.textContent);

			else if ( node.nodeType === node.ELEMENT_NODE ) {
				if ( node.tagName === 'IMG' )
					tokens.push({
						altText: node.alt,
						emoticonSrc: node.src
					});

				else if ( node.tagName === 'A' )
					tokens.push({
						isLink: true,
						href: node.textContent
					});

				else if ( node.tagName === 'SPAN' )
					tokens.push({
						mentionedUser: node.textContent,
						own: node.classList.contains('mentioning')
					});

				else
					this.log("Unknown Tag Type: " + node.tagName);
			} else
				this.log("Unknown Node Type Tokenizing Message: " + node.nodeType);
		}
	}

	line.setAttribute('data-tokens', JSON.stringify(tokens));

	// Further tokenization~!
	if ( this.settings.replace_bad_emotes )
		tokens = this.tokenize_replace_emotes(tokens);

	tokens = this._remove_banned(tokens);
	tokens = this.tokenize_emotes(user_id, room_id, tokens, false);

	if ( this.settings.parse_emoji )
		tokens = this.tokenize_emoji(tokens);

	tokens = this.tokenize_mentions(tokens);

	// Check for a mention
	if ( ! line.classList.contains('ffz-mentioend') )
		for(var i=0; i < tokens.length; i++)
			if ( tokens[i].mentionedUser ) {
				line.classList.add('ffz-mentioned');
				break;
			}

	// Now, put the content back into the element.
	message_el.innerHTML = this.render_tokens(tokens);
}