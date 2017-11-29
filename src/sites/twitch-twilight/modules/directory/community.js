'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';

export default class Community extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.router');
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

	onEnable() {
		this.parent.ChannelCard.ready((cls, instances) => {
			if (this.router.current.name === 'dir-community') {
				this.apollo.ensureQuery(
					'GamePage_Game',
					'data.directory.streams.edges.0.node.createdAt'
				);

				for(const inst of instances) this.updateChannelCard(inst);
			}
		});

		this.parent.ChannelCard.on('update', inst => this.updateChannelCard(inst), this);
		this.parent.ChannelCard.on('mount', inst => this.updateChannelCard(inst), this);
	}

	updateChannelCard(inst) {
		if (this.router.current.name !== 'dir-community') return;
		
		this.parent.updateUptime(inst, 'props.streamNode.viewersCount.createdAt', '.tw-card .tw-aspect > div');
		this.parent.addCardAvatar(inst, 'props.streamNode.viewersCount.createdAt', '.tw-card');
	}
}