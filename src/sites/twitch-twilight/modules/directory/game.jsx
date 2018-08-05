'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement} from 'utilities/dom';

import GAME_QUERY from './game.gql';

export default class Game extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.fine');
		this.inject('site.apollo');

		this.inject('metadata');
		this.inject('i18n');
		this.inject('settings');

		this.metadata.definitions.block_game = {
			directory: true,
			button(data) {
				return `ffz-directory-toggle-block${data.blocked ? ' active' : ''}`
			},

			setup(data) {
				if ( data.type !== 'GAMES' )
					return null;

				const blocked_games = this.settings.provider.get('directory.game.blocked-games', []),
					blocked = blocked_games.includes(data.name);

				data.blocked = blocked;
				return data;
			},

			label(data) {
				if ( ! data )
					return null;

				return data.blocked ?
					this.i18n.t('directory.unblock', 'Unblock') :
					this.i18n.t('directory.block', 'Block')
			},

			tooltip() {
				return this.i18n.t('directory.block-explain', 'This will let you block streams playing this game from showing up in the directory.');
			},

			click: this.generateClickHandler('directory.game.blocked-games')
		}

		this.metadata.definitions.hide_thumbnails = {
			directory: true,
			button(data) {
				return `ffz-directory-toggle-thumbnail${data.hidden ? ' active' : ''}`
			},

			setup(data) {
				if ( data.type !== 'GAMES' )
					return null;

				const hidden_games = this.settings.provider.get('directory.game.hidden-thumbnails', []);

				data.hidden = hidden_games.includes(data.name);
				return data;
			},

			label(data) {
				if ( ! data )
					return null;

				return data.hidden ?
					this.i18n.t('directory.show-thumbnails', 'Show Thumbnails') :
					this.i18n.t('directory.hide-thumbnails', 'Hide Thumbnails');
			},

			tooltip() {
				return this.i18n.t('directory.thumbnails-explain', 'Enabling this will hide thumbnails of this game everywhere in the directory.');
			},

			click: this.generateClickHandler('directory.game.hidden-thumbnails')
		}

		this.LegacyGameHeader = this.fine.define(
			'legacy-game-header',
			n => n.renderFollowButton && n.renderGameDetailsTab,
			['dir-game-index', 'dir-community']
		);

		this.GameHeader = this.fine.define(
			'game-header',
			n => n.renderDirectoryMetadata,
			['dir-game-index', 'dir-community', 'dir-game-videos', 'dir-game-clips', 'dir-game-details']
		);

		this.apollo.registerModifier('GamePage_Game_RENAME2', GAME_QUERY);
	}

	onEnable() {
		this.GameHeader.on('unmount', this.unmountGameHeader, this);
		this.GameHeader.on('mount', this.updateGameHeader, this);
		this.GameHeader.on('update', this.updateGameHeader, this);

		this.GameHeader.ready((cls, instances) => {
			this.settings.updateContext({new_channel: true});

			for(const inst of instances)
				this.updateGameHeader(inst);
		});

		this.LegacyGameHeader.ready((cls, instances) => {
			for(const inst of instances)
				this.updateButtons(inst);
		});

		this.LegacyGameHeader.on('update', this.updateButtons, this);
	}


	unmountGameHeader(inst) { // eslint-disable-line class-methods-use-this
		const timers = inst._ffz_meta_timers;
		if ( timers )
			for(const key in timers)
				if ( timers[key] )
					clearTimeout(timers[key]);
	}


	updateGameHeader(inst) {
		this.updateMetadata(inst);
	}


	updateMetadata(inst, keys) {
		const container = this.fine.getChildNode(inst),
			wrapper = container && container.querySelector && container.querySelector('.side-nav-directory-info__info-wrapper > div + div');

		if ( ! inst._ffz_mounted || ! wrapper )
			return;

		const metabar = wrapper;

		if ( ! keys )
			keys = this.metadata.keys;
		else if ( ! Array.isArray(keys) )
			keys = [keys];

		const timers = inst._ffz_meta_timers = inst._ffz_meta_timers || {},
			refresh_func = key => this.updateMetadata(inst, key),
			data = {
				directory: inst.props.data.directory,
				type: inst.props.directoryType,
				name: inst.props.directoryName,
				_inst: inst
			}

		for(const key of keys)
			this.metadata.render(key, data, metabar, timers, refresh_func);
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


		block_btn = (<button
			class="tw-mg-l-1 tw-button ffz-directory-toggle-block"
			onClick={this.generateLegacyClickHandler('directory.game.blocked-games', game, update_block)}
		>
			{block_label = <span class="tw-button__text" />}
		</button>);

		update_block();


		const update_hidden = () => {
			const hidden_games = this.settings.provider.get('directory.game.hidden-thumbnails') || [],
				hidden = hidden_games.includes(game);

			hidden_btn.classList.toggle('active', hidden);
			hidden_label.textContent = hidden ?
				this.i18n.t('directory.show-thumbnails', 'Show Thumbnails') :
				this.i18n.t('directory.hide-thumbnails', 'Hide Thumbnails');

			this.parent.DirectoryCard.forceUpdate();
		}

		hidden_btn = (<button
			class="tw-mg-l-1 tw-button ffz-directory-toggle-thumbnail"
			onClick={this.generateLegacyClickHandler('directory.game.hidden-thumbnails', game, update_hidden)}
		>
			{hidden_label = <span class="tw-button__text" />}
		</button>)

		update_hidden();

		buttons.appendChild(<div class="ffz-buttons">
			{block_btn}
			{hidden_btn}
		</div>);
	}

	generateLegacyClickHandler(setting, game, update_func) {
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

	generateClickHandler(setting) {
		return (data, event, update_func) => {
			const values = this.settings.provider.get(setting, []),
				game = data.name,
				idx = values.indexOf(game);

			if ( idx === -1 )
				values.push(game)
			else
				values.splice(idx, 1);

			this.settings.provider.set(setting, values);
			this.parent.DirectoryCard.forceUpdate();
			update_func();
		}
	}
}