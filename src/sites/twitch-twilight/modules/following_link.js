'use strict';

// ============================================================================
// Following Button Modification 
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement as e} from 'utilities/dom';

import Tooltip from 'utilities/tooltip';

export default class FollowingText extends SiteModule {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		// this.inject('site');
		this.inject('settings');
		this.inject('site.router');
		this.inject('site.apollo');
		this.inject('i18n');

		this.apollo.registerModifier('FollowedChannels', `query {
			currentUser {
				followedLiveUsers {
					nodes {
						profileImageURL(width: 70)
						stream {
							type
							createdAt
						}
					}
				}
			}
		}`);

		this.apollo.registerModifier('FollowedChannels', res => {
			this.updateFollowing(this.nodes = res.data.currentUser.followedLiveUsers.nodes);
		}, false);

		this.router.on(':route', () => {
			this.updateFollowing();
		});
	}

	async updateFollowing(nodes) {
		nodes = nodes || this.nodes || [];
		const followingText = await this.site.awaitElement('.top-nav__nav-link[data-a-target="following-link"]');
		const topNavContainer = followingText.parentElement;
		const oldFFZFollowingText = topNavContainer.querySelector('.ffz-following-container');
		if (oldFFZFollowingText !== null) oldFFZFollowingText.remove();

		const topSpan = e('span', {
			className: 'top-span',
			style: 'width: 100%; float: left; text-align: left; border-bottom: 1px black solid; padding-bottom: 8px;',
			textContent: 'Following'
		});

		const height = document.body.querySelector('.twilight-root').clientHeight - 50;
		const max_lines = Math.max(Math.floor(height / 40) - 1, 2);

		let c = 0;
		let filtered = 0;

		const blockedGames = this.settings.provider.get('directory.game.blocked-games') || [];

		const innerContent = [topSpan, e('br')];
		if (nodes.length) {

			for (let i = 0; i < nodes.length; i++) {
				const node = nodes[i];
	
				if (blockedGames.includes(node.stream.game.name)) {
					filtered += 1;
					continue;
				}
	
				c += 1;
				if (c > max_lines) {
					const div = e('div', {
						className: 'ffz-following-inner',
						style: 'padding-top: 16px; padding-bottom: 4px;'
					}, e('span', {
						textContent: `And ${this.i18n.formatNumber(nodes.length - max_lines)} more${filtered ? ` (${filtered} hidden)` : ''}`,
						style: 'float: left; margin-bottom: 8px;'
					}));
					innerContent.push(div);
					break;
				}
	
				const up_since = new Date(node.stream.createdAt);
				const uptime = up_since && Math.floor((Date.now() - up_since) / 1000) || 0;
				const uptimeText = this.timeToString(uptime, false, false, false, true);

				const div = e('div', {
					className: 'ffz-following-inner',
					style: 'padding-top: 16px; padding-bottom: 4px;'
				}, [
					e('div', {
						className: 'top-stream-info',
						style: 'padding-bottom: 16px;'	
					}, [
						// Username
						e('a', {
							textContent: node.displayName,
							style: 'float: left; font-weight: bold;',
							href: `/${node.login}`,
							onclick: event => {
								event.preventDefault();
								event.stopPropagation();
				
								this.router.navigate('user', { userName: node.login });
							}
						}),
						e('div', {
							style: 'float: right;'
						}, [
							// Uptime
							e('div', {
								className: 'ffz-uptime-cont',
								style: 'float: right;'
							}, [
								e('span', 'tw-stat__icon',
									e('figure', 'ffz-i-clock')
								),
								e('span', {
									textContent: uptimeText
								})
							]),
							// Viewers
							e('div', {
								className: 'ffz-viewer-cont',
								style: 'float: right; margin-right: 4px;'
							}, [
								e('span', 'tw-stat__icon',
									e('figure', 'ffz-i-plus')
								),
								e('span', {
									textContent: `${this.i18n.formatNumber(node.stream.viewersCount)}`
								})
							])
						])
					]),
					e('span', {
						className: 'ellipsis',
						textContent: `Playing ${node.stream.game.name}`,
						style: 'float: left; margin-bottom: 8px; max-width: 100%;'
					})
				]);
				innerContent.push(div);
			}

			if (filtered) {
				const div = e('div', {
					className: 'ffz-following-inner',
					style: 'padding-top: 16px; padding-bottom: 4px;'
				}, e('span', {
					textContent: `(${filtered} hidden)`,
					style: 'float: left; margin-bottom: 8px;'
				}));
				innerContent.push(div);
			}
		} else {
			const div = e('div', {
				className: 'ffz-following-inner',
				style: 'padding-top: 16px; padding-bottom: 4px;'
			}, e('span', {
				textContent: `No one you're following is online.`,
				style: 'float: left; margin-bottom: 8px;'
			}));
			innerContent.push(div);
		}

		const content = e('div', {
			style: 'padding: 4px;',
		}, innerContent);

		const tipDiv = e('div', {
			className: 'ffz-following',
			tip_content: content,
		});

		const newFollowing = e('div', 'top-nav__nav-link ffz-following-container', [
			e('a', {
				href: '/directory/following',
				textContent: followingText.title,
				onclick: event => {
					event.preventDefault();
					event.stopPropagation();
	
					this.router.navigate('dir-following');
				}
			}),
			e('span', {
				className: 'tw-pill tw-pill--brand',
				textContent: nodes.length,
				style: 'margin-left: 0.5rem;'
			}),
			tipDiv
		]);
		
		topNavContainer.insertBefore(newFollowing, followingText);
		followingText.classList.add('hide');

		newFollowing.tooltip = new Tooltip(tipDiv, newFollowing, {
			live: false,
			html: true,
			interactive: true,
			delayHide: 250,
			content: () => tipDiv.tip_content,
			onShow: (t, tip) => tipDiv.tip = tip,
			onHide: () => tipDiv.tip = null,
			popper: {
				placement: 'bottom',
				modifiers: {
					backgroundChange: {
						order: 900 - 1,
						enabled: true,
						fn: data => {
							data.styles.width = '300px';
							return data;
						}
					}
				}
			}
		});
	}

	async onEnable() {
		await this.site.awaitElement('.top-nav__nav-link[data-a-target="following-link"]');
		this.apollo.ensureQuery('FollowedChannels', 'data.currentUser.followedLiveUsers.nodes.0.stream.createdAt');
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
}