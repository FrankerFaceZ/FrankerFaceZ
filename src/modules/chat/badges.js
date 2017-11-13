'use strict';

// ============================================================================
// Badge Handling
// ============================================================================

import Module from 'utilities/module';

export const CSS_BADGES = {
	staff: { 1: { color: '#200f33', use_svg: true } },
	admin: { 1: { color: '#faaf19', use_svg: true  } },
	global_mod: { 1: { color: '#0c6f20', use_svg: true } },
	broadcaster: { 1: { color: '#e71818', use_svg: true } },
	moderator: { 1: { color: '#34ae0a', use_svg: true } },
	twitchbot: { 1: { color: '#34ae0a' } },
	partner: { 1: { color: 'transparent', has_trans: true, trans_color: '#6441a5' } },

	turbo: { 1: { color: '#6441a5', use_svg: true } },
	premium: { 1: { color: '#009cdc' } },

	subscriber: { 0: { color: '#6441a4' }, 1: { color: '#6441a4' }},
}


export default class Badges extends Module {

}