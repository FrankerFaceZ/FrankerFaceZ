'use strict';

// ============================================================================
// Emote Menu: GifSection
// The GIF tab: a grid of GIPHY results driven by the menu's search box.
// Twitch's own emote picker hands us its GIPHY key, rating, cooldown and
// the onSelectGif callback that sends the chosen GIF, so this only has to
// search and render. Built at runtime because React comes from Twitch;
// `t` is the EmoteMenu module.
// ============================================================================

export function createGifSection(t, React) {
	const createElement = React && React.createElement;

	return class FFZGifSection extends React.Component {
		constructor(props) {
			super(props);
			this.state = { query: props.query || '', results: [], loading: false, loadingMore: false, offset: 0, total: 0, cooldown: props.cooldown || 0, unavailable: false };
		}

		buildURL(query, offset) {
			const valid_ratings = ['g', 'pg'],
				raw = (this.props.rating || '').toLowerCase(),
				rating = valid_ratings.includes(raw) ? raw : 'g';

			return query
				? `https://api.giphy.com/v1/gifs/search?api_key=${this.props.apiKey}&q=${encodeURIComponent(query)}&rating=${rating}&limit=50&offset=${offset}`
				: `https://api.giphy.com/v1/gifs/trending?api_key=${this.props.apiKey}&rating=${rating}&limit=50&offset=${offset}`;
		}

		handleQueryChange(value) {
			clearTimeout(this._debounce);
			this._debounce = setTimeout(() => this.search(value), 300);
		}

		async search(query) {
			if ( ! this.props.apiKey )
				return;

			this.setState({ loading: true, offset: 0, query });

			try {
				const resp = await fetch(this.buildURL(query, 0)),
					data = await resp.json();

				this.setState({
					results: data.data || [],
					total: data.pagination?.total_count || 0,
					offset: data.data?.length || 0,
					loading: false
				});
			} catch(err) {
				this.setState({ loading: false });
			}
		}

		async loadMore() {
			if ( this.state.loading || this.state.loadingMore )
				return;

			if ( this.state.offset >= this.state.total )
				return;

			this.setState({ loadingMore: true });

			try {
				const resp = await fetch(this.buildURL(this.state.query, this.state.offset)),
					data = await resp.json();

				this.setState(prev => ({
					results: prev.results.concat(data.data || []),
					offset: prev.offset + (data.data?.length || 0),
					loadingMore: false
				}));
			} catch(err) {
				this.setState({ loadingMore: false });
			}
		}

		componentDidMount() {
			this.search(this.props.query || '');

			if ( this.state.cooldown > 0 )
				this.startCooldownTimer();
		}

		componentWillUnmount() {
			clearTimeout(this._debounce);
			clearInterval(this._cooldown_timer);
		}

		startCooldownTimer() {
			clearInterval(this._cooldown_timer);
			this._cooldown_timer = setInterval(() => {
				this.setState(prev => {
					const next = prev.cooldown - 1;
					if ( next <= 0 ) {
						clearInterval(this._cooldown_timer);
						return { cooldown: 0 };
					}
					return { cooldown: next };
				});
			}, 1000);
		}

		async handleSelect(gif) {
			if ( ! this.props.onSelectGif || this.state.cooldown > 0 )
				return;

			const media_url = gif.images?.original?.url
				|| gif.images?.fixed_width?.url
				|| gif.url;

			let remaining;
			try {
				remaining = await this.props.onSelectGif({
					...gif,
					url: media_url
				});
			} catch(err) {
				return;
			}

			if ( remaining === -1 ) {
				this.setState({ unavailable: true });
				return;
			}

			if ( remaining ) {
				this.setState({ cooldown: remaining });
				this.startCooldownTimer();
			}
		}

		render() {
			const disabled = this.state.cooldown > 0;

			return (<div class="tw-pd-1">
				{disabled && (
					<div class="ffz--gif-cooldown-notice tw-mg-b-1 tw-c-text-alt-2">
						{t.i18n.t('emote-menu.gif-cooldown', 'You can send another GIF in {seconds}s.', {seconds: this.state.cooldown})}
					</div>
				)}
				{this.state.unavailable && (
					<div class="ffz--gif-cooldown-notice tw-mg-b-1 tw-c-text-alt-2">
						{t.i18n.t('emote-menu.gif-unavailable', 'GIFs are temporarily unavailable.')}
					</div>
				)}
				{this.state.loading && (
					<div class="tw-align-center tw-pd-1">
						{t.i18n.t('emote-menu.gif-loading', 'Loading...')}
					</div>
				)}
				{! this.state.loading && this.state.results.length === 0 && (
					<div class="tw-align-center tw-pd-1">
						{t.i18n.t('emote-menu.gif-empty', 'No GIFs found.')}
					</div>
				)}
				<div class="ffz--gif-picker-grid">
					{this.state.results.map(gif => (
						<button
							key={gif.id}
							class={disabled ? 'ffz--gif-picker-item--disabled' : ''}
							onClick={() => this.handleSelect(gif)}
						>
							<img src={gif.images.fixed_width_small.url} alt={gif.title} />
						</button>
					))}
				</div>
			</div>);
		}
	};
}
