'use strict';

// ============================================================================
// Twitch Icons
//
// A small set of Twitch's own moderation icons, usable anywhere an icon font
// class is accepted by adding the class `ffz-i-tw-${name}`. The glyphs are
// drawn by styles/twitch-icons.scss as CSS masks, so they take the text
// colour like the font icons do. Keep the two files in sync.
// ============================================================================

/**
 * Each entry is `[name, aliases]`: the name used in the `ffz-i-tw-${name}`
 * class, and space separated search terms for the icon picker.
 */
export const TWITCH_ICONS: [string, string][] = [
	['ban', 'ban block twitch'],
	['timeout', 'timeout clock twitch'],
	['warn', 'warn warning attention twitch'],
	['trash', 'trash delete remove twitch']
];
