'use strict';

// ============================================================================
// Tooltip Handling
// ============================================================================

import {createElement, sanitize} from 'utilities/dom';
import {has, maybe_call} from 'utilities/object';

import Tooltip from 'utilities/tooltip';
import Module from 'utilities/module';

export default class TooltipProvider extends Module {
	constructor(...args) {
		super(...args);
		this.types = {};

		this.should_enable = true;

		this.types.json = target => {
			const title = target.dataset.title;
			return [
				title && createElement('strong', null, title),
				createElement('code', {
					className: `block${title ? ' pd-t-05 border-t mg-t-05' : ''}`,
					style: {
						fontFamily: 'monospace',
						textAlign: 'left'
					}
				}, target.dataset.data)
			]
		}

		this.types.child = target => {
			const child = target.querySelector(':scope > .ffz-tooltip-child');
			if ( ! child )
				return null;

			target._ffz_child = child;
			child.remove();
			child.classList.remove('ffz-tooltip-child');
			return child;
		};

		this.types.child.onHide = target => {
			const child = target._ffz_child;
			if ( child ) {
				target._ffz_child = null;
				child.remove();

				if ( ! target.querySelector(':scope > .ffz-tooltip-child') ) {
					child.classList.add('ffz-tooltip-child');
					target.appendChild(child);
				}
			}
		}

		this.types.text = target => sanitize(target.dataset.title);
		this.types.html = target => target.dataset.title;
	}

	onEnable() {
		const container = document.querySelector('#root>div') || document.querySelector('#root') || document.querySelector('.clips-root') || document.body;
		//	is_minimal = false; //container && container.classList.contains('twilight-minimal-root');

		this.tips = new Tooltip(container, 'ffz-tooltip', {
			html: true,
			delayHide: this.checkDelayHide.bind(this),
			delayShow: this.checkDelayShow.bind(this),
			content: this.process.bind(this),
			interactive: this.checkInteractive.bind(this),
			hover_events: this.checkHoverEvents.bind(this),

			onShow: this.delegateOnShow.bind(this),
			onHide: this.delegateOnHide.bind(this),

			popper: {
				placement: 'top',
				modifiers: {
					flip: {
						behavior: ['top', 'bottom', 'left', 'right']
					},
					preventOverflow: {
						boundariesElement: container
					}
				}
			},

			onHover: (target, tip, event) => {
				this.emit(':hover', target, tip, event)
			},

			onLeave: (target, tip, event) => {
				this.emit(':leave', target, tip, event);
			}
		});

		this.on(':cleanup', this.cleanup);
	}

	cleanup() {
		this.tips.cleanup();
	}

	delegateOnShow(target, tip) {
		const type = target.dataset.tooltipType,
			handler = this.types[type];

		if ( handler && handler.onShow )
			handler.onShow(target, tip);
	}

	delegateOnHide(target, tip) {
		const type = target.dataset.tooltipType,
			handler = this.types[type];

		if ( handler && handler.onHide )
			handler.onHide(target, tip);
	}

	checkDelayShow(target, tip) {
		const type = target.dataset.tooltipType,
			handler = this.types[type];

		if ( has(handler, 'delayShow') )
			return maybe_call(handler.delayShow, null, target, tip);

		return 0;
	}

	checkDelayHide(target, tip) {
		const type = target.dataset.tooltipType,
			handler = this.types[type];

		if ( has(handler, 'delayHide') )
			return maybe_call(handler.delayHide, null, target, tip);

		return 0;
	}

	checkInteractive(target, tip) {
		const type = target.dataset.tooltipType,
			handler = this.types[type];

		if ( has(handler, 'interactive') )
			return maybe_call(handler.interactive, null, target, tip);

		return false;
	}

	checkHoverEvents(target, tip) {
		const type = target.dataset.tooltipType,
			handler = this.types[type];

		if ( has(handler, 'hover_events') )
			return maybe_call(handler.hover_events, null, target, tip);

		return false;
	}

	process(target, tip) {
		const type = target.dataset.tooltipType || 'text',
			handler = this.types[type];

		if ( ! handler )
			return [
				createElement('strong', null, 'Unhandled Tooltip Type'),
				createElement('code', {
					className: 'tw-block pd-t-05 border-t mg-t-05',
					style: {
						fontFamily: 'monospace',
						textAlign: 'left'
					}
				}, JSON.stringify(target.dataset, null, 4))
			];

		return handler(target, tip);
	}
}