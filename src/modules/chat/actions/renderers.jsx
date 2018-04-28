'use strict';

import {load as loadFontAwesome} from 'utilities/font-awesome';


// ============================================================================
// Text
// ============================================================================

export const text = {
	title: 'Text',
	title_i18n: 'setting.actions.appearance.text',

	colored: true,
	preview: () => import(/* webpackChunkName: 'main-menu' */ './preview-text.vue'),
	editor: () => import(/* webpackChunkName: 'main-menu' */ './edit-text.vue'),

	render(data, createElement, color) {
		return <span style={{color}}>{data.text}</span>;
	}
}


// ============================================================================
// Icon
// ============================================================================

export const icon = {
	title: 'Icon',
	title_i18n: 'setting.actions.appearance.icon',

	colored: true,
	preview: () => import(/* webpackChunkName: 'main-menu' */ './preview-icon.vue'),
	editor: () => import(/* webpackChunkName: 'main-menu' */ './edit-icon.vue'),

	load(data) {
		if ( data.icon && data.icon.startsWith('ffz-fa') )
			loadFontAwesome();

		return true;
	},

	render(data, createElement, color) {
		return <figure style={{color}} class={`${data.icon||'ffz-i-zreknarf'}`} />;
	}
}


// ============================================================================
// Image
// ============================================================================

export const image = {
	title: 'Image',
	title_i18n: 'setting.actions.appearance.image',

	preview: () => import(/* webpackChunkName: 'main-menu' */ './preview-image.vue'),
	editor: () => import(/* webpackChunkName: 'main-menu' */ './edit-image.vue'),

	render(data, createElement) {
		return <figure class="mod-icon__image"><img src={data.image} /></figure>;
	}
}