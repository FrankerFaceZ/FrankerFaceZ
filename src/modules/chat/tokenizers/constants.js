'use strict';

// ============================================================================
// Shared Tokenizer Constants
// ============================================================================

import { MODIFIER_FLAGS } from '../emotes';

export const SHRINK_X = MODIFIER_FLAGS.ShrinkX,
	SLIDE_X = MODIFIER_FLAGS.Slide,
	STRETCH_X = MODIFIER_FLAGS.GrowX;
	//SHRINK_Y = MODIFIER_FLAGS.ShrinkY,
	//STRETCH_Y = MODIFIER_FLAGS.GrowY,


export const EMOTE_CLASS = 'chat-image chat-line__message--emote',
	//WHITESPACE = /^\s*$/,
	//LINK_REGEX = /([^\w@#%\-+=:~])?((?:(https?:\/\/)?(?:[\w@#%\-+=:~]+\.)+[a-z]{2,6}(?:\/[\w./@#%&()\-+=:?~]*)?))([^\w./@#%&()\-+=:?~]|\s|$)/g,
	NEW_LINK_REGEX = /(?:(https?:\/\/)?((?:[\w#%\-+=:~]+\.)+[a-z]{2,10}(?:\/[\w./#%&@()\-+=:?~]*[^\s.!,?])?))/g,
	//OLD_NEW_LINK_REGEX = /(?:(https?:\/\/)?((?:[\w#%\-+=:~]+\.)+[a-z]{2,10}(?:\/[\w./#%&@()\-+=:?~]*)?))/g,
	//MENTION_REGEX = /([^\w@#%\-+=:~])?(@([^\u0000-\u007F]+|\w+)+)([^\w./@#%&()\-+=:?~]|\s|$)/g; // eslint-disable-line no-control-regex
	MENTION_REGEX = /^(['"*([{<\\/]*)(@)((?:[^\u0000-\u007F]|[\w-])+)(?:\b|$)/; // eslint-disable-line no-control-regex
