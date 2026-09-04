import { describe, expect, it } from 'vitest';
import { hasLeadModPermissions } from './permissions';

describe('hasLeadModPermissions', () => {
	it('is false for missing or empty permission sets', () => {
		expect(hasLeadModPermissions(undefined)).toBe(false);
		expect(hasLeadModPermissions(null)).toBe(false);
		expect(hasLeadModPermissions(new Set())).toBe(false);
		expect(hasLeadModPermissions([])).toBe(false);
	});

	it('is false for a regular moderator, who has no role-management entries', () => {
		expect(hasLeadModPermissions(new Set(['moderation.chat:delete']))).toBe(false);
	});

	it('is true when any role-management permission is present', () => {
		expect(hasLeadModPermissions(new Set(['moderation.roles.mod:add', 'moderation.roles.vip:remove']))).toBe(true);
		expect(hasLeadModPermissions(['moderation.roles.vip:add'])).toBe(true);
	});

	it('ignores things that are not permission strings', () => {
		expect(hasLeadModPermissions('moderation.roles.mod:add')).toBe(false);
		expect(hasLeadModPermissions(new Set([42, null]))).toBe(false);
	});
});
