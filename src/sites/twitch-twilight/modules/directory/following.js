'use strict';

// ============================================================================
// Following Page
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement as e} from 'utilities/dom';
import {get} from 'utilities/object';

import Popper from 'popper.js';

export default class Following extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.fine');
		this.inject('site.router');
		this.inject('site.apollo');
		this.inject('site.css_tweaks');

		this.inject('settings');

		this.settings.add('directory.following.group-hosts', {
			default: true,

			ui: {
				path: 'Directory > Following >> Placeholder',
				title: 'Group Hosts',
				description: 'Only show a given hosted channel once in the directory.',
				component: 'setting-check-box'
			},

			changed: () => this.isRouteAcceptable() && this.apollo.getQuery('FollowedIndex_CurrentUser').refetch()
		});

		this.settings.add('directory.following.uptime', {
			default: 1,

			ui: {
				path: 'Directory > Following >> Placeholder',
				title: 'Stream Uptime',
				description: 'Display the stream uptime on the channel cards.',

				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Enabled'},
					{value: 2, title: 'Enabled (with Seconds)'}
				]
			},

			changed: () => this.isRouteAcceptable() && this.ChannelCard.forceUpdate()
		});

		this.settings.add('directory.following.host-menus', {
			default: 1,

			ui: {
				path: 'Directory > Following >> Placeholder',
				title: 'Hosted Channel Menus',
				description: 'Display a menu to select which channel to visit when clicking a hosted channel in the directory.',

				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'When Multiple are Hosting'},
					{value: 2, title: 'Always'}
				]
			},

			changed: () => this.isRouteAcceptable() && this.ChannelCard.forceUpdate()
		});

		this.settings.add('directory.following.hide-boxart', {
			default: 0,

			ui: {
				path: 'Directory > Following >> Placeholder',
				title: 'Hide Boxart',
				description: 'Do not display boxart over a stream / video thumbnail.',

				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Never'},
					{value: 1, title: 'On Hover'},
					{value: 2, title: 'Always'}
				]
			},

			changed: value => {
				this.css_tweaks.toggleHide('boxart-hide', value === 2);
				this.css_tweaks.toggleHide('boxart-hover', value === 1);
				if (this.isRouteAcceptable()) this.ChannelCard.forceUpdate()
			}
		});

		this.settings.add('directory.following.show-channel-avatar', {
			default: 1,

			ui: {
				path: 'Directory > Following >> Placeholder',
				title: 'Show Channel Avatar',
				description: 'Show channel avatar next or on-top of a stream / video thumbnail.',

				component: 'setting-select-box',

				data: [
					{value: 0, title: 'Never'},
					{value: 1, title: 'Next to Stream Name'},
					{value: 2, title: 'On Thumbnail, Hidden on Hover'},
					{value: 3, title: 'On Thumbnail'}
				]
			},

			changed: value => {
				this.css_tweaks.toggleHide('profile-hover-following', value === 2);
				if (this.isRouteAcceptable()) this.ChannelCard.forceUpdate();
			}
		});

		this.apollo.registerModifier('FollowedIndex_CurrentUser', `query {
			currentUser {
				followedLiveUsers {
					nodes {
						profileImageURL(width: 70)
						stream {
							createdAt
						}
					}
				}
				followedHosts {
					nodes {
						profileImageURL(width: 70)
						hosting {
							profileImageURL(width: 70)
							stream {
								createdAt
								type
							}
						}
					}
				}
			}
		}`);

		this.apollo.registerModifier('FollowingLive_CurrentUser', `query {
			currentUser {
				followedLiveUsers {
					nodes {
						profileImageURL(width: 70)
						stream {
							createdAt
						}
					}
				}
			}
		}`);

		this.apollo.registerModifier('FollowingHosts_CurrentUser', `query {
			currentUser {
				followedHosts {
					nodes {
						profileImageURL(width: 70)
						hosting {
							profileImageURL(width: 70)
							stream {
								createdAt
							}
						}
					}
				}
			}
		}`);

		this.ChannelCard = this.fine.define(
			'following-channel-card',
			n => n.renderGameBoxArt && n.renderContentType
		);

		this.apollo.registerModifier('FollowedIndex_CurrentUser', res => {
			this.modifyLiveUsers(res);
			this.modifyLiveHosts(res);
		}, false);

		this.apollo.registerModifier('FollowingLive_CurrentUser', res => this.modifyLiveUsers(res), false);
		this.apollo.registerModifier('FollowingHosts_CurrentUser', res => this.modifyLiveHosts(res), false);
	}

	isRouteAcceptable() {
		return this.router.current.name === 'dir-following'
			|| this.router.current.name === 'dir-category' && this.router.match[1] === 'following';
	}

	modifyLiveUsers(res) {
		const hiddenThumbnails = this.settings.provider.get('directory.game.hidden-thumbnails') || [];
		const blockedGames = this.settings.provider.get('directory.game.blocked-games') || [];

		const newLiveNodes = [];

		const nodes = res.data.currentUser.followedLiveUsers.nodes;
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];

			const s = node.stream.viewersCount = new Number(node.stream.viewersCount || 0);
			s.profileImageURL = node.profileImageURL;
			s.createdAt = node.stream.createdAt;

			if (node.stream.game && hiddenThumbnails.includes(node.stream.game.name)) node.stream.previewImageURL = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.jpg';
			if (!node.stream.game || node.stream.game && !blockedGames.includes(node.stream.game.name)) newLiveNodes.push(node);
		}
		res.data.currentUser.followedLiveUsers.nodes = newLiveNodes;
		return res;
	}

	modifyLiveHosts(res) {
		const hiddenThumbnails = this.settings.provider.get('directory.game.hidden-thumbnails') || [];
		const blockedGames = this.settings.provider.get('directory.game.blocked-games') || [];

		const nodes = res.data.currentUser.followedHosts.nodes;
		this.hosts = {};
		const newHostNodes = [];

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];

			const s = node.hosting.stream.viewersCount = new Number(node.hosting.stream.viewersCount || 0);
			s.profileImageURL = node.hosting.profileImageURL;
			s.createdAt = node.hosting.stream.createdAt;
			s.hostData = {
				channel: node.hosting.login,
				displayName: node.hosting.displayName
			};

			if (!this.hosts[node.hosting.displayName]) {
				this.hosts[node.hosting.displayName] = {
					nodes: [node],
					channels: [node.displayName]
				};
				if (node.hosting.stream.game && hiddenThumbnails.includes(node.hosting.stream.game.name)) node.hosting.stream.previewImageURL = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.jpg';
				if (!node.hosting.stream.game || node.hosting.stream.game && !blockedGames.includes(node.hosting.stream.game.name)) newHostNodes.push(node);
			} else {
				this.hosts[node.hosting.displayName].nodes.push(node);
				this.hosts[node.hosting.displayName].channels.push(node.displayName);
			}
		}

		if (this.settings.get('directory.following.group-hosts')) {
			res.data.currentUser.followedHosts.nodes = newHostNodes;
		}
		return res;
	}

	onEnable() {
		this.css_tweaks.toggleHide('boxart-hover', this.settings.get('directory.following.hide-boxart') === 1);
		this.css_tweaks.toggleHide('boxart-hide', this.settings.get('directory.following.hide-boxart') === 2);
		this.css_tweaks.toggleHide('profile-hover-following', this.settings.get('directory.following.show-channel-avatar') === 2);

		this.ChannelCard.ready((cls, instances) => {
			if (this.router && this.router.match) {
				if (this.router.match[1] === 'following') {
					this.apollo.ensureQuery(
						'FollowedIndex_CurrentUser',
						n =>
							get('data.currentUser.followedLiveUsers.nodes.0.profileImageURL', n) !== undefined
							||
							get('data.currentUser.followedHosts.nodes.0.hosting.profileImageURL', n) !== undefined
					);
				} else if (this.router.match[1] === 'live') {
					this.apollo.ensureQuery(
						'FollowingLive_CurrentUser',
						'data.currentUser.followedLiveUsers.nodes.0.profileImageURL'
					);
				} else if (this.router.match[1] === 'hosts') {
					this.apollo.ensureQuery(
						'FollowingHosts_CurrentUser',
						'data.currentUser.followedHosts.nodes.0.hosting.profileImageURL'
					);
				}
			}

			for(const inst of instances) this.updateChannelCard(inst);
		});

		this.ChannelCard.on('update', inst => this.updateChannelCard(inst), this);
		this.ChannelCard.on('mount', inst => this.updateChannelCard(inst), this);
		this.ChannelCard.on('unmount', inst => this.parent.clearUptime(inst), this);

		document.body.addEventListener('click', this.destroyHostMenu.bind(this));
	}

	destroyHostMenu(event) {
		if (!event || event && event.target && event.target.closest('.ffz-channel-selector-outer') === null && Date.now() > this.hostMenuBuffer) {
			this.hostMenuPopper && this.hostMenuPopper.destroy();
			this.hostMenu && this.hostMenu.remove();
			this.hostMenuPopper = this.hostMenu = undefined;
		}
	}

	showHostMenu(inst, { channels }, event) {
		if (this.settings.get('directory.following.host-menus') === 0 || this.settings.get('directory.following.host-menus') === 1 && channels.length < 2) return;

		event.preventDefault();
		event.stopPropagation();

		this.hostMenuPopper && this.hostMenuPopper.destroy();

		this.hostMenu && this.hostMenu.remove();

		const simplebarContentChildren = [];

		// Hosted Channel Header
		simplebarContentChildren.push(
			e('p', {
				className: 'pd-t-05 pd-x-1 c-text-alt-2',
				textContent: 'Hosted Channel'
			})
		);

		// Hosted Channel Content
		simplebarContentChildren.push(
			e('a', {
				className: 'tw-interactable',
				href: `/${inst.props.viewerCount.hostData.channel}`,
				style: 'padding-top: 0.1rem; padding-bottom: 0.1rem;',
				onclick: event => this.parent.hijackUserClick(event, inst.props.viewerCount.hostData.channel, this.destroyHostMenu.bind(this))
			}, e('div', 'align-items-center flex flex-row flex-nowrap mg-x-1 mg-y-05',
				[
					e('div', {
						className: 'flex-shrink-0',
						style: 'overflow: hidden; width: 3rem; height: 3rem;',
					}, e('img', {
						src: inst.props.viewerCount.profileImageURL,
						alt: inst.props.channelName
					})),
					e('p', {
						className: 'ellipsis flex-grow-1 mg-l-1 font-size-5',
						textContent: inst.props.channelName
					})
				]
			))
		);

		// Hosting Channels Header
		simplebarContentChildren.push(
			e('p', {
				className: 'pd-t-05 pd-x-1 c-text-alt-2',
				textContent: 'Hosting Channels'
			})
		);

		// Hosting Channels Content
		const hosts = this.hosts[inst.props.channelName];
		for (let i = 0; i < hosts.nodes.length; i++) {
			const node = hosts.nodes[i];
			simplebarContentChildren.push(
				e('a', {
					className: 'tw-interactable',
					href: `/${node.login}`,
					style: 'padding-top: 0.1rem; padding-bottom: 0.1rem;',
					onclick: event => this.parent.hijackUserClick(event, node.login, this.destroyHostMenu.bind(this))
				}, e('div', 'align-items-center flex flex-row flex-nowrap mg-x-1 mg-y-05',
					[
						e('div', {
							className: 'flex-shrink-0',
							style: 'overflow: hidden; width: 3rem; height: 3rem;',
						}, e('img', {
							src: node.profileImageURL,
							alt: node.displayName
						})),
						e('p', {
							className: 'ellipsis flex-grow-1 mg-l-1 font-size-5',
							textContent: node.displayName
						})
					]
				))
			);
		}

		this.hostMenu = e('div', 'tw-balloon block',
			e('div', 'selectable-filter__balloon pd-y-05',
				e('div', {
					className: 'scrollable-area',
					style: 'max-height: 20rem;',
					'data-simplebar': true,
				}, [
					e('div', 'simplebar-track vertical',
						e('div', 'simplebar-scrollbar')
					),
					e('div', 'simplebar-scroll-content',
						e('div', 'simplebar-content', simplebarContentChildren)
					)
				])
			)
		);

		document.body.appendChild(this.hostMenu);

		this.hostMenuPopper = new Popper(document.body, this.hostMenu, {
			placement: 'bottom-start',
			modifiers: {
				flip: {
					enabled: false
				},
				offset: {
					offset: `${event.clientX - 60}, ${event.clientY - 60}`
				}
			},
		});

		this.hostMenuBuffer = Date.now() + 50;
	}

	updateChannelCard(inst) {
		if (!this.isRouteAcceptable()) return;
		
		this.parent.updateUptime(inst, 'props.viewerCount.createdAt', '.tw-card .tw-aspect > div');

		const container = this.fine.getHostNode(inst),
			card = container && container.querySelector && container.querySelector('.tw-card');

		if ( container === null || card === null )
			return;

		// Remove old elements
		const hiddenBodyCard = card.querySelector('.tw-card-body.hide');
		if (hiddenBodyCard !== null) hiddenBodyCard.classList.remove('hide');

		const ffzChannelData = card.querySelector('.ffz-channel-data');
		if (ffzChannelData !== null) ffzChannelData.remove();

		const channelAvatar = card.querySelector('.channel-avatar');
		if (channelAvatar !== null) channelAvatar.remove();

		if (inst.props.viewerCount.profileImageURL) {
			const hosting = inst.props.channelNameLinkTo.state.content === 'live_host' && inst.props.viewerCount.hostData;
			let channel, displayName;
			if (hosting) {
				channel = inst.props.viewerCount.hostData.channel;
				displayName = inst.props.viewerCount.hostData.displayName;
			}

			const avatarSetting = this.settings.get('directory.following.show-channel-avatar');
			const cardDiv = card.querySelector('.tw-card-body');
			const modifiedDiv = e('div', {
				innerHTML: cardDiv.innerHTML
			});

			let avatarDiv;
			if (avatarSetting === 1) {
				avatarDiv = e('a', {
					className: 'channel-avatar',
					href: hosting ? `/${channel}` : inst.props.linkTo.pathname,
					style: 'margin-right: 8px; min-width: 4rem; margin-top: 0.5rem;'
				}, e('img', {
					title: inst.props.channelName,
					src: inst.props.viewerCount.profileImageURL,
					style: 'height: 4rem;'
				}));
			} else if (avatarSetting === 2 || avatarSetting === 3) {
				const avatarElement = e('a', {
					className: 'channel-avatar',
					href: hosting ? `/${channel}` : inst.props.linkTo.pathname,
					onclick: event => this.parent.hijackUserClick(event, inst.props.streamNode.broadcaster.login)
				}, e('div', 'live-channel-card__boxart bottom-0 absolute',
					e('figure', 'tw-aspect tw-aspect--align-top',
						e('img', {
							title: inst.props.channelName,
							src: inst.props.viewerCount.profileImageURL
						})
					)
				)
				);

				const divToAppend = card.querySelector('.tw-aspect > div');
				if (divToAppend.querySelector('.channel-avatar') === null) divToAppend.appendChild(avatarElement);
			}

			const cardDivParent = cardDiv.parentElement;
			const ffzChannelData = cardDivParent.querySelector('.ffz-channel-data');
			if (ffzChannelData === null) {
				cardDiv.classList.add('hide');

				const newCardDiv = e('div', 'ffz-channel-data flex flex-nowrap', [
					avatarDiv, modifiedDiv
				]);
				cardDivParent.appendChild(newCardDiv);
			}

			if (hosting) {
				const hostObj = this.hosts[displayName];
				if (this.settings.get('directory.following.group-hosts')) {
					const titleLink = card.querySelector('.ffz-channel-data a[data-a-target="live-channel-card-title-link"]');
					const thumbnailLink = card.querySelector('a[data-a-target="live-channel-card-thumbnail-link"]');
					const channelCardTitle = card.querySelector('.ffz-channel-data .live-channel-card__title');

					const textContent = hostObj.channels.length > 1 ? `${hostObj.channels.length} hosting ${displayName}` : inst.props.title;
					if (channelCardTitle !== null) {
						channelCardTitle.textContent
							= channelCardTitle.title
							= textContent;
					}

					if (thumbnailLink !== null) thumbnailLink.title = textContent;

					if (titleLink !== null) titleLink.onclick = this.showHostMenu.bind(this, inst, hostObj);
					if (thumbnailLink !== null) thumbnailLink.onclick = this.showHostMenu.bind(this, inst, hostObj);
				}
			}
		}
	}
}