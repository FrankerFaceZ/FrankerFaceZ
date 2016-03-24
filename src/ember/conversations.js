var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// ---------------
// Settings
// ---------------

FFZ.settings_info.conv_focus_on_click = {
	type: "boolean",
	value: false,
	no_mobile: true,
	visible: false,

	category: "Whispers",
	name: "Focus Input on Click",
	help: "Focus on a conversation's input box when you click it."
	};

FFZ.settings_info.top_conversations = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Whispers",
	name: "Position on Top",
	help: "Display the new conversation-style whisper UI at the top of the window instead of the bottom.",
	on_update: function(val) {
			document.body.classList.toggle('ffz-top-conversations', val);
		}
	};


FFZ.settings_info.minimize_conversations = {
	type: "boolean",
	value: false,
	no_mobile: true,

	category: "Whispers",
	name: "Minimize Whisper UI",
	help: "Slide the Whisper UI mostly out of view when it's not being used and you have no unread messages.",
	on_update: function(val) {
			document.body.classList.toggle('ffz-minimize-conversations', val);
		}
	};


// ---------------
// Initialization
// ---------------

FFZ.prototype.setup_conversations = function() {
	document.body.classList.toggle('ffz-top-conversations', this.settings.top_conversations);
	document.body.classList.toggle('ffz-minimize-conversations', this.settings.minimize_conversations);

	this.log("Hooking the Ember Conversation Window component.");
	var ConvWindow = utils.ember_resolve('component:conversation-window');
	if ( ConvWindow )
		this._modify_conversation_window(ConvWindow);


	this.log("Hooking the Ember Conversation Line component.");
	var ConvLine = utils.ember_resolve('component:conversation-line');
	if ( ConvLine )
		this._modify_conversation_line(ConvLine);

	// TODO: Make this better later.
	jQuery('.conversations-list').find('.html-tooltip').tipsy({live: true, html: true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
    jQuery('.conversations-list').find('.ffz-tooltip').tipsy({live: true, html: true, title: this.render_tooltip(), gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
}


FFZ.prototype._modify_conversation_window = function(component) {
	var f = this,
		Layout = utils.ember_lookup('controller:layout');

	component.reopen({
		headerBadges: Ember.computed("thread.participants", "currentUsername", function() {
			var e = this.get("otherUser"),
				badges = f.get_other_badges(e.get('username'), null, e.get('userType'), false, e.get('hasTurbo')),
				out = [];

			// It wants slightly different output from us.
			for(var slot in badges) {
				var badge = badges[slot];
				out.push({
					classes: 'badge ' + badge.klass,
					title: badge.title
				});
			}

			return out;
		}),

		didInsertElement: function() {
			var el = this.get('element'),
				header = el && el.querySelector('.conversation-header'),
				header_name = header && header.querySelector('.conversation-header-name'),

				raw_color = this.get('otherUser.color'),
				colors = raw_color && f._handle_color(raw_color),

				is_dark = (Layout && Layout.get('isTheatreMode')) || f.settings.dark_twitch;

			if ( header_name && raw_color ) {
				header_name.style.color = (is_dark ? colors[1] : colors[0]);
				header_name.classList.add('has-color');
				header_name.setAttribute('data-color', raw_color);
			}

			jQuery('.badge', el).tipsy({gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')});
			jQuery(el).find('.html-tooltip').tipsy({live: true, html: true, gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
            jQuery(el).find('.ffz-tooltip').tipsy({live: true, html: true, title: f.render_tooltip(), gravity: utils.tooltip_placement(2*constants.TOOLTIP_DISTANCE, 'n')});
		}
	});
}


FFZ.prototype._modify_conversation_line = function(component) {
	var f = this,
		Layout = utils.ember_lookup('controller:layout');

	component.reopen({
		tokenizedMessage: function() {
			try {
				return f.tokenize_conversation_line(this.get('message'));
			} catch(err) {
				f.error("convo-line tokenizedMessage: " + err);
				return this._super();
			}

		}.property("message", "currentUsername"),

		click: function(e) {
			if ( e.target && e.target.classList.contains('deleted-link') )
				return f._deleted_link_click.call(e.target, e);

			if ( f._click_emote(e.target, e) )
				return;

			return this._super(e);
		},

		render: function(e) {
			var user = this.get('message.from.username'),
				raw_color = this.get('message.from.color'),
				colors = raw_color && f._handle_color(raw_color),

				is_dark = (Layout && Layout.get('isTheatreMode')) || f.settings.dark_twitch,
                myself = f.get_user(),
                from_me = myself && myself.login === user;

			e.push('<div class="indicator"></div>');

			var alias = f.aliases[user],
				name = this.get('message.from.displayName') || (user && user.capitalize()) || "unknown user",
				style = colors && 'color:' + (is_dark ? colors[1] : colors[0]),
				colored = style ? ' has-color' : '';

			if ( alias )
				e.push('<span class="from ffz-alias tooltip' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '" title="' + utils.sanitize(name) + '">' + utils.sanitize(alias) + '</span>');
			else
				e.push('<span class="from' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">' + utils.sanitize(name) + '</span>');

			e.push('<span class="colon">:</span> ');

			if ( ! this.get('isActionMessage') ) {
				style = '';
				colored = '';
			}

			e.push('<span class="message' + colored + '" style="' + style + (colors ? '" data-color="' + raw_color : '') + '">');
			e.push(f.render_tokens(this.get('tokenizedMessage'), true, f.settings.filter_whispered_links && !from_me));
			e.push('</span>');
		}
	});
}