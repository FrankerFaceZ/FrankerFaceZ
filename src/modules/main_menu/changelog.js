'use strict';

// Fetching and parsing of commits for the changelog and the recent-changes
// list. The main changelog reads the repository this client was built
// from, so a fork sees its own history; the add-ons changelog always reads
// the FrankerFaceZ add-ons repository.

import { GITHUB_REPOSITORY } from 'utilities/constants';

export const ADDONS_REPOSITORY = 'FrankerFaceZ/add-ons';

const TITLE_MATCH = /^(.+?)?\s*v?(\d+\.\d+\.\d+(?:-[a-z0-9-]+)?)$/i,
	SETTING_REGEX = /\]\(~([^)]+)\)/g,
	CHANGE_REGEX = /^\*\s*([^:]+?):\s*(.+)$/i,
	ISSUE_REGEX = /(^|\s)#(\d+)\b/g,
	TRAILER_REGEX = /^[A-Za-z][\w-]*:\s+\S/,
	MERGE_REGEX = /^Merge\b/i;


export function linkify(text, repo = GITHUB_REPOSITORY) {
	text = text.replace(SETTING_REGEX, (_, link) => `](~${link})`);

	return text.replace(ISSUE_REGEX, (_, space, number) =>
		`${space}[#${number}](https://github.com/${repo}/issues/${number})`
	);
}


// Drop git trailers (the final paragraph made only of "Token: value" lines,
// such as Co-Authored-By or Signed-off-by) and any trailing blank lines.
export function stripTrailers(lines) {
	const out = lines.slice();

	while ( out.length && ! out[out.length - 1].trim().length )
		out.pop();

	let start = out.length;
	while ( start > 0 && TRAILER_REGEX.test(out[start - 1].trim()) )
		start--;

	// Only a whole paragraph counts as a trailer block.
	if ( start < out.length && (start === 0 || ! out[start - 1].trim().length) ) {
		out.splice(start);
		while ( out.length && ! out[out.length - 1].trim().length )
			out.pop();
	}

	return out;
}


/**
 * Turn a commit from the GitHub API into a changelog entry.
 *
 * Release commits are titled with a version, e.g. `4.82.0`, and list their
 * changes as `* Section: change` lines. Any other commit uses its subject as
 * the title and its body as the description. A commit whose subject is a
 * change line, like `* Fixed: ...`, has no title and shows the change alone.
 *
 * Returns `null` for commits marked `skiplog`.
 */
export function parseCommit(commit, repo = GITHUB_REPOSITORY) {
	const input = commit?.commit?.message ?? '';
	if ( /\bskiplog\b/i.test(input) )
		return null;

	const parents = Array.isArray(commit.parents) ? commit.parents.map(x => x.sha) : [],
		lines = input.split(/\r?\n/),
		first = (lines.shift() ?? '').trim(),
		body = stripTrailers(lines),
		body_lines = body.filter(x => x.trim().length).length,
		match = TITLE_MATCH.exec(first);

	const versioned = !! (match && body_lines),
		merge = parents.length > 1,
		// A merge commit carrying nothing but its generated subject and, for
		// a pull request, the request's title duplicates the commits it
		// brought in, so it is hidden.
		auto_merge = merge && MERGE_REGEX.test(first) && body_lines <= 1;

	let title = null,
		version = null,
		content = body;

	if ( versioned ) {
		title = (match[1] ?? '').trim() || null;
		version = match[2];

	} else if ( CHANGE_REGEX.test(first) )
		content = [first, ...body];

	else
		title = first || null;

	const sections = {},
		description = [];

	let last_bit = null;

	for(const line of content) {
		const trimmed = line.trim();
		if ( ! trimmed.length ) {
			if ( ! last_bit && description.length )
				description.push(line);
			continue;
		}

		const m = CHANGE_REGEX.exec(trimmed);
		if ( ! m ) {
			if ( ! last_bit )
				description.push(line);
			else
				last_bit.push(trimmed);

		} else {
			const section = sections[m[1]] = sections[m[1]] || [];
			last_bit = [m[2]];
			section.push(last_bit);
		}
	}

	const segments = [];
	let summary = title;

	for(const [key, val] of Object.entries(sections)) {
		if ( ! val?.length )
			continue;

		if ( ! summary )
			summary = `${key}: ${val[0].join(' ')}`;

		segments.push({
			key,
			value: linkify(val.map(x => `* ${x.join(' ')}`).join('\n').trim(), repo)
		});
	}

	const message = linkify(description.join('\n').trim(), repo);
	if ( ! summary )
		summary = description.find(x => x.trim().length)?.trim() ?? null;

	const date_str = commit.commit?.author?.date ?? commit.commit?.committer?.date;

	return {
		sha: commit.sha,
		hash: commit.sha ? commit.sha.slice(0, 7) : null,
		link: commit.html_url,
		date: date_str ? new Date(date_str) : null,
		author: commit.author ?? null,
		parents,
		versioned,
		merge,
		auto_merge,
		title,
		summary,
		version,
		message,
		segments
	};
}


/**
 * Pick the commit to label as the running version. That is the commit the
 * client was built from or, when that commit is a hidden merge, the head of
 * the branch it merged, which is the last change the build carries.
 */
export function findActiveSha(entries, build_sha) {
	if ( ! build_sha )
		return null;

	const built = entries.find(x => x.sha === build_sha);
	if ( built && built.auto_merge )
		return built.parents[1] ?? built.parents[0] ?? null;

	return build_sha;
}


/**
 * Load a page of commits from GitHub. Resolves to the array of commits, or
 * `null` when the response is not a list of commits (such as a rate limit).
 * Throws on network failure.
 */
export async function fetchCommits(repo, options = {}) {
	const url = new URL(`https://api.github.com/repos/${repo}/commits`);
	if ( options.until )
		url.searchParams.append('until', options.until);
	if ( options.path )
		url.searchParams.append('path', options.path);
	if ( options.per_page )
		url.searchParams.append('per_page', options.per_page);

	const resp = await fetch(url),
		data = resp.ok ? await resp.json() : null;

	return Array.isArray(data) ? data : null;
}


const RECENT_TTL = 10 * 60 * 1000;
let recent_cache = null;

/**
 * The latest commits of this client's repository, shared between the home
 * page and the changelog and kept for ten minutes so opening the menu
 * repeatedly does not spend GitHub's unauthenticated request allowance.
 */
export function fetchRecentCommits(repo = GITHUB_REPOSITORY) {
	if ( recent_cache && recent_cache.repo === repo && Date.now() < recent_cache.expires )
		return recent_cache.promise;

	// Only a successful response is kept, so a failure or a rate limit is
	// tried again the next time.
	const promise = fetchCommits(repo).then(data => {
		if ( ! data && recent_cache?.promise === promise )
			recent_cache = null;
		return data;
	}, err => {
		if ( recent_cache?.promise === promise )
			recent_cache = null;
		throw err;
	});

	recent_cache = {
		repo,
		promise,
		expires: Date.now() + RECENT_TTL
	};

	return promise;
}
