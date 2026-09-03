'use strict';

// ============================================================================
// Emote Menu: GifPanel
// The GIF tab: a grid of GIPHY results driven by the menu's search box,
// sending a GIF through Twitch's sendGifMessage mutation on click. Built at
// runtime because React comes from Twitch; `t` is the EmoteMenu module.
// ============================================================================

import {debounce} from 'utilities/object';
import {fetchGifs} from './giphy';

const PAGE_SIZE = 24;

export function createGifPanel(t, React) {
	const createElement = React && React.createElement;

	return class FFZGifPanel extends React.Component {
		constructor(props) {
			super(props);

			this.state = {
				items: [],
				offset: 0,
				total: Infinity,
				loading: false,
				error: null,
				sending: null,
				notice: null
			};

			this.loadMore = this.loadMore.bind(this);
			this.clickGif = this.clickGif.bind(this);
			this.reload = debounce(() => this.load(true), 350);
		}

		componentDidMount() {
			this.load(true);
		}

		componentDidUpdate(old_props) {
			if ( old_props.search !== this.props.search || old_props.rating !== this.props.rating || old_props.api_key !== this.props.api_key )
				this.reload();
		}

		componentWillUnmount() {
			this.unmounted = true;
		}

		async load(reset = false) {
			const key = this.props.api_key;
			if ( ! key ) {
				this.setState({items: [], offset: 0, loading: false, error: 'no-key'});
				return;
			}

			const offset = reset ? 0 : this.state.offset,
				query = (this.props.search || '').trim(),
				request = this.request = {query, offset};

			this.setState(reset
				? {items: [], offset: 0, total: Infinity, loading: true, error: null}
				: {loading: true, error: null}
			);

			let result;
			try {
				result = await fetchGifs(key, {
					query,
					rating: this.props.rating,
					offset,
					limit: PAGE_SIZE
				});
			} catch(err) {
				t.log.warn('Unable to load GIFs from GIPHY.', err);
				if ( ! this.unmounted && this.request === request )
					this.setState({loading: false, error: 'load'});
				return;
			}

			// A newer request superseded this one.
			if ( this.unmounted || this.request !== request )
				return;

			this.setState(state => ({
				items: reset ? result.items : state.items.concat(result.items),
				offset: offset + result.items.length,
				total: result.total,
				loading: false
			}));
		}

		loadMore() {
			if ( ! this.state.loading && ! this.isDone() )
				this.load(false);
		}

		isDone() {
			return this.state.error != null || this.state.offset >= this.state.total;
		}

		async clickGif(event) {
			const id = event.currentTarget.dataset.id,
				gif = this.state.items.find(item => item.id === id);

			if ( ! gif || this.state.sending )
				return;

			this.setState({sending: id, notice: null});

			const result = await t.sendGif(this.props.channel_id, gif);
			if ( this.unmounted )
				return;

			if ( result.ok ) {
				this.setState({sending: null});
				if ( this.props.toggleVisibility )
					this.props.toggleVisibility();
				return;
			}

			let notice;
			if ( result.seconds > 0 )
				notice = t.i18n.t('emote-menu.gifs.cooldown', 'You can send another GIF in {seconds, plural, one {# second} other {# seconds}}.', {seconds: result.seconds});
			else if ( result.error )
				notice = t.i18n.t('emote-menu.gifs.error', 'Twitch did not accept that GIF ({error}).', {error: result.error});
			else
				notice = t.i18n.t('emote-menu.gifs.failed', 'Unable to send that GIF.');

			this.setState({sending: null, notice});
		}

		renderMessage(text) { // eslint-disable-line class-methods-use-this
			return (<div class="tw-pd-1 tw-c-text-alt-2 tw-align-center">{text}</div>);
		}

		render() {
			const {items, loading, error, sending, notice} = this.state;

			return (<div class="ffz--gif-panel">
				{notice && <div class="ffz--gif-notice tw-pd-x-1 tw-pd-y-05 tw-c-text-alt">{notice}</div>}
				{error === 'no-key' && this.renderMessage(t.i18n.t('emote-menu.gifs.no-key', 'GIF search needs a GIPHY API key. Add one under Chat > Emote Menu > GIFs.'))}
				{error === 'load' && this.renderMessage(t.i18n.t('emote-menu.gifs.load-error', 'Unable to load GIFs right now.'))}
				{items.length > 0 && <div class="ffz--gif-grid">
					{items.map(gif => (<button
						key={gif.id}
						class={`ffz--gif-item${sending === gif.id ? ' ffz--gif-item__sending' : ''}`}
						data-id={gif.id}
						title={gif.title}
						aria-label={gif.title}
						disabled={sending != null}
						onClick={this.clickGif}
					>
						<img
							src={gif.preview}
							alt={gif.title}
							width={gif.width}
							height={gif.height}
							loading="lazy"
						/>
					</button>))}
				</div>}
				{loading && this.renderMessage(t.i18n.t('emote-menu.gifs.loading', 'Loading GIFs...'))}
				{! loading && ! error && ! items.length && this.renderMessage(t.i18n.t('emote-menu.gifs.empty', 'No GIFs found.'))}
				{! loading && ! this.isDone() && items.length > 0 && <button
					class="tw-button tw-button--text tw-full-width tw-mg-t-05"
					onClick={this.loadMore}
				>
					<span class="tw-button__text">{t.i18n.t('emote-menu.gifs.more', 'Load More')}</span>
				</button>}
				<div class="ffz--gif-attribution tw-pd-05 tw-c-text-alt-2 ffz-font-size-8 tw-align-center">
					{t.i18n.t('emote-menu.gifs.attribution', 'Powered by GIPHY')}
				</div>
			</div>);
		}
	};
}
