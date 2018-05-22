'use strict';

import {load as loadFontAwesome} from 'utilities/font-awesome';


// ============================================================================
// Text
// ============================================================================

export const text = {
	title: 'Text',
	title_i18n: 'setting.actions.appearance.text',

	colored: true,

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-text.vue'),

	component: () => import(/* webpackChunkName: 'main-menu' */ './components/preview-text.vue'),
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
	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-icon.vue'),

	load(data) {
		if ( data.icon && data.icon.startsWith('ffz-fa') )
			loadFontAwesome();

		return true;
	},

	component: () => import(/* webpackChunkName: 'main-menu' */ './components/preview-icon.vue'),

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

	editor: () => import(/* webpackChunkName: 'main-menu' */ './components/edit-image.vue'),

	component: () => import(/* webpackChunkName: 'main-menu' */ './components/preview-image.vue'),
	render(data, createElement) {
		return <figure class="mod-icon__image"><img src={data.image} /></figure>;
	}
}