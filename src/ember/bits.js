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

	visible: function() {
		var globals = utils.ember_lookup('service:globals'),
			user = this.get_user();

		return (globals && globals.get('isBitsEnabled')) || (user && user.is_staff);
	},

	name: "Bits Animation",
	help: "Display bits with animation.",

	on_update: utils.toggle_cls('ffz-animate-bits')
}


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_bits = function() {
	utils.toggle_cls('ffz-animate-bits')(this.settings.bits_animated);

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