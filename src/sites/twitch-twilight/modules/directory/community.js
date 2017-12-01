'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';

export default class Community extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.apollo');

		this.apollo.registerModifier('GamePage_Game', `query {
			directory {
				... on Community {
					streams {
						edges {
							node {
								createdAt
								type
								broadcaster {
									profileImageURL(width: 70)
								}
							}
						}
					}
				}
			}
		}`);
	}
}