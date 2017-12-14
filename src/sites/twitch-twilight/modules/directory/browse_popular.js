'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';

export default class BrowsePopular extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.apollo');

		this.apollo.registerModifier('BrowsePage_Popular', `query {
			streams {
				edges {
					node {
						createdAt
						broadcaster {
							profileImageURL(width: 70)
						}
					}
				}
			}
		}`);

		this.apollo.registerModifier('BrowsePage_Popular', res => this.modifyStreams(res), false);
	}

	modifyStreams(res) { // eslint-disable-line class-methods-use-this
		const newStreams = [];

		const edges = res.data.streams.edges;
		for (let i = 0; i < edges.length; i++) {
			const edge = edges[i];
			const node = edge.node;

			const s = node.viewersCount = new Number(node.viewersCount || 0);
			s.profileImageURL = node.broadcaster.profileImageURL;
			s.createdAt = node.createdAt;
			s.login = node.broadcaster.login;
			s.displayName = node.broadcaster.displayName;

			newStreams.push(edge);
		}
		res.data.streams.edges = newStreams;
		return res;
	}
}