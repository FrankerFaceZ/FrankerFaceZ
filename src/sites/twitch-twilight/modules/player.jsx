'use strict';

// ============================================================================
// Twitch Player
// ============================================================================

import PlayerBase from 'src/sites/shared/player';

export const PLAYER_ROUTES = [
	'front-page', 'user', 'video', 'user-video', 'user-clip', 'user-videos',
	'user-clips', 'user-collections', 'user-events', 'user-followers',
	'user-following', 'dash', 'squad', 'command-center', 'dash-stream-manager',
	'mod-view', 'user-home'
];

/*const HAS_PITCH = (() => {
	const el = createElement('video');
	return el.preservesPitch != null || el.mozPreservesPitch != null
})();*/

export default class Player extends PlayerBase {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		// Dependency Injection
		this.inject('site.router');
		this.inject('metadata');

		// React Components

		/*this.SquadStreamBar = this.fine.define(
			'squad-stream-bar',
			n => n.shouldRenderSquadBanner && n.props && n.props.triggerPlayerReposition,
			PLAYER_ROUTES
		);*/

		/*this.PersistentPlayer = this.fine.define(
			'persistent-player',
			n => n.state && n.state.playerStyles
		);*/

		this.Player = this.fine.define(
			'highwind-player',
			n => n.setPlayerActive && n.props?.playerEvents && n.props?.mediaPlayerInstance,
			PLAYER_ROUTES
		);

		this.TheatreHost = this.fine.define(
			'theatre-host',
			n => n.toggleTheatreMode && n.props && n.props.onTheatreModeEnabled,
			['user', 'user-home', 'video', 'user-video', 'user-clip']
		);

		this.PlayerSource = this.fine.define(
			'player-source',
			n => n.setSrc && n.setInitialPlaybackSettings,
			PLAYER_ROUTES
		);
	}


	repositionPlayer() {
		if ( ! this._mover ) {
			const el = document.querySelector('.channel-root__player');
			this._mover = this.fine.searchNode(
				el,
				n => n.memoizedProps?.triggerPlayerReposition,
				50
			);
		}

		if ( this._mover )
			this._mover.memoizedProps.triggerPlayerReposition();
	}


	registerSettings() {
		super.registerSettings();

		this.settings.add('player.home.autoplay', {
			default: true,
			ui: {
				path: 'Player > General >> Playback',
				title: 'Auto-play featured broadcasters on the front page.',
				component: 'setting-check-box'
			},
		});

		this.settings.add('player.theatre.no-whispers', {
			default: false,
			requires: ['whispers.show'],
			process(ctx, val) {
				if ( ! ctx.get('whispers.show') )
					return true;

				return val;
			},

			ui: {
				path: 'Player > General >> Theatre Mode',
				title: 'Hide whispers when Theatre Mode is enabled.',
				component: 'setting-check-box'
			},
			changed: val => this.css_tweaks.toggle('theatre-no-whispers', val)
		});

		this.settings.add('player.theatre.metadata', {
			default: false,
			ui: {
				path: 'Player > General >> Theatre Mode',
				title: 'Show metadata when mousing over the player.',
				component: 'setting-check-box'
			},

			changed: val => this.css_tweaks.toggle('theatre-metadata', val)
		});

		this.settings.add('player.theatre.auto-enter', {
			default: false,
			ui: {
				path: 'Player > General >> Theatre Mode',
				title: 'Automatically open Theatre Mode when visiting a channel.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('player.hide-event-bar', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the Event Bar',
				description: 'Hide the Event Bar which appears above the player when there is an ongoing event for the current channel.',
				component: 'setting-check-box'
			},
			changed: val => {
				this.css_tweaks.toggleHide('player-event-bar', val);
				this.repositionPlayer();
			}
		});

		/*this.settings.add('player.hide-rerun-bar', {
			default: false,
			ui: {
				path: 'Channel > Appearance >> General',
				title: 'Hide the Rerun Bar',
				description: 'Hide the Rerun Bar which appears above the player when the current channel is playing a video rather than live content.',
				component: 'setting-check-box'
			},
			changed: val => {
				this.css_tweaks.toggleHide('player-rerun-bar', val);
				this.repositionPlayer();
			}
		});*/
	}


	async onEnable() {
		await super.onEnable();

		this.css_tweaks.toggle('theatre-no-whispers', this.settings.get('player.theatre.no-whispers'));
		this.css_tweaks.toggle('theatre-metadata', this.settings.get('player.theatre.metadata'));
		this.css_tweaks.toggleHide('player-event-bar', this.settings.get('player.hide-event-bar'));
		//this.css_tweaks.toggleHide('player-rerun-bar', this.settings.get('player.hide-rerun-bar'));

		this.on(':fix-player', this.repositionPlayer, this);

		this.TheatreHost.on('mount', inst => {
			inst._ffz_theater_start = Date.now();
			this.tryTheatreMode(inst);
		});
		this.TheatreHost.on('update', this.tryTheatreMode, this);
		this.TheatreHost.ready((cls, instances) => {
			const now = Date.now();
			for(const inst of instances) {
				inst._ffz_theater_start = now;
				this.tryTheatreMode(inst);
			}
		});

		this.PlayerSource.on('mount', this.checkCarousel, this);
		this.PlayerSource.on('update', this.checkCarousel, this);
	}

	shouldStopAutoplay() {
		return this.settings.get('player.no-autoplay') ||
			(! this.settings.get('player.home.autoplay') && this.router.current?.name === 'front-page');
	}


	checkCarousel(inst) {
		if ( this.settings.get('channel.hosting.enable') )
			return;

		if ( inst.props?.playerType === 'channel_home_carousel' ) {
			if ( inst.props.content?.hostChannel === inst._ffz_cached_login )
				return;

			inst._ffz_cached_login = inst.props.content?.hostChannel;
			if ( ! inst._ffz_cached_login )
				return;

			const player = inst.props.mediaPlayerInstance,
				events = inst.props.playerEvents;

			this.stopPlayer(player, events, inst);
		}
	}


	tryTheatreMode(inst) {
		if ( ! inst._ffz_theater_timer )
			inst._ffz_theater_timer = setTimeout(() => {
				inst._ffz_theater_timer = null;

				if ( ! this.settings.get('player.theatre.auto-enter') || ! inst._ffz_mounted )
					return;

				if ( this.router.current_name !== 'user' )
					return;

				if ( inst.props.channelHomeLive || inst.props.channelHomeCarousel || inst.props.theatreModeEnabled )
					return;

				if ( Date.now() - (inst._ffz_theater_start ||0) > 2000 )
					return;

				if ( inst.props.onTheatreModeEnabled )
					inst.props.onTheatreModeEnabled();
			}, 250);
	}


	/**
	 * Tries to reposition the player, using a method exposed on the
	 * Squad Streaming bar.
	 *
	 * @memberof Player
	 * @returns {void}
	 */
	repositionPlayer() {
		// TODO: New implementation that works.
	}

	updateSquadContext() {
		this.settings.updateContext({
			squad_bar: this.hasSquadBar
		});
	}

	get hasSquadBar() {
		// TODO: New implementation that works.
		return false;
	}
}
