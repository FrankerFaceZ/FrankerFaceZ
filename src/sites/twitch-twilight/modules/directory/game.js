'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement as e} from 'utilities/dom';

export default class Game extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.fine');
		this.inject('site.apollo');

		this.inject('settings');

		this.GameHeader = this.fine.define(
			'game-header',
			n => n.renderFollowButton && n.renderGameDetailsTab
		);

		this.apollo.registerModifier('GamePage_Game', `query {
			directory {
				... on Game {
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
		this.GameHeader.ready((cls, instances) => {
			for(const inst of instances) this.updateButtons(inst);
		});

		this.GameHeader.on('update', inst => this.updateButtons(inst));
	}

	updateButtons(inst) {
		if (inst.props.directoryType !== 'GAMES') return;

		const container = this.fine.getHostNode(inst);
		// We can't get the buttons through querySelector('button ...') so this has to do for now...
		const buttons = container && container.querySelector && container.querySelector('div > div.align-items-center');

		const ffzButtons = buttons.querySelector('.ffz-buttons');
		if (ffzButtons !== null) return;

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
				this.ChannelCard.forceUpdate();
			});

			const ffzButtons = e('div', 'ffz-buttons', [
				blockButton,
				hideThumbnailButton
			]);

			buttons.appendChild(ffzButtons);
		}
	}
}