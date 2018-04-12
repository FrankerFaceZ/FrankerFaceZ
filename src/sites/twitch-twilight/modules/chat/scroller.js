'use strict';

// ============================================================================
// Chat Scroller
// ============================================================================

import {createElement} from 'utilities/dom';
import Twilight from 'site';
import Module from 'utilities/module';

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
			n => n.saveScrollRef && n.handleScrollEvent,
			Twilight.CHAT_ROUTES
		);

		this.settings.add('chat.scroller.freeze', {
			default: 0,
			ui: {
				path: 'Chat > Behavior >> General',
				title: 'Freeze Chat Scrolling',
				description: 'Automatically stop chat from scrolling when moving the mouse over it or holding a key.',
				component: 'setting-select-box',
				data: [
					{value: 0, title: 'Disabled'},
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
	}

	onEnable() {
		this.on('i18n:update', () => {
			for(const inst of this.ChatScroller.instances)
				inst.ffzUpdateText();
		});

		this.freeze = this.chat.context.get('chat.scroller.freeze');
		this.chat.context.on('changed:chat.scroller.freeze', val => {
			this.freeze = val;

			for(const inst of this.ChatScroller.instances) {
				inst.ffzDisableFreeze();
				if ( val !== 0 )
					inst.ffzEnableFreeze();
			}
		});

		this.ChatScroller.ready((cls, instances) => {
			const t = this,
				old_catch = cls.prototype.componentDidCatch,
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
						React = t.web_munch.getModule('react'),
						createElement = React && React.createElement,
						handler = () => {
							clearTimeout(timer);
							this.ffzZeroErrors();
						}

					if ( auto )
						timer = setTimeout(handler, 250);

					if ( ! createElement )
						return null;

					return createElement('div', {
						className: 'tw-border-l tw-c-background-alt-2 tw-c-text tw-full-width tw-full-height tw-align-items-center tw-flex tw-flex-column tw-justify-content-center tw-relative'
					}, [
						createElement('div', {className: 'tw-mg-b-1'}, 'There was an error displaying chat.'),
						! auto && createElement('button', {
							className: 'tw-button',
							onClick: handler
						}, createElement('span', {className: 'tw-button__text'}, 'Try Again'))
					]);

				} else
					return old_render.call(this);
			}

			cls.prototype.ffzShouldBeFrozen = function(since) {
				if ( since === undefined )
					since = Date.now() - this.ffz_last_move;

				const f = t.freeze;

				return ! this.ffz_outside && (
					(this.ffz_ctrl  && (f === 2 || f === 6)) ||
					(this.ffz_meta  && (f === 3 || f === 7)) ||
					(this.ffz_alt   && (f === 4 || f === 8)) ||
					(this.ffz_shift && (f === 5 || f === 9)) ||
					(since < 750    && (f === 1 || f > 5))
				);
			}

			cls.prototype.ffzMaybeUnfreeze = function() {
				if ( this.ffz_frozen )
					requestAnimationFrame(() => {
						if ( this.ffz_frozen && ! this.ffzShouldBeFrozen() )
							this.ffzUnfreeze();
					});
			}

			cls.prototype.ffzUpdateText = function() {
				if ( ! this._ffz_freeze_indicator )
					return;

				const f = t.freeze,
					reason = f === 2 ? t.i18n.t('key.ctrl', 'Ctrl Key') :
						f === 3 ? t.i18n.t('key.meta', 'Meta Key') :
							f === 4 ? t.i18n.t('key.alt', 'Alt Key') :
								f === 5 ? t.i18n.t('key.shift', 'Shift Key') :
									f === 6 ? t.i18n.t('key.ctrl_mouse', 'Ctrl or Mouse') :
										f === 7 ? t.i18n.t('key.meta_mouse', 'Meta or Mouse') :
											f === 8 ? t.i18n.t('key.alt_mouse', 'Alt or Mouse') :
												f === 9 ? t.i18n.t('key.shift_mouse', 'Shift or Mouse') :
													t.i18n.t('key.mouse', 'Mouse Movement');

				this._ffz_freeze_indicator.firstElementChild.textContent = t.i18n.t(
					'chat.paused',
					'(Chat Paused Due to %{reason})',
					{reason}
				);
			}

			cls.prototype.ffzShowFrozen = function() {
				this._ffz_freeze_visible = true;
				let el = this._ffz_freeze_indicator;
				if ( ! el ) {
					const node = t.fine.getChildNode(this);
					if ( ! node )
						return;

					node.classList.add('tw-full-height');

					el = this._ffz_freeze_indicator = createElement('div', {
						className: 'ffz--freeze-indicator chat-list__more-messages-placeholder tw-relative tw-mg-x-2'
					}, createElement('div', {
						className: 'chat-list__more-messages tw-bottom-0 tw-full-width tw-align-items-center tw-flex tw-justify-content-center tw-absolute tw-pd-05'
					}));

					this.ffzUpdateText();
					node.appendChild(el);

				} else
					el.classList.remove('tw-hide');
			}

			cls.prototype.ffzHideFrozen = function() {
				this._ffz_freeze_visible = false;
				if ( this._ffz_freeze_indicator )
					this._ffz_freeze_indicator.classList.add('tw-hide');
			}

			cls.prototype.ffzFreeze = function() {
				if ( ! this._ffz_interval )
					this._ffz_interval = setInterval(() => {
						if ( ! this.ffzShouldBeFrozen() )
							this.ffzMaybeUnfreeze();
					}, 200);

				this.ffz_frozen = true;
				this.setState({ffzFrozen: true});
				//this.ffzShowFrozen();
			}

			cls.prototype.ffzUnfreeze = function() {
				if ( this._ffz_interval ) {
					clearInterval(this._ffz_interval);
					this._ffz_interval = null;
				}

				this.ffz_frozen = false;
				this.setState({ffzFrozen: false});
				if ( this.state.isAutoScrolling )
					this.scrollToBottom();

				//this.ffzHideFrozen();
			}


			cls.prototype.ffzInstallHandler = function() {
				if ( this._ffz_handleScroll )
					return;

				const t = this;
				this._old_scroll = this.scrollToBottom;
				this.scrollToBottom = function() {
					if ( ! this.ffz_freeze_enabled || ! this.state.ffzFrozen )
						return this._old_scroll();
				}

				this._ffz_handleScroll = this.handleScrollEvent;
				this.handleScrollEvent = function(e) {
					// If we're frozen because of FFZ, do not allow a mouse click to update
					// the auto-scrolling state. That just gets annoying.
					if ( e.type === 'mousedown' && t.ffz_frozen )
						return;

					if ( t.scroll && e.type === 'touchmove' ) {
						t.scroll.scrollContent.scrollHeight - t.scroll.scrollContent.scrollTop - t.scroll.scrollContent.offsetHeight <= 10 ? t.setState({
							isAutoScrolling: !0
						}) : t.setState({
							isAutoScrolling: !1
						})
					}

					return t._ffz_handleScroll(e);
				}

				const scroller = this.scroll && this.scroll.scrollContent;
				if ( scroller ) {
					scroller.removeEventListener('mousedown', this._ffz_handleScroll);
					scroller.addEventListener('mousedown', this.handleScrollEvent);
					scroller.addEventListener('touchmove', this.handleScrollEvent);
				}
			}


			cls.prototype.ffzEnableFreeze = function() {
				const node = t.fine.getChildNode(this);
				if ( ! node || this.ffz_freeze_enabled )
					return;

				this.ffz_freeze_enabled = true;

				if ( t.freeze > 1 ) {
					document.body.addEventListener('keydown',
						this._ffz_key = this.ffzKey.bind(this));

					document.body.addEventListener('keyup', this._ffz_key);
				}

				node.addEventListener('mousemove',
					this._ffz_mousemove = this.ffzMouseMove.bind(this));

				node.addEventListener('mouseleave',
					this._ffz_mouseleave = this.ffzMouseLeave.bind(this));
			}


			cls.prototype.ffzDisableFreeze = function() {
				this.ffz_freeze_enabled = false;

				if ( this.ffz_frozen )
					this.ffzUnfreeze();

				if ( this._ffz_outside ) {
					clearTimeout(this._ffz_outside);
					this._ffz_outside = null;
				}

				const node = t.fine.getChildNode(this);
				if ( ! node )
					return;

				this._ffz_freeze_visible = false;

				if ( this._ffz_freeze_indicator ) {
					this._ffz_freeze_indicator.remove();
					this._ffz_freeze_indicator = null;
				}

				if ( this._ffz_key ) {
					document.body.removeEventListener('keyup', this._ffz_key);
					document.body.removeEventListener('keydown', this._ffz_key);
					this._ffz_key = null;
				}

				if ( this._ffz_mousemove ) {
					node.removeEventListener('mousemove', this._ffz_mousemove);
					this._ffz_mousemove = null;
				}

				if ( this._ffz_mouseleave ) {
					node.removeEventListener('mouseleave', this._ffz_mouseleave);
					this._ffz_mouseleave = null;
				}
			}


			cls.prototype.ffzKey = function(e) {
				if (e.altKey === this.ffz_alt &&
						e.shiftKey === this.ffz_shift &&
						e.ctrlKey === this.ffz_ctrl &&
						e.metaKey === this.ffz_meta)
					return;

				this.ffz_alt = e.altKey;
				this.ffz_shift = e.shiftKey;
				this.ffz_ctrl = e.ctrlKey;
				this.ffz_meta = e.metaKey;

				if ( this.ffz_outside || t.freeze < 2 )
					return;

				const should_freeze = this.ffzShouldBeFrozen(),
					changed = should_freeze !== this.ffz_frozen;

				if ( changed )
					if ( should_freeze )
						this.ffzFreeze();
					else
						this.ffzUnfreeze();
			}


			cls.prototype.ffzMouseMove = function(e) {
				this.ffz_last_move = Date.now();
				this.ffz_outside = false;
				if ( this._ffz_outside ) {
					clearTimeout(this._ffz_outside);
					this._ffz_outside = null;
				}

				// If nothing of interest has happened, stop.
				if (e.altKey === this.ffz_alt &&
						e.shiftKey === this.ffz_shift &&
						e.ctrlKey === this.ffz_ctrl &&
						e.metaKey === this.ffz_meta &&
						e.screenY === this.ffz_sy &&
						e.screenX === this.ffz_sx)
					return;

				this.ffz_alt = e.altKey;
				this.ffz_shift = e.shiftKey;
				this.ffz_ctrl = e.ctrlKey;
				this.ffz_meta = e.metaKey;
				this.ffz_sy = e.screenY;
				this.ffz_sx = e.screenX;

				const should_freeze = this.ffzShouldBeFrozen(),
					changed = should_freeze !== this.ffz_frozen;

				if ( changed )
					if ( should_freeze )
						this.ffzFreeze();
					else
						this.ffzUnfreeze();
			}


			cls.prototype.ffzMouseLeave = function() {
				this.ffz_outside = true;
				if ( this._ffz_outside )
					clearTimeout(this._ffz_outside);

				this._ffz_outside = setTimeout(() => this.ffzMaybeUnfreeze(), 64);
			}


			for(const inst of instances)
				this.onMount(inst);
		});

		this.ChatScroller.on('mount', this.onMount, this);
		this.ChatScroller.on('unmount', this.onUnmount, this);

		this.ChatScroller.on('update', inst => {
			const should_show = inst.ffz_freeze_enabled && inst.state.ffzFrozen && inst.state.isAutoScrolling,
				changed = should_show !== inst._ffz_freeze_visible;

			if ( changed )
				if ( should_show )
					inst.ffzShowFrozen();
				else
					inst.ffzHideFrozen();
		});

	}


	onMount(inst) {
		inst.ffzInstallHandler();

		if ( this.freeze !== 0 )
			inst.ffzEnableFreeze();
	}

	onUnmount(inst) { // eslint-disable-line class-methods-use-this
		inst.ffzDisableFreeze();
	}
}