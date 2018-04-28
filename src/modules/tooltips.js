'use strict';

// ============================================================================
// Tooltip Handling
// ============================================================================

import {createElement} from 'utilities/dom';
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

		this.types.html = target => target.dataset.title;
	}

	onEnable() {
		const container = document.querySelector('.twilight-root,.twilight-minimal-root') || document.body,
			is_minimal = container && container.classList.contains('twilight-minimal-root');

		this.tips = new Tooltip(is_minimal ? '.twilight-minimal-root,body' : 'body #root,body', 'ffz-tooltip', {
			html: true,
			delayHide: this.checkDelayHide.bind(this),
			delayShow: this.checkDelayShow.bind(this),
			content: this.process.bind(this),
			interactive: this.checkInteractive.bind(this),
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
			}
		});
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

	process(target, tip) {
		const type = target.dataset.tooltipType,
			handler = this.types[type];

		if ( ! handler )
			return [
				createElement('strong', null, 'Unhandled Tooltip Type'),
				createElement('code', {
					className: 'block pd-t-05 border-t mg-t-05',
					style: {
						fontFamily: 'monospace',
						textAlign: 'left'
					}
				}, JSON.stringify(target.dataset, null, 4))
			];

		return handler(target, tip);
	}
}