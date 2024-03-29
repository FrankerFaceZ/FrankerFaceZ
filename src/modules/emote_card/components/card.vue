<template>
	<div
		:style="{zIndex: z}"
		class="ffz-viewer-card tw-border tw-border-radius-medium tw-c-background-base tw-c-text-base tw-elevation-2 tw-flex tw-flex-column viewer-card"
		tabindex="0"
		@focusin="onFocus"
		@keyup.esc="close"
	>
		<div
			class="ffz-viewer-card__header tw-border-radius-medium tw-c-background-accent-alt tw-flex-grow-0 tw-flex-shrink-0 viewer-card__background tw-relative"
		>
			<div class="tw-flex tw-flex-column tw-full-height tw-full-width viewer-card__overlay">
				<div class="tw-align-center tw-border-radius-medium tw-align-items-center tw-c-background-alt tw-c-text-base tw-flex tw-flex-grow-1 tw-flex-row tw-full-width tw-justify-content-start tw-pd-05 tw-relative viewer-card__banner">
					<div class="tw-mg-l-05 tw-mg-y-05 tw-inline-flex viewer-card-drag-cancel">
						<figure v-if="! loaded" class="tw-mg-x-1 tw-font-size-2 ffz-i-zreknarf loading" />
						<figure v-else class="ffz-avatar tw-flex tw-align-items-center" :style="imageStyle">
							<img
								v-if="emote.src"
								:src="emote.src"
								class="tw-block tw-image tw-image-avatar"
							>
						</figure>
					</div>
					<div class="tw-align-left tw-flex-grow-1 tw-ellipsis tw-mg-l-1 tw-mg-y-05 viewer-card__display-name">
						<h4
							class="tw-inline tw-ellipsis"
							:class="{'tw-italic': hasOriginalName}"
							:title="emote ? emote.name : raw_emote.name"
						>
							{{ emote ? emote.name : raw_emote.name }}
						</h4>
						<P
							v-if="! loaded"
							class="tw-c-text-alt-2 tw-font-size-6"
						>
							{{ t('emote-card.loading', 'Loading...') }}
						</P>
						<p
							v-if="loaded && emote.source"
							class="tw-c-text-alt-2 tw-font-size-6 tw-ellipsis"
							:title="emote.source_i18n ? t(emote.source_i18n, emote.source) : emote.source"
						>
							{{ emote.source_i18n ? t(emote.source_i18n, emote.source) : emote.source }}
						</p>
						<p v-if="hasOriginalName" class="tw-c-text-alt-2 tw-font-size-6 tw-ellipsis">
							<t-list
								phrase="emote.original-name"
								default="Name: {name}"
							>
								<template #name>
									{{ emote.originalName }}
								</template>
							</t-list>
						</p>
						<p v-if="loaded && emote.owner" class="tw-c-text-alt-2 tw-font-size-6 tw-ellipsis">
							<t-list
								phrase="emote-card.owner"
								default="Owner: {owner}"
							>
								<template #owner>
									<a
										v-if="emote.ownerLink"
										rel="noopener noreferrer"
										target="_blank"
										:href="emote.ownerLink"
									>{{ emote.owner }}</a>
									<span v-else>{{ emote.owner }}</span>
								</template>
							</t-list>
						</p>
						<p v-if="loaded && emote.artist" class="tw-c-text-alt-2 tw-font-size-6 tw-ellipsis">
							<t-list
								phrase="emote-card.artist"
								default="Artist: {artist}"
							>
								<template #artist>
									<a
										v-if="emote.artistLink"
										rel="noopener noreferrer"
										target="_blank"
										:href="emote.artistLink"
										class="ffz-i-artist"
									>{{ emote.artist }}</a>
									<span v-else>{{ emote.artist }}</span>
								</template>
							</t-list>
						</p>
					</div>
					<button
						v-if="canFavorite"
						:data-title="favoriteLabel"
						:aria-label="favoriteLabel"
						class="tw-flex-shrink-0 viewer-card-drag-cancel tw-align-self-start tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-core-button tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ffz-tooltip"
						@click="toggleFavorite"
					>
						<span class="tw-button-icon__icon">
							<figure :class="{
								'ffz-i-star': isFavorite,
								'ffz-i-star-empty': ! isFavorite
							}" />
						</span>
					</button>
					<div class="tw-flex tw-flex-column tw-align-self-start">
						<button
							:data-title="t('emote-card.close', 'Close')"
							:aria-label="t('emote-card.close', 'Close')"
							class="viewer-card-drag-cancel tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-core-button tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ffz-tooltip"
							@click="close"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-cancel" />
							</span>
						</button>
						<div
							v-if="hasMoreActions"
							v-on-clickaway="closeMore"
							class="tw-relative viewer-card-drag-cancel"
						>
							<button
								:data-title="t('emote-card.more', 'More')"
								:aria-label="t('emote-card.more', 'More')"
								class="tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-core-button tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ffz-tooltip"
								@click="toggleMore"
							>
								<span class="tw-button-icon__icon">
									<figure class="ffz-i-ellipsis-vert" />
								</span>
							</button>
							<balloon
								v-if="moreOpen"
								color="background-alt-2"
								dir="down-right"
								size="sm"
								class="tw-border-radius-medium"
							>
								<simplebar classes="ffz-mh-30">
									<div class="tw-pd-y-05">
										<template v-for="(entry, idx) in moreActions">
											<div
												v-if="entry.divider"
												:key="idx"
												class="tw-mg-1 tw-border-b"
											/>
											<a
												:key="idx"
												:disabled="entry.disabled"
												:href="entry.href"
												rel="noopener noreferrer"
												target="_blank"
												class="tw-block ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive tw-full-width ffz--cursor"
												@click="clickMore(entry, $event)"
											>
												<div class="tw-flex tw-align-items-center tw-pd-y-05 tw-pd-x-1">
													<div
														class="tw-flex-grow-1"
														:class="{'tw-mg-r-1' : !! entry.icon}"
													>
														{{ entry.title_i18n ? t(entry.title_i18n, entry.title, entry) : entry.title }}
													</div>
													<figure
														v-if="entry.icon || entry.type === 'link'"
														:class="entry.icon || 'ffz-i-link-ext'"
													/>
												</div>
											</a>
										</template>
									</div>
								</simplebar>
							</balloon>
						</div>
					</div>
				</div>
			</div>
		</div>
		<ReportForm
			v-if="reporting"
			:emote="emote"
			:getFFZ="getFFZ"
			@close="close"
		/>
		<component
			v-if="! reporting && loaded && hasBody"
			:is="bodyComponent"
			:emote="emote"
			:getFFZ="getFFZ"
			@close="close"
		/>
		<Modifiers
			v-if="! reporting && raw_modifiers && raw_modifiers.length"
			:raw_modifiers="raw_modifiers"
			:getFFZ="getFFZ"
		/>
	</div>
</template>

<script>

import ManageFFZ from './manage-ffz.vue';
import Modifiers from './modifiers.vue';
import ReportForm from './report-form.vue';
import TwitchBody from './twitch-body.vue';

import displace from 'displacejs';

export default {
	components: {
		Modifiers,
		ReportForm
	},

	props: [
		'raw_emote', 'data',
		'pos_x', 'pos_y',
		'getZ', 'getFFZ', 'reportTwitchEmote',
		'raw_modifiers'
	],

	data() {
		return {
			z: this.getZ(),

			moreOpen: false,
			isFavorite: false,

			reporting: false,

			loaded: false,
			errored: false,
			pinned: false,

			emote: null
		}
	},

	computed: {
		favoriteLabel() {
			return this.t('emote-card.fav', 'Favorite This Emote');
		},

		hasBody() {
			return this.bodyComponent != null
		},

		hasOriginalName() {
			return this.loaded && this.emote.originalName && this.emote.originalName !== this.emote.name;
		},

		bodyComponent() {
			const body = this.emote?.body;

			if ( body === 'twitch' )
				return TwitchBody;

			if ( body === 'manage-ffz' )
				return ManageFFZ;

			return null;
		},

		canFavorite() {
			return this.loaded && this.emote.fav_source;
		},

		moreActions() {
			if ( ! this.loaded || ! this.emote.more )
				return null;

			return this.emote.more;
		},

		hasMoreActions() {
			return (this.moreActions?.length ?? 0) > 0;
		},

		imageStyle() {
			if ( ! this.loaded )
				return {};

			return {
				width: `${Math.min(112, (this.emote.width ?? 28) * 2)}px`,
				height: `${(this.emote.height ?? 28) * 2}px`
			};
		}
	},

	beforeMount() {
		this.ffzEmit(':open', this);

		this.data.then(data => {
			this.loaded = true;
			this.ffzEmit(':load', this);
			this.emote = data;

			this.updateIsFavorite();
			this.$nextTick(() => this.handleResize());

		}).catch(err => {
			console.error('Error loading emote card data', err);
			this.errored = true;
		});
	},

	mounted() {
		this._on_resize = this.handleResize.bind(this);
		window.addEventListener('resize', this._on_resize);
		this.createDrag();
	},

	beforeDestroy() {
		this.ffzEmit(':close', this);
		this.destroyDrag();
		if ( this._on_resize ) {
			window.removeEventListener('resize', this._on_resize);
			this._on_resize = null;
		}
	},

	methods: {
		updateIsFavorite() {
			if ( ! this.emote || ! this.emote.fav_source )
				this.isFavorite = false;
			else {
				const emotes = this.getFFZ().resolve('chat.emotes');
				this.isFavorite = emotes.isFavorite(this.emote.fav_source, this.emote.fav_id ?? this.emote.id);
			}
		},

		toggleFavorite() {
			if ( ! this.emote || ! this.emote.fav_source )
				return;

			const emotes = this.getFFZ().resolve('chat.emotes');
			this.isFavorite = emotes.toggleFavorite(this.emote.fav_source, this.emote.fav_id ?? this.emote.id);
			this.cleanTips();
		},

		toggleMore() {
			this.moreOpen = ! this.moreOpen;
		},

		closeMore() {
			this.moreOpen = false;
		},

		clickMore(entry, evt) {
			this.moreOpen = false;

			if ( entry.type === 'link' )
				return;

			evt.preventDefault();

			if ( entry.type === 'report-ffz' )
				this.reporting = true;
				this.$nextTick(() => this.handleResize());

			if ( entry.type === 'report-twitch' ) {
				if ( this.reportTwitchEmote(this.emote.id, this.emote.channel_id) )
					this.close();

				return;
			}
		},

		constrain() {
			const el = this.$el;
			let parent = el.parentElement,
				moved = false;

			if ( ! parent )
				parent = document.body;

			const box = el.getBoundingClientRect();
			let pbox = parent.getBoundingClientRect();

			if ( box.top < pbox.top ) {
				el.style.top = `${el.offsetTop + (pbox.top - box.top)}px`;
				moved = true;
			} else if ( box.bottom > pbox.bottom ) {
				el.style.top = `${el.offsetTop - (box.bottom - pbox.bottom)}px`;
				moved = true;
			}

			if ( box.left < pbox.left ) {
				el.style.left = `${el.offsetLeft + (pbox.left - box.left)}px`;
				moved = true;
			} else if ( box.right > pbox.right ) {
				el.style.left = `${el.offsetLeft - (box.right - pbox.right)}px`;
				moved = true;
			}

			if ( moved && this.displace )
				this.displace.reinit();
		},

		pin() {
			this.pinned = true;
			this.$emit('pin');
			this.ffzEmit(':pin', this);
		},

		cleanTips() {
			this.$nextTick(() => this.ffzEmit('tooltips:cleanup'))
		},

		close() {
			this.$emit('close');
		},

		createDrag() {
			this.$nextTick(() => {
				this.displace = displace(this.$el, {
					handle: this.$el.querySelector('.ffz-viewer-card__header'),
					highlightInputs: true,
					constrain: true,
					onMouseDown: () => this.onFocus(),
					onTouchStart: () => this.onFocus(),
					ignoreFn: e => e.target.closest('.viewer-card-drag-cancel') != null
				});
			})
		},

		destroyDrag() {
			if ( this.displace ) {
				this.displace.destroy();
				this.displace = null;
			}
		},

		handleResize() {
			if ( this.displace )
				this.displace.reinit();
		},

		onFocus() {
			this.z = this.getZ();
		},

		focus() {
			this.$el.focus();
		},

		ffzEmit(event, ...args) {
			this.$emit('emit', event, ...args);
		}
	}

}

</script>
