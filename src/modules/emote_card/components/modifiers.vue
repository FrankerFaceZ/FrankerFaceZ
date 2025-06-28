<template>
	<section
		class="ffz-emote-card__modifiers"
		:class="{'tw-pd-b-05': expanded}"
	>
		<div
			class="tw-flex tw-align-items-center tw-c-background-alt-2 tw-pd-y-05 tw-pd-x-1 ffz--cursor"
			@click="toggle"
		>
			<div class="tw-flex-grow-1">
				<h4>{{ t('emote-card.modifiers', 'Modifiers') }}</h4>
			</div>

			<figure
				:class="{
					'ffz-i-down-dir': expanded,
					'ffz-i-left-dir': ! expanded
				}"
			/>
		</div>
		<div
			v-for="(mod, idx) in modifiers"
			v-if="expanded"
			:key="idx"
			class="tw-pd-05 tw-flex tw-align-items-center tw-border-t"
		>
			<div class="tw-mg-l-05 tw-inline-flex">
				<figure
					v-if="mod.icon"
					class="ffz-avatar ffz-avatar--50"
				>
					<img
						:src="mod.icon"
						class="tw-block tw-image tw-image-avatar"
					>
				</figure>
				<figure
					v-else
					class="ffz-avatar"
					:style="mod.imageStyle"
				>
					<img
						v-if="mod.src"
						:src="mod.src"
						:srcset="mod.srcSet"
						class="tw-block tw-image tw-image-avatar"
					>
				</figure>
			</div>
			<div class="tw-align-left tw-flex-grow-1 tw-ellipsis tw-mg-x-1">
				<h4 class="tw-inline" :title="mod.name">
					{{ mod.name }}
				</h4>
				<p
					v-if="mod.source"
					class="tw-c-text-alt-2 tw-font-size-6"
					:title="mod.source_i18n ? t(mod.source_i18n, mod.source) : mod.source"
				>
					{{ mod.source_i18n ? t(mod.source_i18n, mod.source) : mod.source }}
				</p>
				<p v-if="mod.owner" class="tw-c-text-alt-2 tw-font-size-6">
					<t-list
						phrase="emote-card.owner"
						default="Owner: {owner}"
					>
						<template #owner>
							<a
								v-if="mod.ownerLink"
								rel="noopener noreferrer"
								target="_blank"
								:href="mod.ownerLink"
							>{{ mod.owner }}</a>
							<span v-else>{{ mod.owner }}</span>
						</template>
					</t-list>
				</p>
				<p v-if="mod.artist" class="tw-c-text-alt-2 tw-font-size-6">
					<t-list
						phrase="emote-card.artist"
						default="Artist: {artist}"
					>
						<template #artist>
							<a
								v-if="mod.artistLink"
								rel="noopener noreferrer"
								target="_blank"
								:href="mod.artistLink"
								class="ffz-i-artist"
							>{{ mod.artist }}</a>
							<span v-else>{{ mod.artist }}</span>
						</template>
					</t-list>
				</p>
			</div>
		</div>
	</section>
</template>

<script>

export default {

	props: [
		'raw_modifiers',
		'getFFZ'
	],

	data() {
		const ffz = this.getFFZ(),
			settings = ffz.resolve('settings'),
			provider = settings.provider;

		return {
			expanded: provider.get('emote-card.expand-mods', true)
		}
	},

	computed: {
		modifiers() {
			const ffz = this.getFFZ(),
				emotes = ffz.resolve('chat.emotes');

			const out = [];

			for(const [set_id, emote_id] of this.raw_modifiers) {
				if ( set_id === 'info' ) {
					out.push({
						type: 'info',
						icon: emote_id?.icon,
						name: emote_id?.label
					});
					continue;
				}

				const emote_set = emotes.emote_sets[set_id],
					emote = emote_set?.emotes?.[emote_id];

				if ( emote ) {
					const is_effect = emote.modifier_flags != 0;

					out.push({
						type: 'emote',
						id: emote.id,
						src: emote.animSrc ?? emote.src,
						srcSet: emote.animSrcSet ?? emote.srcSet,
						width: emote.width,
						height: emote.height,
						name: emote.name,
						imageStyle: {
							width: `${Math.min(112, (emote.width ?? 28) * 1)}px`,
							height: `${(emote.height ?? 28) * 1}px`
						},
						source: emote_set.source_line || (`${emote_set.source || 'FFZ'} ${emote_set.title || 'Global Emotes'}`),
						owner: emote.owner && ! is_effect
							? (emote.owner.display_name || emote.owner.name)
							: null,
						ownerLink: emote.owner && ! is_effect && ! emote_set.source
							? `https://www.frankerfacez.com/${emote.owner.name}`
							: null,
						artist: emote.artist
							? (emote.artist.display_name || emote.artist.name)
							: null,
						artistLink: emote.artist && ! emote_set.source
							? `https://www.frankerfacez.com/${emote.artist.name}`
							: null,
					});
				}
			}

			return out;
		}
	},

	methods: {
		toggle() {
			const ffz = this.getFFZ(),
				settings = ffz.resolve('settings'),
				provider = settings.provider;

			this.expanded = ! this.expanded
			provider.set('emote-card.expand-mods', this.expanded);
		}
	}

}

</script>