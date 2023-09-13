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

		this.overrides = new Map();

	}

	onEnable() {
		this.settings.getChanges('chat.hype.show-pinned', val => {
			this.toggle('PaidPinnedChatMessageList', val);
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
			if ( inst?.props?.component === cmp )
				inst.forceUpdate();
		}
	}

	shouldRender(cmp, props) {
		return this.overrides.get(cmp) ?? true;
	}

}