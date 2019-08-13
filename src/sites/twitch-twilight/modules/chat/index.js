'use strict';

// ============================================================================
// Chat Hooks
// ============================================================================

import {ColorAdjuster} from 'utilities/color';
import {setChildren} from 'utilities/dom';
import {get, has, make_enum, split_chars, shallow_object_equals, set_equals} from 'utilities/object';
import {FFZEvent} from 'utilities/events';

import Module from 'utilities/module';

import Twilight from 'site';

import Scroller from './scroller';
import ChatLine from './line';
import SettingsMenu from './settings_menu';
import EmoteMenu from './emote_menu';
import Input from './input';
import ViewerCards from './viewer_card';


const REGEX_EMOTES = {
	'B-?\\)': ['B)', 'B-)'],
	'R-?\\)': ['R)', 'R-)'],
	'[oO](_|\\.)[oO]': ['o_o', 'O_o', 'o_O', 'O_O', 'o.o', 'O.o', 'o.O', 'O.O'],
	'\\&gt\\;\\(': ['>('],
	'\\&lt\\;3': ['<3'],
	'\\:-?(o|O)': [':o', ':O', ':-o', ':-O'],
	'\\:-?(p|P)': [':p', ':P', ':-p', ':-P'],
	'\\:-?D': [':D', ':-D'],
	'\\:-?[\\\\/]': [':/', ':-/', ':\\', ':-\\'],
	'\\:-?[z|Z|\\|]': [':z', ':Z', ':|', ':-z', ':-Z', ':-|'],
	'\\:-?\\(': [':(', ':-('],
	'\\:-?\\)': [':)', ':-)'],
	'\\;-?(p|P)': [';p', ';P', ';-p', ';-P'],
	'\\;-?\\)': [';)', ';-)'],
	'#-?[\\\\/]': ['#/', '#-/', '#//', '#-//'],
	':-?(?:7|L)': [':7', ':L', ':-7', ':-L'],
	'\\&lt\\;\\]': ['<]'],
	'\\:-?(S|s)': [':s', ':S', ':-s', ':-S'],
	'\\:\\&gt\\;': [':>']
};


const MESSAGE_TYPES = make_enum(
	'Post',
	'Action',
	'PostWithMention'
);

const MOD_TYPES = make_enum(
	'Ban',
	'Timeout',
	'Delete'
);

const AUTOMOD_TYPES = make_enum(
	'MessageRejectedPrompt',
	'CheerMessageRejectedPrompt',
	'MessageRejected',
	'MessageAllowed',
	'MessageDenied',
	'CheerMessageDenied',
	'CheerMessageTimeout',
	'MessageModApproved',
	'MessageModDenied'
);

const CHAT_TYPES = make_enum(
	'Message',
	'ExtensionMessage',
	'Moderation',
	'ModerationAction',
	'TargetedModerationAction',
	'AutoMod',
	'SubscriberOnlyMode',
	'FollowerOnlyMode',
	'SlowMode',
	'EmoteOnlyMode',
	'R9KMode',
	'Connected',
	'Disconnected',
	'Reconnect',
	'Hosting',
	'Unhost',
	'Hosted',
	'Subscription',
	'Resubscription',
	'GiftPaidUpgrade',
	'AnonGiftPaidUpgrade',
	'PrimePaidUpgrade',
	'ExtendSubscription',
	'SubGift',
	'AnonSubGift',
	'Clear',
	'RoomMods',
	'RoomState',
	'Raid',
	'Unraid',
	'Ritual',
	'Notice',
	'Info',
	'BadgesUpdated',
	'Purchase',
	'BitsCharity',
	'CrateGift',
	'RewardGift',
	'SubMysteryGift',
	'AnonSubMysteryGift',
	'FirstCheerMessage',
	'BitsBadgeTierMessage',
	'InlinePrivateCallout',
	'ChannelPointsReward'
);


const NULL_TYPES = [
	'Reconnect',
	'RoomState',
	'BadgesUpdated',
	'Clear'
];


const MISBEHAVING_EVENTS = [
	'onBadgesUpdatedEvent',
];


export default class ChatHook extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.colors = new ColorAdjuster;
		this.inverse_colors = new ColorAdjuster;

		this.inject('settings');
		this.inject('i18n');

		this.inject('site');
		this.inject('site.router');
		this.inject('site.fine');
		this.inject('site.web_munch');
		this.inject('site.css_tweaks');

		this.inject('chat');

		this.inject(Scroller);
		this.inject(ChatLine);
		this.inject(SettingsMenu);
		this.inject(EmoteMenu);
		this.inject(Input);
		this.inject(ViewerCards);

		this.ChatService = this.fine.define(
			'chat-service',
			n => n.join && n.connectHandlers,
			Twilight.CHAT_ROUTES
		);

		this.ChatBuffer = this.fine.define(
			'chat-buffer',
			n => n.updateHandlers && n.delayedMessageBuffer && n.handleMessage,
			Twilight.CHAT_ROUTES
		);

		this.ChatController = this.fine.define(
			'chat-controller',
			n => n.hostingHandler && n.onRoomStateUpdated,
			Twilight.CHAT_ROUTES
		);

		this.ChatContainer = this.fine.define(
			'chat-container',
			n => n.showViewersList && n.onChatInputFocus,
			Twilight.CHAT_ROUTES
		);

		this.ChatBufferConnector = this.fine.define(
			'chat-buffer-connector',
			n => n.clearBufferHandle && n.syncBufferedMessages,
			Twilight.CHAT_ROUTES
		);

		this.PinnedCheer = this.fine.define(
			'pinned-cheer',
			n => n.collapseCheer && n.saveRenderedMessageRef,
			Twilight.CHAT_ROUTES
		);

		this.RoomPicker = this.fine.define(
			'chat-picker',
			n => n.closeRoomPicker && n.handleRoomSelect,
			Twilight.CHAT_ROUTES
		);

		this.InlineCallout = this.fine.define(
			'inline-callout',
			n => n.showCTA && n.toggleContextMenu && n.actionClick,
			Twilight.CHAT_ROUTES
		);

		this.PinnedCallout = this.fine.define(
			'pinned-callout',
			n => n.getCalloutTitle && n.buildCalloutProps && n.pin,
			Twilight.CHAT_ROUTES
		);

		// Settings

		this.settings.add('chat.pin-resubs', {
			default: false,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Automatically pin re-subscription messages in chat.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.width', {
			default: 340,
			ui: {
				path: 'Chat > Appearance >> General @{"sort": -1}',
				title: 'Width',
				description: "How wide chat should be, in pixels. This may be affected by your browser's zoom and font size settings.",
				component: 'setting-text-box',
				process(val) {
					val = parseInt(val, 10);
					if ( isNaN(val) || ! isFinite(val) || val <= 0 )
						return 340;

					return val;
				}
			}
		});

		this.settings.add('chat.use-width', {
			requires: ['chat.width', 'context.ui.rightColumnExpanded'],
			process(ctx) {
				if ( ! ctx.get('context.ui.rightColumnExpanded') )
					return false;

				return ctx.get('chat.width') != 340;
			}
		});

		this.settings.add('chat.bits.show-pinned', {
			requires: ['chat.bits.show'],
			default: null,
			process(ctx, val) {
				if ( val != null )
					return val;

				return ctx.get('chat.bits.show')
			},

			ui: {
				path: 'Chat > Bits and Cheering >> Appearance',
				title: 'Display Top Cheerers',
				description: 'By default, this inherits its value from Display Bits.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.bits.show-rewards', {
			requires: ['chat.bits.show'],
			default: null,
			process(ctx, val) {
				if ( val != null )
					return val;

				return ctx.get('chat.bits.show')
			},

			ui: {
				path: 'Chat > Bits and Cheering >> Behavior',
				title: 'Display messages when a cheer shares rewards to people in chat.',
				description: 'By default, this inherits its value from Display Bits. This setting only affects newly arrived messages.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.rituals.show', {
			default: true,
			ui: {
				path: 'Chat > Filtering >> Rituals',
				title: 'Display ritual messages such as "User is new here! Say Hello!".',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.subs.show', {
			default: 3,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Display Subs in Chat',
				component: 'setting-select-box',
				description: '**Note**: Messages sent with re-subs will always be displayed. This only controls the special "X subscribed!" message.',
				data: [
					{value: 0, title: 'Do Not Display'},
					{value: 1, title: 'Re-Subs with Messages Only'},
					{value: 2, title: 'Re-Subs Only'},
					{value: 3, title: 'Display All'}
				]
			}
		});

		this.settings.add('chat.subs.compact', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Display subscription notices in a more compact (classic style) form.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.subs.merge-gifts', {
			default: 1000,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Merge Mass Sub Gifts',
				component: 'setting-select-box',
				data: [
					{value: 1000, title: 'Disabled'},
					{value: 50, title: 'More than 50'},
					{value: 20, title: 'More than 20'},
					{value: 10, title: 'More than 10'},
					{value: 5, title: 'More than 5'},
					{value: 0, title: 'Always'}
				],
				description: 'Merge mass gift subscriptions into a single message, depending on the quantity.\n**Note:** Only affects newly gifted subs.'
			}
		});

		this.settings.add('chat.subs.merge-gifts-visibility', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Subscriptions',
				title: 'Expand merged mass sub gift messages by default.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.alternate', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Display lines with alternating background colors.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.padding', {
			default: false,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Reduce padding around lines.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.lines.borders', {
			default: 0,
			ui: {
				path: 'Chat > Appearance >> Chat Lines',
				title: 'Separators',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Basic Line (1px Solid)'},
					{value: 2, title: '3D Line (2px Groove)'},
					{value: 3, title: '3D Line (2px Groove Inset)'},
					{value: 4, title: 'Wide Line (2px Solid)'}
				]
			}
		});
	}

	get currentChat() {
		for(const inst of this.ChatController.instances)
			if ( inst && inst.chatService )
				return inst;

		return null;
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

		this.updateChatLines();
		this.updateMentionCSS();
		this.emit(':update-colors');
	}


	updateChatCSS() {
		if ( ! this._update_css_waiter )
			this._update_css_waiter = requestAnimationFrame(() => this._updateChatCSS());
	}

	_updateChatCSS() {
		cancelAnimationFrame(this._update_css_waiter);
		this._update_css_waiter = null;

		const width = this.chat.context.get('chat.width'),
			size = this.chat.context.get('chat.font-size'),
			emote_alignment = this.chat.context.get('chat.lines.emote-alignment'),
			lh = Math.round((20/12) * size);

		let font = this.chat.context.get('chat.font-family') || 'inherit';
		if ( font.indexOf(' ') !== -1 && font.indexOf(',') === -1 && font.indexOf('"') === -1 && font.indexOf("'") === -1 )
			font = `"${font}"`;

		this.css_tweaks.setVariable('chat-font-size', `${size/10}rem`);
		this.css_tweaks.setVariable('chat-line-height', `${lh/10}rem`);
		this.css_tweaks.setVariable('chat-font-family', font);
		this.css_tweaks.setVariable('chat-width', `${width/10}rem`);

		this.css_tweaks.toggle('chat-font', size !== 12 || font);
		this.css_tweaks.toggle('chat-width', this.settings.get('chat.use-width'));

		this.css_tweaks.toggle('emote-alignment-padded', emote_alignment === 1);
		this.css_tweaks.toggle('emote-alignment-baseline', emote_alignment === 2);

		this.emit(':update-chat-css');
	}

	updateLineBorders() {
		const mode = this.chat.context.get('chat.lines.borders');

		this.css_tweaks.toggle('chat-borders', mode > 0);
		this.css_tweaks.toggle('chat-borders-3d', mode === 2);
		this.css_tweaks.toggle('chat-borders-3d-inset', mode === 3);
		this.css_tweaks.toggle('chat-borders-wide', mode === 4);
	}

	updateMentionCSS() {
		const enabled = this.chat.context.get('chat.filtering.highlight-mentions');
		this.css_tweaks.toggle('chat-mention-token', this.chat.context.get('chat.filtering.highlight-tokens'));

		const raw_color = this.chat.context.get('chat.filtering.mention-color');
		if ( raw_color ) {
			this.css_tweaks.toggle('chat-mention-bg', false);
			this.css_tweaks.toggle('chat-mention-bg-alt', false);

			this.css_tweaks.toggle('chat-mention-bg-custom', true);
			this.css_tweaks.setVariable('chat-mention-color', this.inverse_colors.process(raw_color));

		} else {
			this.css_tweaks.toggle('chat-mention-bg-custom', false);
			this.css_tweaks.toggle('chat-mention-bg', enabled);
			this.css_tweaks.toggle('chat-mention-bg-alt', enabled && this.chat.context.get('chat.lines.alternate'));
		}
	}


	async grabTypes() {
		const ct = await this.web_munch.findModule('chat-types'),
			changes = [];

		this.automod_types = ct && ct.a || AUTOMOD_TYPES;
		this.chat_types = ct && ct.b || CHAT_TYPES;
		this.message_types = ct && ct.c || MESSAGE_TYPES;
		this.mod_types = ct && ct.e || MOD_TYPES;

		if ( ! ct )
			return;

		if ( ct.a && ! shallow_object_equals(ct.a, AUTOMOD_TYPES) )
			changes.push('AUTOMOD_TYPES');

		if ( ct.b && ! shallow_object_equals(ct.b, CHAT_TYPES) )
			changes.push('CHAT_TYPES');

		if ( ct.c && ! shallow_object_equals(ct.c, MESSAGE_TYPES) )
			changes.push('MESSAGE_TYPES');

		if ( ct.e && ! shallow_object_equals(ct.e, MOD_TYPES) )
			changes.push('MOD_TYPES');

		if ( changes.length )
			this.log.info('Chat Types have changed from static mappings for categories:', changes.join(' '));
	}


	onEnable() {
		this.on('site.web_munch:loaded', this.grabTypes);
		this.grabTypes();

		this.chat.context.on('changed:chat.width', this.updateChatCSS, this);
		this.settings.main_context.on('changed:chat.use-width', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-size', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.font-family', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.lines.emote-alignment', this.updateChatCSS, this);
		this.chat.context.on('changed:chat.adjustment-mode', this.updateColors, this);
		this.chat.context.on('changed:chat.adjustment-contrast', this.updateColors, this);
		this.chat.context.on('changed:theme.is-dark', this.updateColors, this);
		this.chat.context.on('changed:chat.lines.borders', this.updateLineBorders, this);
		this.chat.context.on('changed:chat.filtering.highlight-mentions', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.filtering.highlight-tokens', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.filtering.mention-color', this.updateMentionCSS, this);
		this.chat.context.on('changed:chat.fix-bad-emotes', this.updateChatLines, this);
		this.chat.context.on('changed:chat.filtering.display-deleted', this.updateChatLines, this);
		this.chat.context.on('changed:chat.filtering.display-mod-action', this.updateChatLines, this);
		this.chat.context.on('changed:chat.filtering.clickable-mentions', val => this.css_tweaks.toggle('clickable-mentions', val));
		this.chat.context.on('changed:chat.pin-resubs', val => {
			if ( val ) {
				this.updateInlineCallouts();
				this.updatePinnedCallouts();
			}
		}, this);

		this.chat.context.on('changed:chat.lines.alternate', val => {
			this.css_tweaks.toggle('chat-rows', val);
			this.updateMentionCSS();
		});

		this.chat.context.on('changed:chat.lines.padding', val =>
			this.css_tweaks.toggle('chat-padding', val));

		this.chat.context.on('changed:chat.bits.show', val =>
			this.css_tweaks.toggle('hide-bits', !val));
		this.chat.context.on('changed:chat.bits.show-pinned', val =>
			this.css_tweaks.toggleHide('pinned-cheer', !val));

		this.chat.context.on('changed:chat.filtering.deleted-style', val => {
			this.css_tweaks.toggle('chat-deleted-strike', val === 1 || val === 2);
			this.css_tweaks.toggle('chat-deleted-fade', val < 2);
		});

		const val = this.chat.context.get('chat.filtering.deleted-style');
		this.css_tweaks.toggle('chat-deleted-strike', val === 1 || val === 2);
		this.css_tweaks.toggle('chat-deleted-fade', val < 2);

		this.css_tweaks.toggle('clickable-mentions', this.chat.context.get('chat.filtering.clickable-mentions'));

		this.css_tweaks.toggleHide('pinned-cheer', !this.chat.context.get('chat.bits.show-pinned'));
		this.css_tweaks.toggle('hide-bits', !this.chat.context.get('chat.bits.show'));
		this.css_tweaks.toggle('chat-rows', this.chat.context.get('chat.lines.alternate'));
		this.css_tweaks.toggle('chat-padding', this.chat.context.get('chat.lines.padding'));

		this.updateChatCSS();
		this.updateColors();
		this.updateLineBorders();
		this.updateMentionCSS();

		this.InlineCallout.on('mount', this.onInlineCallout, this);
		this.InlineCallout.on('update', this.onInlineCallout, this);
		this.InlineCallout.ready(() => this.updateInlineCallouts());

		this.PinnedCallout.on('mount', this.onPinnedCallout, this);
		this.PinnedCallout.on('update', this.onPinnedCallout, this);
		this.PinnedCallout.ready(() => this.updatePinnedCallouts());

		this.ChatController.on('mount', this.chatMounted, this);
		this.ChatController.on('unmount', this.chatUnmounted, this);
		this.ChatController.on('receive-props', this.chatUpdated, this);

		this.ChatService.ready((cls, instances) => {
			this.wrapChatService(cls);

			for(const inst of instances) {
				inst.client.events.removeAll();

				inst._ffzInstall();

				inst.connectHandlers();

				inst.props.setChatConnectionAPI({
					sendMessage: inst.sendMessage,
					_ffz_inst: inst
				});
			}
		});

		this.ChatBuffer.ready((cls, instances) => {
			this.wrapChatBuffer(cls);

			for(const inst of instances) {
				const handler = inst.props.messageHandlerAPI;
				if ( handler )
					handler.removeMessageHandler(inst.handleMessage);

				inst._ffzInstall();

				if ( handler )
					handler.addMessageHandler(inst.handleMessage);

				inst.props.setMessageBufferAPI({
					addUpdateHandler: inst.addUpdateHandler,
					removeUpdateHandler: inst.removeUpdateHandler,
					getMessages: inst.getMessages,
					isPaused: inst.isPaused,
					setPaused: inst.setPaused,
					hasNewerLeft: inst.hasNewerLeft,
					loadNewer: inst.loadNewer,
					loadNewest: inst.loadNewest,
					_ffz_inst: inst
				});
			}
		});

		this.ChatBufferConnector.on('mount', this.connectorMounted, this);
		this.ChatBufferConnector.on('receive-props', this.connectorUpdated, this);
		this.ChatBufferConnector.on('unmount', this.connectorUnmounted, this);

		this.ChatBufferConnector.ready((cls, instances) => {
			for(const inst of instances)
				this.connectorMounted(inst);
		})

		this.ChatController.ready((cls, instances) => {
			const t = this,
				old_catch = cls.prototype.componentDidCatch,
				old_render = cls.prototype.render;

			// Try catching errors. With any luck, maybe we can
			// recover from the error when we re-build?
			cls.prototype.componentDidCatch = function(err, info) {
				// Don't log infinitely if stuff gets super screwed up.
				const errs = this.state.ffz_errors || 0;
				if ( errs < 100 ) {
					this.setState({ffz_errors: errs + 1});
					t.log.info('Error within Chat', err, info, errs);
				}

				if ( old_catch )
					return old_catch.call(this, err, info);
			}

			cls.prototype.render = function() {
				if ( this.state.ffz_errors > 0 ) {
					const React = t.web_munch.getModule('react'),
						createElement = React && React.createElement;

					if ( ! createElement )
						return null;

					return createElement('div', {
						className: 'tw-border-l tw-c-background-alt-2 tw-c-text-base tw-full-width tw-full-height tw-align-items-center tw-flex tw-flex-column tw-justify-content-center tw-relative'
					}, 'There was an error displaying chat.');

				} else
					return old_render.call(this);
			}

			for(const inst of instances)
				this.chatMounted(inst);
		});


		this.ChatContainer.on('mount', this.containerMounted, this);
		this.ChatContainer.on('unmount', this.removeRoom, this);
		this.ChatContainer.on('update', this.containerUpdated, this);

		this.ChatContainer.ready((cls, instances) => {
			const t = this,
				old_catch = cls.prototype.componentDidCatch;

			// Try catching errors. With any luck, maybe we can
			// recover from the error when we re-build?
			cls.prototype.componentDidCatch = function(err, info) {
				// Don't log infinitely if stuff gets super screwed up.
				const errs = this.state.ffz_errors || 0;
				if ( errs < 100 ) {
					this.setState({ffz_errors: errs + 1});
					t.log.info('Error within Chat Container', err, info, errs);
				}

				if ( old_catch )
					return old_catch.call(this, err, info);
			}


			for(const inst of instances)
				this.containerMounted(inst);
		});


		this.PinnedCheer.on('mount', this.fixPinnedCheer, this);
		this.PinnedCheer.on('update', this.fixPinnedCheer, this);

		this.PinnedCheer.ready((cls, instances) => {
			for(const inst of instances)
				this.fixPinnedCheer(inst);
		});


		this.RoomPicker.ready((cls, instances) => {
			for(const inst of instances)
				this.closeRoomPicker(inst);
		});

		this.RoomPicker.on('mount', this.closeRoomPicker, this);
	}


	updatePinnedCallouts() {
		for(const inst of this.PinnedCallout.instances)
			this.onPinnedCallout(inst);
	}

	onPinnedCallout(inst) {
		if ( ! this.chat.context.get('chat.pin-resubs') || inst._ffz_pinned )
			return;

		const props = inst.props,
			event = props && props.event;
		if ( props.pinned || ! event || event.type !== 'share-resub' )
			return;

		this.log.info('Automatically pinning re-sub notice.');
		inst._ffz_pinned = true;
		inst.pin();
	}

	updateInlineCallouts() {
		for(const inst of this.InlineCallout.instances)
			this.onInlineCallout(inst);
	}

	onInlineCallout(inst) {
		if ( ! this.chat.context.get('chat.pin-resubs') || inst._ffz_pinned )
			return;

		const event = get('props.event.callout', inst);
		if ( ! event || event.cta !== 'Share' )
			return;

		const onPin = get('contextMenuProps.onPin', event);
		if ( ! onPin )
			return;

		this.log.info('Automatically pinning re-sub notice.');
		inst._ffz_pinned = true;

		if ( inst.hideOnContextMenuAction )
			inst.hideOnContextMenuAction(onPin)();
		else
			onPin();
	}


	tryUpdateBadges() {
		if ( !this._badge_timer )
			this._badge_timer = setTimeout(() => this._tryUpdateBadges(), 0);
	}

	_tryUpdateBadges() {
		if ( this._badge_timer )
			clearTimeout(this._badge_timer);
		this._badge_timer = null;

		this.log.info('Trying to update badge data from the chat container.');
		const inst = this.ChatContainer.first;
		if ( inst )
			this.containerUpdated(inst, inst.props);
	}


	closeRoomPicker(inst) { // eslint-disable-line class-methods-use-this
		inst.closeRoomPicker();
	}


	wrapChatBuffer(cls) {
		if ( cls.prototype._ffz_was_here )
			return;

		const t = this,
			old_clear = cls.prototype.clear,
			old_flush = cls.prototype.flushRawMessages,
			old_mount = cls.prototype.componentDidMount;

		cls.prototype._ffzInstall = function() {
			if ( this._ffz_installed )
				return;

			this._ffz_installed = true;

			const inst = this,
				old_handle = inst.handleMessage,
				old_set = inst.props.setMessageBufferAPI;

			inst.props.setMessageBufferAPI = function(api) {
				if ( api )
					api._ffz_inst = inst;

				return old_set(api);
			}

			inst.handleMessage = function(msg) {
				if ( msg ) {
					try {
						const types = t.chat_types || {},
							mod_types = t.mod_types || {};

						if ( msg.type === types.RewardGift && ! t.chat.context.get('chat.bits.show-rewards') )
							return;

						if ( msg.type === types.Message ) {
							const m = t.chat.standardizeMessage(msg),
								cont = inst._ffz_connector,
								room_id = cont && cont.props.channelID;

							let room = m.roomLogin = m.roomLogin ? m.roomLogin : m.channel ? m.channel.slice(1) : cont && cont.props.channelLogin;

							if ( ! room && room_id ) {
								const r = t.chat.getRoom(room_id, null, true);
								if ( r && r.login )
									room = m.roomLogin = r.login;
							}

							const u = t.site.getUser(),
								r = {id: room_id, login: room};

							if ( u && cont ) {
								u.moderator = cont.props.isCurrentUserModerator;
								u.staff = cont.props.isStaff;
							}

							m.ffz_tokens = m.ffz_tokens || t.chat.tokenizeMessage(m, u, r);

							const event = new FFZEvent({
								message: m,
								channel: room,
								channelID: room_id
							});

							t.emit('chat:receive-message', event);
							if ( event.defaultPrevented || m.ffz_removed )
								return;

						} else if ( msg.type === types.ModerationAction && inst.markUserEventDeleted && inst.unsetModeratedUser ) {
							//t.log.info('Moderation Action', msg);
							if ( ! inst.props.isCurrentUserModerator )
								return;

							const mod_action = msg.moderationActionType;
							if ( mod_action === 'ban' || mod_action === 'timeout' || mod_action === 'delete' ) {
								const user = msg.targetUserLogin;
								if ( inst.moderatedUsers.has(user) )
									return;

								const do_remove = t.chat.context.get('chat.filtering.remove-deleted') === 3;
								if ( do_remove ) {
									const len = inst.buffer.length,
										target_id = msg.messageID;
									inst.buffer = inst.buffer.filter(m =>
										m.type !== types.Message || ! m.user || m.user.userLogin !== user ||
										(target_id && m.id !== target_id)
									);
									if ( len !== inst.buffer.length && ! inst.props.isBackground )
										inst.notifySubscribers();

									inst.ffzModerateBuffer([inst.delayedMessageBuffer], msg);

								} else
									inst.ffzModerateBuffer([inst.buffer, inst.delayedMessageBuffer], msg);

								inst.moderatedUsers.add(user);
								setTimeout(inst.unsetModeratedUser(user), 1e3);

								inst.delayedMessageBuffer.push({
									event: msg,
									time: Date.now(),
									shouldDelay: false
								});

								return;
							}

						} else if ( msg.type === types.Moderation && inst.markUserEventDeleted && inst.unsetModeratedUser ) {
							//t.log.info('Moderation', msg);
							if ( inst.props.isCurrentUserModerator )
								return;

							const user = msg.userLogin;
							if ( inst.moderatedUsers.has(user) )
								return;

							const mod_action = msg.moderationType;
							let new_action;
							if ( mod_action === mod_types.Ban )
								new_action = 'ban';
							else if ( mod_action === mod_types.Delete )
								new_action = 'delete';
							else if ( mod_action === mod_types.Unban )
								new_action = 'unban';
							else if ( mod_action === mod_types.Timeout )
								new_action = 'timeout';

							if ( new_action )
								msg.moderationActionType = new_action;

							const do_remove = t.chat.context.get('chat.filtering.remove-deleted') === 3;
							if ( do_remove ) {
								const len = inst.buffer.length,
									target_id = msg.targetMessageID;
								inst.buffer = inst.buffer.filter(m =>
									m.type !== types.Message || ! m.user || m.user.userLogin !== user ||
									(target_id && m.id !== target_id)
								);
								if ( len !== inst.buffer.length && ! inst.props.isBackground )
									inst.notifySubscribers();

								inst.ffzModerateBuffer([inst.delayedMessageBuffer], msg);

							} else
								inst.ffzModerateBuffer([inst.buffer, inst.delayedMessageBuffer], msg);

							inst.moderatedUsers.add(user);
							setTimeout(inst.unsetModeratedUser(user), 1e3);

							inst.delayedMessageBuffer.push({
								event: msg,
								time: Date.now(),
								shouldDelay: false
							});

							return;

						} else if ( msg.type === types.Clear ) {
							if ( t.chat.context.get('chat.filtering.ignore-clear') )
								msg = {
									type: types.Info,
									message: t.i18n.t('chat.ignore-clear', 'An attempt by a moderator to clear chat was ignored.')
								}
						}

					} catch(err) {
						t.log.error('Error processing chat event.', err);
						t.log.capture(err, {extra: {msg}});
					}
				}

				return old_handle.call(inst, msg);
			}

			inst.ffzModerateBuffer = function(buffers, event) {
				const mod_types = t.mod_types || {},
					mod_type = event.moderationActionType,
					user_login = event.targetUserLogin || event.userLogin,
					mod_login = event.createdByLogin,
					target_id = event.targetMessageID || event.messageID;

				let deleted_count = 0, last_msg;

				const is_delete = mod_type === mod_types.Delete,
					updater = m => {
						if ( m.event )
							m = m.event;

						if ( target_id && m.id !== target_id )
							return;

						const msg = inst.markUserEventDeleted(m, user_login);
						if ( ! msg )
							return;

						last_msg = msg;
						deleted_count++;

						msg.modLogin = mod_login;
						msg.modActionType = mod_type;
						msg.duration = event.duration;

						if ( is_delete )
							return true;
					};

				for(const buffer of buffers)
					if ( buffer.some(updater) )
						break;

				//t.log.info('Moderate Buffer', mod_type, user_login, mod_login, target_id, deleted_count, last_msg);

				if ( last_msg )
					last_msg.deletedCount = deleted_count;
			}

			inst.setPaused = function(paused) {
				if ( inst.paused === paused )
					return;

				inst.paused = paused;
				if ( ! paused ) {
					inst.slidingWindowEnd = Math.min(inst.buffer.length, t.chat.context.get('chat.scrollback-length'));
					if ( ! inst.props.isBackground )
						inst.notifySubscribers();
				}
			}

			inst.loadNewer = function() {
				if ( ! inst.hasNewerLeft() )
					return;

				const end = Math.min(inst.buffer.length, inst.slidingWindowEnd + 40),
					start = Math.max(0, end - t.chat.context.get('chat.scrollback-length'));

				inst.clear(inst.buffer.length - start);
				inst.slidingWindowEnd = end - start;
				if ( ! inst.props.isBackground )
					inst.notifySubscribers();
			}

			inst.loadNewest = function() {
				if ( ! inst.hasNewerLeft() )
					return;

				const max_size = t.chat.context.get('chat.scrollback-length');

				inst.clear(max_size);
				inst.slidingWindowEnd = Math.min(max_size, inst.buffer.length);
				if ( ! inst.props.isBackground )
					inst.notifySubscribers();
			}

			inst.getMessages = function() {
				return inst.buffer.slice(0, inst.slidingWindowEnd + (inst.ffz_extra || 0));
			}
		}

		cls.prototype.componentDidMount = function() {
			try {
				this._ffzInstall();
			} catch(err) {
				t.log.error('Error installing FFZ features onto chat buffer.', err);
			}

			return old_mount.call(this);
		}

		cls.prototype.clear = function(count) {
			try {
				if ( count == null )
					count = 0;

				const max_size = t.chat.context.get('chat.scrollback-length');
				if ( ! this.isPaused() && count > max_size )
					count = max_size;

				if ( count <= 0 ) {
					this.ffz_extra = 0;
					this.buffer = [];
					this.delayedMessageBuffer = [];
					this.paused = false;

				} else {
					const buffer = this.buffer,
						ct = t.chat_types || CHAT_TYPES,
						target = buffer.length - count;

					if ( target > 0 ) {
						let removed = 0, last;
						for(let i=0; i < target; i++)
							if ( buffer[i] && ! NULL_TYPES.includes(ct[buffer[i].type]) ) {
								removed++;
								last = i;
							}

						// When we remove less then expected, we want to keep track
						// of that so we can return the extra messages from getMessages.
						this.buffer = buffer.slice(removed % 2 !== 0 ? Math.max(target - 4, last) : target);
						this.ffz_extra = buffer.length - count;

					} else {
						this.ffz_extra = 0;
						this.buffer = this.buffer.slice(0);
					}

					if ( this.paused && this.buffer.length >= 900 )
						this.setPaused(false);
				}
			} catch(err) {
				t.log.error('Error running clear', err);
				return old_clear.call(this, count);
			}
		}

		cls.prototype.flushRawMessages = function() {
			try {
				const out = [],
					now = Date.now(),
					raw_delay = t.chat.context.get('chat.delay'),
					delay = raw_delay === -1 ? this.delayDuration : raw_delay,
					first = now - delay,
					see_deleted = this.shouldSeeBlockedAndDeletedMessages || this.props && this.props.shouldSeeBlockedAndDeletedMessages,
					has_newer = this.hasNewerLeft(),
					paused = this.isPaused(),
					max_size = t.chat.context.get('chat.scrollback-length'),
					do_remove = t.chat.context.get('chat.filtering.remove-deleted');

				let added = 0,
					buffered = this.slidingWindowEnd,
					changed = false;

				for(const msg of this.delayedMessageBuffer) {
					if ( msg.time <= first || ! msg.shouldDelay ) {
						if ( do_remove !== 0 && (do_remove > 1 || ! see_deleted) && this.isDeletable(msg.event) && msg.event.deleted )
							continue;

						this.buffer.push(msg.event);
						changed = true;

						if ( ! this.paused ) {
							if ( this.buffer.length > max_size )
								added++;
							else
								buffered++;
						}

					} else
						out.push(msg);
				}

				this.delayedMessageBuffer = out;
				if ( changed ) {
					this.clear(Math.min(900, this.buffer.length - added));
					if ( !(added === 0 && buffered === this.slidingWindowEnd && has_newer === this.hasNewerLeft() && paused === this.isPaused()) ) {
						this.slidingWindowEnd = buffered;
						if ( ! this.props.isBackground )
							this.notifySubscribers();
					}
				}
			} catch(err) {
				t.log.error('Error running flush.', err);
				return old_flush.call(this);
			}
		}
	}


	sendMessage(room, message) {
		const service = this.ChatService.first;

		if ( ! service || ! room )
			return null;

		if ( room.startsWith('#') )
			room = room.slice(1);

		if ( room.toLowerCase() !== service.props.channelLogin.toLowerCase() )
			return service.client.sendCommand(room, message);

		service.sendMessage(message);
	}


	wrapChatService(cls) {
		const t = this,
			old_mount = cls.prototype.componentDidMount,
			old_handler = cls.prototype.connectHandlers;

		cls.prototype._ffz_was_here = true;

		cls.prototype.ffzGetEmotes = function() {
			const emote_map = this.client && this.client.session && this.client.session.emoteMap;
			if ( this._ffz_cached_map === emote_map )
				return this._ffz_cached_emotes;

			this._ffz_cached_map = emote_map;
			const emotes = this._ffz_cached_emotes = {};

			if ( emote_map )
				for(const emote of Object.values(emote_map))
					if ( emote ) {
						const token = emote.token;
						if ( Array.isArray(REGEX_EMOTES[token]) ) {
							for(const tok of REGEX_EMOTES[token] )
								emotes[tok] = emote.id;

						} else
							emotes[token] = emote.id;
					}

			return emotes;
		}


		cls.prototype._ffzInstall = function() {
			if ( this._ffz_installed )
				return;

			this._ffz_installed = true;

			const inst = this,
				old_send = this.sendMessage;

			inst.sendMessage = function(raw_msg) {
				const msg = raw_msg.replace(/\n/g, '');

				if ( msg.startsWith('/ffz') ) {
					inst.addMessage({
						type: t.chat_types.Notice,
						message: 'The /ffz command is not yet re-implemented.'
					})

					return false;
				}

				const event = new FFZEvent({
					message: msg,
					channel: inst.props.channelLogin
				});

				t.emit('chat:pre-send-message', event);

				if ( event.defaultPrevented )
					return;

				return old_send.call(this, msg);
			}
		}


		cls.prototype.componentDidMount = function() {
			try {
				this._ffzInstall();
			} catch(err) {
				t.log.error('Error installing FFZ features onto chat service.', err);
			}

			return old_mount.call(this);
		}


		cls.prototype.connectHandlers = function(...args) {
			if ( ! this._ffz_init ) {
				const i = this;

				for(const key of MISBEHAVING_EVENTS) {
					const original = this[key];
					if ( original )
						this[key] = function(e, t) {
							i._wrapped = e;
							const ret = original.call(i, e, t);
							i._wrapped = null;
							return ret;
						}
				}

				const old_chat = this.onChatMessageEvent;
				this.onChatMessageEvent = function(e) {
					if ( e && e.sentByCurrentUser ) {
						try {
							e.message.user.emotes = findEmotes(
								e.message.body,
								i.ffzGetEmotes()
							);

						} catch(err) {
							t.log.capture(err, {extra: e});
						}
					}

					return old_chat.call(i, e);
				}


				const old_action = this.onChatActionEvent;
				this.onChatActionEvent = function(e) {
					if ( e && e.sentByCurrentUser ) {
						try {
							e.message.user.emotes = findEmotes(
								e.message.body,
								i.ffzGetEmotes()
							);

						} catch(err) {
							t.log.capture(err, {extra: e});
						}
					}

					return old_action.call(i, e);
				}


				const old_sub = this.onSubscriptionEvent;
				this.onSubscriptionEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.subs.show') < 3 )
							return;

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'resub';
						out.sub_plan = e.methods;
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_sub.call(i, e);
					}
				}

				const old_resub = this.onResubscriptionEvent;
				this.onResubscriptionEvent = function(e) {
					try {
						if ( t.chat.context.get('chat.subs.show') < 2 && ! e.body )
							return;

						const out = i.convertMessage({message: e});
						out.ffz_type = 'resub';
						out.sub_cumulative = e.cumulativeMonths || 0;
						out.sub_streak = e.streakMonths || 0;
						out.sub_share_streak = e.shouldShareStreakTenure;
						out.sub_months = e.months;
						out.sub_plan = e.methods;

						//t.log.info('Resub Event', e, out);

						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_resub.call(i, e);
					}
				}

				const mysteries = this.ffz_mysteries = {};

				const old_subgift = this.onSubscriptionGiftEvent;
				this.onSubscriptionGiftEvent = function(e) {
					try {
						const key = `${e.channel}:${e.user.userID}`,
							mystery = mysteries[key];

						if ( mystery ) {
							if ( mystery.expires < Date.now() ) {
								mysteries[key] = null;
							} else {
								mystery.recipients.push({
									id: e.recipientID,
									login: e.recipientLogin,
									displayName: e.recipientName
								});

								if( mystery.recipients.length >= mystery.size )
									mysteries[key] = null;

								if ( mystery.line )
									mystery.line.forceUpdate();

								return;
							}
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_gift';
						out.sub_recipient = {
							id: e.recipientID,
							login: e.recipientLogin,
							displayName: e.recipientName
						};
						out.sub_plan = e.methods;
						out.sub_total = e.senderCount;

						//t.log.info('Sub Gift', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_subgift.call(i, e);
					}
				}

				const old_anonsubgift = this.onAnonSubscriptionGiftEvent;
				this.onAnonSubscriptionGiftEvent = function(e) {
					try {
						const key = `${e.channel}:ANON`,
							mystery = mysteries[key];

						if ( mystery ) {
							if ( mystery.expires < Date.now() )
								mysteries[key] = null;
							else {
								mystery.recipients.push({
									id: e.recipientID,
									login: e.recipientLogin,
									displayName: e.recipientName
								});

								if( mystery.recipients.length >= mystery.size )
									mysteries[key] = null;

								if ( mystery.line )
									mystery.line.forceUpdate();

								return;
							}
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_gift';
						out.sub_anon = true;
						out.sub_recipient = {
							id: e.recipientID,
							login: e.recipientLogin,
							displayName: e.recipientName
						};
						out.sub_plan = e.methods;
						out.sub_total = e.senderCount;

						//t.log.info('Anon Sub Gift', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_anonsubgift.call(i, e);
					}
				}

				const old_submystery = this.onSubscriptionMysteryGiftEvent;
				this.onSubscriptionMysteryGiftEvent = function(e) {
					try {
						let mystery = null;
						if ( e.massGiftCount > t.chat.context.get('chat.subs.merge-gifts') ) {
							const key = `${e.channel}:${e.user.userID}`;
							mystery = mysteries[key] = {
								recipients: [],
								size: e.massGiftCount,
								expires: Date.now() + 30000
							};
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_mystery';
						out.mystery = mystery;
						out.sub_plan = e.plan;
						out.sub_count = e.massGiftCount;
						out.sub_total = e.senderCount;

						//t.log.info('Sub Mystery', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_submystery.call(i, e);
					}
				}

				const old_anonsubmystery = this.onAnonSubscriptionMysteryGiftEvent;
				this.onAnonSubscriptionMysteryGiftEvent = function(e) {
					try {
						let mystery = null;
						if ( e.massGiftCount > t.chat.context.get('chat.subs.merge-gifts') ) {
							const key = `${e.channel}:ANON`;
							mystery = mysteries[key] = {
								recipients: [],
								size: e.massGiftCount,
								expires: Date.now() + 30000
							};
						}

						e.body = '';
						const out = i.convertMessage({message: e});
						out.ffz_type = 'sub_mystery';
						out.sub_anon = true;
						out.mystery = mystery;
						out.sub_plan = e.plan;
						out.sub_count = e.massGiftCount;
						out.sub_total = e.senderCount;

						//t.log.info('Anon Sub Mystery', e, out);
						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_anonsubmystery.call(i, e);
					}
				}

				const old_ritual = this.onRitualEvent;
				this.onRitualEvent = function(e) {
					try {
						const out = i.convertMessage(e);
						out.ffz_type = 'ritual';
						out.ritual = e.type;

						return i.postMessageToCurrentChannel(e, out);

					} catch(err) {
						t.log.capture(err, {extra: e});
						return old_ritual.call(i, e);
					}
				}

				const old_host = this.onHostingEvent;
				this.onHostingEvent = function (e, _t) {
					t.emit('tmi:host', e, _t);
					return old_host.call(i, e, _t);
				}

				const old_unhost = this.onUnhostEvent;
				this.onUnhostEvent = function (e, _t) {
					t.emit('tmi:unhost', e, _t);
					return old_unhost.call(i, e, _t);
				}

				const old_add = this.addMessage;
				this.addMessage = function(e) {
					const original = i._wrapped;
					if ( original && ! e._ffz_checked )
						return i.postMessageToCurrentChannel(original, e);

					return old_add.call(i, e);
				}

				this._ffz_init = true;
			}

			return old_handler.apply(this, ...args);
		}

		cls.prototype.postMessageToCurrentChannel = function(original, message) {
			message._ffz_checked = true;

			if ( original.channel ) {
				let chan = message.channel = original.channel.toLowerCase();
				if ( chan.startsWith('#') )
					chan = chan.slice(1);

				if ( chan !== this.props.channelLogin.toLowerCase() )
					return;

				message.roomLogin = chan;
			}

			if ( original.message ) {
				const user = original.message.user,
					flags = original.message.flags;
				if ( user )
					message.emotes = user.emotes;

				if ( flags && this.getFilterFlagOptions )
					message.flags = this.getFilterFlagOptions(flags);

				if ( typeof original.action === 'string' )
					message.message = original.action;
				else
					message.message = original.message.body;
			}

			this.addMessage(message);
		}
	}


	updateChatLines() {
		this.PinnedCheer.forceUpdate();
		this.chat_line.updateLines();
	}


	// ========================================================================
	// Pinned Cheers
	// ========================================================================

	fixPinnedCheer(inst) {
		const el = this.fine.getChildNode(inst),
			container = el && el.querySelector && el.querySelector('.pinned-cheer__headline'),
			tc = inst.props.topCheer;

		if ( ! container || ! tc )
			return;

		container.dataset.roomId = inst.props.channelID;
		container.dataset.room = inst.props.channelLogin && inst.props.channelLogin.toLowerCase();
		container.dataset.userId = tc.user.userID;
		container.dataset.user = tc.user.userLogin && tc.user.userLogin.toLowerCase();

		if ( tc.user.color ) {
			const user_el = container.querySelector('.chat-author__display-name');
			if ( user_el )
				user_el.style.color = this.colors.process(tc.user.color);

			const login_el = container.querySelector('.chat-author__intl-login');
			if ( login_el )
				login_el.style.color = this.colors.process(tc.user.color);
		}

		const bit_el = container.querySelector('.chat-line__message--emote'),
			cont = bit_el ? bit_el.parentElement.parentElement : container.querySelector('.ffz--pinned-top-emote'),
			prefix = extractCheerPrefix(tc.messageParts);

		if ( cont && prefix ) {
			const tokens = this.chat.tokenizeString(`${prefix}${tc.bits}`, tc);

			cont.classList.add('ffz--pinned-top-emote');
			cont.innerHTML = '';
			setChildren(cont, this.chat.renderTokens(tokens));
		}
	}


	// ========================================================================
	// Room Handling
	// ========================================================================

	addRoom(thing, props) {
		if ( ! props )
			props = thing.props;

		if ( ! props.channelID )
			return null;

		const room = thing._ffz_room = this.chat.getRoom(props.channelID, props.channelLogin && props.channelLogin.toLowerCase(), false, true);
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
		if ( chat.chatBuffer )
			chat.chatBuffer.ffzController = chat;

		if ( ! props )
			props = chat.props;

		if ( ! this.addRoom(chat, props) )
			return;

		this.updateRoomBitsConfig(chat, props.bitsConfig);

		// TODO: Check if this is the room for the current channel.

		this.settings.updateContext({
			moderator: props.isCurrentUserModerator,
			chatHidden: props.isHidden
		});

		if ( props.isEmbedded || props.isPopout )
			this.settings.updateContext({
				channel: props.channelLogin && props.channelLogin.toLowerCase(),
				channelID: props.channelID
			});

		this.chat.context.updateContext({
			moderator: props.isCurrentUserModerator,
			channel: props.channelLogin && props.channelLogin.toLowerCase(),
			channelID: props.channelID,
			/*ui: {
				theme: props.theme
			}*/
		});
	}


	chatUnmounted(chat) {
		if ( chat.chatBuffer && chat.chatBuffer.ffzController === this )
			chat.chatBuffer.ffzController = null;

		if ( chat.props.isEmbedded || chat.props.isPopout )
			this.settings.updateContext({
				channel: null,
				channelID: null
			});

		this.chat.context.updateContext({
			moderator: false,
			channel: null,
			channelID: null
		});

		this.removeRoom(chat);
	}


	chatUpdated(chat, props) {
		if ( chat.chatBuffer )
			chat.chatBuffer.ffzController = chat;

		if ( ! chat._ffz_room || props.channelID != chat._ffz_room.id ) {
			this.removeRoom(chat);
			if ( chat._ffz_mounted )
				this.chatMounted(chat, props);
			return;
		}

		if ( props.bitsConfig !== chat.props.bitsConfig )
			this.updateRoomBitsConfig(chat, props.bitsConfig);

		// TODO: Check if this is the room for the current channel.

		if ( props.isEmbedded || props.isPopout )
			this.settings.updateContext({
				channel: props.channelLogin && props.channelLogin.toLowerCase(),
				channelID: props.channelID
			});

		this.settings.updateContext({
			moderator: props.isCurrentUserModerator,
			chatHidden: props.isHidden
		});

		this.chat.context.updateContext({
			moderator: props.isCurrentUserModerator,
			channel: props.channelLogin && props.channelLogin.toLowerCase(),
			channelID: props.channelID,
			/*ui: {
				theme: props.theme
			}*/
		});
	}


	updateRoomBitsConfig(chat, config) { // eslint-disable-line class-methods-use-this
		const room = chat._ffz_room;
		if ( ! room )
			return;

		// We have to check that the available cheers haven't changed
		// to avoid doing too many recalculations.
		let new_bits = null;
		if ( config && Array.isArray(config.orderedActions) ) {
			new_bits = new Set;
			for(const action of config.orderedActions)
				if ( action && action.prefix )
					new_bits.add(action.prefix);
		}

		if ( (! this._ffz_old_bits && ! new_bits) || set_equals(this._ffz_old_bits, new_bits) )
			return;

		this._ffz_old_bits = new_bits;

		room.updateBitsConfig(formatBitsConfig(config));
		this.updateChatLines();
	}


	// ========================================================================
	// Chat Buffer Connector
	// ========================================================================

	connectorMounted(inst) { // eslint-disable-line class-methods-use-this
		const buffer = inst.props.messageBufferAPI;
		if ( buffer && buffer._ffz_inst && buffer._ffz_inst._ffz_connector !== inst )
			buffer._ffz_inst._ffz_connector = inst;
	}

	connectorUpdated(inst, props) { // eslint-disable-line class-methods-use-this
		const buffer = inst.props.messageBufferAPI,
			new_buffer = props.messageBufferAPI;

		if ( buffer === new_buffer )
			return;

		if ( buffer && buffer._ffz_inst && buffer._ffz_inst._ffz_connector === inst )
			buffer._ffz_inst._ffz_connector = null;

		if ( new_buffer && new_buffer._ffz_inst && new_buffer._ffz_inst._ffz_connector !== inst )
			buffer._ffz_inst._ffz_connector = inst;
	}

	connectorUnmounted(inst) { // eslint-disable-line class-methods-use-this
		const buffer = inst.props.messageBufferAPI;
		if ( buffer && buffer._ffz_inst && buffer._ffz_inst._ffz_connector === inst )
			buffer._ffz_inst._ffz_connector = null;
	}


	// ========================================================================
	// Chat Containers
	// ========================================================================

	containerMounted(cont, props) {
		if ( ! props )
			props = cont.props;

		if ( ! this.addRoom(cont, props) )
			return;

		if ( props.data ) {
			this.chat.badges.updateTwitchBadges(props.data.badges);
			this.updateRoomBadges(cont, props.data.user && props.data.user.broadcastBadges);
			this.updateRoomRules(cont, props.chatRules);
		}
	}


	containerUpdated(cont, props) {
		// If we don't have a room, or if the room ID doesn't match our ID
		// then we need to just create a new Room because the chat room changed.
		if ( ! cont._ffz_room || props.channelID != cont._ffz_room.id ) {
			this.removeRoom(cont);
			if ( cont._ffz_mounted )
				this.containerMounted(cont, props);
			return;
		}

		// Twitch, React, and Apollo are the trifecta of terror so we
		// can't compare the badgeSets property in any reasonable way.
		// Instead, just check the lengths to see if they've changed
		// and hope that badge versions will never change separately.
		const data = props.data || {},
			odata = cont.props.data || {},

			bs = data.badges || [],
			obs = odata.badges || [],

			cs = data.user && data.user.broadcastBadges || [],
			ocs = odata.user && odata.user.broadcastBadges || [];

		if ( this.chat.badges.getTwitchBadgeCount() !== bs.length || bs.length !== obs.length )
			this.chat.badges.updateTwitchBadges(bs);

		if ( cont._ffz_room.badgeCount() !== cs.length || cs.length !== ocs.length )
			this.updateRoomBadges(cont, cs);

		this.updateRoomRules(cont, props.chatRules);
	}

	hasRoomBadges(cont) { // eslint-disable-line class-methods-use-this
		const room = cont._ffz_room;
		if ( ! room )
			return false;

		return room.hasBadges();
	}

	updateRoomBadges(cont, badges) { // eslint-disable-line class-methods-use-this
		const room = cont._ffz_room;
		if ( ! room )
			return;

		room.updateBadges(badges);
		this.updateChatLines();
	}

	updateRoomRules(cont, rules) { // eslint-disable-line class-methods-use-this
		const room = cont._ffz_room;
		if ( ! room )
			return;

		room.rules = rules;
	}
}


// ============================================================================
// Processing Functions
// ============================================================================

export function formatBitsConfig(config) {
	if ( ! config )
		return;

	const out = {},
		actions = config.indexedActions;

	for(const key in actions)
		if ( has(actions, key) ) {
			const action = actions[key],
				new_act = out[key] = {
					id: action.id,
					prefix: action.prefix,
					tiers: []
				};

			for(const tier of action.orderedTiers) {
				const images = {};
				for(const im of tier.images) {
					const themed = images[im.theme] = images[im.theme] || [],
						ak = im.isAnimated ? 'animated' : 'static',
						anim = themed[ak] = themed[ak] || {};

					anim[im.dpiScale] = im.url;
				}

				new_act.tiers.push({
					amount: tier.bits,
					color: tier.color,
					id: tier.id,
					images
				})
			}
		}

	return out;
}


export function findEmotes(msg, emotes) {
	const out = {};
	let idx = 0;

	for(const part of msg.split(' ')) {
		const len = split_chars(part).length;

		if ( has(emotes, part) ) {
			const em = emotes[part],
				matches = out[em] = out[em] || [];

			matches.push({
				startIndex: idx,
				endIndex: idx + len - 1
			});
		}

		idx += len + 1;
	}

	return out;
}


function extractCheerPrefix(parts) {
	for(const part of parts) {
		if ( part.type !== 3 || ! part.content.cheerAmount )
			continue;

		return part.content.alt;
	}

	return null;
}
