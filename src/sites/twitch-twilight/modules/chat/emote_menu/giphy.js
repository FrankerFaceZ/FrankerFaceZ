'use strict';

// ============================================================================
// GIPHY Client
// Twitch's GIF picker searches GIPHY directly from the page, so we do the
// same. Results are normalised to the few fields the GIF tab needs.
// ============================================================================

const BASE = 'https://api.giphy.com/v1/gifs';

export const RATINGS = ['g', 'pg', 'pg-13'];

/**
 * Fetch trending GIFs, or search when a query is given.
 *
 * @param {string} api_key A GIPHY API key.
 * @param {object} options
 * @param {string} [options.query] Search text. Trending is used when empty.
 * @param {string} [options.rating] Maximum content rating: g, pg or pg-13.
 * @param {number} [options.offset] Paging offset.
 * @param {number} [options.limit] Page size.
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function fetchGifs(api_key, {query = '', rating = 'g', offset = 0, limit = 24} = {}) {
	query = (query || '').trim();

	const params = new URLSearchParams({
		api_key,
		rating: RATINGS.includes(rating) ? rating : 'g',
		offset: String(offset),
		limit: String(limit)
	});

	if ( query )
		params.set('q', query);

	const resp = await fetch(`${BASE}/${query ? 'search' : 'trending'}?${params}`);
	if ( ! resp.ok )
		throw new Error(`GIPHY request failed with status ${resp.status}`);

	const data = await resp.json(),
		items = [];

	for(const gif of data.data || []) {
		const preview = gif.images?.fixed_width || gif.images?.fixed_height,
			original = gif.images?.original;

		if ( ! gif.id || ! preview?.url || ! original?.url )
			continue;

		items.push({
			id: gif.id,
			title: gif.title || '',
			preview: preview.webp || preview.url,
			width: parseInt(preview.width, 10) || 200,
			height: parseInt(preview.height, 10) || 200,
			// Twitch sends the original image URL, query string included.
			url: original.url
		});
	}

	return {
		items,
		total: data.pagination?.total_count ?? Infinity
	};
}
