'use strict';

// ============================================================================
// Player Constants
// Feature detection and option lists shared by the player module and its
// settings definitions.
// ============================================================================

export const HAS_COMPRESSOR = window.AudioContext && window.DynamicsCompressorNode != null;
export const HAS_GAIN = HAS_COMPRESSOR && window.GainNode != null;

export const SCROLL_I18N = 'setting.entry.player.volume-scroll.values';
export const SCROLL_OPTIONS = [
	{value: false, title: 'Disabled', i18n_key: `${SCROLL_I18N}.false`},
	{value: true, title: 'Enabled', i18n_key: `${SCROLL_I18N}.true`},
	{value: 2, title: 'Enabled with Right-Click', i18n_key: `${SCROLL_I18N}.2`},
	{value: 3, title: 'Enabled with Alt', i18n_key: `${SCROLL_I18N}.3`},
	{value: 4, title: 'Enabled with Alt + Right-Click', i18n_key: `${SCROLL_I18N}.4`},
	{value: 5, title: 'Enabled with Shift', i18n_key: `${SCROLL_I18N}.5`},
	{value: 6, title: 'Enabled with Shift + Right-Click', i18n_key: `${SCROLL_I18N}.6`},
	{value: 7, title: 'Enabled with Ctrl', i18n_key: `${SCROLL_I18N}.7`},
	{value: 8, title: 'Enabled with Ctrl + Right-Click', i18n_key: `${SCROLL_I18N}.8`}
];
