import { describe, expect, it } from 'vitest';
import { findActiveSha, linkify, parseCommit, stripTrailers } from './changelog';

function commit(message, extra = {}) {
	return {
		sha: extra.sha ?? 'abcdef1234567890',
		html_url: 'https://github.com/Example/FrankerFaceZ/commit/abcdef1',
		parents: (extra.parents ?? ['0000000']).map(sha => ({sha})),
		author: extra.author ?? null,
		commit: {
			message,
			author: {date: '2026-09-01T12:00:00Z'}
		}
	};
}

describe('stripTrailers', () => {
	it('removes a trailing block of git trailers', () => {
		expect(stripTrailers([
			'',
			'Body text.',
			'',
			'Co-Authored-By: Someone <someone@example.com>',
			'Claude-Session: https://example.com/session'
		])).toEqual(['', 'Body text.']);
	});

	it('keeps "Key: value" lines that are part of the body', () => {
		expect(stripTrailers([
			'',
			'Note: this matters.',
			'More text.'
		])).toEqual(['', 'Note: this matters.', 'More text.']);
	});
});

describe('linkify', () => {
	it('links issue references to the given repository', () => {
		expect(linkify('Fixes #12', 'Example/FrankerFaceZ'))
			.toBe('Fixes [#12](https://github.com/Example/FrankerFaceZ/issues/12)');
	});

	it('defaults to the built repository', () => {
		expect(linkify('#3')).toContain('https://github.com/Example/FrankerFaceZ/issues/3');
	});
});

describe('parseCommit', () => {
	it('reads a release commit', () => {
		const entry = parseCommit(commit('4.82.0\n\n* Added: GIFs in chat.\n* Fixed: A thing. #5\n* Added: Another.'), 'Example/FrankerFaceZ');

		expect(entry.versioned).toBe(true);
		expect(entry.version).toBe('4.82.0');
		expect(entry.title).toBe(null);
		expect(entry.summary).toBe('Added: GIFs in chat.');
		expect(entry.message).toBe('');
		expect(entry.segments).toEqual([
			{key: 'Added', value: '* GIFs in chat.\n* Another.'},
			{key: 'Fixed', value: '* A thing. [#5](https://github.com/Example/FrankerFaceZ/issues/5)'}
		]);
	});

	it('reads a titled release commit', () => {
		const entry = parseCommit(commit('Emote Menu v1.2.3\n\n* Changed: Layout.'));
		expect(entry.title).toBe('Emote Menu');
		expect(entry.version).toBe('1.2.3');
	});

	it('uses the subject and body of an ordinary commit', () => {
		const entry = parseCommit(commit(
			'Quieten the console on every load\n\n- PubSub: no longer logs.\n- Locale: falls back.\n\nCo-Authored-By: Someone <s@example.com>'
		));

		expect(entry.versioned).toBe(false);
		expect(entry.title).toBe('Quieten the console on every load');
		expect(entry.summary).toBe(entry.title);
		expect(entry.message).toBe('- PubSub: no longer logs.\n- Locale: falls back.');
		expect(entry.segments).toEqual([]);
	});

	it('treats a change-line subject as a change', () => {
		const entry = parseCommit(commit('* Fixed: The ability to report GIFs'));

		expect(entry.title).toBe(null);
		expect(entry.summary).toBe('Fixed: The ability to report GIFs');
		expect(entry.segments).toEqual([{key: 'Fixed', value: '* The ability to report GIFs'}]);
	});

	it('hides generated merge commits but keeps described ones', () => {
		const pr = parseCommit(commit(
			'Merge pull request #17 from Example/feature\n\nAdd the feature',
			{parents: ['aaa', 'bbb']}
		));
		expect(pr.merge).toBe(true);
		expect(pr.auto_merge).toBe(true);

		const upstream = parseCommit(commit(
			'Merge upstream/master: GIF support\n\nBrings in three upstream commits.\n\nThey add GIF rendering.',
			{parents: ['aaa', 'bbb']}
		));
		expect(upstream.merge).toBe(true);
		expect(upstream.auto_merge).toBe(false);
		expect(upstream.title).toBe('Merge upstream/master: GIF support');

		const plain = parseCommit(commit('Merge branch \'x\' into y'));
		expect(plain.auto_merge).toBe(false);
	});

	it('skips commits marked skiplog', () => {
		expect(parseCommit(commit('Tidy up (skiplog)'))).toBe(null);
	});

	it('carries the hash, link, date and parents', () => {
		const entry = parseCommit(commit('Subject', {parents: ['p1', 'p2']}));
		expect(entry.hash).toBe('abcdef1');
		expect(entry.link).toBe('https://github.com/Example/FrankerFaceZ/commit/abcdef1');
		expect(entry.date).toEqual(new Date('2026-09-01T12:00:00Z'));
		expect(entry.parents).toEqual(['p1', 'p2']);
	});
});

describe('findActiveSha', () => {
	const entries = [
		{sha: 'merge', auto_merge: true, parents: ['old', 'head']},
		{sha: 'head', auto_merge: false, parents: ['old']},
		{sha: 'old', auto_merge: false, parents: []}
	];

	it('returns the build commit when it is shown', () => {
		expect(findActiveSha(entries, 'head')).toBe('head');
	});

	it('follows a hidden merge to the branch it merged', () => {
		expect(findActiveSha(entries, 'merge')).toBe('head');
	});

	it('returns null without a build commit', () => {
		expect(findActiveSha(entries, null)).toBe(null);
	});

	it('returns the build commit even when it is not loaded', () => {
		expect(findActiveSha(entries, 'unknown')).toBe('unknown');
	});
});
