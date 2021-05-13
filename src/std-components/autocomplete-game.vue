<template functional>
	<div class="tw-pd-x-1 tw-pd-y-05">
		<div class="tw-card tw-relative">
			<div class="tw-align-items-center tw-flex tw-flex-nowrap tw-flex-row">
				<div class="ffz-card-img ffz-card-img--size-3 tw-flex-shrink-0 tw-overflow-hidden">
					<aspect :ratio="1/1.33">
						<img
							:alt="props.game.displayName"
							:src="props.game.boxArtURL"
							class="tw-image"
						>
					</aspect>
				</div>
				<div class="tw-card-body tw-overflow-hidden tw-relative">
					<p class="tw-pd-x-1">
						{{ props.game.displayName }}
					</p>
				</div>
			</div>
		</div>
	</div>
</template>