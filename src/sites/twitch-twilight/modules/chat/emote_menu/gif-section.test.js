import { describe, expect, it } from 'vitest';
import { createGifSection } from './gif-section';

// The section is a React component built at runtime from Twitch's React.
// A minimal stand-in is enough to construct it and call its helpers.
const FakeReact = {
	Component: class {
		constructor(props) {
			this.props = props;
			this.state = {};
		}
		setState() {}
	},
	createElement: () => null
};

function section(props) {
	const Section = createGifSection({}, FakeReact);
	return new Section({apiKey: 'key', ...props});
}

describe('createGifSection buildURL', () => {
	it('asks for trending without a query and search with one', () => {
		const s = section({rating: 'g'});
		expect(s.buildURL('', 0)).toBe('https://api.giphy.com/v1/gifs/trending?api_key=key&rating=g&limit=50&offset=0');
		expect(s.buildURL('cats', 50)).toBe('https://api.giphy.com/v1/gifs/search?api_key=key&q=cats&rating=g&limit=50&offset=50');
	});

	it('encodes the query', () => {
		expect(section({}).buildURL('two words & more', 0)).toContain('q=two%20words%20%26%20more');
	});

	it('accepts g and pg from the channel and clamps anything else to g', () => {
		expect(section({rating: 'PG'}).buildURL('', 0)).toContain('rating=pg');
		expect(section({rating: 'pg-13'}).buildURL('', 0)).toContain('rating=g');
		expect(section({rating: 'R'}).buildURL('', 0)).toContain('rating=g');
		expect(section({}).buildURL('', 0)).toContain('rating=g');
	});
});
