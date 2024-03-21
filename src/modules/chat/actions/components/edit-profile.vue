<template lang="html">
	<div>
		<div class="tw-flex tw-align-items-center">
			<label for="edit_profile">
				{{ t('setting.actions.profile', 'Profile') }}
			</label>

			<select
				id="edit_profile"
				v-model.trim="value.uuid"
				class="tw-border-radius-medium tw-font-size-6 tw-full-width ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-y-05"
				@input="$emit('input', value)"
			>
				<option
					v-for="profile in profiles"
					:key="profile.value"
					:value="profile.value"
				>{{ profile.i18n_key ? t(profile.i18n_key, profile.name) : profile.name }}</option>
			</select>
		</div>
	</div>
</template>

<script>

export default {
	props: ['value', 'defaults'],

	data() {
		const ffz = window.FrankerFaceZ.get(),
			settings = ffz?.resolve('settings'),
			profiles = settings?.__profiles;

		return {
			profiles: profiles ? profiles.map(prof => ({
				value: prof.uuid,
				name: prof.name,
				i18n_key: prof.i18n_key
			})) : []
		}
	}
}

</script>
