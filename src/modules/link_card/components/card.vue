<template>
	<div
		:style="{zIndex: z, '--ffz-color-accent': accent}"
		class="ffz-viewer-card tw-border tw-border-radius-medium tw-c-background-base tw-c-text-base tw-elevation-2 tw-flex tw-flex-column viewer-card ffz-accent-card"
		tabindex="0"
		@focusin="onFocus"
		@keyup.esc="close"
	>
		<div
			class="ffz-viewer-card__header tw-border-radius-medium tw-c-background-accent-alt tw-flex-grow-0 tw-flex-shrink-0 viewer-card__background tw-relative"
		>
			<div
				v-if="isUnsafe"
				class="ffz--corner-flag ffz--corner-flag--left ffz--corner-flag__warn ffz-tooltip ffz-tooltip--no-mouse tw-border-top-left-radius-medium"
				:data-title="unsafeTip"
			>
				<figure class="ffz-i-attention" />
			</div>
			<div class="tw-flex tw-flex-column tw-full-height tw-full-width viewer-card__overlay">
				<div
					class="tw-align-center tw-border-radius-medium tw-align-items-center tw-c-background-alt tw-c-text-base tw-flex tw-flex-grow-1 tw-flex-row tw-full-width tw-justify-content-start tw-pd-05 tw-relative viewer-card__banner"
					:class="{'tw-pd-l-3': isUnsafe}"
				>
					<div class="tw-align-left tw-flex-grow-1 tw-ellipsis tw-mg-l-05 tw-mg-y-05 viewer-card__display-name">
						<p class="tw-font-size-6 tw-ellipsis" :title="url">
							<span class="tw-c-text-alt-2">{{ urlPrefix }}</span><span>{{ urlDomain }}</span><span class="tw-c-text-alt-2">{{ urlPath }}</span>
						</p>
					</div>
					<div class="tw-flex tw-align-self-start">
						<a
							:data-title="t('link-card.open-ext', 'Open Link')"
							:data-url="targetUrl"
							:href="targetUrl"
							class="ffz--cursor viewer-card-drag-cancel tw-align-items-center tw-align-middle tw-border-radius-medium tw-button-icon tw-core-button tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative ffz-tooltip"
							rel="noreferrer noopener"
							target="_blank"
						>
							<span class="tw-button-icon__icon">
								<figure class="ffz-i-link-ext" />
							</span>
						</a>
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
					</div>
				</div>
			</div>
		</div>
		<section class="tw-c-background-body">
			<div class="viewer-card__tabs-container tw-border-t">
				<div
					v-for="(d, key) in tabs"
					:id="`link-card__${key}`"
					:key="key"
					:class="{
						active: active_tab === key,
						'tw-inline-flex': !! d.pill,
						'tw-align-items-center': !! d.pill
					}"
					class="viewer-card__tab tw-pd-x-1"
					@click="active_tab = key"
				>
					<span>{{ d.label_i18n ? t(d.label_i18n, d.label, d) : d.label }}</span>
					<span v-if="d.pill" class="tw-mg-l-05 ffz-pill" :class="d.pill_classes || ''">{{ d.pill_i18n ? t(d.pill_i18n, d.pill, d) : d.pill }}</span>
				</div>
			</div>
		</section>
		<keep-alive>
			<chat-rich
				v-if="rich_data && active_tab === 'preview'"
				:data="rich_data"
				:url="url"
				:events="events"
				:no-unsafe="true"
				:no-elevation="true"
				:no-tooltip="true"
				:no-link="true"
			/>
		</keep-alive>
		<keep-alive>
			<ManageFFZ
				v-if="active_tab === 'manage' && ffzEmote"
				:emote="ffzEmote"
				:get-f-f-z="getFFZ"
				:no-header="true"
			/>
		</keep-alive>
		<div
			v-if="active_tab === 'urls'"
			class="tw-c-background-base tw-pd-05"
		>
			<table v-if="embed && embed.urls && embed.urls.length">
				<tbody
					v-for="(url, idx) in embed.urls"
					:key="idx"
				>
					<tr>
						<td class="tw-c-text-alt-2">
							{{ tNumber(idx + 1) }}.
						</td>
						<td class="tw-pd-x-05 tw-word-break-all">
							<a
								:data-url="url.url"
								:href="url.url"
								rel="noreferrer noopener"
								target="_blank"
								class="ffz-link--inherit"
							>
								<lc-url :url="url.url" :show-protocol="true" />
							</a>
						</td>
					</tr>
					<tr v-if="url.shortened || (url.flags && url.flags.length)">
						<td>&nbsp;</td>
						<td class="tw-pd-x-05">
							<span
								v-if="url.shortened"
								class="ffz-pill"
							>{{ t('link-card.shortened', 'shortened') }}</span>
							<span
								v-for="flag in url.flags"
								v-if="url.flags"
								class="ffz-pill ffz-pill--live"
							>{{ flag }}</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script>

import {deep_copy, sha256} from 'utilities/object';

import displace from 'displacejs';

import ManageFFZ from '../../emote_card/components/manage-ffz.vue';

export default {
	components: {
		ManageFFZ,
		'chat-rich': async () => {
			const stuff = await import(/* webpackChunkName: "chat" */ 'src/modules/chat/components');
			return stuff.default('./chat-rich.vue').default;
		}
	},

	props: [
		'url', 'data',
		'pos_x', 'pos_y',
		'getZ', 'getFFZ',
		'use_dest'
	],

	data() {
		const token = {
			type: 'link',
			force_rich: true,
			is_mail: false,
			url: this.url,
			text: this.url
		};

		const chat = this.getFFZ().resolve('chat');

		return {
			z: this.getZ(),

			active_tab: 'preview',
			moreOpen: false,

			rich_data: chat.rich_providers.link.process.call(chat, token),

			url_hash: null,
			loaded: false,
			errored: false,
			pinned: false,

			embed: null,

			events: {
				on: (...args) => this.getFFZ().on(...args),
				off: (...args) => this.getFFZ().off(...args),
				emit: (...args) => this.getFFZ().emit(...args)
			}
		}
	},

	computed: {
		isUnsafe() {
			return this.embed?.unsafe;
		},

		ffzEmote() {
			if ( this.embed?.special?.type !== 'ffz-emote' )
				return null;

			return {
				id: this.embed.special.id
			}
		},

		unsafeTip() {
			if ( ! Array.isArray(this.embed?.urls) )
				return null;

			const reasons = Array.from(new Set(this.embed.urls.map(url => url.flags).flat())).join(', ');

			return this.t(
				'tooltip.link-unsafe',
				'Caution: This URL is has been flagged as potentially harmful by: {reasons}',
				{
					reasons
				}
			)
		},

		tabs() {
			const tabs = {
				preview: {
					label: 'Preview',
					label_i18n: 'link-card.preview'
				}
			};

			if ( this.ffzEmote?.id )
				tabs.manage = {
					label: 'Manage Emote',
					label_i18n: 'link-card.manage-emote'
				};

			if ( Array.isArray(this.embed?.urls) ) {
				tabs.urls = {
					label: 'Visited URLs',
					label_i18n: 'tooltip.link.urls'
				};

				if ( this.embed.urls.length > 1 ) {
					tabs.urls.pill = this.tNumber(this.embed.urls.length);
					if ( this.embed.unsafe )
						tabs.urls.pill_classes = ['ffz-pill--live'];
				}
			}

			return tabs;
		},

		accent() {
			return this.embed?.accent
		},

		_url() {
			if ( this.url instanceof URL )
				return this.url;
			return new URL(this.url);
		},

		targetUrl() {
			const urls = this.use_dest ? this.embed?.urls : null;
			if ( Array.isArray(urls) )
				for(const url of urls) {
					if ( ! url.shortened )
						return url.url;
				}

			return this.url;
		},

		urlPrefix() {
			return null;
			//return this._url.protocol;
		},

		urlDomain() {
			return this._url.host;
		},

		urlPath() {
			return this._url.toString().slice(this._url.origin.length);
		},

		moreActions() {
			const actions = [];

			/*if ( this.url_hash && this.vt_key )
				actions.push({
					type: 'virus-total',
					title_i18n: 'link-card.virus-check',
					title: 'Check URL on VirusTotal',
					icon: 'ffz-i-flag'
				});*/

			if ( Array.isArray(this.embed?.actions) )
				for(const act of this.embed.actions)
					actions.push(act);

			return actions;
		},

		hasMoreActions() {
			return (this.moreActions?.length ?? 0) > 0;
		},
	},

	beforeMount() {
		this.ffzEmit(':open', this);

		sha256(this.url).then(hash => {
			this.url_hash = hash;
		});

		this.data.then(data => {
			this.loaded = true;
			this.ffzEmit(':load', this);
			this.embed = deep_copy(data);

			this.$nextTick(() => this.handleResize());

		}).catch(err => {
			console.error('Error loading link card data', err);
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

			//if ( entry.type === 'virus-total' )
			//	this.openVirusTotal();
		},

		/*async openVirusTotal() {
			if ( ! this.url_hash || ! this.vt_key )
				return;

			const resp = await fetch(`https://www.virustotal.com/api/v3/urls`, {
				method: 'POST',
				headers: {
					'x-apikey': this.vt_key
				},
				body: new URLSearchParams({
					url: this.url
				})
			}).then(resp => resp.ok ? resp.json() : null);

			console.log('response', resp);
		},*/

		constrain() {
			const el = this.$el;
			let parent = el.parentElement,
				moved = false;

			if ( ! parent )
				parent = document.body;

			const box = el.getBoundingClientRect(),
				pbox = parent.getBoundingClientRect();

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