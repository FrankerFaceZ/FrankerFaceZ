var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.bits_animated = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Bits Animation",
	help: "Display bits with animation.",

	on_update: utils.toggle_cls('ffz-animate-bits')
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



// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_bits = function() {
	utils.toggle_cls('ffz-animate-bits')(this.settings.bits_animated);
	utils.toggle_cls('ffz-show-bits-tags')(this.settings.bits_tags_container);
	utils.toggle_cls('ffz-hide-pinned-cheers')(!this.settings.bits_pinned);
	utils.toggle_cls('ffz-pinned-cheer-expand-hover')(this.settings.bits_pinned_expand === 1);
	utils.toggle_cls('ffz-pinned-cheer-expand')(this.settings.bits_pinned_expand === 2);

	var f = this,
		Service = utils.ember_lookup('service:bits-rendering-config');
	if ( ! Service )
		return this.error("Unable to locate the Ember service:bits-rendering-config");

	Service.reopen({
		ffz_get_tier: function(amount) {
			var config = this.get('config'),
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
			return this._templateUrlConstructor(tier.image, "dark", (f.settings.bits_animated ? 'animated' : 'static'), 4);
		},

		_ffz_tier_css: function(ind, tier) {
			var selector = '.ffz-bit.bit-tier-' + ind,
				color = f._handle_color(tier.color),

				template = 'url("' + this.get('config.templateUrl').replace('{background}', 'light').replace('{image}', tier.image) + '")',
				template_srcset = template.replace('{scale}', 1) + ' 1x, ' + template.replace('{scale}', 2) + ' 2x, ' + template.replace('{scale}', 4) + ' 4x',
				output;

			output = selector + '{' +
				'color: ' + color[0] + ';' +
				'background-image: ' + template.replace('{scale}', 1).replace(/{state}/g, 'static') + ';' +
				'background-image: -webkit-image-set(' + template_srcset.replace(/{state}/g, 'static') + ');' +
			'}.ffz-animate-bits ' + selector + '{' +
				'background-image: ' + template.replace('{scale}', 1).replace(/{state}/g, 'animated') + ';' +
				'background-image: -webkit-image-set(' + template_srcset.replace(/{state}/g, 'animated') + ');' +
			'}';

			template = template.replace('/light/', '/dark/');
			template_srcset = template_srcset.replace(/\/light\//g, '/dark/');

			return output + '.tipsy ' + selector + ',.dark ' + selector + ',.force-dark ' + selector + ',.theatre ' + selector + '{' +
				'color: ' + color[1] + ';' +
				'background-image: ' + template.replace('{scale}', 1).replace(/{state}/g, 'static') + ';' +
				'background-image: -webkit-image-set(' + template_srcset.replace(/{state}/g, 'static') + ');' +
			'}.ffz-animate-bits .tipsy ' + selector + ',.ffz-animate-bits .dark ' + selector + ',.ffz-animate-bits .force-dark ' + selector + ',.ffz-animate-bits .theatre ' + selector + '{' +
				'background-image: ' + template.replace('{scale}', 1).replace(/{state}/g, 'animated') + ';' +
				'background-image: -webkit-image-set(' + template_srcset.replace(/{state}/g, 'animated') + ');' +
			'}';
		},

		ffz_update_css: function() {
			var tiers = this.get('config.tiers') || [],
				output = [];

			for(var i=0, l = tiers.length; i < l; i++)
				output.push(this._ffz_tier_css(i, tiers[i]));

			utils.update_css(f._chat_style, 'bit-styles', output.join(''));

		}.observes('config')
	});

	if ( ! Service.get('isLoaded') )
		Service.loadRenderConfig();
	else
		Service.ffz_update_css();
}