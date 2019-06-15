'use strict';

// ============================================================================
// Directory (Following, for now)
// ============================================================================

import {SiteModule} from 'utilities/module';
import {createElement} from 'utilities/dom';
import { get } from 'utilities/object';

import GAME_QUERY from './game.gql';

export default class Game extends SiteModule {
	constructor(...args) {
		super(...args);

		this.inject('site.fine');
		this.inject('site.apollo');

		//this.inject('metadata');
		this.inject('i18n');
		this.inject('settings');

		this.GameHeader = this.fine.define(
			'game-header',
			n => n.props && n.props.data && n.getBannerImage && n.getCategoryDisplayNameAndFollowButton,
			['dir-game-index', 'dir-community', 'dir-game-videos', 'dir-game-clips', 'dir-game-details']
		);

		this.apollo.registerModifier('DirectoryPage_Game', GAME_QUERY);
		this.apollo.registerModifier('DirectoryPage_Game', res => {
			/*setTimeout(() =>
				this.apollo.ensureQuery(
					'DirectoryPage_Game',
					'data.game.streams.edges.0.node.createdAt'
				), 500);*/

			this.modifyStreams(res);
		}, false);
	}

	modifyStreams(res) { // eslint-disable-line class-methods-use-this
		const edges = get('data.game.streams.edges', res);
		if ( ! edges || ! edges.length )
			return res;

		res.data.game.streams.edges = this.parent.processNodes(edges, true);
		return res;
	}

	onEnable() {
		this.GameHeader.on('mount', this.updateGameHeader, this);
		this.GameHeader.on('update', this.updateGameHeader, this);

		this.GameHeader.ready((cls, instances) => {
			for(const inst of instances)
				this.updateGameHeader(inst);
		});
	}


	updateGameHeader(inst) {
		this.updateButtons(inst);

		/*this.apollo.ensureQuery(
			'DirectoryPage_Game',
			'data.game.streams.edges.0.node.createdAt'
		);*/

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

		buttons.appendChild(<div class="ffz-directory-buttons">
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
			this.parent.DirectoryCard.forceUpdate();
			update_func();
		}
	}

	/*unmountGameHeader(inst) { // eslint-disable-line class-methods-use-this
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

				_mt: 'directory',
				_inst: inst
			}

		for(const key of keys)
			this.metadata.render(key, data, metabar, timers, refresh_func);
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
	}*/
}