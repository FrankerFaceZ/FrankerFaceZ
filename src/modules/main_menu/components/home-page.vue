<template lang="html">
	<div class="ffz--home tw-flex tw-flex-nowrap">
		<div class="tw-flex-grow-1">
			<div class="tw-align-center">
				<h2 class="ffz-i-zreknarf ffz-i-pd-1">
					FrankerFaceZ
				</h2>
				<span class="tw-c-text-alt">
					{{ t('home.tag-line', 'The Twitch Enhancement Suite') }}
				</span>
			</div>

			<section class="tw-pd-t-1 tw-border-t tw-mg-t-1">
				<markdown :source="t('home.about', md)" />
			</section>

			<div
				v-if="unseen"
				class="tw-pd-t-1 tw-border-t tw-mg-t-1"
			>
				<h3 class="tw-pd-b-05">
					{{ t('home.new-settings', 'New Settings') }}
				</h3>

				<div class="tw-pd-b-1">
					{{ t('home.new-settings.desc', 'These are settings that you haven\'t looked at yet.') }}
				</div>

				<div
					v-for="cat of unseen"
					:key="cat.key"
					class="tw-mg-b-05"
				>
					<a
						class="tw-strong"
						href="#"
						@click.prevent="item.requestPage(cat.key)"
					>
						<span
							v-for="(tk,idx) of cat.tokens"
							:key="idx"
						>
							{{ tk.i18n ? t(tk.i18n, tk.title) : tk.title }}
						</span>
					</a>
					<div
						v-for="entry of cat.entries"
						:key="entry.key"
						class="tw-mg-l-2"
					>
						{{ entry.i18n ? t(entry.i18n, entry.title) : entry.title }}
					</div>
				</div>
			</div>

			<div
				v-if="addons"
				class="tw-pd-t-1 tw-border-t tw-mg-t-1"
			>
				<h3 class="tw-pd-b-05">
					{{ t('home.addon-updates', 'Updated Add-Ons') }}
				</h3>

				<div class="tw-pd-b-1">
					<markdown :source="t('home.addon-updates.desc', 'These add-ons have updated within the past seven days. Check the [changelog](~add_ons.changelog) to see what\'s changed.')" />
				</div>

				<div
					v-for="addon of addons"
					:key="addon.key"
					class="tw-mg-b-05 tw-flex tw-align-items-center"
				>
					<div class="ffz-card-img--size-4 tw-overflow-hidden tw-mg-r-1">
						<img :src="addon.icon" class="tw-image">
					</div>
					<div>
						<a
							v-if="addon.enabled && addon.settings"
							href="#"
							class="tw-strong ffz-link--inherit"
							@click.prevent="item.requestPage(addon.settings)"
						>
							{{ addon.name_i18n ? t(addon.name_i18n, addon.name) : addon.name }}
						</a>
						<div v-else class="tw-strong">
							{{ addon.name_i18n ? t(addon.name_i18n, addon.name) : addon.name }}
						</div>
						<div class="tw-c-text-alt">
							<span class="tw-mg-r-1">
								{{ t('addon.version', 'Version {version}', addon) }}
							</span>
							<span>
								{{ t('addon.updated', 'Updated: {when,humantime}', {when: addon.updated}) }}
							</span>
						</div>
					</div>
				</div>
			</div>

			<div
				v-if="new_addons"
				class="tw-pd-t-1 tw-border-t tw-mg-t-1"
			>
				<h3 class="tw-pd-b-05">
					{{ t('home.addon-new', 'New Add-Ons') }}
				</h3>

				<div class="tw-pd-b-1">
					<markdown :source="t('home.addon-new.desc', 'These add-ons were published within the past seven days. Check them out in [Add-Ons](~add_ons).')" />
				</div>

				<div
					v-for="addon of new_addons"
					:key="addon.key"
					class="tw-mg-b-05 tw-flex tw-align-items-center"
				>
					<div class="ffz-card-img--size-4 tw-overflow-hidden tw-mg-r-1">
						<img :src="addon.icon" class="tw-image">
					</div>
					<div>
						<a
							v-if="addon.enabled && addon.settings"
							href="#"
							class="tw-strong ffz-link--inherit"
							@click.prevent="item.requestPage(addon.settings)"
						>
							{{ addon.name_i18n ? t(addon.name_i18n, addon.name) : addon.name }}
						</a>
						<div v-else class="tw-strong">
							{{ addon.name_i18n ? t(addon.name_i18n, addon.name) : addon.name }}
						</div>
						<div class="tw-c-text-alt">
							<span class="tw-mg-r-1">
								{{ t('addon.version', 'Version {version}', addon) }}
							</span>
							<span>
								{{ t('addon.updated', 'Updated: {when,humantime}', {when: addon.updated}) }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="tw-mg-l-1 tw-flex-shrink-0 tweet-column">
			<div class="tw-flex tw-mg-b-1">
				<a
					:data-title="t('home.website', 'FrankerFaceZ Website')"
					class="tw-flex-grow-1 tw-button ffz-tooltip ffz--ffz-button tw-mg-r-1"
					href="https://www.frankerfacez.com/"
					target="_blank"
					rel="noopener"
				>
					<span class="tw-button__icon tw-pd-05">
						<figure class="ffz-i-zreknarf tw-font-size-3" />
					</span>
				</a>
				<a
					:data-title="t('home.discord', 'Discord')"
					class="tw-flex-grow-1 tw-button ffz-tooltip ffz--discord-button tw-mg-r-1"
					href="https://discord.gg/UrAkGhT"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span class="tw-button__icon tw-pd-05-1">
						<figure class="ffz-i-discord tw-font-size-3" />
					</span>
				</a>
				<a
					:data-title="t('home.twitter', 'Twitter')"
					class="tw-flex-grow-1 tw-button ffz-tooltip ffz--twitter-button tw-mg-r-1"
					href="https://twitter.com/frankerfacez"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span class="tw-button__icon tw-pd-05">
						<figure class="ffz-i-twitter tw-font-size-3" />
					</span>
				</a>
				<a
					:data-title="t('home.github', 'GitHub')"
					class="tw-flex-grow-1 tw-button ffz-tooltip ffz--github-button"
					href="https://github.com/FrankerFaceZ/FrankerFaceZ"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span class="tw-button__icon tw-pd-05">
						<figure class="ffz-i-github tw-font-size-3" />
					</span>
				</a>
			</div>

			<a
				:data-theme="theme"
				class="twitter-timeline"
				data-width="300"
				href="https://twitter.com/FrankerFaceZ?ref_src=twsrc%5Etfw"
			>
				{{ t('home.tweets', 'Tweets by FrankerFaceZ') }}
			</a>
		</div>
	</div>
</template>


<script>

import HOME_MD from '../home.md';

import {createElement as e} from 'utilities/dom';

export default {
	props: ['item', 'context'],

	data() {
		return {
			md: HOME_MD,
			theme: '',
			addons: null,
			new_addons: null,
			unseen: this.item.getUnseen()
		}
	},

	created() {
		this.updateAddons();
		this.updateTheme();
		this.context.context.on('changed:theme.is-dark', this.updateTheme, this);

		const ffz = this.context.getFFZ();
		ffz.on('main_menu:update-unseen', this.updateUnseen, this);
		ffz.on('addons:data-loaded', this.updateAddons, this);
	},

	beforeDestroy() {
		this.context.context.off('changed:theme.is-dark', this.updateTheme, this);

		const ffz = this.context.getFFZ();
		ffz.off('main_menu:update-unseen', this.updateUnseen, this);
		ffz.off('addons:data-loaded', this.updateAddons, this);
	},

	mounted() {
		let el;
		document.head.appendChild(el = e('script', {
			id: 'ffz--twitter-widget-script',
			async: true,
			charset: 'utf-8',
			src: 'https://platform.twitter.com/widgets.js',
			onLoad: () => el.remove()
		}));
	},

	methods: {
		updateUnseen() {
			this.unseen = this.item.getUnseen();
		},

		updateAddons() {
			const ffz = this.context.getFFZ(),
				addon_module = ffz.resolve('addons'),
				addons = addon_module?.addons;

			const out = [],
				new_out = [],
				week_ago = Date.now() - (86400 * 7 * 1000);

			if ( addons )
				for(const [key, addon] of Object.entries(addons)) {
					const enabled = addon_module.isAddonEnabled(key),
						copy = {
							key,
							enabled,
							icon: addon.icon,
							name: addon.name,
							name_i18n: addon.name_i18n,
							updated: addon.updated,
							settings: addon.settings,
							version: addon.version
						};

					if ( addon.created && addon.created >= week_ago )
						new_out.push(copy);

					if ( addon.updated && addon.updated >= week_ago && enabled ) {
						out.push(copy);
					}
				}

			out.sort((a,b) => b.updated - a.updated);
			new_out.sort((a,b) => b.created - a.created);

			this.addons = out.length ? out : null;
			this.new_addons = new_out.length ? new_out : null;
		},

		updateTheme() {
			this.theme = this.context.context.get('theme.is-dark') ? 'dark' : 'light'
		}
	}
}
</script>