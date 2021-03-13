'use strict';

import Module from 'utilities/module';

// ============================================================================
// Vanilla Viewer Cards
// ============================================================================

export default class ViewerCards extends Module {
	constructor(...args) {
		super(...args);

		this.inject('chat');
		this.inject('settings');
		this.inject('site.css_tweaks');
		this.inject('site.fine');

		this.last_login = null;

		this.settings.add('chat.viewer-cards.highlight-chat', {
			default: false,
			ui: {
				path: 'Chat > Viewer Cards >> Appearance',
				title: 'Highlight messages from users with open viewer cards.',
				component: 'setting-check-box'
			}
		});

		this.settings.add('chat.viewer-cards.color', {
			default: '',
			ui: {
				path: 'Chat > Viewer Cards >> Appearance',
				title: 'Highlight Color',
				component: 'setting-color-box'
			}
		});

		this.settings.add('chat.viewer-cards.use-color', {
			requires: ['chat.viewer-cards.highlight-chat', 'chat.viewer-cards.color'],
			process(ctx) {
				if ( ctx.get('chat.viewer-cards.highlight-chat') )
					return ctx.get('chat.viewer-cards.color');
			}
		})

		this.ViewerCard = this.fine.define(
			'chat-viewer-card',
			n => n.props?.targetLogin && n.props?.hideViewerCard
		);
	}

	onEnable() {
		this.chat.context.on('changed:chat.viewer-cards.highlight-chat', this.refreshStyle, this);
		this.chat.context.on('changed:chat.viewer-cards.color', this.refreshStyle, this);
		this.on('..:update-colors', this.refreshStyle, this);

		this.ViewerCard.on('mount', this.updateCard, this);
		this.ViewerCard.on('update', this.updateCard, this);
		this.ViewerCard.on('unmount', this.unmountCard, this);
	}

	refreshStyle() {
		this.updateStyle(this.last_login);
	}

	updateStyle(login) {
		// Make sure we're dealing with lower-case logins.
		if ( typeof login === 'string' )
			login = login.toLowerCase();

		this.last_login = login;
		if ( login && this.chat.context.get('chat.viewer-cards.highlight-chat') ) {
			let color = this.chat.context.get('chat.viewer-cards.color');
			if ( color && color.length )
				color = this.parent.inverse_colors.process(color);
			else if ( this.chat.context.get('theme.is-dark') )
				color = 'rgba(0,80,255,0.2)';
			else
				color = 'rgba(128,170,255,0.2)';

			this.css_tweaks.set('viewer-card-highlight', `body .chat-room .chat-line__message:not(.chat-line--inline):nth-child(1n+0)[data-user="${login}"] {
	background-color: ${color} !important;
}`);
		} else
			this.css_tweaks.delete('viewer-card-highlight');
	}

	updateCard(inst) {
		this.updateStyle(inst.props && inst.props.targetLogin);
	}

	unmountCard() {
		this.updateStyle();
	}
}