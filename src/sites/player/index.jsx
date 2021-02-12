'use strict';

// ============================================================================
// Standalone Player
// ============================================================================

import {createElement} from 'utilities/dom';

import BaseSite from '../base';

import Fine from 'utilities/compat/fine';
import Player from './player';
import CSSTweaks from './css_tweaks';
import Tooltips from 'src/modules/tooltips';

import MAIN_URL from './styles/player-main.scss';

// ============================================================================
// The Site
// ============================================================================

export default class PlayerSite extends BaseSite {
	constructor(...args) {
		super(...args);

		this.inject('i18n');
		this.inject(Fine);
		this.inject(Player);
		this.inject('tooltips', Tooltips);
		this.inject('css_tweaks', CSSTweaks);

		this.DataSource = this.fine.define(
			'data-source',
			n => n.consentMetadata && n.onPlaying && n.props && n.props.data
		);

		this.PlayerMenu = this.fine.define(
			'player-menu',
			n => n.closeSettingsMenu && n.state && n.state.activeMenu && n.getMaxMenuHeight
		);
	}

	onEnable() {
		this.settings = this.resolve('settings');

		this.DataSource.on('mount', this.updateData, this);
		this.DataSource.on('update', this.updateData, this);
		this.DataSource.ready((cls, instances) => {
			for(const inst of instances)
				this.updateData(inst);
		});

		this.PlayerMenu.on('mount', this.updateMenu, this);
		this.PlayerMenu.on('update', this.updateMenu, this);
		this.PlayerMenu.ready((cls, instances) => {
			for(const inst of instances)
				this.updateMenu(inst);
		});

		this.on('i18n:update', () => {
			for(const inst of this.PlayerMenu.instances)
				this.updateMenu(inst);
		});

		// Window Size
		const update_size = () => this.settings.updateContext({
			size: {
				height: window.innerHeight,
				width: window.innerWidth
			}
		});

		window.addEventListener('resize', update_size);
		update_size();

		this.settings.updateContext({
			route: {
				name: 'popout-player',
				parts: ['/'],
				domain: 'player.twitch.tv'
			},
			route_data: ['/']
		});

		document.head.appendChild(createElement('link', {
			href: MAIN_URL,
			rel: 'stylesheet',
			type: 'text/css',
			crossOrigin: 'anonymous'
		}));
	}

	get data() {
		return this.DataSource.first;
	}

	updateData(inst) {
		const user = inst?.props?.data?.user,

			bcast = user?.broadcastSettings,
			game = user?.stream?.game;

		this.settings.updateContext({
			title: bcast?.title,
			channelID: user?.id,
			category: game?.name,
			categoryID: game?.id
		});
	}

	updateMenu(inst) {
		const outer = this.fine.getChildNode(inst),
			container = outer && outer.querySelector('div[data-a-target="player-settings-menu"]');

		if ( ! container )
			return;

		const should_render = inst.state.activeMenu === 'settings-menu__main';

		let lbl, cont = container.querySelector('.ffz--cc-button');
		if ( ! cont ) {
			if ( ! should_render )
				return;

			const handler = () => {
				const win = window.open(
					'https://twitch.tv/popout/frankerfacez/chat?ffz-settings=player',
					'_blank',
					'resizable=yes,scrollbars=yes,width=850,height=600'
				);

				if ( win )
					win.focus();
			}

			cont = (<div class="tw-mg-t-1 tw-border-t tw-pd-t-1 tw-full-width tw-relative ffz--cc-button">
				<button
					class="tw-block tw-border-radius-medium tw-full-width ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive"
					onclick={handler}
				>
					<div class="tw-align-items-center tw-flex tw-pd-05 tw-relative">
						{lbl = <div class="tw-flex-grow-1" />}
					</div>
				</button>
			</div>);

			container.appendChild(cont);

		} else if ( ! should_render ) {
			cont.remove();
			return;
		} else
			lbl = cont.querySelector('button > div > div');

		lbl.textContent = this.i18n.t('site.menu_button', 'FrankerFaceZ Control Center');
	}
}