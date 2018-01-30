'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {get} from 'utilities/object';

export default class BrowsePopular extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.apollo');
		this.inject('site.fine');
		this.inject('settings');

		this.apollo.registerModifier('BrowsePage_Popular', this.apollo.gql`query {
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

		this.ChannelCard = this.fine.define(
			'browse-all-channel-card',
			n => n.props && n.props.channelName && n.props.linkTo && n.props.linkTo.state && n.props.linkTo.state.medium === 'twitch_browse_directory'
		);

		this.apollo.registerModifier('BrowsePage_Popular', res => this.modifyStreams(res), false);
	}

	onEnable() {
		this.ChannelCard.ready((cls, instances) => {
			// Popular Directory Channel Cards
			this.apollo.ensureQuery(
				'BrowsePage_Popular',
				'data.streams.edges.node.0.createdAt'
			);

			for(const inst of instances) this.updateChannelCard(inst);
		});

		this.ChannelCard.on('update', this.updateChannelCard, this);
		this.ChannelCard.on('mount', this.updateChannelCard, this);
		this.ChannelCard.on('unmount', this.parent.clearUptime, this);
	}

	modifyStreams(res) { // eslint-disable-line class-methods-use-this
		const blockedGames = this.settings.provider.get('directory.game.blocked-games') || [];

		const newStreams = [];

		const edges = get('data.streams.edges', res);
		if (!edges) return res;

		for (let i = 0; i < edges.length; i++) {
			const edge = edges[i];
			const node = edge.node;

			const s = node.viewersCount = new Number(node.viewersCount || 0);
			s.profileImageURL = node.broadcaster.profileImageURL;
			s.createdAt = node.createdAt;
			s.login = node.broadcaster.login;
			s.displayName = node.broadcaster.displayName;

			if (!node.game || node.game && !blockedGames.includes(node.game.name)) newStreams.push(edge);
		}
		res.data.streams.edges = newStreams;
		return res;
	}

	updateChannelCard(inst) {
		const container = this.fine.getHostNode(inst);
		if (!container) return;

		if (container.classList.contains('ffz-modified-channel-card')) return;
		container.classList.add('ffz-modified-channel-card');

		this.parent.updateUptime(inst, 'props.viewerCount.createdAt', '.tw-card-img');
		this.parent.addCardAvatar(inst, 'props.viewerCount', '.tw-card');

		const hiddenThumbnails = this.settings.provider.get('directory.game.hidden-thumbnails') || [];
		const hiddenPreview = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.jpg';

		if (inst.props.type === 'watch_party')
			container.classList.toggle('tw-hide', this.settings.get('directory.hide-vodcasts'));

		const img = container.querySelector && container.querySelector('.tw-card-img img');
		if (img == null) return;

		if (hiddenThumbnails.includes(inst.props.gameTitle)) {
			img.src = hiddenPreview;
		} else {
			img.src = inst.props.imageSrc;
		}
	}
}