'use strict';

// ============================================================================
// Directory
// ============================================================================

import {SiteModule} from 'utilities/module';
import {duration_to_string} from 'utilities/time';
import {createElement as e} from 'utilities/dom';
import {get} from 'utilities/object';

import Following from './following';
import Game from './game';
import Community from './community';

export default class Directory extends SiteModule {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.apollo');
		this.inject('site.css_tweaks');

		this.inject('settings');

		this.inject(Following);
		this.inject(Game);
		this.inject(Community);

		this.apollo.registerModifier('GamePage_Game', res => this.modifyStreams(res), false);

		this.ChannelCard = this.fine.define(
			'channel-card',
			n => n.props && n.props.streamNode
		);

		this.on('settings:changed:directory.following.show-channel-avatar', value => {
			this.css_tweaks.toggleHide('profile-hover-game', value === 2);
			this.ChannelCard.forceUpdate();
		});

		this.on('settings:changed:directory.following.uptime', () => this.ChannelCard.forceUpdate());
	}


	onEnable() {
		this.css_tweaks.toggleHide('profile-hover-game', this.settings.get('directory.following.show-channel-avatar') === 2);
		
		this.ChannelCard.ready((cls, instances) => {
			this.apollo.ensureQuery(
				'GamePage_Game',
				'data.directory.streams.edges.0.node.createdAt'
			);
			
			for(const inst of instances) this.updateChannelCard(inst);
		});
		
		this.ChannelCard.on('update', inst => this.updateChannelCard(inst), this);
		this.ChannelCard.on('mount', inst => this.updateChannelCard(inst), this);
		this.ChannelCard.on('unmount', inst => this.clearUptime(inst), this);
	}


	updateChannelCard(inst) {
		const fnData = {
			uptimeSel: inst.props.directoryType === 'GAMES' ? '.tw-thumbnail-card .tw-card-img' : '.tw-card .tw-aspect > div',
			avatarSel: inst.props.directoryType === 'GAMES' ? '.tw-thumbnail-card' : '.tw-card',
		};

		this.updateUptime(inst, 'props.streamNode.viewersCount.createdAt', fnData.uptimeSel);
		this.addCardAvatar(inst, fnData.avatarSel);
	}


	modifyStreams(res) { // eslint-disable-line class-methods-use-this
		const nodeType = res.data.directory.__typename;
		const newStreams = [];

		const hiddenThumbnails = this.settings.provider.get('directory.game.hidden-thumbnails') || [];

		const edges = res.data.directory.streams.edges;
		for (let i = 0; i < edges.length; i++) {
			const edge = edges[i];
			const node = edge.node;

			const s = node.viewersCount = new Number(node.viewersCount || 0);
			s.profileImageURL = node.broadcaster.profileImageURL;
			s.createdAt = node.createdAt;

			if (nodeType === 'Game' && hiddenThumbnails.includes(res.data.directory.displayName) ||
			nodeType === 'Community' && hiddenThumbnails.includes(node.game.name))
				edge.node.previewImageURL = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.jpg';

			newStreams.push(edge);
		}
		res.data.directory.streams.edges = newStreams;
		return res;
	}


	clearUptime(inst) { // eslint-disable-line class-methods-use-this
		if ( inst.ffz_update_timer ) {
			clearInterval(inst.ffz_update_timer);
			inst.ffz_update_timer = null;
		}

		if ( inst.ffz_uptime_el ) {
			inst.ffz_uptime_el.parentElement.removeChild(inst.ffz_uptime_el);
			inst.ffz_uptime_el = null;
			inst.ffz_uptime_span = null;
			inst.ffz_uptime_tt = null;
		}
	}


	updateUptime(inst, created_path, selector) {
		const container = this.fine.getHostNode(inst),
			card = container && container.querySelector && container.querySelector(selector),
			setting = this.settings.get('directory.following.uptime'),
			created_at = get(created_path, inst),
			up_since = created_at && new Date(created_at),
			uptime = up_since && Math.floor((Date.now() - up_since) / 1000) || 0;

		if ( ! card || setting === 0 || uptime < 1 )
			return this.clearUptime(inst);

		const up_text = duration_to_string(uptime, false, false, false, setting === 1);

		if ( ! inst.ffz_uptime_el )
			card.appendChild(inst.ffz_uptime_el = e('div',
				'video-preview-card__preview-overlay-stat c-background-overlay c-text-overlay font-size-6 top-0 right-0 z-default inline-flex absolute mg-05',
				e('div', 'tw-tooltip-wrapper inline-flex', [
					e('div', 'tw-stat', [
						e('span', 'c-text-live tw-stat__icon', e('figure', 'ffz-i-clock')),
						inst.ffz_uptime_span = e('span', 'tw-stat__value')
					]),
					inst.ffz_uptime_tt = e('div', 'tw-tooltip tw-tooltip--down tw-tooltip--align-center')
				])));

		if ( ! inst.ffz_update_timer )
			inst.ffz_update_timer = setInterval(this.updateUptime.bind(this, inst, created_path, selector), 1000);

		inst.ffz_uptime_span.textContent = up_text;
		inst.ffz_uptime_tt.textContent = up_since.toLocaleString();

	}


	addCardAvatar(inst, selector) {
		const container = this.fine.getHostNode(inst),
			card = container && container.querySelector && container.querySelector(selector),
			setting = this.settings.get('directory.following.show-channel-avatar');

		// Remove old elements
		const hiddenBodyCard = card.querySelector('.tw-card-body.hide');
		if (hiddenBodyCard !== null) hiddenBodyCard.classList.remove('hide');

		const ffzChannelData = card.querySelector('.ffz-channel-data');
		if (ffzChannelData !== null) ffzChannelData.remove();

		const channelAvatar = card.querySelector('.channel-avatar');
		if (channelAvatar !== null) channelAvatar.remove();
		
		if ( ! card || setting === 0 )
			return;

		if (inst.props.streamNode.viewersCount.profileImageURL) {
			if (setting === 1) {
				const cardDiv = card.querySelector('.tw-card-body');
				const modifiedDiv = e('div', {
					innerHTML: cardDiv.innerHTML
				});

				const avatarDiv = e('a', {
					className: 'channel-avatar',
					href: `/${inst.props.streamNode.broadcaster.login}`,
					style: 'margin-right: 8px; min-width: 4rem; margin-top: 0.5rem;',
					onclick: event => this.hijackUserClick(event, inst.props.streamNode.broadcaster.login)
				}, e('img', {
					title: inst.props.streamNode.broadcaster.displayName,
					src: inst.props.streamNode.viewersCount.profileImageURL,
					style: 'height: 4rem;'
				}));

				const cardDivParent = cardDiv.parentElement;

				if (cardDivParent.querySelector('.ffz-channel-data') === null) {
					cardDiv.classList.add('hide');

					const newCardDiv = e('div', 'ffz-channel-data flex flex-nowrap', [
						avatarDiv, modifiedDiv
					]);
					cardDivParent.appendChild(newCardDiv);
				}
			} else if (setting === 2 || setting === 3) {
				const avatarElement = e('a', {
					className: 'channel-avatar',
					href: `/${inst.props.streamNode.broadcaster.login}`,
					onclick: event => this.hijackUserClick(event, inst.props.streamNode.broadcaster.login)
				}, e('div', 'live-channel-card__boxart bottom-0 absolute',
					e('figure', 'tw-aspect tw-aspect--align-top',
						e('img', {
							title: inst.props.streamNode.broadcaster.displayName,
							src: inst.props.streamNode.viewersCount.profileImageURL
						})
					)
				)
				);

				const divToAppend = card.querySelector('figure.tw-aspect');
				if (divToAppend.querySelector('.channel-avatar') === null) divToAppend.appendChild(avatarElement);
			}
		}
	}


	hijackUserClick(event, user, optionalFn = null) {
		event.preventDefault();
		event.stopPropagation();

		if (optionalFn) optionalFn();

		this.router.navigate('user', { userName: user });
	}
}