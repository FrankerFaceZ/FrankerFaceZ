'use strict';

// ============================================================================
// Emote Menu: MenuSection
// A collapsible section of the emote menu listing emotes from one set. Built at runtime because React comes from Twitch; `t` is the EmoteMenu module.
// ============================================================================

import {KEYS} from 'utilities/constants';

export function createMenuSection(t, React) {
	const createElement = React && React.createElement;
	const storage = t.settings.provider;

	return class FFZMenuSection extends React.Component {
		constructor(props) {
			super(props);

			this.ref = null;
			this.saveRef = ref => {
				if ( this.ref )
					this.props.stopObserving(this.ref);

				this.ref = ref;
				if ( ref )
					this.props.startObserving(this.ref, this);
			}

			const collapsed = storage.get('emote-menu.collapsed'),
				hidden = storage.get('emote-menu.hidden-sets');

			this.state = {
				active: false,
				activeEmote: -1,
				hidden: hidden && props.data && hidden.includes(props.data.hide_key || props.data.key),
				collapsed: collapsed && props.data && collapsed.includes(props.data.key),
				intersecting: window.IntersectionObserver ? false : true
			}

			this.keyHeading = this.keyHeading.bind(this);
			this.clickHeading = this.clickHeading.bind(this);
			this.clickEmote = this.clickEmote.bind(this);

			this.mouseEnter = () => this.state.intersecting || this.setState({intersecting: true});

			this.onMouseEnter = this.onMouseEnter.bind(this);
			this.onMouseLeave = this.onMouseLeave.bind(this);
		}

		componentDidMount() {
			this.props.addSection(this);

			if ( this.ref )
				this.props.startObserving(this.ref, this);
		}

		componentWillUnmount() {
			this.props.removeSection(this);

			if ( this.ref )
				this.props.stopObserving(this.ref);
		}

		keyInteract(code) { // eslint-disable-line
			/* no-op */
		}

		clickEmote(event) {
			if ( this.props.visibility_control ) {
				const ds = event.currentTarget.dataset;
				let source, id = ds.id;

				if ( ds.provider === 'twitch' )
					source = 'twitch';
				else if ( ds.provider === 'ffz' ) {
					const emote_set = t.emotes.emote_sets[ds.set],
						emote = emote_set && emote_set.emotes[id];

					if ( ! emote )
						return;

					source = emote_set.source || 'ffz';
					id = emote.id;

				} else
					return;

				t.emotes.toggleHidden(source, id);
				return;
			}

			if ( t.emotes.handleClick(event, true) )
				return;

			// Check for magic.
			let prefix = '', postfix = '';
			const effects = event.currentTarget.dataset.effects,
				is_prefix = event.currentTarget.dataset.effectPrefix === 'true';
			if ( effects?.length > 0 && effects != '0' && t.emotes.target_emote ) {
				if ( is_prefix )
					postfix = ` ${t.emotes.target_emote.name}`;
				else
					prefix = `${t.emotes.target_emote.name} `;
			}

			this.props.onClickToken(`${prefix}${event.currentTarget.dataset.name}${postfix}`);
		}

		keyHeading(event) {
			if ( event.keyCode === KEYS.Enter || event.keyCode === KEYS.Space )
				this.clickHeading();
		}

		clickHeading() {
			if ( this.props.visibility_control ) {
				const hidden = storage.get('emote-menu.hidden-sets') || [],
					key = this.props.data.hide_key || this.props.data.key,
					idx = hidden.indexOf(key);

				if ( key === 'twitch-current-channel' )
					return;

				if ( idx === -1 ) {
					hidden.push(key);
					this.setState({hidden: true});
				} else {
					hidden.splice(idx, 1);
					this.setState({hidden: false});
				}

				storage.set('emote-menu.hidden-sets', hidden);
				t.emit('chat.emotes:change-set-hidden', key);
				return;
			}

			if ( this.props.filtered )
				return;

			const collapsed = storage.get('emote-menu.collapsed') || [],
				val = ! this.state.collapsed,
				key = this.props.data.key,
				idx = collapsed.indexOf(key);

			this.setState({collapsed: val});

			if ( val && idx === -1 )
				collapsed.push(key);
			else if ( ! val && idx !== -1 )
				collapsed.splice(idx, 1);
			else
				return;

			storage.set('emote-menu.collapsed', collapsed);
		}

		onMouseEnter(event) {
			const set_id = event.currentTarget.dataset.setId;
			this.setState({unlocked: set_id});
		}

		onMouseLeave() {
			this.setState({unlocked: null});
		}

		render() {
			const data = this.props.data,
				filtered = this.props.filtered,
				visibility = this.props.visibility_control;

			let show_heading = ! (data.is_favorites && ! this.props.combineTabs) && this.props.showHeading;
			if ( show_heading === 2 )
				show_heading = ! filtered;
			else
				show_heading = !! show_heading;

			if ( visibility )
				show_heading = true;

			const hidden = visibility ? this.state.hidden : false,
				collapsed = visibility ? hidden : (show_heading && ! filtered && this.state.collapsed);

			if ( ! data )
				return null;

			let image;
			if ( data.image )
				image = (<img class={`ffz--menu-badge${data.image_large ? ' ffz--menu-badge__large' : ''}`} src={data.image} srcSet={data.image_set} />);
			else
				image = (<figure class={`ffz--menu-badge ffz-i-${data.icon || 'zreknarf'}`} />);

			let calendar;

			const renews = data.renews && data.renews.getTime(),
				ends = data.ends && data.ends.getTime();

			if ( renews > 0 ) {
				calendar = {
					icon: 'calendar',
					message: t.i18n.t('emote-menu.sub-renews', 'This sub renews {seconds,humantime}.', {seconds: renews})
				}

			} else if ( ends ) {
				if ( data.prime )
					calendar = {
						icon: 'crown',
						message: t.i18n.t('emote-menu.sub-prime', 'This is your free sub with Prime Gaming.\nIt ends {seconds,humantime}.', {seconds: ends})
					}
				else if ( data.gift )
					calendar = {
						icon: 'gift',
						message: t.i18n.t('emote-menu.sub-gift-ends', 'This gifted sub ends {seconds,humantime}.', {seconds: ends})
					}
				else
					calendar = {
						icon: 'calendar-empty',
						message: t.i18n.t('emote-menu.sub-ends', 'This sub ends {seconds,humantime}.', {seconds: ends})
					}
			}

			let source = data.source_i18n ? t.i18n.t(data.source_i18n, data.source) : data.source;
			if ( source == null )
				source = 'FFZ';

			return (<section ref={this.saveRef} data-key={data.key} class={filtered ? 'filtered' : ''} onMouseEnter={this.mouseEnter}>
				{show_heading ? (<heading tabindex="0" class="tw-pd-1 tw-border-b tw-flex tw-flex-nowrap" onKeyDown={this.keyHeading} onClick={this.clickHeading}>
					{image}
					<div class="tw-pd-l-05">
						{(data.i18n ? t.i18n.t(data.i18n, data.title) : data.title) || t.i18n.t('emote-menu.unknown', 'Unknown Source')}
						{! visibility && calendar && (<span
							class={`tw-mg-x-05 ffz--expiry-info ffz-tooltip ffz-i-${calendar.icon}`}
							data-tooltip-type="html"
							data-title={calendar.message}
						/>)}
					</div>
					<div class="tw-flex-grow-1" />
					<span class={!visibility && data.channel_source ? 'ffz-tooltip' : ''} data-title={data.channel_source}>{
						visibility ?
							(hidden ?
								t.i18n.t('emote-menu.visibility.hidden', 'Hidden') :
								t.i18n.t('emote-menu.visibility.visible', 'Visible') )
							: source
					}</span>
					{(visibility ? false : filtered) ? '' : <figure class={`tw-pd-l-05 ffz-i-${collapsed ? 'left' : 'down'}-dir`} />}
				</heading>) : null}
				{collapsed || this.renderBody(show_heading)}
			</section>)
		}

		renderBody(show_sources) {
			const data = this.props.data,
				filtered = this.props.filtered,
				lock = data.locks && data.locks[this.state.unlocked],

				emotes = data.filtered_emotes && data.filtered_emotes.map(emote => {
					if ( filtered && emote.locked )
						return;

					const locked = emote.locked && (! lock || ! lock.emotes.has(emote.id)),
						emote_lock = locked && data.locks && data.locks[emote.set_id];
					let sellout = '';

					if ( emote_lock ) {
						if ( emote_lock.id === 'subwoofer' ) {
							sellout = t.i18n.t('emote-menu.emote-subwoofer', 'Become an FFZ Subwoofer to unlock this emote.');
						} else if ( emote_lock.id === 'cheer' ) {
							sellout = t.i18n.t('emote-menu.emote-cheer', 'Cheer an additional {bits_remaining, plural, one {# bit} other {# bits}} to unlock this emote.', emote_lock);
						} else if ( emote_lock.id === 'follower' ) {
							sellout = t.i18n.t('emote-menu.emote-follower', 'Follow {user} to unlock this emote in their channel.', emote_lock);
						} else if ( data.all_locked )
							sellout = t.i18n.t('emote-menu.emote-sub', 'Subscribe for {price} to unlock this emote.', emote_lock);
						else
							sellout = t.i18n.t('emote-menu.emote-up', 'Upgrade your sub to {price} to unlock this emote.', emote_lock);
					}

					return this.renderEmote(
						emote,
						locked,
						show_sources,
						sellout
					);
				});

			return (<div class="tw-pd-1 tw-border-b tw-c-background-alt tw-align-center">
				{emotes}
				{! this.props.visibility_control && !filtered && this.renderSellout()}
			</div>)
		}

		renderEmote(emote, locked, source, sellout) {
			if ( ! this.state.intersecting )
				return <span key={emote.id} class="emote-picker__placeholder" style={{width: `${emote.width||28}px`, height: `${emote.height||28}px`}} />;

			const visibility = this.props.visibility_control,
				modifiers = this.props.emote_modifiers[emote.id],
				has_modifiers = Array.isArray(modifiers) && modifiers.length > 0,
				//has_menu = has_modifiers && this.state.open_menu == emote.id,
				animated = this.props.animated,
				hidden = visibility && emote.hidden,

				tt = t.chat.context.get('chat.emote-menu.tooltips');

			let src, srcSet;
			if ( animated && emote.animSrc ) {
				src = emote.animSrc;
				srcSet = emote.animSrcSet;
			} else {
				src = emote.src;
				srcSet = emote.srcSet;
			}

			return (<button
				key={emote.id}
				class={`${tt ? 'ffz-tooltip ' : ''}emote-picker__emote-link${!visibility && locked ? ' locked' : ''}${hidden ? ' emote-hidden' : ''}`}
				data-tooltip-type="emote"
				data-provider={emote.provider}
				data-id={emote.id}
				data-set={emote.set_id}
				data-code={emote.code}
				data-modifiers={modifiers}
				data-effects={emote.effects}
				data-effect-prefix={emote.effect_prefix}
				data-variant={emote.variant}
				data-no-source={source}
				data-name={emote.name}
				aria-label={emote.name}
				data-locked={emote.locked}
				data-sellout={sellout}
				onClick={(this.props.visibility_control || !emote.locked) && this.clickEmote}
			>
				<figure class="emote-picker__emote-figure">
					<img
						class={`emote-picker__emote-image${emote.emoji ? ' ffz-emoji' : ''}`}
						src={src}
						srcSet={srcSet}
						alt={emote.name}
						height={emote.height ? `${emote.height}px` : null}
						width={emote.width ? `${emote.width}px` : null}
					/>
				</figure>
				{! visibility && has_modifiers && <div class="emote-button__options" />}
				{! visibility && emote.favorite && <figure class="ffz--favorite ffz-i-star" />}
				{! visibility && locked && <figure class={`ffz-i-${emote.lock_icon || 'lock'}`} />}
				{hidden && <figure class="ffz-i-eye-off" />}
			</button>)
		}

		renderSellout() {
			const data = this.props.data;

			if ( ! data.all_locked || ! data.locks )
				return null;

			let lock = data.locks[this.state.unlocked],
				locks = Object.values(data.locks).filter(x => x.id !== 'cheer'),
				has_ffz = locks.filter(x => x.is_ffz).length > 0;

			if ( ! lock && data.locks.length === 1 )
				lock = data.locks[0];

			if ( ! locks.length )
				return null;

			return (<div class="tw-mg-1 tw-border-t tw-pd-t-1 tw-mg-b-0">
				{has_ffz
					? t.i18n.t('emote-menu.ffz-unlock', 'This feature is available to FFZ Subwoofers.')
					: (lock
						? t.i18n.t('emote-menu.sub-unlock', 'Subscribe for {price} to unlock {count, plural, one {# emote} other {# emotes}}', {price: lock.price, count: lock.emotes.size})
						: t.i18n.t('emote-menu.sub-basic', 'Subscribe to unlock some emotes')
					)
				}
				{has_ffz && this.props.ffz_sub_data?.has_free_sub
					? <div class="tw-pd-y-1">{t.i18n.t('emote-menu.free-sub.about', 'As thanks for supporting us in the past, you can get one month of FFZ Subwoofer for free.')}</div>
					: null}
				<div class="ffz--sub-buttons tw-mg-t-05">
					{locks.map(lock => lock.hide_button ? null : (<a
						key={lock.price}
						class="tw-button tw-border-radius-none"
						href={lock.url}
						target="_blank"
						rel="noopener noreferrer"
						data-set-id={lock.set_id}
						onMouseEnter={this.onMouseEnter}
						onMouseLeave={this.onMouseLeave}
					>
						<span class="tw-button__text">
							{has_ffz && this.props.ffz_sub_data?.has_free_sub
								? t.i18n.t('emote-menu.free-sub', 'Use My Free Month')
								: lock.price
							}
						</span>
					</a>))}
				</div>
			</div>)
		}
	};
}
