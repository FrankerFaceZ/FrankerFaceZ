'use strict';

// ============================================================================
// Loadable Stuff
// ============================================================================

import Module from 'utilities/module';


export default class Loadable extends Module {
	constructor(...args) {
		super(...args);

		this.should_enable = true;

		this.inject('settings');
		this.inject('site.fine');
		this.inject('site.web_munch');

		this.LoadableComponent = this.fine.define(
			'loadable-component',
			n => n.props?.component && n.props.loader
		);

		this.ErrorBoundaryComponent = this.fine.define(
			'error-boundary-component',
			n => n.props?.name && n.props?.onError && n.props?.children && n.onErrorBoundaryTestEmit
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
				old_render = cls.prototype.render;

			cls.prototype.render = function() {
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
				old_render = cls.prototype.render;

			cls.prototype.render = function() {
				try {
					const type = this.props.component;
					if ( t.overrides.has(type) ) {
						let cmp = this.state.Component;
						if ( typeof cmp === 'function' && ! cmp.ffzWrapped ) {
							const React = t.web_munch.getModule('react'),
								createElement = React && React.createElement;

							if ( createElement ) {
								if ( ! cmp.ffzWrapper ) {
									const th = this;
									function FFZWrapper(props, state) {
										if ( t.shouldRender(th.props.component, props, state) )
											return createElement(cmp, props);
										return null;
									}

									FFZWrapper.ffzWrapped = true;
									FFZWrapper.displayName = `FFZWrapper(${this.props.component})`;
									cmp.ffzWrapper = FFZWrapper;
								}

								this.state.Component = cmp.ffzWrapper;
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

	toggle(cmp, state = null) {
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

	update(cmp) {
		for(const inst of this.LoadableComponent.instances) {
			const type = inst?.props?.component;
			if ( type && type === cmp )
				inst.forceUpdate();
		}

		for(const inst of this.ErrorBoundaryComponent.instances) {
			const name = inst?.props?.name;
			if ( name && name === cmp )
				inst.forceUpdate();
		}
	}

	shouldRender(cmp, props) {
		return this.overrides.get(cmp) ?? true;
	}

}