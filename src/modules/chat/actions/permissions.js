'use strict';

// ============================================================================
// Chat Actions: Permissions
// ============================================================================

/**
 * Whether a set of chat command permissions marks the user as a lead
 * moderator. Twitch reports the same permission level for lead and regular
 * moderators; what sets lead moderators apart is the set of chat command
 * permissions, which holds the role-management entries
 * (moderation.roles.mod:add and friends) only for them.
 *
 * @param {Set<string>|Iterable<string>|null|undefined} perms The permissions.
 */
export function hasLeadModPermissions(perms) {
	if ( ! perms || typeof perms[Symbol.iterator] !== 'function' || typeof perms === 'string' )
		return false;

	for(const perm of perms)
		if ( typeof perm === 'string' && perm.startsWith('moderation.roles.') )
			return true;

	return false;
}
