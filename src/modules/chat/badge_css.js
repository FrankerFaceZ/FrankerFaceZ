'use strict';

// ============================================================================
// Badge CSS
// Generates the CSS for rendering badges in each supported style.
// ============================================================================

import {SERVER, IS_WEBKIT, WEBKIT_CSS as WEBKIT} from 'utilities/constants';
import {has} from 'utilities/object';


export const CSS_MASK_IMAGE = IS_WEBKIT ? 'webkitMaskImage' : 'maskImage';

const NO_REPEAT = 'background-repeat:no-repeat;background-position:center;',
	BASE_IMAGE = `${SERVER}/static/badges/twitch/`,

	CSS_TEMPLATES = {
		0: data => `${data.fore ? `color:${data.fore};` : ''}background:${data.image||''} ${data.color};background-size:${data.scale*1.8}rem;${data.svg ? '' : `background-image:${data.image_set};`}${NO_REPEAT}`,
		1: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.2}rem;`,
		2: data => `${CSS_TEMPLATES[0](data)}border-radius:${data.scale*.9}rem;background-size:${data.scale*1.6}rem;`,
		3: data => `${data.fore ? `color:${data.fore};` : ''}background:${data.color};border-radius:${data.scale*.9}rem;`,
		4: data => `${CSS_TEMPLATES[3](data)}height:${data.scale}rem;min-width:${data.scale}rem;`,
		5: data => `background:${data.image};background-size:${data.scale*1.8}rem;${data.svg ? `` : `background-image:${data.image_set};`}${NO_REPEAT}`,
		6: data => `background:linear-gradient(${data.color},${data.color});${WEBKIT}mask-image:${data.image};${WEBKIT}mask-size:${data.scale*1.8}rem ${data.scale*1.8}rem;${data.svg ? `` : `${WEBKIT}mask-image:${data.image_set};`}`
	};


export function generateOverrideCSS(data, style) {
	const urls = data.urls || {1: data.image},
		image = `url("${urls[1]}")`,
		image_set = `${WEBKIT}image-set(${image} 1x${urls[2] ? `, url("${urls[2]}") 2x` : ''}${urls[4] ? `, url("${urls[4]}") 4x` : ''})`;

	if ( style === 3 || style === 4 )
		return '';

	if ( style === 6 )
		return `${WEBKIT}mask-image:${image} !important;${WEBKIT}mask-image:${image_set} !important;`;
	else
		return `background-image:${image} !important;background-image:${image_set} !important;`;
}


export function generateBadgeCSS(badge, version, data, style, is_dark, badge_version = 2, color_fixer, fg_fixer, scale = 1, clickable = false) {
	let color = data.color || 'transparent',
		fore = data.fore || is_dark ? '#fff' : '#000',
		base_image = data.image || (data.addon ? null : `${BASE_IMAGE}${badge_version}/${badge}${data.svg ? '.svg' : `/${version}/`}`),
		trans = false,
		invert = false,
		svg, image, image_set;

	if ( base_image && style > 4 ) {
		const td = data.trans || {};
		color = td.color || color;

		if ( td.image ) {
			trans = true;
			if ( td.image !== true )
				base_image = td.image;
		}

		if ( has(td, 'invert') )
			invert = td.invert && ! is_dark;
		else
			invert = style === 5 && ! is_dark;
	}

	if ( style === 3 || style === 4 ) {
		if ( color === 'transparent' && data.trans )
			color = data.trans.color || color;
	}

	if ( color === 'transparent' )
		style = 0;

	if ( base_image && style !== 3 && style !== 4 ) {
		svg = base_image.endsWith('.svg');
		if ( data.urls )
			image = `url("${data.urls[scale]}")`;
		else
			image = `url("${svg ? base_image : `${base_image}${scale}${trans ? '_trans' : ''}.png`}")`;

		if ( data.urls && scale === 1 ) {
			image_set = `${WEBKIT}image-set(${image} 1x${data.urls[2] ? `, url("${data.urls[2]}") 2x` : ''}${data.urls[4] ? `, url("${data.urls[4]}") 4x` : ''})`

		} else if ( data.urls && scale === 2 ) {
			image_set = `${WEBKIT}image-set(${image} 1x${data.urls[4] ? `, url("${data.urls[4]}") 2x` : ''})`;

		} else if ( ! svg && scale < 4 ) {
			if ( scale === 1 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}2${trans ? '_trans' : ''}.png") 2x, url("${base_image}4${trans ? '_trans' : ''}.png") 4x)`;

			else if ( scale === 2 )
				image_set = `${WEBKIT}image-set(${image} 1x, url("${base_image}4${trans ? '_trans' : ''}.png") 2x)`;

		} else
			image_set = image;
	}

	if ( color_fixer && color && color !== 'transparent' )
		color = color_fixer.process(color) || color;

	if ( fg_fixer && fore && fore !== 'transparent' && color !== 'transparent' ) {
		fg_fixer.base = color;
		fore = fg_fixer.process(fore) || fore;
	}

	if ( ! base_image ) {
		if ( style > 4 )
			style = 1;
		else if ( style > 3 )
			style = 2;
	}

	return `${clickable && (data.click_handler || data.click_url || data.click_action) ? 'cursor:pointer;' : ''}${invert ? 'filter:invert(100%);' : ''}${CSS_TEMPLATES[style]({
		scale: 1,
		color,
		fore,
		image,
		image_set,
		svg
	})}${data.css || ''}`;
}
