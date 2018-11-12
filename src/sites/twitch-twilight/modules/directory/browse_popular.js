'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {get} from 'utilities/object';

import BROWSE_POPULAR from './browse_popular.gql';

export default class BrowsePopular extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.apollo');
		this.inject('site.fine');
		this.inject('settings');

		this.apollo.registerModifier('BrowsePage_Popular', BROWSE_POPULAR);
		this.apollo.registerModifier('BrowsePage_Popular', res => this.modifyStreams(res), false);
	}

	onEnable() {
		// Popular Directory Channel Cards
		this.apollo.ensureQuery(
			'BrowsePage_Popular',
			'data.streams.edges.0.node.createdAt'
		);
	}

	modifyStreams(res) { // eslint-disable-line class-methods-use-this
		const edges = get('data.streams.edges', res);
		if ( ! edges || ! edges.length )
			return res;

		res.data.streams.edges = this.parent.processNodes(edges);
		return res;
	}
}