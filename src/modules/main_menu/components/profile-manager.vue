<template lang="html">
<div class="ffz--widget ffz--profile-manager border-t pd-y-1">
	<div class="c-background-accent c-text-overlay pd-1 mg-b-1">
		<h3 class="ffz-i-attention">
			This feature is not yet finished.
		</h3>

		Creating and editing profiles is disabled until the rule editor is finished.
	</div>
	<div class="flex align-items-center pd-b-05">
		<div class="flex-grow-1">
			{{ t('setting.profiles.drag', 'Drag profiles to change their priority.') }}
		</div>
		<button class="mg-l-1 tw-button tw-button--text" disabled @notclick="edit()">
			<span class="tw-button__text ffz-i-plus">
				{{ t('setting.profiles.new', 'New Profile') }}
			</span>
		</button>
		<!--button class="mg-l-1 tw-button tw-button--text">
			<span class="tw-button__text ffz-i-upload">
				{{ t('setting.profiles.import', 'Import…') }}
			</span>
		</button-->
	</div>

	<div ref="list" class="ffz--profile-list">
		<section
			v-for="p in context.profiles"
			:key="p.id"
			:data-profile="p.id"
		>
			<div
				class="ffz--profile elevation-1 c-background border pd-y-05 pd-r-1 mg-y-05 flex flex--nowrap"
				:class="{live: p.live}"
				tabindex="0"
			>
				<div class="flex flex-shrink-0 align-items-center handle pd-x-05 pd-t-1 pd-b-05">
					<span class="ffz-i-ellipsis-vert" />
				</div>

				<div class="flex-grow-1">
					<h4>{{ t(p.i18n_key, p.title, p) }}</h4>
					<div v-if="p.description" class="description">
						{{ t(p.desc_i18n_key, p.description, p) }}
					</div>
				</div>

				<div class="flex flex-shrink-0 align-items-center">
					<button class="tw-button tw-button--text" disabled @notclick="edit(p)">
						<span class="tw-button__text ffz-i-cog">
							{{ t('setting.profiles.configure', 'Configure') }}
						</span>
					</button>
				</div>

				<div class="flex flex-shrink-0 align-items-center border-l mg-l-1 pd-l-1">
					<div v-if="p.live" class="ffz--profile__icon ffz-i-ok tw-tooltip-wrapper">
						<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
							{{ t('setting.profiles.active', 'This profile is active.') }}
						</div>
					</div>
					<div v-if="! p.live" class="ffz--profile__icon ffz-i-cancel tw-tooltip-wrapper">
						<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
							{{ t('setting.profiles.inactive', 'This profile is not active.') }}
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
</template>

<script>

import Sortable from 'sortablejs';

export default {
	props: ['item', 'context'],

	methods: {
		edit(profile) {
			const item = {
				full_key: 'data_management.profiles.edit_profile',
				key: 'edit_profile',

				profile_warning: false,

				title: `Edit Profile`,
				i18n_key: 'setting.data_management.profiles.edit_profile',
				parent: this.item.parent,

				contents: [{
					page: true,
					profile,
					component: 'profile-editor'
				}]
			};

			item.contents[0].parent = item;
			this.$emit('change-item', item);
		}
	},

	mounted() {
		this._sortable = Sortable.create(this.$refs.list, {
			draggable: 'section',
			filter: 'button',

			onUpdate: (event) => {
				const id = event.item.dataset.profile,
					profile = this.context.profile_keys[id];

				if ( profile )
					profile.move(event.newIndex);
			}
		});
	},

	beforeDestroy() {
		if ( this._sortable )
			this._sortable.destroy();

		this._sortable = null;
	}

}

</script>