<template>
	<div class="tw-pd-x-1 tw-pd-y-05">
		<div class="tw-card tw-relative">
			<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row">
				<div class="ffz-card-img ffz-card-img--size-3 tw-flex-shrink-0 tw-overflow-hidden tw-avatar">
					<aspect :ratio="1">
						<img
							:alt="$attrs.user.displayName"
							:src="$attrs.user.profileImageURL"
							class="tw-image tw-image-avatar tw-border-radius-rounded"
						>
					</aspect>
				</div>
				<div class="tw-card-body tw-overflow-hidden tw-relative tw-flex tw-align-items-center tw-flex-grow-1">
					<div
						v-if="$attrs.user.login && $attrs.user.displayName && $attrs.user.login.trim() !== $attrs.user.displayName.trim().toLowerCase()"
						class="tw-flex tw-flex-column tw-mg-x-1 tw-flex-grow-1"
					>
						<p>{{ $attrs.user.displayName }}</p>
						<p class="tw-font-size-8 tw-c-text-alt-2">
							({{ $attrs.user.login }})
						</p>
					</div>
					<p v-else class="tw-mg-x-1 tw-flex-grow-1">
						{{ $attrs.user.displayName }}
					</p>
					<figure
						v-if="$attrs.user.roles && $attrs.user.roles.isPartner"
						class="tw-c-text-link ffz-i-verified"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
export default {
	inheritAttrs: false
};
</script>
