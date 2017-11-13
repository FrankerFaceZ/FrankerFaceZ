'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import Module from 'utilities/module';
import {createElement as e} from 'utilities/dom';


export default class Player extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('i18n');

		this.Player = this.fine.define(
			'twitch-player',
			n => n.player && n.onPlayerReady
		);
	}

	onEnable() {
		const t = this;

		this.Player.ready((cls, instances) => {
			const old_init = cls.prototype.initializePlayer;

			cls.prototype.initializePlayer = function() {
				const ret = old_init.call(this);
				t.addResetButton(this);
				return ret;
			}

			for(const inst of instances)
				this.addResetButton(inst);
		});

		this.on('i18n:update', () => {
			for(const inst of this.Player.instances)
				this.addResetButton(inst);
		});
	}


	addResetButton(inst) {
		if ( ! inst.playerRef )
			return this.log.warn('no player ref');

		const t = this,
			el = inst.playerRef.querySelector('.player-buttons-right .pl-flex'),
			container = el && el.parentElement;

		if ( ! container )
			return;

		let tip = container.querySelector('.ffz--player-reset .player-tip');

		if ( ! tip )
			container.insertBefore(
				e('button', {
					className: 'player-button player-button--reset ffz--player-reset ffz-i-cancel',
					type: 'button',
					onDblClick: t.resetPlayer.bind(t, inst)
				}, tip = e('span', 'player-tip js-control-tip')),
				el.nextSibling
			);

		tip.dataset.tip = this.i18n.t('player.reset_button', 'Double-Click to Reset Player');
	}


	resetPlayer(inst) {
		// Player shutdown logic copied from componentWillUnmount
		inst.checkPlayerDependencyAnimationFrame && cancelAnimationFrame(inst.checkPlayerDependencyAnimationFrame);
		inst.checkPlayerDependencyAnimationFrame = null;
		inst.maybeDetachFromWindow();

		const ES = this.web_munch.getModule('extension-service');
		if ( ES )
			ES.extensionService.unregisterPlayer();

		inst.player.destroy();
		inst.playerRef.innerHTML = '';

		inst.initializePlayer();
	}


	get current() {
		// There should only ever be one player instance, but might change
		// when they re-add support for the mini player.
		for(const inst of this.Player.instances)
			if ( inst && inst.player )
				return inst.player;
	}
}