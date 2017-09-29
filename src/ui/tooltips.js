var FFZ = window.FrankerFaceZ,
	utils = require('../utils'),
	constants = require('../constants');


// ---------------------
// Initialization
// ---------------------

FFZ.prototype.fix_tooltips = function() {
	// Add handlers to FFZ's tooltip classes.
	jQuery(".html-tooltip").zipsy({
		live: true,
		html: true,
		gravity: utils.newtip_placement(constants.TOOLTIP_DISTANCE, 'n')
		//gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')
	});

	jQuery(".ffz-tooltip").zipsy({
		live: true,
		html: true,
		className: this.render_tooltip_class(),
		title: this.render_tooltip(),
		gravity: utils.newtip_placement(constants.TOOLTIP_DISTANCE, 'n')
		//gravity: utils.tooltip_placement(constants.TOOLTIP_DISTANCE, 'n')
	});

	// First, override the tooltip mixin.
	var TipsyTooltip = utils.ember_resolve('component:tipsy-tooltip');
	if ( TipsyTooltip ) {
		this.log("Modifying Tipsy-Tooltip component to use gravity.");
		TipsyTooltip.reopen({
			didInsertElement: function() {
				var gravity = this.get("gravity");
				if ( ! gravity || typeof gravity === "string" )
					gravity = utils.newtip_placement(constants.TOOLTIP_DISTANCE, gravity || 's');

				this.$().zipsy({
					gravity: gravity
				});
			}
		})
	}

	// Fix tipsy invalidation
	if ( window.jQuery && jQuery.fn && jQuery.fn.tipsy )
		jQuery.fn.tipsy.revalidate = function() {
			jQuery(".tipsy").each(function() {
				var t = jQuery.data(this, "tipsy-pointee");
				(!t || !t[0] || !document.contains(t[0])) && jQuery(this).remove();
			})
		};


	// Iterate all existing tipsy stuff~!
	this.log('Fixing already existing tooltips.');
	if ( ! window.jQuery || ! jQuery.cache )
		return;

	for(var obj_id in jQuery.cache) {
		var obj = jQuery.cache[obj_id];
		if ( obj && obj.data && obj.data.tipsy && obj.data.tipsy.options && typeof obj.data.tipsy.options.gravity !== "function" ) {
			obj.data.tipsy.options.gravity = utils.tooltip_placement(constants.TOOLTIP_DISTANCE, obj.data.tipsy.options.gravity || 's');
		}
	}
}


// ---------------------
// Zipsy!
// ---------------------

var zipsyIdcounter = 0;

function maybeCall(thing, ctx) {
	return typeof thing === 'function' ? thing.apply(ctx, Array.prototype.slice.call(arguments, 2)) : thing;
}

function Zipsy(element, options) {
	this.$element = jQuery(element);
	this.options = options;
	this.enabled = true;
	this.fixTitle();
}

Zipsy.prototype = {
	show: function() {
		var j_el = this.$element,
			el = j_el[0];

		if ( ! this.enabled || ! document.contains(el) || ! j_el.is(':visible') )
			return;

		var title = this.getTitle(),
			$tip = this.tip();

		if ( ! title )
			return;

		$tip.find('.tipsy-inner')[this.options.html ? 'html' : 'text'](title);
		$tip[0].className = 'zipsy tipsy';
		if ( this.options.className )
			$tip.addClass(maybeCall(this.options.className, el));

		$tip.detach().css({
			top: 0, left: 0,
			width: '', height: '',
			visibility: 'hidden',
			display: 'block'
		}).prependTo(this.options.prependTo).data('tipsy-pointee', el);

		var pos;

		if ( j_el.parents('svg').length > 0 )
			pos = jQuery.extend({}, j_el.offset(), el.getBBox());

		else if ( this.options.prependTo !== document.body )
			pos = jQuery.extend(j_el.position(), {
				width: j_el.width(),
				height: j_el.height()
			});

		else
			pos = jQuery.extend({}, j_el.offset(), {
				width: el.offsetWidth || 0,
				height: el.offsetHeight || 0
			});

		var bbox = $tip[0].getBoundingClientRect(),
			actual_width = Math.ceil(bbox.width),
			actual_height = Math.ceil(bbox.height),
			gravity = maybeCall(this.options.gravity, el, bbox),
			g1 = gravity.charAt(0),
			g2 = gravity.length > 1 ? gravity.charAt(1) : 'c',
			offset = maybeCall(this.options.offset, el),
			tp = {};

		if ( g1 === 'n' )
			tp.top = pos.top + pos.height + offset;

		else if ( g1 === 's' )
			tp.top = pos.top - actual_height - offset;

		else if ( g1 === 'e' )
			tp.left = pos.left - actual_width - offset;

		else if ( g1 === 'w' )
			tp.left = pos.left + pos.width + offset;

		if ( g1 === 'n' || g1 === 's' ) {
			if ( g2 === 'c' )
				tp.left = pos.left + pos.width / 2 - actual_width / 2;

			else if ( g2 === 'e' )
				tp.left = pos.left + pos.width - actual_width + 5;

			else if ( g2 === 'w' )
				tp.left = pos.left - 5;

		} else if ( g1 === 'e' || g1 === 'w' ) {
			if ( g2 === 'c' )
				tp.top = pos.top + pos.height / 2 - actual_height / 2;

			else if ( g2 === 'n' )
				tp.top = pos.top - 5;

			else if ( g2 === 's' )
				tp.top = pos.top + pos.height - actual_height + 5;
		}

		$tip.css(tp).addClass('tipsy-' + gravity);
		$tip.find('.tipsy-arrow')[0].className = 'tipsy-arrow tipsy-arrow-' + gravity.charAt(0);
		$tip.css({width: actual_width + 'px'});

		var opacity = maybeCall(this.options.opacity, el);

		if ( this.options.fade )
			$tip.stop().css({
				opacity: 0,
				display: 'block',
				visibility: 'hidden'
			}).animate({
				opacity: opacity
			}, this.options.fadeInTime);

		else
			$tip.css({
				visibility: 'visible',
				opacity: opacity
			});

		if ( this.options.aria ) {
			var tip_id = zipsyIdcounter++;
			$tip.attr('id', tip_id);
			j_el.attr('aria-describedby', tip_id);
		}
	},

	hide: function() {
		if ( this.options.fade )
			this.tip().stop().fadeOut(this.options.fadeOutTime, function() { jQuery(this).detach() });
		else
			this.tip().detach();

		if ( this.options.aria )
			this.$element.removeAttr('aria-describedby');
	},

	fixTitle: function() {
		var e = this.$element;
		if ( e.attr('title') || typeof e.attr('original-title') !== 'string' )
			e.attr('original-title', e.attr('title') || '').removeAttr('title');
	},

	getTitle: function() {
		var e = this.$element,
			title = this.options.title;

		if ( title === 'title' ) {
			this.fixTitle();
			title = e.attr('original-title');
		} else if ( typeof title === 'string' )
			title = e.attr(title);
		else if ( typeof title === 'function' )
			title = title.call(e[0]);
		else
			title = '';

		return (''+title).trim() || this.options.fallback;
	},

	tip: function() {
		var t = this;
		if ( ! this._tip )
			this._tip = jQuery('<div class="zipsy tipsy" role="tooltip"><div class="tipsy-arrow"></div><div class="tipsy-inner"></div></div>');

		this._tip
			.off('mouseenter mouseleave')
			.on('mouseenter', function() {
				t.hoverState = 'in';

			}).on('mouseleave', function() {
				t.hoverState = 'out';
				if ( t.options.delayOut === 0 )
					t.hide();
				else
					setTimeout(function() {
						if ( t.hoverState === 'out' || ! t.$element || ! t.$element.is(':visible') )
							t.hide();
					}, t.options.delayOut);
			})

		return this._tip;
	},

	validate: function() {
		if ( ! this.$element[0].parentNode ) {
			this.hide();
			this.$element = null;
			this.options = null;
			this.enabled = false;
		}
	},

	enable: function() {
		this.enabled = true;
	},

	disable: function() {
		this.enabled = false;
	},

	toggleEnabled: function() {
		this.enabled = !this.enabled;
	}
}

jQuery.fn.zipsy = function(options) {
	jQuery.fn.zipsy.enable();

	if ( options === true )
		return this.data('tipsy');

	else if ( typeof options === 'string' ) {
		var tipsy = this.data('tipsy');
		if ( tipsy )
			tipsy[options]();

		return this;
	}

	options = jQuery.extend({}, jQuery.fn.zipsy.defaults, options);

	function get(el) {
		var zipsy = jQuery.data(el, 'tipsy');
		if ( ! zipsy ) {
			zipsy = new Zipsy(el, jQuery.fn.zipsy.elementOptions(el, options));
			jQuery.data(el, 'tipsy', zipsy);
		}

		return zipsy;
	}

	function enter() {
		if ( ! jQuery.fn.zipsy.enabled )
			return;

		var zipsy = get(this);
		zipsy.hoverState = 'in';
		if ( options.delayIn === 0 )
			zipsy.show();
		else
			setTimeout(function() {
				if ( zipsy.hoverState === 'in' )
					zipsy.show();
			}, options.delayIn);
	}

	function leave() {
		var zipsy = get(this);
		zipsy.hoverState = 'out';
		if ( options.delayOut === 0 )
			zipsy.hide();
		else
			setTimeout(function() {
				if ( zipsy.hoverState === 'out' || ! zipsy.$element || ! zipsy.$element.is(':visible') )
					zipsy.hide();
			}, options.delayOut);
	}

	if ( ! options.live )
		this.each(function() { get(this) });

	if ( options.trigger !== 'manual' ) {
		var event_in = options.trigger === 'hover' ? 'mouseenter mouseover' : 'focus',
			event_out = options.trigger === 'hover' ? 'mouseleave mouseout' : 'blur';

		if ( options.live && options.live !== true ) {
			jQuery(this).on(event_in, options.live, enter);
			jQuery(this).on(event_out, options.live, leave);
		} else if ( options.live ) {
			jQuery(document.body).on(event_in, this.selector, enter);
			jQuery(document.body).on(event_out, this.selector, leave);

		} else {
			var binder = options.live ? 'live' : 'bind';
			this[binder](event_in, enter)[binder](event_out, leave);
		}
	}

	return this;
}

jQuery.fn.zipsy.defaults = {
	aria: false,
	className: null,
	delayIn: 0,
	delayOut: 0,
	fade: false,
	fadeInTime: 400,
	fadeOutTime: 400,
	fallback: '',
	gravity: 'n',
	html: false,
	live: false,
	offset: 0,
	opacity: 0.8,
	title: 'title',
	trigger: 'hover',
	theme: '',
	prependTo: document.body
};

jQuery.fn.zipsy.revalidate = function() {
	jQuery('.tipsy').each(function() {
		var t = jQuery.data(this, "tipsy-pointee");
		(!t || !t[0] || !document.contains(t[0])) && jQuery(this).remove();
	});
}

jQuery.fn.zipsy.clear = function() {
	jQuery('.tipsy').remove();
}

jQuery.fn.zipsy.enable = function() {
	jQuery.fn.zipsy.enabled = true;
}

jQuery.fn.zipsy.disable = function() {
	jQuery.fn.zipsy.enabled = false;
}

jQuery.fn.zipsy.elementOptions = function(el, options) {
	return options;
}

jQuery.fn.zipsy.autoNS = function() {
	return $(this).offset().top > ($(document).scrollTop() + $(window).height() / 2) ? 's' : 'n';
}

jQuery.fn.zipsy.autoWE = function() {
	return $(this).offset().left > ($(document).scrollLeft() + $(window).width() / 2) ? 'e' : 'w';
}

jQuery.fn.zipsy.autoNWNE = function() {
	return $(this).offset().left > ($(document).scrollLeft() + $(window).width() / 2) ? 'ne' : 'nw';
}

jQuery.fn.zipsy.autoSWSE = function() {
	return $(this).offset().left > ($(document).scrollLeft() + $(window).width() / 2) ? 'se' : 'sw';
}

jQuery.fn.zipsy.autoBounds = utils.newtip_placement;