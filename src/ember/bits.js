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
	no_bttv: 6,

	name: "Bits Stacking",
	help: "Collect all the bits emoticons in a message into a single one at the start of the message."
};


FFZ.settings_info.bits_animated = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: 6,

	name: "Bits Animation",
	help: "Display bits with animation.",

	on_update: function() {
		var bits = utils.ember_lookup('service:bits-emotes') ||
					utils.ember_lookup('service:bits-rendering-config');
		if ( bits && bits.ffz_has_css )
			bits.ffz_update_css();
	}
}


FFZ.settings_info.bits_tags_container = {
	type: "boolean",
	value: true,

	category: "Chat Appearance",
	no_bttv: 6,

	name: "Bits Tag Display",
	help: "Display competitive bits tags at the top of chats that have it enabled.",

	on_update: utils.toggle_cls('ffz-show-bits-tags')
}


FFZ.settings_info.bits_pinned = {
	type: "select",
	options: {
		0: "Disabled",
		1: "Show Recent",
		2: "Show Top",
		3: "Show All (Default)"
	},

	value: 3,
	process_value: utils.process_int(3, 0, 3),

	category: "Chat Appearance",

	name: "Display Pinned Cheers",
	help: "Show pinned messages with bits at the top of chat in channels that have it enabled.",

	on_update: function(val) {
		var PinnedCheers = utils.ember_lookup('service:bits-pinned-cheers');
		if ( val === 3 || ! PinnedCheers )
			return;

		if ( val !== 1 )
			PinnedCheers.set('recentPinnedCheer', null);

		if ( val !== 2 )
			PinnedCheers.set('topPinnedCheer', null);
	}
}


FFZ.settings_info.bits_redesign = {
	type: "boolean",
	value: false,

	category: "Chat Appearance",
	name: "Bits Redesign",
	help: "Use the special cheering animations from April 1st, 2017.",

	on_update: function() {
		var bits = utils.ember_lookup('service:bits-emotes') ||
					utils.ember_lookup('service:bits-rendering-config');
		if ( bits && bits.ffz_has_css )
			bits.ffz_update_css();
	}
}


// --------------------
// Initialization
// --------------------

var redesign = function(x) { return x.replace('/actions/cheer/', '/actions/cheer-redesign/') };

FFZ.prototype.setup_bits = function() {
	utils.toggle_cls('ffz-show-bits-tags')(this.settings.bits_tags_container);

	this.update_views('component:bits/chat-token', this._modify_bits_token);

	var f = this,
		Service = utils.ember_lookup('service:bits-emotes'),
		PinnedCheers = utils.ember_lookup('service:bits-pinned-cheers'),

		image_css = function(images) {
			var im_1 = images[1],
				im_2 = images[2],
				im_4 = images[4];

			if ( f.settings.bits_redesign ) {
				im_1 = redesign(im_1);
				im_2 = redesign(im_2);
				im_4 = redesign(im_4);
			}

			return 'background-image: url("' + im_1 + '");' +
				'background-image: ' + (constants.IS_WEBKIT ? ' -webkit-' : '') + 'image-set(' +
					'url("' + im_1 + '") 1x, url("' + im_2 + '") 2x, url("' + im_4 + '") 4x);';
		},

		tier_css = function(ind, prefix, tier) {
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
		};

	if ( PinnedCheers ) {
		PinnedCheers.reopen({
			_updatePinnedCheerData: function(data) {
				var setting = f.settings.bits_pinned;
				if ( setting < 2 )
					data.top = null;
				else if ( data.top )
					data.top.is_pinned_cheer = 2;

				if ( setting !== 3 && setting !== 1 )
					data.recent = null;
				else if ( data.recent )
					data.recent.is_pinned_cheer = true;

				return this._super(data);
			}
		});

		FFZ.settings_info.bits_pinned.on_update.call(this, this.settings.bits_pinned);
	}

	if ( Service ) {
		Service.reopen({
			ffz_has_css: false,

			ffz_get_tier: function(prefix, amount) {
				if ( ! this.ffz_has_css )
					this.ffz_update_css();

				var config = this.getPrefixData(prefix) || {},
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

			ffz_get_preview: function(prefix, amount) {
				var src = this.getImageSrc(amount, prefix, true, !f.settings.bits_animated, 4);
				return f.settings.bits_redesign ? redesign(src) : src;
			},

			_ffz_image_css: image_css,
			_ffz_tier_css: tier_css,

			ffz_update_css: function() {
				var output = [],
					prefixes = _.map(this.get('regexes') || [], function(x) {
						return x && x.prefix || null;
					});

				for(var i=0; i < prefixes.length; i++) {
					var prefix = prefixes[i],
						data = prefix && this.getPrefixData(prefix);

					if ( ! data )
						continue;

					var tiers = data && data.tiers || [];
					for(var x=0; x < tiers.length; x++)
						output.push(this._ffz_tier_css(x, prefix, tiers[x]));
				}

				utils.update_css(f._chat_style, 'bit-styles', output.join(''));
				this.ffz_has_css = true;
			}.observes('emoteConfig', 'regexes')
		});

	} else {
		this.log("Unable to find the Ember service:bits-emotes. Falling back...");

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

			ffz_get_preview: function(prefix, amount) {
				var data = this.ffz_get_tier(prefix, amount),
					tier = data && data[1],
					src = tier ? this._constructImageSrc([4], tier, {
							background: 'dark',
							scale: 4,
							state: f.settings.bits_animated ? 'animated' : 'static'
						}).src : '';

				return f.settings.bits_redesign ? redesign(src) : src;
			},

			_ffz_image_css: image_css,
			_ffz_tier_css: tier_css,

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
	}

	if ( Service.get('isLoaded') && Service.loadRenderConfig )
		Service.loadRenderConfig();
}


FFZ.prototype._modify_bits_token = function(component) {
	var f = this;
	utils.ember_reopen_view(component, {
		ffz_init: function() {
			this.ffzRender();
		},

		ffzRender: function() {
			var el = this.get('element'),
				prefix = this.get('prefix'),
				amount = this.get('amount');

			el.innerHTML = f.render_token(false, false, true, {
				type: 'bits',
				amount: amount,
				prefix: prefix
			});

		}.observes('prefix', 'amount')
	})
}