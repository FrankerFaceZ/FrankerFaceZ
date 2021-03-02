'use strict';

// ============================================================================
// Chat Hooks
// ============================================================================

import {get} from 'utilities/object';
import {ColorAdjuster} from 'utilities/color';

import Module from 'utilities/module';

import Line from './line';


export default class Chat extends Module {
	constructor(...args) {
		super(...args);

		this.colors = new ColorAdjuster;
		this.inverse_colors = new ColorAdjuster;

		this.inject('settings');
		this.inject('i18n');

		this.settings.add('theme.is-dark', {
			requires: ['context.ui.theme'],
			process(ctx) {
				return ctx.get('context.ui.theme') === 1
			}
		});

		this.inject('chat');

		this.inject('site.twitch_data');
		this.inject('site.fine');
		this.inject('site.css_tweaks');

		this.inject(Line);

		this.ChatController = this.fine.define(
			'clip-chat-controller',
			n => n.filterChatLines
		);
	}

	onEnable() {
		this.chat.context.on('changed:chat.font-size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-family', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.lines.emote-alignment', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.adjustment-mode', this.updateColors, this);
		this.chat.context.on('changed:chat.adjustment-contrast', this.updateColors, this);
		this.chat.context.on('changed:theme.is-dark', this.updateColors, this);

		this.chat.context.getChanges('chat.lines.alternate', val =>
			this.css_tweaks.toggle('chat-rows', val));

		this.chat.context.getChanges('chat.lines.borders', this.updateLineBorders, this);

		this.ChatController.on('mount', this.chatMounted, this);
		this.ChatController.on('unmount', this.chatMounted, this);
		this.ChatController.on('update', this.chatUpdated, this);
		this.ChatController.on('receive-props', this.chatUpdated, this);

		this.ChatController.ready((cls, instances) => {
			for(const inst of instances)
				this.chatMounted(inst);
		});

		this.loadBadges();
		this.updateChatCSS();
		this.updateColors();
	}


	updateLineBorders() {
		const mode = this.chat.context.get('chat.lines.borders');

		this.css_tweaks.toggle('chat-borders', mode > 0);
		this.css_tweaks.toggle('chat-borders-3d', mode === 2);
		this.css_tweaks.toggle('chat-borders-3d-inset', mode === 3);
		this.css_tweaks.toggle('chat-borders-wide', mode === 4);
	}


	updateChatCSS() {
		const size = this.chat.context.get('chat.font-size'),
			emote_alignment = this.chat.context.get('chat.lines.emote-alignment'),
			lh = Math.round((20/12) * size);

		let font = this.chat.context.get('chat.font-family') || 'inherit';
		if ( font.indexOf(' ') !== -1 && font.indexOf(',') === -1 && font.indexOf('"') === -1 && font.indexOf("'") === -1 )
			font = `"${font}"`;

		this.css_tweaks.setVariable('chat-font-size', `${size/10}rem`);
		this.css_tweaks.setVariable('chat-line-height', `${lh/10}rem`);
		this.css_tweaks.setVariable('chat-font-family', font);

		this.css_tweaks.toggle('chat-font', size !== 12 || font);

		this.css_tweaks.toggle('emote-alignment-padded', emote_alignment === 1);
		this.css_tweaks.toggle('emote-alignment-baseline', emote_alignment === 2);
	}


	updateColors() {
		const is_dark = this.chat.context.get('theme.is-dark'),
			mode = this.chat.context.get('chat.adjustment-mode'),
			contrast = this.chat.context.get('chat.adjustment-contrast'),
			c = this.colors,
			ic = this.inverse_colors;

		// TODO: Get the background color from the theme system.
		// Updated: Use the lightest/darkest colors from alternating rows for better readibility.
		c._base = is_dark ? '#191919' : '#e0e0e0'; //#0e0c13' : '#faf9fa';
		c.mode = mode;
		c.contrast = contrast;

		ic._base = is_dark ? '#dad8de' : '#19171c';
		ic.mode = mode;
		ic.contrast = contrast;

		this.line.updateLines();
	}


	async loadBadges() {
		let data;
		try {
			data = await this.twitch_data.getBadges();
		} catch(err) {
			this.log.warn('Error loading badge data.', err);
			return;
		}

		if ( data )
			this.chat.badges.updateTwitchBadges(data);
	}


	// ========================================================================
	// Room Handling
	// ========================================================================

	addRoom(thing, props) {
		if ( ! props )
			props = thing.props;

		const channel_id = get('data.clip.broadcaster.id', props);
		if ( ! channel_id )
			return null;

		const room = thing._ffz_room = this.chat.getRoom(channel_id, null, false, true);
		room.ref(thing);
		return room;
	}


	removeRoom(thing) { // eslint-disable-line class-methods-use-this
		if ( ! thing._ffz_room )
			return;

		thing._ffz_room.unref(thing);
		thing._ffz_room = null;
	}


	// ========================================================================
	// Chat Controller
	// ========================================================================

	chatMounted(chat, props) {
		if ( ! props )
			props = chat.props;

		if ( ! this.addRoom(chat, props) )
			return;

		this.updateRoomBadges(chat, get('data.clip.video.owner.broadcastBadges', props));
	}


	chatUmounted(chat) {
		this.removeRoom(chat);
	}


	chatUpdated(chat, props) {
		if ( ! chat._ffz_room || props?.data?.clip?.broadcaster?.id !== chat._ffz_room.id ) {
			this.chatUmounted(chat);
			this.chatMounted(chat, props);
			return;
		}

		const new_room_badges = get('data.clip.video.owner.broadcastBadges', props),
			old_room_badges = get('data.clip.video.owner.broadcastBadges', chat.props);

		if ( new_room_badges !== old_room_badges )
			this.updateRoomBadges(chat, new_room_badges);
	}

	updateRoomBadges(chat, badges) { // eslint-disable-line class-methods-use-this
		const room = chat._ffz_room;
		if ( ! room )
			return;

		room.updateBadges(badges);
	}
}
