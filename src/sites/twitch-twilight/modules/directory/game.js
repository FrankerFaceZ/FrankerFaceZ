'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement as e} from 'utilities/dom';

import GAME_QUERY from './game.gql';

export default class Game extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.fine');
		this.inject('site.apollo');

		this.inject('i18n');
		this.inject('settings');

		this.GameHeader = this.fine.define(
			'game-header',
			n => n.renderFollowButton && n.renderGameDetailsTab,
			['dir-game-index', 'dir-community']
		);

		this.apollo.registerModifier('GamePage_Game', GAME_QUERY);
	}

	onEnable() {
		this.GameHeader.ready((cls, instances) => {
			for(const inst of instances) this.updateButtons(inst);
		});

		this.GameHeader.on('update', this.updateButtons, this);
	}

	updateButtons(inst, update = false) {
		const container = this.fine.getChildNode(inst);
		if ( inst.props.directoryType !== 'GAMES' || ! container || ! container.querySelector )
			return;

		const buttons = container.querySelector('div > div.tw-align-items-center'),
			ffz_buttons = buttons && buttons.querySelector('.ffz-buttons');

		if ( ! buttons || (ffz_buttons && ! update) )
			return;

		if ( ffz_buttons )
			ffz_buttons.remove();

		// The Block / Unblock Button
		let block_btn, block_label,
			hidden_btn, hidden_label;

		const game = inst.props.directoryName,
			update_block = () => {
				const blocked_games = this.settings.provider.get('directory.game.blocked-games') || [],
					blocked = blocked_games.includes(game);

				block_btn.classList.toggle('active', blocked);
				block_label.textContent = blocked ?
					this.i18n.t('directory.unblock', 'Unblock') :
					this.i18n.t('directory.block', 'Block');
			}


		block_btn = e('button', {
			className: 'tw-mg-l-1 tw-button ffz-directory-toggle-block',
			onClick: this.generateClickHandler('directory.game.blocked-games', game, update_block)
		}, block_label = e('span', 'tw-button__text'));

		update_block();


		const update_hidden = () => {
			const hidden_games = this.settings.provider.get('directory.game.hidden-thumbnails') || [],
				hidden = hidden_games.includes(game);

			hidden_btn.classList.toggle('active', hidden);
			hidden_label.textContent = hidden ?
				this.i18n.t('directory.show-thumbnails', 'Show Thumbnails') :
				this.i18n.t('directory.hide-thumbnails', 'Hide Thumbnails');

			this.parent.ChannelCard.forceUpdate();
		}

		hidden_btn = e('button', {
			className: 'tw-mg-l-1 tw-button ffz-directory-toggle-thumbnail',
			onClick: this.generateClickHandler('directory.game.hidden-thumbnails', game, update_hidden)
		}, hidden_label = e('span', 'tw-button__text'));

		update_hidden();

		buttons.appendChild(e('div', 'ffz-buttons', [
			block_btn,
			hidden_btn
		]));
	}

	generateClickHandler(setting, game, update_func) {
		return e => {
			e.preventDefault();
			const values = this.settings.provider.get(setting) || [],
				idx = values.indexOf(game);

			if ( idx === -1 )
				values.push(game);
			else
				values.splice(idx, 1);

			this.settings.provider.set(setting, values);
			update_func();
		}
	}

}