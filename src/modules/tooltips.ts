'use strict';

// ============================================================================
// Tooltip Handling
// ============================================================================

import {createElement, sanitize} from 'utilities/dom';
import {has, maybe_call} from 'utilities/object';

import Tooltip, { TooltipInstance } from 'utilities/tooltip';
import Module, { GenericModule, buildAddonProxy } from 'utilities/module';
import awaitMD, {getMD} from 'utilities/markdown';
import { DEBUG } from 'src/utilities/constants';
import type { AddonInfo, DomFragment, OptionallyCallable } from '../utilities/types';
import type TranslationManager from '../i18n';

declare global {
	interface HTMLElement {
		_ffz_child: Element | null;
	}
}

declare module 'utilities/types' {
	interface ModuleEventMap {
		tooltips: TooltipEvents;
	}
	interface ModuleMap {
		tooltips: TooltipProvider;
	}
}


export type TooltipEvents = {
	/**
	 * When this event is emitted, the tooltip provider will attempt to remove
	 * old, invalid tool-tips.
	 */
	':cleanup': [],

	':hover': [target: HTMLElement, tip: TooltipInstance, event: MouseEvent];
	':leave': [target: HTMLElement, tip: TooltipInstance, event: MouseEvent];
};

type TooltipOptional<TReturn> = OptionallyCallable<[target: HTMLElement, tip: TooltipInstance], TReturn>;

type TooltipExtra = {
	__source?: string;

	popperConfig(target: HTMLElement, tip: TooltipInstance, options: any): any;

	delayShow: TooltipOptional<number>;
	delayHide: TooltipOptional<number>;

	interactive: TooltipOptional<boolean>;
	hover_events: TooltipOptional<boolean>;

	onShow(target: HTMLElement, tip: TooltipInstance): void;
	onHide(target: HTMLElement, tip: TooltipInstance): void;

};

export type TooltipDefinition = Partial<TooltipExtra> &
	((target: HTMLElement, tip: TooltipInstance) => DomFragment);


export default class TooltipProvider extends Module<'tooltips', TooltipEvents> {

	// Storage
	types: Record<string, TooltipDefinition | undefined>;

	// Dependencies
	i18n: TranslationManager = null as any;

	// State
	container?: HTMLElement | null;
	tip_element?: HTMLElement | null;
	tips?: Tooltip | null;


	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.types = {};

		this.inject('i18n');

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
		};

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
		};

		this.types.markdown = (target, tip) => {
			tip.add_class = 'ffz-tooltip--markdown';

			const md = getMD();
			if ( ! md )
				return awaitMD().then(md => md.render(target.dataset.title));

			return md.render(target.dataset.title);
		};

		this.types.text = target => sanitize(target.dataset.title ?? '');
		this.types.html = target => target.dataset.title;

		this.onFSChange = this.onFSChange.bind(this);
	}


	getAddonProxy(addon_id: string, addon: AddonInfo, module: GenericModule) {
		if ( ! addon_id )
			return this;

		const overrides: Record<string, any> = {},
			is_dev = DEBUG || addon?.dev;
		let warnings: Record<string, boolean | string> | undefined;

		overrides.define = (key: string, handler: TooltipDefinition) => {
			if ( handler )
				handler.__source = addon_id;

			return this.define(key, handler);
		};

		if ( is_dev ) {
			overrides.cleanup = () => {
				module.log.warn('[DEV-CHECK] Instead of calling tooltips.cleanup(), you can emit the event "tooltips:cleanup"');
				return this.cleanup();
			};

			warnings = {
				types: 'Please use tooltips.define()'
			};
		}

		return buildAddonProxy(
			module,
			this,
			'tooltips',
			overrides,
			warnings
		);
	}


	onEnable() {
		const container = this.getRoot();

		window.addEventListener('fullscreenchange', this.onFSChange);

		//	is_minimal = false; //container && container.classList.contains('twilight-minimal-root');

		this.container = container;
		this.tip_element = container;
		this.tips = this._createInstance(container);

		this.on(':cleanup', this.cleanup);

		this.on('addon:fully-unload', addon_id => {
			let removed = 0;
			for(const [key, handler] of Object.entries(this.types)) {
				if ( handler?.__source === addon_id ) {
					removed++;
					this.types[key] = undefined;
				}
			}

			if ( removed ) {
				this.log.debug(`Cleaned up ${removed} entries when unloading addon:`, addon_id);
				this.cleanup();
			}
		});
	}


	define(key: string, handler: TooltipDefinition) {
		// TODO: Determine if any tooltips are already open.
		// If so, we need to close them / maybe re-open them?
		this.types[key] = handler;
	}


	getRoot() { // eslint-disable-line class-methods-use-this
		return document.querySelector<HTMLElement>('.sunlight-root') ||
			//document.querySelector('#root>div') ||
			document.querySelector('#root') ||
			document.querySelector('.clips-root') ||
			document.body;
	}

	_createInstance(container: HTMLElement, klass = 'ffz-tooltip', default_type = 'text', tip_container?: HTMLElement) {
		return new Tooltip(container, klass, {
			html: true,
			i18n: this.i18n,
			live: true,
			check_modifiers: true,
			container: tip_container || container,

			delayHide: this.checkDelayHide.bind(this, default_type),
			delayShow: this.checkDelayShow.bind(this, default_type),
			content: this.process.bind(this, default_type),
			interactive: this.checkInteractive.bind(this, default_type),
			hover_events: this.checkHoverEvents.bind(this, default_type),

			onShow: this.delegateOnShow.bind(this, default_type),
			onHide: this.delegateOnHide.bind(this, default_type),

			popperConfig: this.delegatePopperConfig.bind(this, default_type),
			popper: {
				placement: 'top',
				modifiers: {
					flip: {}
				}
			},

			onHover: (target, tip, event) => {
				this.emit(':hover', target, tip, event)
			},

			onLeave: (target, tip, event) => {
				this.emit(':leave', target, tip, event);
			}
		});
	}


	onFSChange() {
		if ( ! this.container )
			this.container = this.getRoot();

		let tip_element = this.container;
		if ( document.fullscreenElement instanceof HTMLElement )
			tip_element = document.fullscreenElement;

		if ( tip_element !== this.tip_element ) {
			this.tip_element = tip_element;
			if ( this.tips ) {
				this.tips.destroy();
				this.tips = this._createInstance(tip_element);
			}
		}
	}


	cleanup() {
		if ( this.tips )
			this.tips.cleanup();
	}


	delegatePopperConfig(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance,
		options: any
	) {
		const type = target.dataset.tooltipType || default_type,
			handler = this.types[type];

		if ( target.dataset.tooltipSide )
			options.placement = target.dataset.tooltipSide;

		if ( handler && handler.popperConfig )
			return handler.popperConfig(target, tip, options);

		return options;
	}

	delegateOnShow(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance
	) {
		const type = target.dataset.tooltipType || default_type,
			handler = this.types[type];

		if ( handler && handler.onShow )
			handler.onShow(target, tip);
	}

	delegateOnHide(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance
	) {
		const type = target.dataset.tooltipType || default_type,
			handler = this.types[type];

		if ( handler && handler.onHide )
			handler.onHide(target, tip);
	}

	checkDelayShow(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance
	) {
		const type = target.dataset.tooltipType || default_type,
			handler = this.types[type];

		if ( handler?.delayShow != null )
			return maybe_call(handler.delayShow, null, target, tip);

		return 0;
	}

	checkDelayHide(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance
	) {
		const type = target.dataset.tooltipType || default_type,
			handler = this.types[type];

		if ( handler?.delayHide != null )
			return maybe_call(handler.delayHide, null, target, tip);

		return 0;
	}

	checkInteractive(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance
	) {
		const type = target.dataset.tooltipType || default_type,
			handler = this.types[type];

		if ( handler?.interactive != null )
			return maybe_call(handler.interactive, null, target, tip);

		return false;
	}

	checkHoverEvents(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance
	) {
		const type = target.dataset.tooltipType || default_type,
			handler = this.types[type];

		if ( handler?.hover_events != null )
			return maybe_call(handler.hover_events, null, target, tip);

		return false;
	}

	process(
		default_type: string,
		target: HTMLElement,
		tip: TooltipInstance
	) {
		const type = target.dataset.tooltipType || default_type || 'text',
			align = target.dataset.tooltipAlign,
			handler = this.types[type];

		if ( align )
			tip.align = align;

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
