<template functional>
	<div class="tw-pd-x-1 tw-pd-y-05">
		<div class="tw-card tw-relative">
			<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row">
				<div class="ffz-card-img ffz-card-img--size-3 tw-flex-shrink-0 tw-overflow-hidden tw-avatar">
					<aspect :ratio="1">
						<img
							:alt="props.user.displayName"
							:src="props.user.profileImageURL"
							class="tw-image tw-image-avatar tw-border-radius-rounded"
						>
					</aspect>
				</div>
				<div class="tw-card-body tw-overflow-hidden tw-relative tw-flex tw-align-items-center tw-flex-grow-1">
					<div
						v-if="props.user.login && props.user.displayName && props.user.login.trim() !== props.user.displayName.trim().toLowerCase()"
						class="tw-flex tw-flex-column tw-mg-x-1 tw-flex-grow-1"
					>
						<p>{{ props.user.displayName }}</p>
						<p class="tw-font-size-8 tw-c-text-alt-2">
							({{ props.user.login }})
						</p>
					</div>
					<p v-else class="tw-mg-x-1 tw-flex-grow-1">
						{{ props.user.displayName }}
					</p>
					<figure
						v-if="props.user.roles && props.user.roles.isPartner"
						class="tw-c-text-link ffz-i-verified"
					/>
				</div>
			</div>
		</div>
	</div>
</template>