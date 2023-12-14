'use strict';

import type SettingsManager from 'root/src/settings';
import type { FineWrapper } from 'root/src/utilities/compat/fine';
import type Fine from 'root/src/utilities/compat/fine';
import type { ReactStateNode } from 'root/src/utilities/compat/react-types';

// ============================================================================
// Loadable Stuff
// ============================================================================

import Module, { GenericModule } from 'utilities/module';
import type { AnyFunction } from 'utilities/types';
import type Twilight from '..';

declare module 'utilities/types' {
	interface ModuleEventMap {

	}
	interface ModuleMap {
		'site.loadable': Loadable
	}
	interface SettingsTypeMap {
		'chat.hype.show-pinned': boolean;
		'layout.turbo-cta': boolean;
	}
}


type LoadableNode = ReactStateNode<{
	component: string;
	loader: any;
}, {
	Component?: AnyFunction;
}>;

type ErrorBoundaryNode = ReactStateNode<{
	name: string;
	onError: any;
	children: any;
}> & {
	onErrorBoundaryTestEmit: any
}


export default class Loadable extends Module {

	// Dependencies
	settings: SettingsManager = null as any;
	site: Twilight = null as any;
	fine: Fine = null as any;

	// State
	overrides: Map<string, boolean>;

	// Fine
	ErrorBoundaryComponent: FineWrapper<ErrorBoundaryNode>;
	LoadableComponent: FineWrapper<LoadableNode>;

	constructor(name?: string, parent?: GenericModule) {
		super(name, parent);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site');

		this.LoadableComponent = this.fine.define(
			'loadable-component',
			n =>
				(n as LoadableNode).props?.component &&
				(n as LoadableNode).props.loader
		);

		this.ErrorBoundaryComponent = this.fine.define(
			'error-boundary-component',
			n =>
				(n as ErrorBoundaryNode).props?.name &&
				(n as ErrorBoundaryNode).props?.onError &&
				(n as ErrorBoundaryNode).props?.children &&
				(n as ErrorBoundaryNode).onErrorBoundaryTestEmit
		);

		this.overrides = new Map();

	}

	onEnable() {
		this.settings.getChanges('chat.hype.show-pinned', val => {
			this.toggle('PaidPinnedChatMessageList', val);
		});

		this.settings.getChanges('layout.turbo-cta', val => {
			this.toggle('TopNav__TurboButton_Available', val);
		});

		this.ErrorBoundaryComponent.ready((cls, instances) => {
			this.log.debug('Found Error Boundary component wrapper.');

			const t = this,
				proto = cls.prototype as ErrorBoundaryNode,
				old_render = proto.render;

			proto.render = function() {
				try {
					const type = this.props.name;
					if ( t.overrides.has(type) && ! t.shouldRender(type) )
						return null;
				} catch(err) {
					/* no-op */
					console.error(err);
				}

				return old_render.call(this);
			}

			this.ErrorBoundaryComponent.updateInstances();
		});

		this.LoadableComponent.ready((cls, instances) => {
			this.log.debug('Found Loadable component wrapper.');

			const t = this,
				proto = cls.prototype,
				old_render = proto.render;

			proto.render = function() {
				try {
					const type = this.props.component;
					if ( t.overrides.has(type) && this.state ) {
						let cmp = this.state.Component;
						if ( typeof cmp === 'function' && ! (cmp as any).ffzWrapped ) {
							const React = t.site.getReact(),
								createElement = React && React.createElement;

							if ( createElement ) {
								if ( ! (cmp as any).ffzWrapper ) {
									const th = this;
									function FFZWrapper(props: any) {
										if ( t.shouldRender(th.props.component) )
											return createElement(cmp, props);
										return null;
									}

									FFZWrapper.ffzWrapped = true;
									FFZWrapper.displayName = `FFZWrapper(${this.props.component})`;
									(cmp as any).ffzWrapper = FFZWrapper;
								}

								this.state.Component = (cmp as any).ffzWrapper;
							}
						}
					}
				} catch(err) {
					/* no-op */
					console.error(err);
				}

				return old_render.call(this);
			}

			this.LoadableComponent.updateInstances();
		});
	}

	toggle(cmp: string, state: boolean | null = null) {
		const existing = this.overrides.get(cmp) ?? true;

		if ( state == null )
			state = ! existing;
		else
			state = !! state;

		if ( state !== existing ) {
			this.overrides.set(cmp, state);
			this.update(cmp);
		}
	}

	update(cmp: string) {
		for(const inst of this.LoadableComponent.instances) {
			const type = inst.props?.component;
			if ( type && type === cmp )
				inst.forceUpdate();
		}

		for(const inst of this.ErrorBoundaryComponent.instances) {
			const name = inst.props?.name;
			if ( name && name === cmp )
				inst.forceUpdate();
		}
	}

	shouldRender(cmp: string) {
		return this.overrides.get(cmp) ?? true;
	}

}
