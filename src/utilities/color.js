'use strict';

export function hue2rgb(p, q, t) {
	if ( t < 0 ) t += 1;
	if ( t > 1 ) t -= 1;
	if ( t < 1/6 )
		return p + (q-p) * 6 * t;
	if ( t < 1/2 )
		return q;
	if ( t < 2/3 )
		return p + (q-p) * (2/3 - t) * 6;
	return p;
}

export function bit2linear(channel) {
	// http://www.brucelindbloom.com/Eqn_RGB_to_XYZ.html
	// This converts rgb 8bit to rgb linear, lazy because the other algorithm is really really dumb
	//return Math.pow(channel, 2.2);

	// CSS Colors Level 4 says 0.03928, Bruce Lindbloom who cared to write all algos says 0.04045, used bruce because whynawt
	return (channel <= 0.04045) ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function linear2bit(channel) {
	// Using lazy conversion in the other direction as well
	//return Math.pow(channel, 1/2.2);

	// I'm honestly not sure about 0.0031308, I've only seen it referenced on Bruce Lindbloom's site
	return (channel <= 0.0031308) ? channel * 12.92 : Math.pow(1.055 * channel, 1/2.4) - 0.055;
}


export const Color = {};

Color._canvas = null;
Color._context = null;

Color.CVDMatrix = {
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


const RGBAColor = Color.RGBA = function(r, g, b, a) {
	this.r = r||0; this.g = g||0; this.b = b||0; this.a = a||0;
};

const HSVAColor = Color.HSVA = function(h, s, v, a) {
	this.h = h||0; this.s = s||0; this.v = v||0; this.a = a||0;
};

const HSLAColor = Color.HSLA = function(h, s, l, a) {
	this.h = h||0; this.s = s||0; this.l = l||0; this.a = a||0;
};

const XYZAColor = Color.XYZA = function(x, y, z, a) {
	this.x = x||0; this.y = y||0; this.z = z||0; this.a = a||0;
};

const LUVAColor = Color.LUVA = function(l, u, v, a) {
	this.l = l||0; this.u = u||0; this.v = v||0; this.a = a||0;
};


// RGBA Colors

RGBAColor.prototype.eq = function(rgb) {
	return rgb.r === this.r && rgb.g === this.g && rgb.b === this.b && rgb.a === this.a;
}

RGBAColor.fromName = function(name) {
	let context = Color._context;
	if ( ! context ) {
		const canvas = Color._canvas = document.createElement('canvas');
		context = Color._context = canvas.getContext('2d');
	}

	context.clearRect(0,0,1,1);
	context.fillStyle = name;
	context.fillRect(0,0,1,1);
	const data = context.getImageData(0,0,1,1);

	if ( ! data || ! data.data || data.data.length !== 4 )
		return null;

	return new RGBAColor(data.data[0], data.data[1], data.data[2], data.data[3] / 255);
}

RGBAColor.fromCSS = function(rgb) {
	if ( ! rgb )
		return null;

	rgb = rgb.trim();

	if ( rgb.charAt(0) === '#' )
		return RGBAColor.fromHex(rgb);

	const match = /rgba?\( *(\d+%?) *, *(\d+%?) *, *(\d+%?) *(?:, *([\d.]+))?\)/i.exec(rgb);
	if ( match ) {
		let r = match[1],
			g = match[2],
			b = match[3],
			a = match[4];

		if ( r.charAt(r.length-1) === '%' )
			r = 255 * (parseInt(r,10) / 100);
		else
			r = parseInt(r,10);

		if ( g.charAt(g.length-1) === '%' )
			g = 255 * (parseInt(g,10) / 100);
		else
			g = parseInt(g,10);

		if ( b.charAt(b.length-1) === '%' )
			b = 255 * (parseInt(b,10) / 100);
		else
			b = parseInt(b,10);

		if ( a )
			if ( a.charAt(a.length-1) === '%' )
				a = parseInt(a,10) / 100;
			else
				a = parseFloat(a);
		else
			a = 1;

		return new RGBAColor(
			Math.min(Math.max(0, r), 255),
			Math.min(Math.max(0, g), 255),
			Math.min(Math.max(0, b), 255),
			Math.min(Math.max(0, a), 1)
		);
	}

	return RGBAColor.fromName(rgb);
}

RGBAColor.fromHex = function(code, alpha = 1) {
	if ( code.charAt(0) === '#' )
		code = code.slice(1);

	if ( code.length === 3 )
		code = `${code[0]}${code[0]}${code[1]}${code[1]}${code[2]}${code[2]}`;

	else if ( code.length === 4 )
		code = `${code[0]}${code[0]}${code[1]}${code[1]}${code[2]}${code[2]}${code[3]}${code[3]}`;

	if ( code.length === 8 ) {
		alpha = parseInt(code.slice(6), 16) / 255;
		code = code.slice(0, 6);

	} else if ( code.length !== 6 )
		throw new Error('invalid hex code');

	const raw = parseInt(code, 16);
	return new RGBAColor(
		(raw >> 16),		 // Red
		(raw >> 8 & 0x00FF), // Green
		(raw & 0x0000FF),    // Blue,
		alpha                // Alpha
	);
}

RGBAColor.fromHSVA = function(h, s, v, a) {
	let r, g, b;

	const i = Math.floor(h * 6),
		f = h * 6 - i,
		p = v * (1 - s),
		q = v * (1 - f * s),
		t = v * (1 - (1 - f) * s);

	switch(i % 6) {
		case 0: r = v; g = t; b = p; break;
		case 1: r = q; g = v; b = p; break;
		case 2: r = p; g = v; b = t; break;
		case 3: r = p; g = q; b = v; break;
		case 4: r = t; g = p; b = v; break;
		case 5: r = v; g = p; b = q;
	}

	return new RGBAColor(
		Math.round(Math.min(Math.max(0, r*255), 255)),
		Math.round(Math.min(Math.max(0, g*255), 255)),
		Math.round(Math.min(Math.max(0, b*255), 255)),
		a === undefined ? 1 : a
	);
}

RGBAColor.fromXYZA = function(x, y, z, a) {
	const R =  3.240479 * x - 1.537150 * y - 0.498535 * z,
		G = -0.969256 * x + 1.875992 * y + 0.041556 * z,
		B =  0.055648 * x - 0.204043 * y + 1.057311 * z;

	// Make sure we end up in a real color space
	return new RGBAColor(
		Math.max(0, Math.min(255, 255 * linear2bit(R))),
		Math.max(0, Math.min(255, 255 * linear2bit(G))),
		Math.max(0, Math.min(255, 255 * linear2bit(B))),
		a === undefined ? 1 : a
	);
}

RGBAColor.fromHSLA = function(h, s, l, a) {
	if ( s === 0 ) {
		const v = Math.round(Math.min(Math.max(0, 255*l), 255));
		return new RGBAColor(v, v, v, a === undefined ? 1 : a);
	}

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
		p = 2 * l - q;

	return new RGBAColor(
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h + 1/3)), 255)),
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h)), 255)),
		Math.round(Math.min(Math.max(0, 255 * hue2rgb(p, q, h - 1/3)), 255)),
		a === undefined ? 1 : a
	);
}

RGBAColor.prototype.toHSVA = function() { return HSVAColor.fromRGBA(this.r, this.g, this.b, this.a); }
RGBAColor.prototype.toHSLA = function() { return HSLAColor.fromRGBA(this.r, this.g, this.b, this.a); }
RGBAColor.prototype.toCSS = function() { return `rgb${this.a !== 1 ? 'a' : ''}(${Math.round(this.r)},${Math.round(this.g)},${Math.round(this.b)}${this.a !== 1 ? `,${this.a}` : ''})`; }
RGBAColor.prototype.toXYZA = function() { return XYZAColor.fromRGBA(this.r, this.g, this.b, this.a); }
RGBAColor.prototype.toLUVA = function() { return this.toXYZA().toLUVA(); }

RGBAColor.prototype.toHex = function() {
	const rgb = this.b | (this.g << 8) | (this.r << 16);
	return `#${(0x1000000 + rgb).toString(16).slice(1)}`;
}


RGBAColor.prototype.get_Y = function() {
	return ((0.299 * this.r) + ( 0.587 * this.g) + ( 0.114 * this.b)) / 255;
}


RGBAColor.prototype.luminance = function() {
	const r = bit2linear(this.r / 255),
		g = bit2linear(this.g / 255),
		b = bit2linear(this.b / 255);

	return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}


RGBAColor.prototype.brighten = function(amount) {
	amount = typeof amount === `number` ? amount : 1;
	amount = Math.round(255 * (amount / 100));

	return new RGBAColor(
		Math.max(0, Math.min(255, this.r + amount)),
		Math.max(0, Math.min(255, this.g + amount)),
		Math.max(0, Math.min(255, this.b + amount)),
		this.a
	);
}


RGBAColor.prototype.daltonize = function(type) {
	let cvd;
	if ( typeof type === 'string' ) {
		if ( Color.CVDMatrix.hasOwnProperty(type) )
			cvd = Color.CVDMatrix[type];
		else
			throw new Error('Invalid CVD matrix');
	} else
		cvd = type;

	const cvd_a = cvd[0], cvd_b = cvd[1], cvd_c = cvd[2],
		cvd_d = cvd[3], cvd_e = cvd[4], cvd_f = cvd[5],
		cvd_g = cvd[6], cvd_h = cvd[7], cvd_i = cvd[8];

	//let L, M, S, l, m, s, R, G, B, RR, GG, BB;

	// RGB to LMS matrix conversion
	const L = (17.8824 * this.r) + (43.5161 * this.g) + (4.11935 * this.b),
		M = (3.45565 * this.r) + (27.1554 * this.g) + (3.86714 * this.b),
		S = (0.0299566 * this.r) + (0.184309 * this.g) + (1.46709 * this.b);

	// Simulate color blindness
	const l = (cvd_a * L) + (cvd_b * M) + (cvd_c * S),
		m = (cvd_d * L) + (cvd_e * M) + (cvd_f * S),
		s = (cvd_g * L) + (cvd_h * M) + (cvd_i * S);

	// LMS to RGB matrix conversion
	let R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s),
		G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s),
		B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);

	// Isolate invisible colors to color vision deficiency (calculate error matrix)
	R = this.r - R;
	G = this.g - G;
	B = this.b - B;

	// Shift colors towards visible spectrum (apply error modifications)
	const RR = (0.0 * R) + (0.0 * G) + (0.0 * B),
		GG = (0.7 * R) + (1.0 * G) + (0.0 * B),
		BB = (0.7 * R) + (0.0 * G) + (1.0 * B);

	// Add compensation to original values
	R = Math.min(Math.max(0, RR + this.r), 255);
	G = Math.min(Math.max(0, GG + this.g), 255);
	B = Math.min(Math.max(0, BB + this.b), 255);

	return new RGBAColor(R, G, B, this.a);
}

RGBAColor.prototype._r = function(r) { return new RGBAColor(r, this.g, this.b, this.a); }
RGBAColor.prototype._g = function(g) { return new RGBAColor(this.r, g, this.b, this.a); }
RGBAColor.prototype._b = function(b) { return new RGBAColor(this.r, this.g, b, this.a); }
RGBAColor.prototype._a = function(a) { return new RGBAColor(this.r, this.g, this.b, a); }


// HSL Colors

HSLAColor.prototype.eq = function(hsl) {
	return hsl.h === this.h && hsl.s === this.s && hsl.l === this.l && hsl.a === this.a;
}

HSLAColor.fromRGBA = function(r, g, b, a) {
	r /= 255; g /= 255; b /= 255;

	const max = Math.max(r,g,b),
		min = Math.min(r,g,b),

		l = Math.min(Math.max(0, (max+min) / 2), 1),
		d = Math.min(Math.max(0, max - min), 1);

	let h, s;

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

	return new HSLAColor(h, s, l, a === undefined ? 1 : a);
}

HSLAColor.prototype.targetLuminance = function (target) {
	let s = this.s,
		min = 0,
		max = 1;

	s *= Math.pow(this.l > 0.5 ? -this.l : this.l - 1, 7) + 1;

	let d = (max - min) / 2,
		mid = min + d;

	for (; d > 1/65536; d /= 2, mid = min + d) {
		const luminance = RGBAColor.fromHSLA(this.h, s, mid, 1).luminance()
		if (luminance > target) {
			max = mid;
		} else {
			min = mid;
		}
	}

	return new HSLAColor(this.h, s, mid, this.a);
}

HSLAColor.prototype.toRGBA = function() { return RGBAColor.fromHSLA(this.h, this.s, this.l, this.a); }
HSLAColor.prototype.toCSS = function() { return `hsl${this.a !== 1 ? 'a' : ''}(${Math.round(this.h*360)},${Math.round(this.s*100)}%,${Math.round(this.l*100)}%${this.a !== 1 ? `,${this.a}` : ''})`; }
HSLAColor.prototype.toHSVA = function() { return this.toRGBA().toHSVA(); }
HSLAColor.prototype.toXYZA = function() { return this.toRGBA().toXYZA(); }
HSLAColor.prototype.toLUVA = function() { return this.toRGBA().toLUVA(); }


HSLAColor.prototype._h = function(h) { return new HSLAColor(h, this.s, this.l, this.a); }
HSLAColor.prototype._s = function(s) { return new HSLAColor(this.h, s, this.l, this.a); }
HSLAColor.prototype._l = function(l) { return new HSLAColor(this.h, this.s, l, this.a); }
HSLAColor.prototype._a = function(a) { return new HSLAColor(this.h, this.s, this.l, a); }


// HSV Colors

HSVAColor.prototype.eq = function(hsv) { return hsv.h === this.h && hsv.s === this.s && hsv.v === this.v && hsv.a === this.a; }

HSVAColor.fromRGBA = function(r, g, b, a) {
	r /= 255; g /= 255; b /= 255;

	const max = Math.max(r, g, b),
		min = Math.min(r, g, b),
		d = Math.min(Math.max(0, max - min), 1),

		s = max === 0 ? 0 : d / max,
		v = max;

	let h;

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

	return new HSVAColor(h, s, v, a === undefined ? 1 : a);
}


HSVAColor.prototype.toRGBA = function() { return RGBAColor.fromHSVA(this.h, this.s, this.v, this.a); }
HSVAColor.prototype.toHSLA = function() { return this.toRGBA().toHSLA(); }
HSVAColor.prototype.toXYZA = function() { return this.toRGBA().toXYZA(); }
HSVAColor.prototype.toLUVA = function() { return this.toRGBA().toLUVA(); }


HSVAColor.prototype._h = function(h) { return new HSVAColor(h, this.s, this.v, this.a); }
HSVAColor.prototype._s = function(s) { return new HSVAColor(this.h, s, this.v, this.a); }
HSVAColor.prototype._v = function(v) { return new HSVAColor(this.h, this.s, v, this.a); }
HSVAColor.prototype._a = function(a) { return new HSVAColor(this.h, this.s, this.v, a); }


// XYZ Colors

XYZAColor.prototype.eq = function(xyz) {  return xyz.x === this.x && xyz.y === this.y && xyz.z === this.z; }

XYZAColor.fromRGBA = function(r, g, b, a) {
	const R = bit2linear(r / 255),
		G = bit2linear(g / 255),
		B = bit2linear(b / 255);

	return new XYZAColor(
		0.412453 * R + 0.357580 * G + 0.180423 * B,
		0.212671 * R + 0.715160 * G + 0.072169 * B,
		0.019334 * R + 0.119193 * G + 0.950227 * B,
		a === undefined ? 1 : a
	);
}

XYZAColor.fromLUVA = function(l, u, v, alpha) {
	const deltaGammaFactor = 1 / (XYZAColor.WHITE.x + 15 * XYZAColor.WHITE.y + 3 * XYZAColor.WHITE.z),
		uDeltaGamma = 4 * XYZAColor.WHITE.x * deltaGammaFactor,
		vDeltagamma = 9 * XYZAColor.WHITE.y * deltaGammaFactor;

	// XYZAColor.EPSILON * XYZAColor.KAPPA = 8
	const Y = (l > 8) ? Math.pow((l + 16) / 116, 3) : l / XYZAColor.KAPPA,
		a = 1/3 * (((52 * l) / (u + 13 * l * uDeltaGamma)) - 1),
		b = -5 * Y,
		c = -1/3,
		d = Y * (((39 * l) / (v + 13 * l * vDeltagamma)) - 5),

		X = (d - b) / (a - c),
		Z = X * a + b;

	return new XYZAColor(X, Y, Z, alpha === undefined ? 1 : alpha);
}


XYZAColor.prototype.toRGBA = function() { return RGBAColor.fromXYZA(this.x, this.y, this.z, this.a); }
XYZAColor.prototype.toLUVA = function() { return LUVAColor.fromXYZA(this.x, this.y, this.z, this.a); }
XYZAColor.prototype.toHSLA = function() { return this.toRGBA().toHSLA(); }
XYZAColor.prototype.toHSVA = function() { return this.toRGBA().toHSVA(); }


XYZAColor.prototype._x = function(x) { return new XYZAColor(x, this.y, this.z, this.a); }
XYZAColor.prototype._y = function(y) { return new XYZAColor(this.x, y, this.z, this.a); }
XYZAColor.prototype._z = function(z) { return new XYZAColor(this.x, this.y, z, this.a); }
XYZAColor.prototype._a = function(a) { return new XYZAColor(this.x, this.y, this.z, a); }


// LUV Colors

XYZAColor.EPSILON = Math.pow(6 / 29, 3);
XYZAColor.KAPPA = Math.pow(29 / 3, 3);
XYZAColor.WHITE = (new RGBAColor(255, 255, 255, 1)).toXYZA();


LUVAColor.prototype.eq = function(luv) { return luv.l === this.l && luv.u === this.u && luv.v === this.v; }

LUVAColor.fromXYZA = function(X, Y, Z, a) {
	const deltaGammaFactor = 1 / (XYZAColor.WHITE.x + 15 * XYZAColor.WHITE.y + 3 * XYZAColor.WHITE.z),
		uDeltaGamma = 4 * XYZAColor.WHITE.x * deltaGammaFactor,
		vDeltagamma = 9 * XYZAColor.WHITE.y * deltaGammaFactor,

		yGamma = Y / XYZAColor.WHITE.y;

	let deltaDivider = (X + 15 * Y + 3 * Z);
	if (deltaDivider === 0) {
		deltaDivider = 1;
	}

	const deltaFactor = 1 / deltaDivider,

		uDelta = 4 * X * deltaFactor,
		vDelta = 9 * Y * deltaFactor,

		L = (yGamma > XYZAColor.EPSILON) ? 116 * Math.pow(yGamma, 1/3) - 16 : XYZAColor.KAPPA * yGamma,
		u = 13 * L * (uDelta - uDeltaGamma),
		v = 13 * L * (vDelta - vDeltagamma);

	return new LUVAColor(L, u, v, a === undefined ? 1 : a);
}


LUVAColor.prototype.toXYZA = function() { return XYZAColor.fromLUVA(this.l, this.u, this.v, this.a); }
LUVAColor.prototype.toRGBA = function() { return this.toXYZA().toRGBA(); }
LUVAColor.prototype.toHSLA = function() { return this.toXYZA().toHSLA(); }
LUVAColor.prototype.toHSVA = function() { return this.toXYZA().toHSVA(); }


LUVAColor.prototype._l = function(l) { return new LUVAColor(l, this.u, this.v, this.a); }
LUVAColor.prototype._u = function(u) { return new LUVAColor(this.l, u, this.v, this.a); }
LUVAColor.prototype._v = function(v) { return new LUVAColor(this.l, this.u, v, this.a); }
LUVAColor.prototype._a = function(a) { return new LUVAColor(this.l, this.u, this.v, a); }



export class ColorAdjuster {
	constructor(base = '#232323', mode = 0, contrast = 4.5) {
		this._contrast = contrast;
		this._base = base;
		this._mode = mode;

		this.rebuildContrast();
	}

	get contrast() { return this._contrast }
	set contrast(val) { this._contrast = val; this.rebuildContrast() }

	get base() { return this._base }
	set base(val) { this._base = val; this.rebuildContrast() }

	get dark() { return this._dark }

	get mode() { return this._mode }
	set mode(val) { this._mode = val; this.rebuildContrast() }


	rebuildContrast() {
		this._cache = new Map;

		const base = RGBAColor.fromCSS(this._base),
			lum = base.luminance();

		const dark = this._dark = lum < 0.5;

		if ( dark ) {
			this._luv = new XYZAColor(
				0,
				(this._contrast * (base.toXYZA().y + 0.05) - 0.05),
				0,
				1
			).toLUVA().l;

			this._luma = this._contrast * (base.luminance() + 0.05) - 0.05;

		} else {
			this._luv = new XYZAColor(
				0,
				(base.toXYZA().y + 0.05) / this._contrast - 0.05,
				0,
				1
			).toLUVA().l;

			this._luma = (base.luminance() + 0.05) / this._contrast - 0.05;
		}
	}

	process(color, throw_errors = false) {
		if ( this._mode === -1 )
			return '';
		else if ( this._mode === 0 )
			return color;

		if ( color instanceof RGBAColor )
			color = color.toCSS();

		if ( ! color )
			return null;

		if ( this._cache.has(color) )
			return this._cache.get(color);

		let rgb;

		try {
			rgb = RGBAColor.fromCSS(color);
		} catch(err) {
			if ( throw_errors )
				throw err;

			return null;
		}

		if ( this._mode === 1 ) {
			// HSL Luma
			const luma = rgb.luminance();

			if ( this._dark ? luma < this._luma : luma > this._luma )
				rgb = rgb.toHSLA().targetLuminance(this._luma).toRGBA();

		} else if ( this._mode === 2 ) {
			// LUV
			const luv = rgb.toLUVA();
			if ( this._dark ? luv.l < this._luv : luv.l > this._luv )
				rgb = luv._l(this._luv).toRGBA();

		} else if ( this._mode === 3 ) {
			// HSL Loop (aka BTTV Style)
			if ( this._dark )
				while ( rgb.get_Y() < 0.5 ) {
					const hsl = rgb.toHSLA();
					rgb = hsl._l(Math.min(Math.max(0, 0.1 + 0.9 * hsl.l), 1)).toRGBA();
				}

			else
				while ( rgb.get_Y() >= 0.5 ) {
					const hsl = rgb.toHSLA();
					rgb = hsl._l(Math.min(Math.max(0, 0.9 * hsl.l), 1)).toRGBA();
				}

		} else if ( this._mode === 4 ) {
			// RGB Loop
			let i = 0;
			if ( this._dark )
				while ( rgb.luminance() < 0.15 && i++ < 127 )
					rgb = rgb.brighten();

			else
				while ( rgb.luminance() > 0.3 && i++ < 127 )
					rgb = rgb.brighten(-1);
		}

		const out = rgb.toCSS();
		this._cache.set(color, out);
		return out;
	}
}