var FFZ = window.FrankerFaceZ,

	hue2rgb = function(p, q, t) {
		if ( t < 0 ) t += 1;
		if ( t > 1 ) t -= 1;
		if ( t < 1/6 )
			return p + (q-p) * 6 * t;
		if ( t < 1/2 )
			return q;
		if ( t < 2/3 )
			return p + (q-p) * (2/3 - t) * 6;
		return p;
	};


// ---------------------
// Settings
// ---------------------

FFZ.settings_info.fix_color = {
	type: "select",
	options: {
		'-1': "Disabled",
		0: "Default Colors",
		1: "Luv Adjustment",
		2: "HSL Adjustment (Depreciated)",
		3: "HSV Adjustment (Depreciated)",
		4: "RGB Adjustment (Depreciated)"
	},
	value: '1',

	category: "Chat Appearance",
	no_bttv: true,

	name: "Username Colors - Brightness",
	help: "Ensure that username colors contrast with the background enough to be readable.",

	process_value: function(val) {
		// Load legacy setting.
		if ( val === false )
			return '0';
		else if ( val === true )
			return '1';
		return val;
	},

	on_update: function(val) {
			this.toggle_style('chat-colors-gray', !this.has_bttv && val === '-1');

			if ( ! this.has_bttv && val !== '-1' )
				this._rebuild_colors();
		}
	};


FFZ.settings_info.luv_contrast = {
	type: "button",
	value: 4.5,

	category: "Chat Appearance",
	no_bttv: true,

	name: "Username Colors - Luv Minimum Contrast",
	help: "Set the minimum contrast ratio used by Luv Adjustment to ensure colors are readable.",

	method: function() {
			var old_val = this.settings.luv_contrast,
				new_val = prompt("Luv Adjustment Minimum Contrast Ratio\n\nPlease enter a new value for the minimum contrast ratio required between username colors and the background. The default is: 4.5", old_val);

			if ( new_val === null || new_val === undefined )
				return;

			var parsed = parseFloat(new_val);
			if ( parsed === NaN || parsed < 1 )
				parsed = 4.5;

			this.settings.set("luv_contrast", parsed);
		},

	on_update: function(val) {
			this._rebuild_contrast();

			if ( ! this.has_bttv && this.settings.fix_color == '1' )
			this._rebuild_colors();
		}
	};


FFZ.settings_info.color_blind = {
	type: "select",
	options: {
		0: "Disabled",
		protanope: "Protanope",
		deuteranope: "Deuteranope",
		tritanope: "Tritanope"
	},
	value: '0',

	category: "Chat Appearance",
	no_bttv: true,

	name: "Username Colors - Color Blindness",
	help: "Adjust username colors in an attempt to make them more distinct for people with color blindness.",

	on_update: function(val) {
			if ( ! this.has_bttv && this.settings.fix_color !== '-1' )
			this._rebuild_colors();
		}
	};


// --------------------
// Initialization
// --------------------

FFZ.prototype.setup_colors = function() {
	this.toggle_style('chat-colors-gray', !this.has_bttv && this.settings.fix_color === '-1');

	this._colors = {};
	this._rebuild_contrast();

	this._update_colors();

	// Events for rebuilding colors.
	var Layout = window.App && App.__container__.lookup('controller:layout'),
		Settings = window.App && App.__container__.lookup('controller:settings');

	if ( Layout )
		Layout.addObserver("isTheatreMode", this._update_colors.bind(this, true));

	if ( Settings )
		Settings.addObserver("settings.darkMode", this._update_colors.bind(this, true))

	this._color_old_darkness = (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('settings.darkMode'));
}


// -----------------------
// Color Handling Classes
// -----------------------

FFZ.Color = {};

FFZ.Color.CVDMatrix = {
	protanope: [ // reds are greatly reduced (1% men)
		0.0, 2.02344, -2.52581,
		0.0, 1.0,      0.0,
		0.0, 0.0,      1.0
	],
	deuteranope: [ // greens are greatly reduced (1% men)
		1.0,      0.0, 0.0,
		0.494207, 0.0, 1.24827,
		0.0,      0.0, 1.0
	],
	tritanope: [ // blues are greatly reduced (0.003% population)
		1.0,       0.0,      0.0,
		0.0,       1.0,      0.0,
		-0.395913, 0.801109, 0.0
	]
}


var RGBColor = FFZ.Color.RGB = function(r, g, b) {
	this.r = r||0; this.g = g||0; this.b = b||0;
};

var HSVColor = FFZ.Color.HSV = function(h, s, v) {
	this.h = h||0; this.s = s||0; this.v = v||0;
};

var HSLColor = FFZ.Color.HSL = function(h, s, l) {
	this.h = h||0; this.s = s||0; this.l = l||0;
};

var XYZColor = FFZ.Color.XYZ = function(x, y, z) {
	this.x = x||0; this.y = y||0; this.z = z||0;
};

var LUVColor = FFZ.Color.LUV = function(l, u, v) {
	this.l = l||0; this.u = u||0; this.v = v||0;
};


// RGB Colors

RGBColor.prototype.eq = function(rgb) {
	return rgb.r === this.r && rgb.g === this.g && rgb.b === this.b;
}

RGBColor.fromCSS = function(rgb) {
	rgb = rgb.trim();

	if ( rgb.charAt(0) === '#' )
		return RGBColor.fromHex(rgb);

	var match = /rgba?\( *(\d+%?) *, *(\d+%?) *, *(\d+%?) *(?:,[^\)]+)?\)/.exec(rgb);
	if ( match ) {
		var r = match[1],
			g = match[2],
			b = match[3];

		if ( r.charAt(r.length-1) === '%' )
			r = 255 * (parseInt(r) / 100);
		else
			r = parseInt(r);

		if ( g.charAt(g.length-1) === '%' )
			g = 255 * (parseInt(g) / 100);
		else
			g = parseInt(g);

		if ( b.charAt(b.length-1) === '%' )
			b = 255 * (parseInt(b) / 100);
		else
			b = parseInt(b);

		return new RGBColor(
			Math.min(Math.max(0, r), 255),
			Math.min(Math.max(0, g), 255),
			Math.min(Math.max(0, b), 255)
			);
	}

	return null;
}

RGBColor.fromHex = function(code) {
	var raw = parseInt(code.charAt(0) === '#' ? code.substr(1) : code, 16);
	return new RGBColor(
		(raw >> 16),		 // Red
		(raw >> 8 & 0x00FF), // Green
		(raw & 0x0000FF)	 // Blue
		)
}

RGBColor.fromHSV = function(h, s, v) {
	var r, g, b,

		i = Math.floor(h * 6),
		f = h * 6 - i,
		p = v * (1 - s),
		q = v * (1 - f * s),
		t = v * (1 - (1 - f) * s);

	switch(i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q;
	}

	return new RGBColor(
		Math.round(Math.min(Math.max(0, r*255), 255)),
		Math.round(Math.min(Math.max(0, g*255), 255)),
		Math.round(Math.min(Math.max(0, b*255), 255))
	);
}

RGBColor.fromXYZ = function(x, y, z) {
	var R =  3.240479 * x - 1.537150 * y - 0.498535 * z,
		G = -0.969256 * x + 1.875992 * y + 0.041556 * z,
		B =  0.055648 * x - 0.204043 * y + 1.057311 * z;

	// Make sure we end up in a real color space
	return new RGBColor(
		Math.max(0, Math.min(255, 255 * XYZColor.channelConverter(R))),
		Math.max(0, Math.min(255, 255 * XYZColor.channelConverter(G))),
		Math.max(0, Math.min(255, 255 * XYZColor.channelConverter(B)))
	);
}

RGBColor.fromHSL = function(h, s, l) {
	if ( s === 0 ) {
		var v = Math.round(Math.min(Math.max(0, 255*l), 255));
		return new RGBColor(v, v, v);
	}

	var q = l < 0.5 ? l * (1 + s) : l + s - l * s,
		p = 2 * l - q;

	return new RGBColor(
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h + 1/3)), 255)),
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h)), 255)),
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h - 1/3)), 255))
	);
}

RGBColor.prototype.toHSV = function() { return HSVColor.fromRGB(this.r, this.g, this.b); }
RGBColor.prototype.toHSL = function() { return HSLColor.fromRGB(this.r, this.g, this.b); }
RGBColor.prototype.toCSS = function() { return "rgb(" + Math.round(this.r) + "," + Math.round(this.g) + "," + Math.round(this.b) + ")"; }
RGBColor.prototype.toXYZ = function() { return XYZColor.fromRGB(this.r, this.g, this.b); }
RGBColor.prototype.toLUV = function() { return this.toXYZ().toLUV(); }

RGBColor.prototype.toHex = function() {
	var rgb = this.b | (this.g << 8) | (this.r << 16);
	return '#' + (0x1000000 + rgb).toString(16).slice(1);
}


RGBColor.prototype.luminance = function() {
	var rgb = [this.r / 255, this.g / 255, this.b / 255];
	for (var i =0, l = rgb.length; i < l; i++) {
		if (rgb[i] <= 0.03928) {
			rgb[i] = rgb[i] / 12.92;
		} else {
			rgb[i] = Math.pow( ((rgb[i]+0.055)/1.055), 2.4 );
		}
	}
	return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
}


RGBColor.prototype.brighten = function(amount) {
	amount = typeof amount === "number" ? amount : 1;
	amount = Math.round(255 * (amount / 100));

	return new RGBColor(
		Math.max(0, Math.min(255, this.r + amount)),
		Math.max(0, Math.min(255, this.g + amount)),
		Math.max(0, Math.min(255, this.b + amount))
	);
}


RGBColor.prototype.daltonize = function(type, amount) {
	amount = typeof amount === "number" ? amount : 1.0;
	var cvd;
	if ( typeof type === "string" ) {
		if ( FFZ.Color.CVDMatrix.hasOwnProperty(type) )
			cvd = FFZ.Color.CVDMatrix[type];
		else
			throw "Invalid CVD matrix.";
	} else
		cvd = type;

	var cvd_a = cvd[0], cvd_b = cvd[1], cvd_c = cvd[2],
		cvd_d = cvd[3], cvd_e = cvd[4], cvd_f = cvd[5],
		cvd_g = cvd[6], cvd_h = cvd[7], cvd_i = cvd[8],

		L, M, S, l, m, s, R, G, B, RR, GG, BB;

	// RGB to LMS matrix conversion
	L = (17.8824 * this.r) + (43.5161 * this.g) + (4.11935 * this.b);
	M = (3.45565 * this.r) + (27.1554 * this.g) + (3.86714 * this.b);
	S = (0.0299566 * this.r) + (0.184309 * this.g) + (1.46709 * this.b);
	// Simulate color blindness
	l = (cvd_a * L) + (cvd_b * M) + (cvd_c * S);
	m = (cvd_d * L) + (cvd_e * M) + (cvd_f * S);
	s = (cvd_g * L) + (cvd_h * M) + (cvd_i * S);
	// LMS to RGB matrix conversion
	R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
	G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
	B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);
	// Isolate invisible colors to color vision deficiency (calculate error matrix)
	R = this.r - R;
	G = this.g - G;
	B = this.b - B;
	// Shift colors towards visible spectrum (apply error modifications)
	RR = (0.0 * R) + (0.0 * G) + (0.0 * B);
	GG = (0.7 * R) + (1.0 * G) + (0.0 * B);
	BB = (0.7 * R) + (0.0 * G) + (1.0 * B);
	// Add compensation to original values
	R = Math.min(Math.max(0, RR + this.r), 255);
	G = Math.min(Math.max(0, GG + this.g), 255);
	B = Math.min(Math.max(0, BB + this.b), 255);

	return new RGBColor(R, G, B);
}

RGBColor.prototype._r = function(r) { return new RGBColor(r, this.g, this.b); }
RGBColor.prototype._g = function(g) { return new RGBColor(this.r, g, this.b); }
RGBColor.prototype._b = function(b) { return new RGBColor(this.r, this.g, b); }


// HSL Colors

HSLColor.prototype.eq = function(hsl) {
	return hsl.h === this.h && hsl.s === this.s && hsl.l === this.l;
}

HSLColor.fromRGB = function(r, g, b) {
	r /= 255; g /= 255; b /= 255;

	var max = Math.max(r,g,b),
		min = Math.min(r,g,b),

		h, s, l = Math.min(Math.max(0, (max+min) / 2), 1),
		d = Math.min(Math.max(0, max - min), 1);

	if ( d === 0 )
		h = s = 0;
	else {
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch(max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
		}
		h /= 6;
	}

	return new HSLColor(h, s, l);
}

HSLColor.prototype.toRGB = function() { return RGBColor.fromHSL(this.h, this.s, this.l); }
HSLColor.prototype.toCSS = function() { return "hsl(" + Math.round(this.h*360) + "," + Math.round(this.s*100) + "%," + Math.round(this.l*100) + "%)"; }
HSLColor.prototype.toHex = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toHex(); }
HSLColor.prototype.toHSV = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toHSV(); }
HSLColor.prototype.toXYZ = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toXYZ(); }
HSLColor.prototype.toLUV = function() { return RGBColor.fromHSL(this.h, this.s, this.l).toLUV(); }


HSLColor.prototype._h = function(h) { return new HSLColor(h, this.s, this.l); }
HSLColor.prototype._s = function(s) { return new HSLColor(this.h, s, this.l); }
HSLColor.prototype._l = function(l) { return new HSLColor(this.h, this.s, l); }


// HSV Colors

HSVColor.prototype.eq = function(hsv) { return hsv.h === this.h && hsv.s === this.s && hsv.v === this.v; }

HSVColor.fromRGB = function(r, g, b) {
	r /= 255; g /= 255; b /= 255;

	var max = Math.max(r, g, b),
		min = Math.min(r, g, b),
		d = Math.min(Math.max(0, max - min), 1),

		h,
		s = max === 0 ? 0 : d / max,
		v = max;

	if ( d === 0 )
		h = 0;
	else {
		switch(max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
		}
		h /= 6;
	}

	return new HSVColor(h, s, v);
}


HSVColor.prototype.toRGB = function() { return RGBColor.fromHSV(this.h, this.s, this.v); }
HSVColor.prototype.toHSL = function() { return RGBColor.fromHSV(this.h, this.s, this.v).toHSL(); }
HSVColor.prototype.toXYZ = function() { return RGBColor.fromHSV(this.h, this.s, this.v).toXYZ(); }
HSVColor.prototype.toLUV = function() { return RGBColor.fromHSV(this.h, this.s, this.v).toLUV(); }


HSVColor.prototype._h = function(h) { return new HSVColor(h, this.s, this.v); }
HSVColor.prototype._s = function(s) { return new HSVColor(this.h, s, this.v); }
HSVColor.prototype._v = function(v) { return new HSVColor(this.h, this.s, v); }


// XYZ Colors

RGBColor.channelConverter = function (channel) {
	// http://www.brucelindbloom.com/Eqn_RGB_to_XYZ.html
	// This converts rgb 8bit to rgb linear, lazy because the other algorithm is really really dumb
	return Math.pow(channel, 2.2);

	// CSS Colors Level 4 says 0.03928, Bruce Lindbloom who cared to write all algos says 0.04045, used bruce because whynawt
	return (channel <= 0.04045) ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
};

XYZColor.channelConverter = function (channel) {
	// Using lazy conversion in the other direction as well
	return Math.pow(channel, 1/2.2);

	// I'm honestly not sure about 0.0031308, I've only seen it referenced on Bruce Lindbloom's site
	return (channel <= 0.0031308) ? channel * 12.92 : Math.pow(1.055 * channel, 1/2.4) - 0.055;
};


XYZColor.prototype.eq = function(xyz) {  return xyz.x === this.x && xyz.y === this.y && xyz.z === this.z; }

XYZColor.fromRGB = function(r, g, b) {
	var R = RGBColor.channelConverter(r / 255),
		G = RGBColor.channelConverter(g / 255),
		B = RGBColor.channelConverter(b / 255);

	return new XYZColor(
		0.412453 * R + 0.357580 * G + 0.180423 * B,
		0.212671 * R + 0.715160 * G + 0.072169 * B,
		0.019334 * R + 0.119193 * G + 0.950227 * B
	);
}

XYZColor.fromLUV = function(l, u, v) {
	var deltaGammaFactor = 1 / (XYZColor.WHITE.x + 15 * XYZColor.WHITE.y + 3 * XYZColor.WHITE.z);
	var uDeltaGamma = 4 * XYZColor.WHITE.x * deltaGammaFactor;
	var vDeltagamma = 9 * XYZColor.WHITE.y * deltaGammaFactor;

	// XYZColor.EPSILON * XYZColor.KAPPA = 8
	var Y = (l > 8) ? Math.pow((l + 16) / 116, 3) : l / XYZColor.KAPPA;

	var a = 1/3 * (((52 * l) / (u + 13 * l * uDeltaGamma)) - 1);
	var b = -5 * Y;
	var c = -1/3;
	var d = Y * (((39 * l) / (v + 13 * l * vDeltagamma)) - 5);

	var X = (d - b) / (a - c);
	var Z = X * a + b;

	return new XYZColor(X, Y, Z);
}


XYZColor.prototype.toRGB = function() { return RGBColor.fromXYZ(this.x, this.y, this.z); }
XYZColor.prototype.toLUV = function() { return LUVColor.fromXYZ(this.x, this.y, this.z); }
XYZColor.prototype.toHSL = function() { return RGBColor.fromXYZ(this.x, this.y, this.z).toHSL(); }
XYZColor.prototype.toHSV = function() { return RGBColor.fromXYZ(this.x, this.y, this.z).toHSV(); }


XYZColor.prototype._x = function(x) { return new XYZColor(x, this.y, this.z); }
XYZColor.prototype._y = function(y) { return new XYZColor(this.x, y, this.z); }
XYZColor.prototype._z = function(z) { return new XYZColor(this.x, this.y, z); }


// LUV Colors

XYZColor.EPSILON = Math.pow(6 / 29, 3);
XYZColor.KAPPA = Math.pow(29 / 3, 3);
XYZColor.WHITE = (new RGBColor(255, 255, 255)).toXYZ();


LUVColor.prototype.eq = function(luv) { return luv.l === this.l && luv.u === this.u && luv.v === this.v; }

LUVColor.fromXYZ = function(X, Y, Z) {
	var deltaGammaFactor = 1 / (XYZColor.WHITE.x + 15 * XYZColor.WHITE.y + 3 * XYZColor.WHITE.z);
	var uDeltaGamma = 4 * XYZColor.WHITE.x * deltaGammaFactor;
	var vDeltagamma = 9 * XYZColor.WHITE.y * deltaGammaFactor;

	var yGamma = Y / XYZColor.WHITE.y;
	var deltaDivider = (X + 15 * Y + 3 * Z);

	if (deltaDivider === 0) {
		deltaDivider = 1;
	}

	var deltaFactor = 1 / deltaDivider;

	var uDelta = 4 * X * deltaFactor;
	var vDelta = 9 * Y * deltaFactor;

	var L = (yGamma > XYZColor.EPSILON) ? 116 * Math.pow(yGamma, 1/3) - 16 : XYZColor.KAPPA * yGamma;
	var u = 13 * L * (uDelta - uDeltaGamma);
	var v = 13 * L * (vDelta - vDeltagamma);

	return new LUVColor(L, u, v);
}


LUVColor.prototype.toXYZ = function() { return XYZColor.fromLUV(this.l, this.u, this.v); }
LUVColor.prototype.toRGB = function() { return XYZColor.fromLUV(this.l, this.u, this.v).toRGB(); }
LUVColor.prototype.toHSL = function() { return XYZColor.fromLUV(this.l, this.u, this.v).toHSL(); }
LUVColor.prototype.toHSV = function() { return XYZColor.fromLUV(this.l, this.u, this.v).toHSV(); }


LUVColor.prototype._l = function(l) { return new LUVColor(l, this.u, this.v); }
LUVColor.prototype._u = function(u) { return new LUVColor(this.l, u, this.v); }
LUVColor.prototype._v = function(v) { return new LUVColor(this.l, this.u, v); }


// --------------------
// Rebuild Colors
// --------------------

FFZ.prototype._rebuild_contrast = function() {
	this._luv_required_bright = new XYZColor(0, (this.settings.luv_contrast * (new RGBColor(35,35,35).toXYZ().y + 0.05) - 0.05), 0).toLUV().l;
	this._luv_required_dark = new XYZColor(0, ((new RGBColor(217,217,217).toXYZ().y + 0.05) / this.settings.luv_contrast - 0.05), 0).toLUV().l;
}

FFZ.prototype._rebuild_colors = function() {
	if ( this.has_bttv )
		return;

	// With update colors, we'll automatically process the colors we care about.
	this._colors = {};
	this._update_colors();
}


FFZ.prototype._update_colors = function(darkness_only) {
	// Update the lines. ALL of them.
	var Layout = window.App && App.__container__.lookup('controller:layout'),
		Settings = window.App && App.__container__.lookup('controller:settings'),

		is_dark =  (Layout && Layout.get('isTheatreMode')) || (Settings && Settings.get('settings.darkMode'));

	if ( darkness_only && this._color_old_darkness === is_dark )
		return;

	this._color_old_darkness = is_dark;

	var colored_bits = document.querySelectorAll('.has-color');
	for(var i=0, l=colored_bits.length; i < l; i++) {
		var bit = colored_bits[i],
			color = bit.getAttribute('data-color'),
			colors = color && this._handle_color(color);

		if ( ! colors )
			continue;

		bit.style.color = is_dark ? colors[1] : colors[0];
	}
}


FFZ.prototype._handle_color = function(color) {
	if ( color instanceof RGBColor )
		color = color.toHex();

	if ( ! color || this._colors.hasOwnProperty(color) )
		return this._colors[color];

	var rgb = RGBColor.fromHex(color),

		light_color = color,
		dark_color = color;

	// Color Blindness Handling
	if ( this.settings.color_blind !== '0' ) {
		var new_color = rgb.daltonize(this.settings.color_blind);
		if ( ! rgb.eq(new_color) ) {
			rgb = new_color;
			light_color = dark_color = rgb.toHex();
		}
	}


	// Color Processing - RGB
	if ( this.settings.fix_color === '4' ) {
		var lum = rgb.luminance();

		if ( lum > 0.3 ) {
			var s = 127, nc = rgb;
			while(s--) {
				nc = nc.brighten(-1);
				if ( nc.luminance() <= 0.3 )
					break;
			}

			light_color = nc.toHex();
		}

		if ( lum < 0.15 ) {
			var s = 127, nc = rgb;
			while(s--) {
				nc = nc.brighten();
				if ( nc.luminance() >= 0.15 )
					break;
			}

			dark_color = nc.toHex();
		}
	}


	// Color Processing - HSL
	if ( this.settings.fix_color === '2' ) {
		var hsl = rgb.toHSL();

		light_color = hsl._l(Math.min(Math.max(0, 0.7 * hsl.l), 1)).toHex();
		dark_color = hsl._l(Math.min(Math.max(0, 0.3 + (0.7 * hsl.l)), 1)).toHex();
	}


	// Color Processing - HSV
	if ( this.settings.fix_color === '3' ) {
		var hsv = rgb.toHSV();

		if ( hsv.s === 0 ) {
			// Black and White
			light_color = hsv._v(Math.min(Math.max(0.5, 0.5 * hsv.v), 1)).toRGB().toHex();
			dark_color = hsv._v(Math.min(Math.max(0.5, 0.5 + (0.5 * hsv.v)), 1)).toRGB().toHex();

		} else {
			light_color = RGBColor.fromHSV(hsv.h, Math.min(Math.max(0.7, 0.7 + (0.3 * hsv.s)), 1), Math.min(0.7, hsv.v)).toHex();
			dark_color = RGBColor.fromHSV(hsv.h, Math.min(0.7, hsv.s), Math.min(Math.max(0.7, 0.7 + (0.3 * hsv.v)), 1)).toHex();
		}
	}

	// Color Processing - LUV
	if ( this.settings.fix_color === '1' ) {
		var luv = rgb.toLUV();

		if ( luv.l > this._luv_required_dark )
			light_color = luv._l(this._luv_required_dark).toRGB().toHex();

		if ( luv.l < this._luv_required_bright )
			dark_color = luv._l(this._luv_required_bright).toRGB().toHex();
	}

	var out = this._colors[color] = [light_color, dark_color];
	return out;
}