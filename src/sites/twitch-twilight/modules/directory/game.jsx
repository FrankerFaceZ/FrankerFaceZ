'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement} from 'utilities/dom';
import { get } from 'utilities/object';


export default class Game extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.fine');
		this.inject('site.apollo');

		this.inject('i18n');
		this.inject('settings');

		this.GameHeader = this.fine.define(
			'game-header',
			n => n.props && n.props.data && n.getBannerImage && n.getDirectoryCountAndTags,
			['dir-game-index', 'dir-community', 'dir-game-videos', 'dir-game-clips', 'dir-game-details']
		);

		this.settings.addUI('directory.game.blocked-games', {
			path: 'Directory > Categories @{"description": "Please note that due to limitations in Twitch\'s website, names here must be formatted exactly as displayed in your client. For best results, you can block or unblock categories directly from directory pages."} >> Blocked',
			component: 'game-list-editor',
			default: [],
			onUIChange: () => this.parent.updateCards()
		});

		this.settings.addUI('directory.game.hidden-thumbnails', {
			path: 'Directory > Categories >> Hidden Thumbnails',
			component: 'game-list-editor',
			default: [],
			onUIChange: () => this.parent.updateCards()
		});
	}

	onEnable() {
		this.GameHeader.on('mount', this.updateGameHeader, this);
		this.GameHeader.on('update', this.updateGameHeader, this);
		this.GameHeader.on('unmount', () => {
			this.settings.updateContext({
				category: null,
				categoryID: null
			})
		});

		this.settings.provider.on('changed', key => {
			if ( key === 'directory.game.blocked-games' || key === 'directory.game.hidden-thumbnails' ) {
				this.parent.updateCards();

				for(const inst of this.GameHeader.instances)
					this.updateGameHeader(inst);
			}
		});

		this.GameHeader.ready((cls, instances) => {
			for(const inst of instances)
				this.updateGameHeader(inst);
		});
	}


	updateGameHeader(inst) {
		this.updateButtons(inst);

		const category = inst?.props?.data?.game;

		this.settings.updateContext({
			category: category?.name,
			categoryID: category?.id
		});
	}


	updateButtons(inst) {
		const container = this.fine.getChildNode(inst);
		if ( get('data.game', inst.props) == null || ! container || ! container.querySelector )
			return;

		const buttons = container.querySelector('.tw-flex > .tw-flex-column');
		if ( ! buttons )
			return;

		const ffz_buttons = buttons.querySelector('.ffz-directory-buttons');
		if ( ffz_buttons )
			ffz_buttons.remove();

		let block_btn, block_label,
			hidden_btn, hidden_label;

		const game = get('data.game.name', inst.props) || inst.props.directoryName,
			update_block = () => {
				const blocked_games = this.settings.provider.get('directory.game.blocked-games', []),
					blocked = blocked_games.includes(game);

				block_btn.classList.toggle('active', blocked);
				block_label.textContent = blocked ?
					this.i18n.t('directory.unblock', 'Unblock') :
					this.i18n.t('directory.block', 'Block');
			},
			update_hidden = () => {
				const hidden_games = this.settings.provider.get('directory.game.hidden-thumbnails', []),
					hidden = hidden_games.includes(game);

				hidden_btn.classList.toggle('active', hidden);
				hidden_label.textContent = hidden ?
					this.i18n.t('directory.show-thumbnails', 'Show Thumbnails') :
					this.i18n.t('directory.hide-thumbnails', 'Hide Thumbnails');
			};

		block_btn = (<button
			class="tw-mg-r-1 tw-button ffz-directory-toggle-block"
			onClick={this.generateClickHandler('directory.game.blocked-games', game, update_block)}
		>
			{block_label = <span class="tw-button__text" />}
		</button>);

		update_block();

		hidden_btn = (<button
			class="tw-button ffz-directory-toggle-thumbnail"
			onClick={this.generateClickHandler('directory.game.hidden-thumbnails', game, update_hidden)}
		>
			{hidden_label = <span class="tw-button__text" />}
		</button>);

		update_hidden();

		buttons.appendChild(<div class="tw-mg-t-1 ffz-directory-buttons">
			{block_btn}
			{hidden_btn}
		</div>);
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
			this.parent.updateCards();
			update_func();
		}
	}
}