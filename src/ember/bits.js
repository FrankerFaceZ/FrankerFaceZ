var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.collect_bits = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Grouped by Type",
		2: "All in One"
	},

	value: 0,
	process_value: utils.process_int(0),

	category: "Chat Appearance",
	no_bttv: true,

	name: "Bits Stacking",
	help: "Collect all the bits emoticons in a message into a single one at the start of the message."
};


FFZ.settings_info.bits_animated = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Bits Animation",
	help: "Display bits with animation.",

	on_update: function() {
		var bits = utils.ember_lookup('service:bits-rendering-config');
		if ( bits && bits.ffz_has_css )
			bits.ffz_update_css();
	}
}


FFZ.settings_info.bits_tags_container = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Bits Tag Display",
	help: "Display competitive bits tags at the top of chats that have it enabled.",

	on_update: utils.toggle_cls('ffz-show-bits-tags')
}


FFZ.settings_info.bits_pinned = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",

	name: "Display Pinned Cheers",
	help: "Show pinned messages with bits at the top of chat in channels that have it enabled.",

	on_update: function(val) {
		utils.toggle_cls('ffz-hide-pinned-cheers')(!val);
	}
}


FFZ.settings_info.bits_pinned_expand = {
	type: "select",
	options: {
		0: "On Click (Default)",
		1: "On Hover",
		2: "Always"
	},

	value: 0,
	process_value: utils.process_int(0),

	category: "Chat Appearance",

	name: "Expand Pinned Cheers",
	help: "Set when to expand pinned cheers beyond a minimal height.",

	on_update: function(val) {
		utils.toggle_cls('ffz-pinned-cheer-expand-hover')(val === 1);
		utils.toggle_cls('ffz-pinned-cheer-expand')(val === 2);
	}
}


FFZ.settings_info.bits_disable_charity = {
	type: "boolean",
	value: false,

	category: "Chat Filtering",
	name: "Disable Cheering with #Charity Notices",
	help: "Stop displaying Twitch's notices about Cheering with #Charity."
}



// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_bits = function() {
	utils.toggle_cls('ffz-show-bits-tags')(this.settings.bits_tags_container);
	utils.toggle_cls('ffz-hide-pinned-cheers')(!this.settings.bits_pinned);
	utils.toggle_cls('ffz-pinned-cheer-expand-hover')(this.settings.bits_pinned_expand === 1);
	utils.toggle_cls('ffz-pinned-cheer-expand')(this.settings.bits_pinned_expand === 2);

	var f = this,
		Service = utils.ember_lookup('service:bits-rendering-config');
	if ( ! Service )
		return this.error("Unable to locate the Ember service:bits-rendering-config");

	Service.reopen({
		ffz_has_css: false,

		ffz_get_tier: function(prefix, amount) {
			if ( ! this.get('isLoaded') ) {
				this._actionPromiseCache = false;
				this.loadRenderConfig();
			} else if ( ! this.ffz_has_css )
				this.ffz_update_css();

			var config = this._getConfigPrefix(prefix) || {},
				tiers = config.tiers || [],
				tier = null,
				index = null;

			for(var i=0, l = tiers.length; i < l; i++) {
				var t = tiers[i];
				if ( amount < t.min_bits )
					break;

				tier = t;
				index = i;
			}

			return [index, tier];
		},

		ffz_get_preview: function(tier) {
			return this._constructImageSrc([4], tier, {
				background: 'dark',
				scale: 4,
				state: f.settings.bits_animated ? 'animated' : 'static'
			}).src;
		},

		_ffz_image_css: function(images) {
			return 'background-image: url("' + images[1] + '");' +
				'background-image: ' + (constants.IS_WEBKIT ? ' -webkit-' : '') + 'image-set(' +
					'url("' + images[1] + '") 1x, url("' + images[2] + '") 2x, url("' + images[4] + '") 4x);';
		},

		_ffz_tier_css: function(ind, prefix, tier) {
			var selector = '.ffz-bit.bit-prefix-' + prefix + '.bit-tier-' + ind,
				color = f._handle_color(tier.color),
				animated = f.settings.bits_animated,
				output;

			output = selector + '{' +
				'color: ' + color[0] + ';' +
				this._ffz_image_css(tier.images.light[animated ? 'animated' : 'static']) +
			'}';

			return output + '.tipsy ' + selector + ',.dark ' + selector + ',.force-dark ' + selector + ',.theatre ' + selector + '{' +
				'color: ' + color[1] + ';' +
				this._ffz_image_css(tier.images.dark[animated ? 'animated' : 'static']) +
			'}';
		},

		ffz_update_css: function() {
			var output = [],
				config = this.get('config') || {prefixes: []};

			for(var i=0; i < config.prefixes.length; i++) {
				var prefix = config.prefixes[i],
					data = this._getConfigPrefix(prefix),
					tiers = data && data.tiers || [];

				for(var x=0; x < tiers.length; x++)
					output.push(this._ffz_tier_css(x, prefix, tiers[x]));
			}

			utils.update_css(f._chat_style, 'bit-styles', output.join(''));
			this.ffz_has_css = true;
		}.observes('config'),

		loadRenderConfig: function() {
			var out = this._super();
			if ( ! this.get('config') )
				this._actionPromiseCache = false;
			return out;
		}
	});

	if ( Service.get('isLoaded') )
		Service.loadRenderConfig();
}