var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// --------------------
// Settings
// --------------------

FFZ.settings_info.show_commerce = {
	type: "select",
	options: {
		0: "Never",
		1: "When Revenue is Shared",
		2: "Always"
	},

	value: 2,
	process_value: utils.process_int(0),

	no_mobile: true,

	category: "Commerce",
	name: "Display Commerce Bar",
	help: "Show the commerce bar under channels that allows you to purchase supported games.",

	on_update: function(val) {
		utils.toggle_cls('ffz-hide-purchase-game')(val === 0);
		var views = utils.ember_views(),
			ChannelBox = utils.ember_resolve('component:commerce/channel-box');

		if ( ! ChannelBox )
			return;

		for(var key in views)
			if ( views[key] instanceof ChannelBox )
				try {
					views[key].ffzUpdateVisibility();
				} catch(err) { }
	}
}


FFZ.settings_info.show_itad = {
	type: "boolean",
	value: true,

	no_mobile: true,

	category: "Commerce",
	name: "Display Competitor Pricing",
	help: "Add a button on the commerce bar with pricing from other stores.",

	on_update: function(val) {
		var views = utils.ember_views(),
			BuyGameNow = utils.ember_resolve('component:commerce/buy-game-now');

		if ( ! BuyGameNow )
			return;

		for(var key in views)
			if ( views[key] instanceof BuyGameNow )
				try {
					views[key].ffzRenderPricing();
				} catch(err) { }
	}
}


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_commerce = function() {
	this._itad_game_to_plain = {};

	// Styles
	utils.toggle_cls('ffz-hide-purchase-game')(this.settings.show_commerce === 0);

	// Ember Modifications
	this.update_views('component:commerce/channel-box', this.modify_commerce_box);
	this.update_views('component:commerce/buy-game-now', this.modify_buy_game_now);
}


// --------------------
// Modifications
// --------------------

FFZ.prototype.modify_commerce_box = function(view) {
	var f = this;
	utils.ember_reopen_view(view, {
		ffz_init: function() {
			this.ffzUpdateVisibility();
		},

		ffzUpdateVisibility: function() {
			var el = this.parentView.get('element'),
				real_el = el && el.querySelector('.cmrc-channel-box');

			if ( ! real_el )
				! this.isDestroyed && setTimeout(this.ffzUpdateVisibility.bind(this), 250);
			else
				real_el.classList.toggle('hidden', f.settings.show_commerce === 1 && ! this.get('showSupports'));

		}.observes('showSupports')
	})
}


FFZ.prototype.modify_buy_game_now = function(view) {
	var f = this;
	utils.ember_reopen_view(view, {
		itad_plain: null,
		itad_price: null,
		itad_country: null,

		ffz_init: function() {
			if ( ! this.$().parents('.cmrc-game-details-box,.cmrc-channel-box').length || ! this.$('button').length )
				return;

			//f.log("Buy-Game-New Component", this);
			this.itad_count = 0;
			this.ffzUpdateITADPlain();

			var t = this;
			f.get_location().then(function(data) {
				t.set('itad_country', data && data.country);
			});
		},

		ffzTitle: function() {
			// Do this because Twitch's ToS say you're not allowed to use data collected from
			// the API to show users commercial offers. This scrapes the game title from the
			// page itself and not from any kind of JS API.

			// Granted, they're probably more worried about automated chat spam and people
			// sending spam to email addresses recovered from authenticated user profile requests.

			var el;
			if ( document.body.dataset.currentPath === 'directory.game-details' )
				el = document.querySelector('.game-details__page-title');
			else
				el = document.querySelector('.js-card__info [data-tt_content="current_game"]');

			var output = el ? _.pluck(_.filter(el.childNodes, function(x) { return x.nodeType === document.TEXT_NODE }), 'textContent').join(' ').trim() : null;

			if ( ! output && this.itad_count < 50 ) {
				var t = this;
				setTimeout(function() {
					t.itad_count += 1;
					Ember.propertyDidChange(this, 'ffzTitle');
				}, 250);
			}

			return output;

		}.property(),

		didReceiveAttrs: function() {
			this._super();
			Ember.propertyDidChange(this, 'ffzTitle');
		},

		ffzUpdateITADPlain: function() {
			var title = this.get('ffzTitle'),
				old_plain = this.get('itad_plain'),
				plain = f._itad_game_to_plain[title] || null;

			//f.log("Update ITAD Plain: " + title + " -- [" + plain + "]", this);

			// If we already have the value, fetch it now.
			if ( ! title || plain ) {
				if ( old_plain !== plain )
					this.set('itad_plain', plain);
				return;
			}

			if ( old_plain )
				this.set('itad_plain', null);

			var t = this;
			f.ws_send("get_itad_plain", title, function(success, data) {
				if ( ! success ) return;

				f._itad_game_to_plain[title] = data;
				t.ffzUpdateITADPlain();
			}, true);

		}.observes('ffzTitle'),

		ffzUpdateITADPrice: function() {
			var t = this,
				old_price = this.get('itad_price'),
				country = this.get('itad_country'),
				plain = this.get('itad_plain');

			if ( old_price && old_price[0] === plain )
				return;

			if ( ! plain || ! country )
				return this.set('itad_price', null);

			this.set('itad_price', [plain, null]);
			f.ws_send("get_itad_prices", [plain, country], function(success, data) {
				if ( ! success ) return;

				t.set('itad_price', [plain, data]);
			});

		}.observes('itad_plain', 'itad_country'),


		ffzRenderPricing: function() {
			var t = this,
				el = this.get('element'),
				cont = el && el.querySelector('.ffz-price-info'),
				btn_price,
				data = this.get('itad_price');

			if ( ! f.settings.show_itad || ! data || ! data[1] || ! data[1].list || ! data[1].list.length ) {
				if ( cont )
					jQuery(cont).remove();
				return;
			}

			if ( ! cont ) {
				cont = utils.createElement('div', 'ffz-price-info mg-l-1 balloon-wrapper');
				btn_price = utils.createElement('span', 'ffz-price-num button__num-block pd-x-1 mg-1-0');

				var btn = utils.createElement('button', 'button itad-button button--dropmenu',
					utils.createElement('span', 'ffz-price-label inline-block pd-r-1', 'ITAD'));

				btn.appendChild(btn_price);
				cont.appendChild(btn);
				el.appendChild(cont);

				btn.addEventListener('click', function(event) {
					t.ffzRenderPopup(event);
				});

			} else
				btn_price = cont.querySelector('.ffz-price-num');

			// Determine the cheapest price.
			var sales = data[1].list,
				cheapest = sales[0].price_new,

				currency = data[1].currency,
				formatter = new Intl.NumberFormat(undefined, (currency && currency.code) ? {style: 'currency', currency: currency.code, minimumFractionDigits: 2} : {minimumFractionDigits: 2});

			btn_price.textContent = formatter.format(cheapest);

		}.observes('itad_price'),

		ffzRenderPopup: function(e) {
			if ( e.button !== 0 || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey )
				return;

			e.preventDefault();
			e.stopPropagation();

			var popup = f._popup ? f.close_popup() : f._last_popup,
				t = this,
				data = t.get('itad_price'),
				el = this.get('element'),
				has_support = el && el.parentElement && (el.parentElement.querySelector('.cmrc-channel-box__support') || el.parentElement.querySelector('.cmrc-game-detail-box__support')),
				cont = el && el.querySelector('.ffz-price-info');

			if ( popup && popup.id === 'ffz-price-popup' || ! data || ! data[1] || ! data[1].list || ! data[1].list.length )
				return;

			var balloon = utils.createElement('div', 'itad-balloon balloon balloon--md show', '<table><thead><tr><th>Store</th><th>Price Cut</th><th>Current</th><th>Regular</th></tr></thead><tbody></tbody></table>'),
				tbody = balloon.querySelector('tbody');

			balloon.id = 'ffz-price-popup';

			// Render the table.

			var currency = data[1].currency,
				formatter = new Intl.NumberFormat(undefined, (currency && currency.code) ? {style: 'currency', currency: currency.code, minimumFractionDigits: 2} : {minimumFractionDigits: 2});

			var sales = data[1].list;
			for(var i=0; i < sales.length; i++) {
				var entry = sales[i],
					row = utils.createElement('tr');

				row.innerHTML = '<td><a class="store-link" rel="noreferrer" target="_blank" href="' + utils.quote_san(entry.url) + '">' + utils.sanitize(entry.shop.name) + '</a></td>' +
					'<td>' + (entry.price_cut < 0 ? '' : '-') + utils.sanitize(entry.price_cut) + '%</td>' +
					'<td>' + formatter.format(entry.price_new) + '</td>' +
					'<td>' + formatter.format(entry.price_old) + '</td>';

				tbody.appendChild(row);
			}

			if ( has_support )
				jQuery('.store-link', tbody).click(function(e) {
					var name = has_support.querySelector('strong').textContent,
						link_text = e.target.textContent;

					if ( ! confirm("By following this link and purchasing from " + link_text + " you will NOT be supporting " + name + ".\n\nAre you sure you wish to contune?") )
						return false;
				});

			// Add a by-line for IsThereAnyDeal.

			var url = data[1].urls && data[1].urls.game || "https://isthereanydeal.com",
				by_line = utils.createElement('span', 'ffz-attributions',
					'<hr>Source: <a rel="noreferrer" target="_blank" href="' + utils.quote_san(url) + '">IsThereAnyDeal.com</a><br><br>Any affiliate links in the provided data are the responsibility of IsThereAnyDeal and do not benefit FrankerFaceZ. You may consider visiting the store directly.' +
					'<hr>Reminder: When you buy a game from other services, you miss out on the benefits of purchasing from Twitch directly including: supporting partnered streamers and earning <a target="_blank" href="https://blog.twitch.tv/twitch-crates-are-coming-soon-f50fa0cd4cdf">Twitch Crates</a> containing emotes and badges.');

			balloon.appendChild(by_line);

			// Now calculate the position and add the balloon to the DOM.

			var container = document.querySelector('#main_col'),
				outer = container.getBoundingClientRect(),
				rect = cont.getBoundingClientRect();

			var is_up = (rect.top - outer.top) > (outer.bottom - rect.bottom);
			balloon.classList.add('balloon--' + (is_up ? 'up' : 'down'));
			balloon.classList.toggle('balloon--right', (rect.left - outer.left) > (outer.right - rect.right));

			f._popup_allow_parent = true;
			f._popup = balloon;

			cont.appendChild(balloon);
		}
	})
}