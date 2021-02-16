'use strict';

// ============================================================================
// Chat Scroller
// ============================================================================

import Twilight from 'site';
import Module from 'utilities/module';

const SCROLL_EVENTS = [
	'touchmove',
	'scroll',
	'wheel',
	'mousewheel',
	'DOMMouseScroll'
];

let last_id = 0;

export default class Scroller extends Module {
	constructor(...args) {
		super(...args);

		this.inject('settings');
		this.inject('i18n');
		this.inject('chat');
		this.inject('site.fine');
		this.inject('site.web_munch');

		this.ChatScroller = this.fine.define(
			'chat-scroller',
			n => n.saveScrollRef && n.handleScrollEvent && ! n.renderLines && n.resume,
			Twilight.CHAT_ROUTES
		);

		this.settings.add('chat.scroller.freeze', {
			default: 0,
			ui: {
				path: 'Chat > Behavior >> Scrolling',
				title: 'Pause Chat Scrolling',
				description: 'Automatically stop chat from scrolling when moving the mouse over it or holding a key.\n\n**Note:** Scrolling up in chat will always prevent automatic scrolling, regardless of this setting.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Use Twitch Setting'},
					{value: 1, title: 'On Hover'},
					{value: 2, title: 'When Ctrl is Held'},
					{value: 3, title: 'When Meta is Held'},
					{value: 4, title: 'When Alt is Held'},
					{value: 5, title: 'When Shift is Held'},
					{value: 6, title: 'Ctrl or Hover'},
					{value: 7, title: 'Meta or Hover'},
					{value: 8, title: 'Alt or Hover'},
					{value: 9, title: 'Shift or Hover'}
				]
			}
		});

		this.settings.add('chat.scroller.freeze-requires-hover', {
			default: true,
			ui: {
				path: 'Chat > Behavior >> Scrolling',
				title: 'Require the mouse to be over chat to freeze with a hotkey.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.scroller.hover-delay', {
			default: 750,
			ui: {
				path: 'Chat > Behavior >> Scrolling',
				title: 'Hover Timeout',
				description: 'Chat will only remain frozen due to mouse hovering for this long after the mouse stops moving.',
				component: 'setting-combo-box',
				data: [
					{value: 250, title: '0.25 Seconds'},
					{value: 500, title: '0.50 Seconds'},
					{value: 750, title: '0.75 Seconds'},
					{value: 1000, title: '1 Second'},
					{value: 2500, title: '2.5 Seconds'},
					{value: 5000, title: '5 Seconds'}
				]
			}
		});

		this.settings.add('chat.scroller.smooth-scroll', {
			default: 0,
			ui: {
				path: 'Chat > Behavior >> Scrolling',
				title: 'Smooth Scrolling',
				description: '**Note:** This may not behave well depending on your browser. Disable this if you encounter issues.\n\nSmoothly slide new chat messages into view. Speed will increase as necessary to keep up with chat.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
					{value: 1, title: 'Slow'},
					{value: 2, title: 'Medium'},
					{value: 3, title: 'Fast'},
					{value: 4, title: 'Very Fast'}
				]
			}
		});
	}

	updateUseKeys() {
		const old_use = this.use_keys;
		this.use_keys = false;
		for(const act of this.chat.context.get('chat.actions.inline'))
			if ( act && act.display && act.display.keys ) {
				this.use_keys = true;
				break;
			}

		if ( this.use_keys !== old_use ) {
			for(const inst of this.ChatScroller.instances)
				inst && inst.ffzUpdateKeys && inst.ffzUpdateKeys();
		}
	}

	async onEnable() {
		this.on('i18n:update', () => this.ChatScroller.forceUpdate());

		this.chat.context.on('changed:chat.actions.inline', this.updateUseKeys, this);
		this.updateUseKeys();

		this.pause_hover = this.chat.context.get('chat.scroller.freeze-requires-hover');
		this.chat.context.on('changed:chat.scroller.freeze-requires-hover', val => {
			this.pause_hover = val;

			for(const inst of this.ChatScroller.instances)
				inst.ffzMaybeUnpause();
		})

		this.pause_delay = this.chat.context.get('chat.scroller.hover-delay');
		this.chat.context.on('changed:chat.scroller.hover-delay', val => {
			this.pause_delay = val;

			for(const inst of this.ChatScroller.instances)
				inst.ffzMaybeUnpause();
		})

		this.pause = this.chat.context.get('chat.scroller.freeze');
		this.chat.context.on('changed:chat.scroller.freeze', val => {
			this.pause = val;

			for(const inst of this.ChatScroller.instances)
				inst.ffzMaybeUnpause();
		});

		this.smooth_scroll = this.chat.context.get('chat.scroller.smooth-scroll');
		this.chat.context.on('changed:chat.scroller.smooth-scroll', val => {
			this.smooth_scroll = val;

			for(const inst of this.ChatScroller.instances)
				inst.ffzSetSmoothScroll(val);
		});

		const t = this,
			React = await this.web_munch.findModule('react'),
			createElement = React && React.createElement;

		if ( ! createElement )
			return t.log.warn(`Unable to get React.`);

		this.ChatScroller.ready((cls, instances) => {
			const old_catch = cls.prototype.componentDidCatch,
				old_render = cls.prototype.render;

			// Try catching errors. With any luck, maybe we can
			// recover from the error when we re-build?
			cls.prototype.componentDidCatch = function(err, info) {
				// Don't log infinitely if stuff gets super screwed up.
				const errs = this.state.ffz_errors || 0;
				if ( errs < 100 ) {
					this.setState({
						ffz_errors: errs + 1,
						ffz_total_errors: (this.state.ffz_total_errors||0) + 1
					});

					t.log.capture(err, {extra: info});
					t.log.info('Error within Chat', err, info, errs);
				}

				if ( old_catch )
					return old_catch.call(this, err, info);
			}

			cls.prototype.ffzZeroErrors = function() {
				this.setState({ffz_errors: 0});
			}

			cls.prototype.render = function() {
				if ( this.state.ffz_errors > 0 ) {
					let timer;
					const auto = this.state.ffz_total_errors < 10,
						handler = () => {
							clearTimeout(timer);
							this.ffzZeroErrors();
						}

					if ( auto )
						timer = setTimeout(handler, 250);

					if ( ! createElement )
						return null;

					return createElement('div', {
						className: 'tw-border-l tw-c-background-alt-2 tw-c-text-base tw-full-width tw-full-height tw-align-items-center tw-flex tw-flex-column tw-justify-content-center tw-relative'
					}, [
						createElement('div', {className: 'tw-mg-b-1'}, 'There was an error displaying chat.'),
						! auto && createElement('button', {
							className: 'tw-button',
							onClick: handler
						}, createElement('span', {className: 'tw-button__text'}, 'Try Again'))
					]);

				} else {
					const out = old_render.call(this);

					try {
						const children = out?.props?.children?.props?.children,
							child = children?.[2];

						if ( child?.type?.displayName === 'ChatPausedFooter' )
							children[2] = this.ffzRenderFooter();
					} catch(err) { /* no-op */ }

					return out;
				}
			}

			cls.prototype.ffzInstallHandler = function() {
				if ( this._ffz_installed )
					return;

				this._ffz_installed = true;
				const inst = this;

				inst.ffz_oldScrollEvent = inst.handleScrollEvent;
				inst.ffz_oldScroll = inst.scrollToBottom;

				inst.ffz_acting = false;
				inst.ffz_outside = true;
				inst._ffz_accessor = `_ffz_contains_${last_id++}`;

				t.on('tooltips:mousemove', this.ffzTooltipHover, this);
				t.on('tooltips:leave', this.ffzTooltipLeave, this);

				inst.scrollToBottom = function() {
					if ( inst._ffz_scroll_request )
						return;

					inst._ffz_scroll_request = requestAnimationFrame(inst._scrollToBottom);
				}

				inst._scrollToBottom = function() {
					inst._ffz_scroll_request = null;
					//inst._ffz_snapshot = null;
					if ( ! inst.state.isPaused ) {
						if ( inst.ffz_smooth_scroll && ! inst._ffz_one_fast_scroll )
							inst.ffzSmoothScroll();
						else {
							inst._ffz_one_fast_scroll = false;
							inst.ffz_oldScroll();
						}
					}
				}

				inst.handleScrollEvent = function(event) {
					if ( ! inst.scrollRef?.scrollContent )
						return;

					if ( !(event.which > 0 || event.type === 'mousewheel' || event.type === 'wheel' || event.type === 'touchmove') )
						return;

					// How far are we scrolled up?
					const scroller = inst.scrollRef.scrollContent,
						offset = scroller.scrollHeight - scroller.scrollTop - scroller.offsetHeight,
						scrolled_up = offset > 10;

					if ( scrolled_up !== inst.state.ffz_scrolled_up )
						inst.setState({ffz_scrolled_up: scrolled_up});

					if ( inst.state.isPaused && scrolled_up )
						inst.setLoadMoreEnabled(true);

					if ( inst.state.isPaused && ! scrolled_up )
						inst.ffzMaybeUnpause();
					else if ( ! inst.state.isPaused && scrolled_up )
						inst.pause();
				}

				const old_resume = inst.resume;

				inst.ffzFastResume = function() {
					inst._ffz_one_fast_scroll = true;
					inst.resume();
				}

				inst.resume = function() {
					inst.setState({ffz_scrolled_up: false});
					old_resume.call(this);
				}

				// Event Registration

				const Mousetrap = t.web_munch.getModule('mousetrap') || window.Mousetrap;
				if ( Mousetrap != null ) {
					Mousetrap.unbind('alt', 'keydown');
					Mousetrap.unbind('alt', 'keyup');
				}

				inst.ffzHandleKey = inst.ffzHandleKey.bind(inst);
				window.addEventListener('keydown', inst.ffzHandleKey);
				window.addEventListener('keyup', inst.ffzHandleKey);

				inst.hoverPause = inst.ffzMouseMove.bind(inst);
				inst.hoverResume = inst.ffzMouseLeave.bind(inst);

				const node = t.fine.getChildNode(inst);
				if ( node )
					node.addEventListener('mousemove', inst.hoverPause);

				const scroller = this.scrollRef?.scrollContent;
				if ( scroller ) {
					for(const event of SCROLL_EVENTS) {
						scroller.removeEventListener(event, inst.ffz_oldScrollEvent);
						scroller.addEventListener(event, inst.handleScrollEvent);
					}
				}

				// We need to refresh the element to make sure it's using the correct
				// event handlers for mouse enter / leave.
				inst.forceUpdate();
				t.emit('site:dom-update', 'chat-scroller', inst);
			}

			cls.prototype.ffzSmoothScroll = function() {
				if ( this._ffz_smooth_animation )
					cancelAnimationFrame(this._ffz_smooth_animation);

				this.ffz_is_smooth_scrolling = true;

				// Step setting value is # pixels to scroll per 10ms.
				// 1 is pretty slow, 2 medium, 3 fast, 4 very fast.
				let step = this.ffz_smooth_scroll,
					old_time = performance.now();

				const scroll_content = this.scrollRef?.scrollContent;
				if ( ! scroll_content )
					return;

				const target_top = scroll_content.scrollHeight - scroll_content.clientHeight,
					difference = target_top - scroll_content.scrollTop;

				// If we are falling behind speed us up
				if ( difference > scroll_content.clientHeight ) {
					// we are a full scroll away, just jump there
					step = difference;

				} else if ( difference > 200 ) {
					// we are starting to fall behind, speed it up a bit
					step += step * Math.floor(difference / 200);
				}

				const smoothAnimation = () => {
					if ( this.state.isPaused || ! this.state.isAutoScrolling )
						return this.ffz_is_smooth_scrolling = false;

					// See how much time has passed to get a step based off the delta
					const current_time = performance.now(),
						delta = current_time - old_time,
						current_step = step * (delta / 10);

					// we need to move at least one full pixel for scrollTop to do anything in this delta.
					if ( current_step >= 1 ) {
						const scroll_top = scroll_content.scrollTop,
							next_top = scroll_top + current_step,
							target_top = scroll_content.scrollHeight - scroll_content.clientHeight;

						old_time = current_time;
						if ( next_top < target_top ) {
							scroll_content.scrollTop = scroll_top + current_step;
							this._ffz_smooth_animation = requestAnimationFrame(smoothAnimation);

						} else {
							// We've reached the bottom.
							scroll_content.scrollTop = target_top;
							this.ffz_is_smooth_scrolling = false;
						}

					} else {
						// The frame happened so quick since last update that we haven't moved a full pixel.
						// Just wait.
						this._ffz_smooth_animation = requestAnimationFrame(smoothAnimation);
					}
				}

				smoothAnimation();
			}

			cls.prototype.ffzSetSmoothScroll = function(value) {
				this.ffz_smooth_scroll = value;
				this.ffzMaybeUnpause();
			}

			// Event Handling

			cls.prototype.ffzReadKeysFromEvent = function(event) {
				if ( event.altKey === this.ffz_alt &&
						event.shiftKey === this.ffz_shift &&
						event.ctrlKey === this.ffz_ctrl &&
						event.metaKey === this.ffz_meta )
					return false;

				this.ffz_alt = event.altKey;
				this.ffz_shift = event.shiftKey;
				this.ffz_ctrl = event.ctrlKey;
				this.ffz_meta = event.metaKey;
				return true;
			}

			cls.prototype.ffzHandleKey = function(event) {
				if ( ! this.ffzReadKeysFromEvent(event) )
					return;

				this.ffzUpdateKeyTags();

				if ( (t.pause_hover && this.ffz_outside) || this.ffzGetMode() < 2 )
					return;

				const should_pause = this.ffzShouldBePaused(),
					changed = should_pause !== this.state.isPaused;

				if ( changed )
					if ( should_pause ) {
						this.pause();
						if ( ! this.state.ffz_scrolled_up )
							this.setLoadMoreEnabled(false);
					} else
						this.resume();
			}

			cls.prototype.ffzInstallHoverTimer = function() {
				if ( this._ffz_hover_timer )
					return;

				this._ffz_hover_timer = setInterval(() => {
					if ( this.state.isPaused && this.ffzShouldBePaused() )
						return;

					this.ffzMaybeUnpause();
				}, 50);
			}

			cls.prototype.ffzMouseMove = function(event) {
				this.ffz_last_move = Date.now();
				const was_outside = this.ffz_outside;
				this.ffz_outside = false;

				if ( this._ffz_outside_timer ) {
					clearTimeout(this._ffz_outside_timer);
					this._ffz_outside_timer = null;
				}

				const keys_updated = this.ffzReadKeysFromEvent(event);

				// If nothing changed, stop processing.
				if ( ! keys_updated && event.screenX === this.ffz_sx && event.screenY === this.ffz_sy ) {
					if ( was_outside )
						this.ffzUpdateKeyTags();

					return;
				}

				this.ffz_sx = event.screenX;
				this.ffz_sy = event.screenY;

				if ( keys_updated || was_outside )
					this.ffzUpdateKeyTags();

				const should_pause = this.ffzShouldBePaused(),
					changed = should_pause !== this.state.isPaused;

				if ( changed )
					if ( should_pause ) {
						this.pause();
						this.ffzInstallHoverTimer();
						if ( ! this.state.ffz_scrolled_up )
							this.setLoadMoreEnabled(false);

					} else
						this.resume();
			}

			cls.prototype.ffzMouseLeave = function() {
				this.ffz_outside = true;
				if ( this._ffz_outside_timer )
					clearTimeout(this._ffz_outside_timer);

				this._ffz_outside_timer = setTimeout(() => this.ffzMaybeUnpause(), 64);
				this.ffzUpdateKeyTags();
			}

			cls.prototype.ffzTooltipHover = function(target, tip, event) {
				if ( target[this._ffz_accessor] == null ) {
					const scroller = this.scrollRef?.scrollContent;
					target[this._ffz_accessor] = scroller ? scroller.contains(target) : false;
				}

				if ( target[this._ffz_accessor] )
					this.ffzMouseMove(event);
			}

			cls.prototype.ffzTooltipLeave = function(target) {
				if ( this.ffz_outside )
					return;

				if ( target[this._ffz_accessor] == null ) {
					const scroller = this.scrollRef?.scrollContent;
					target[this._ffz_accessor] = scroller ? scroller.contains(target) : false;
				}

				if ( target[this._ffz_accessor] )
					this.ffzMouseLeave();
			}

			// Keyboard Stuff

			cls.prototype.ffzUpdateActing = function() {
				if ( ! this._ffz_key_frame_acting )
					this._ffz_key_frame_acting = requestAnimationFrame(() => this.ffz_updateActing());
			}

			cls.prototype.ffz_updateActing = function() {
				this._ffz_key_frame_acting = null;

				if ( ! this.scrollRef?.root )
					return;

				this.scrollRef.root.dataset.acting = this.ffz_acting;
			}

			cls.prototype.ffzUpdateKeyTags = function() {
				if ( ! this._ffz_key_frame )
					this._ffz_key_frame = requestAnimationFrame(() => this.ffz_updateKeyTags());
			}

			cls.prototype.ffz_updateKeyTags = function() {
				this._ffz_key_frame = null;

				if ( ! t.use_keys && this.ffz_use_keys === t.use_keys )
					return;

				if ( ! this.scrollRef?.root )
					return;

				this.ffz_use_keys = t.use_keys;
				this.scrollRef.root.classList.toggle('ffz--keys', t.use_keys);

				const ds = this.scrollRef.root.dataset;

				if ( ! t.use_keys ) {
					delete ds.alt;
					delete ds.ctrl;
					delete ds.shift;
					delete ds.meta;

				} else {
					ds.alt = ! this.ffz_outside && this.ffz_alt;
					ds.ctrl = ! this.ffz_outside && this.ffz_ctrl;
					ds.shift = ! this.ffz_outside && this.ffz_shift;
					ds.meta = ! this.ffz_outside && this.ffz_meta;
				}
			}


			// Pause Stuff

			cls.prototype.ffzShouldBePaused = function(since) {
				if ( since == null )
					since = Date.now() - this.ffz_last_move;

				if ( this.state.ffz_scrolled_up )
					return true;

				const mode = this.ffzGetMode(),
					require_hover = t.pause_hover;

				return (! require_hover || ! this.ffz_outside) && (
					(this.ffz_acting) ||
					(this.ffz_ctrl  && (mode === 2 || mode === 6)) ||
					(this.ffz_meta  && (mode === 3 || mode === 7)) ||
					(this.ffz_alt   && (mode === 4 || mode === 8)) ||
					(this.ffz_shift && (mode === 5 || mode === 9)) ||
					(! this.ffz_outside && since < t.pause_delay && (mode === 1 || mode > 5))
				);
			}

			cls.prototype.ffzGetMode = function() {
				let mode = t.pause;
				if ( mode === 0 && ! this.props.mouseoverPausingDisabled ) {
					const setting = this.props.pauseSetting;
					if ( setting === 'MOUSEOVER_ALTKEY' )
						mode = 8;
					else if ( setting === 'MOUSEOVER' )
						mode = 1;
					else if ( setting === 'ALTKEY' )
						mode = 4;
				}

				return mode;
			}

			cls.prototype.ffzMaybeUnpause = function() {
				if ( this.state.isPaused && ! this._ffz_unpause_frame )
					this._ffz_unpause_frame = requestAnimationFrame(() => {
						this._ffz_unpause_frame = null;
						if ( this.state.isPaused && ! this.ffzShouldBePaused() )
							this.resume();
					});
			}

			cls.prototype.ffzRenderFooter = function() {
				let msg, cls = '';
				if ( this.state.ffz_scrolled_up )
					msg = t.i18n.t('chat.messages-below', 'Chat Paused Due to Scroll');
				else if ( this.state.isPaused ) {
					const f = this.ffzGetMode(),
						reason = this.ffz_acting ? t.i18n.t('chat.acting', 'Taking Action') :
							f === 2 ? t.i18n.t('key.ctrl', 'Ctrl Key') :
								f === 3 ? t.i18n.t('key.meta', 'Meta Key') :
									f === 4 ? t.i18n.t('key.alt', 'Alt Key') :
										f === 5 ? t.i18n.t('key.shift', 'Shift Key') :
											f === 6 ? t.i18n.t('key.ctrl_mouse', 'Ctrl or Mouse') :
												f === 7 ? t.i18n.t('key.meta_mouse', 'Meta or Mouse') :
													f === 8 ? t.i18n.t('key.alt_mouse', 'Alt or Mouse') :
														f === 9 ? t.i18n.t('key.shift_mouse', 'Shift or Mouse') :
															t.i18n.t('key.mouse', 'Mouse Movement');

					msg = t.i18n.t('chat.paused', 'Chat Paused Due to {reason}', {reason});
					cls = 'ffz--freeze-indicator';

				} else
					return createElement('div', {
						className: `chat-scroll-footer__placeholder tw-flex tw-justify-content-center tw-relative ${cls}`
					}, null);

				return createElement('div', {
					className: `chat-scroll-footer__placeholder tw-flex tw-justify-content-center tw-relative ${cls}`
				}, createElement('div', {
					className: 'tw-absolute tw-border-radius-medium tw-bottom-0 tw-c-background-overlay tw-c-text-overlay tw-mg-b-1'
				}, createElement('button', {
					className: 'tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium ffz-core-button ffz-core-button--overlay ffz-core-button--text tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative',
					'data-a-target': 'chat-list-footer',
					onClick: this.ffzFastResume
				}, createElement('div', {
					className: 'tw-align-items-center ffz-core-button-label tw-flex tw-flex-grow-0'
				}, createElement('div', {
					className: 'tw-flex-grow-0'
				}, msg)))));
			}

			// Do the thing~

			for(const inst of instances)
				this.onMount(inst);
		});

		this.ChatScroller.on('mount', this.onMount, this);
		this.ChatScroller.on('unmount', this.onUnmount, this);
	}


	onMount(inst) {
		inst.ffzSetSmoothScroll(this.smooth_scroll);
		inst.ffzInstallHandler();
	}

	onUnmount(inst) { // eslint-disable-line class-methods-use-this
		this.off('tooltips:mousemove', inst.ffzTooltipHover, inst);
		this.off('tooltips:leave', inst.ffzTooltipLeave, inst);

		window.removeEventListener('keydown', inst.ffzHandleKey);
		window.removeEventListener('keyup', inst.ffzHandleKey);
	}
}