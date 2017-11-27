'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement as e} from 'utilities/dom';

export default class Community extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.apollo');
		this.inject('site.css_tweaks');

		this.inject('settings');

		this.GameHeader = this.fine.define(
			'game-header',
			n => n.renderFollowButton && n.renderGameDetailsTab
		);

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

		this.ChannelCard = this.fine.define(
			'community-channel-card',
			n => n.props && n.props.streamNode
		);

		this.apollo.registerModifier('GamePage_Game', res => this.router.current.name === 'dir-community' && this.modifyStreams(res), false);

		this.on('settings:changed:show-channel-avatar', value => {
			this.css_tweaks.toggleHide('profile-hover-game', value === 2);
			this.router.current.name === 'dir-community' && this.ChannelCard.forceUpdate();
		});

		this.on('settings:changed:directory.following.uptime', () => this.router.current.name === 'dir-community' && this.ChannelCard.forceUpdate());
	}

	modifyStreams(res) { // eslint-disable-line class-methods-use-this
		const newStreams = [];

		const edges = res.data.directory.streams.edges;
		for (let i = 0; i < edges.length; i++) {
			const edge = edges[i];
			const node = edge.node;
			
			const s = node.viewersCount = new Number(node.viewersCount || 0);
			s.profileImageURL = node.broadcaster.profileImageURL;
			s.createdAt = node.createdAt;

			newStreams.push(edge);
		}
		res.data.directory.streams.edges = newStreams;
		return res;
	}

	onEnable() {
		this.GameHeader.ready((cls, instances) => {
			if (this.router.current.name === 'dir-community') {
				for(const inst of instances) this.updateButtons(inst);
			}
		});

		this.ChannelCard.ready((cls, instances) => {
			if (this.router.current.name === 'dir-community') {
				this.apollo.ensureQuery(
					'GamePage_Game',
					'data.directory.streams.edges.0.node.createdAt'
				);

				for(const inst of instances) this.updateChannelCard(inst);
			}
		});

		this.ChannelCard.on('update', inst => this.router.current.name === 'dir-community' && this.updateChannelCard(inst), this);

		this.ChannelCard.on('mount', inst => this.router.current.name === 'dir-community' && this.updateChannelCard(inst), this);

		this.ChannelCard.on('unmount', inst => this.router.current.name === 'dir-community' && this.updateUptime(inst), this);

		this.css_tweaks.toggleHide('profile-hover-game', this.settings.get('directory.following.show-channel-avatar') === 2);
	}

	updateUptime(inst) {
		const container = this.fine.getHostNode(inst);
		const card = container && container.querySelector && container.querySelector('.tw-card');

		if (this.settings.get('directory.following.uptime') === 0) {
			if (inst.update_timer !== undefined) {
				clearInterval(inst.update_timer);
				inst.update_timer = undefined;
			}

			if (inst.uptime_element !== undefined) {
				inst.uptime_element.remove();
				inst.uptime_element_span = inst.uptime_element = undefined;
			}
		} else {
			if (inst.update_timer === undefined) {
				inst.update_timer = setInterval(
					this.updateUptime.bind(this, inst),
					1000
				);
			}

			const up_since = new Date(inst.props.streamNode.viewersCount.createdAt);
			const uptime = up_since && Math.floor((Date.now() - up_since) / 1000) || 0;
			const uptimeText = this.timeToString(uptime, false, false, false, this.settings.get('directory.following.uptime') === 1);
	
			if (uptime > 0) {
				if (inst.uptime_element === undefined) {
					inst.uptime_element_span = e('span', 'tw-stat__value ffz-uptime', `${uptimeText}`);
					inst.uptime_element = e('div', {
						className: 'c-background-overlay c-text-overlay font-size-6 top-0 right-0 z-default inline-flex absolute mg-05',
						style: 'padding-left: 4px; padding-right: 4px;'
					}, [
						e('span', 'tw-stat__icon',
							e('figure', 'ffz-i-clock')
						),
						inst.uptime_element_span
					]);
	
					if (card.querySelector('.ffz-uptime') === null) card.appendChild(inst.uptime_element);
				} else {
					inst.uptime_element_span.textContent = `${uptimeText}`;
				}
			}
		}
	}

	updateChannelCard(inst) {
		this.updateUptime(inst);

		const container = this.fine.getHostNode(inst);
		const card = container && container.querySelector && container.querySelector('.tw-card');

		if (!inst.props.streamNode.viewersCount.createdAt) return;
		
		// Remove old elements
		const hiddenBodyCard = card.querySelector('.tw-card-body.hide');
		if (hiddenBodyCard !== null) hiddenBodyCard.classList.remove('hide');
		
		const ffzChannelData = card.querySelector('.ffz-channel-data');
		if (ffzChannelData !== null) ffzChannelData.remove();

		const channelAvatar = card.querySelector('.channel-avatar');
		if (channelAvatar !== null) channelAvatar.remove();

		if (inst.props.streamNode.viewersCount.profileImageURL) {
			const avatarSetting = this.settings.get('directory.following.show-channel-avatar');
			if (avatarSetting === 1) {
				const cardDiv = card.querySelector('.tw-card-body');
				const modifiedDiv = e('div', {
					innerHTML: cardDiv.innerHTML
				});

				const avatarDiv = e('a', {
					className: 'channel-avatar',
					href: `/${inst.props.streamNode.broadcaster.login}`,
					style: 'margin-right: 8px; min-width: 4rem;',
					onclick: event => {
						event.preventDefault();
						event.stopPropagation();
		
						this.router.navigate('user', { userName: inst.props.streamNode.broadcaster.login});
					}
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
			} else if (avatarSetting === 2 || avatarSetting === 3) {
				const avatarElement = e('a', {
					className: 'channel-avatar',
					href: `/${inst.props.streamNode.broadcaster.login}`,
					onclick: event => {
						event.preventDefault();
						event.stopPropagation();
		
						this.router.navigate('user', { userName: inst.props.streamNode.broadcaster.login});
					}
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

	timeToString(elapsed, separate_days, days_only, no_hours, no_seconds) { // eslint-disable-line class-methods-use-this
		const seconds = elapsed % 60;
		let minutes = Math.floor(elapsed / 60);
		let hours = Math.floor(minutes / 60);
		let days = null;

		minutes = minutes % 60;

		if ( separate_days ) {
			days = Math.floor(hours / 24);
			hours = hours % 24;
			if ( days_only && days > 0 )
				return `${days} days`;

			days = ( days > 0 ) ? `${days} days, ` : '';
		}

		return (days||'') + ((!no_hours || days || hours) ? (`${(days && hours < 10 ? '0' : '') + hours}:`) : '') + (minutes < 10 ? '0' : '') + minutes + (no_seconds ? '' : (`:${(seconds < 10 ? '0' : '') + seconds}`));
	}

	updateButtons(inst) {
		const container = this.fine.getHostNode(inst);
		// We can't get the buttons through querySelector('button ...') so this has to do for now...
		const buttons = container && container.querySelector && container.querySelector('div > div.align-items-center');
		
		const ffzButtons = buttons.querySelector('.ffz-buttons');
		if (ffzButtons !== null) ffzButtons.remove();
		
		if (buttons.querySelector('.ffz-buttons') === null) {
			// Block / Unblock Games
			const blockedGames = this.settings.provider.get('directory.game.blocked-games') || [];
			const gameBlocked = blockedGames.includes(inst.props.directoryName);

			const blockButton = e('button', {
				className: 'mg-l-1 tw-button ffz-toggle-game-block',
				style: `background-color: ${gameBlocked ? '#228B22' : '#B22222'};`
			}, e('span', {
				className: 'tw-button__text',
				textContent: `${gameBlocked ? 'Unblock' : 'Block'}`
			})
			);

			blockButton.addEventListener('click', () => {
				const gameName = inst.props.directoryName;
				const blockedGames = this.settings.provider.get('directory.game.blocked-games') || [];
				if (blockedGames.includes(gameName)) blockedGames.splice(blockedGames.indexOf(gameName), 1);
				else blockedGames.push(gameName);

				this.settings.provider.set('directory.game.blocked-games', blockedGames);

				this.updateButtons(inst);
			});

			// Hide / Unhide Thumbnails
			const hiddenThumbnails = this.settings.provider.get('directory.game.hidden-thumbnails') || [];
			const thumbnailBlocked = hiddenThumbnails.includes(inst.props.directoryName);

			const hideThumbnailButton = e('button', {
				className: 'mg-l-1 tw-button ffz-toggle-thumbnail',
				style: `background-color: ${thumbnailBlocked ? '#228B22' : '#B22222'};`
			}, e('span', {
				className: 'tw-button__text',
				textContent: `${thumbnailBlocked ? 'Unhide Thumbnails' : 'Hide Thumbnails'}`
			})
			);

			hideThumbnailButton.addEventListener('click', () => {
				const gameName = inst.props.directoryName;
				const hiddenThumbnails = this.settings.provider.get('directory.game.hidden-thumbnails') || [];
				if (hiddenThumbnails.includes(gameName)) hiddenThumbnails.splice(hiddenThumbnails.indexOf(gameName), 1);
				else hiddenThumbnails.push(gameName);

				this.settings.provider.set('directory.game.hidden-thumbnails', hiddenThumbnails);

				this.updateButtons(inst);
			});

			const ffzButtons = e('div', 'ffz-buttons', [
				blockButton,
				hideThumbnailButton
			]);

			buttons.appendChild(ffzButtons);
		}
	}
}