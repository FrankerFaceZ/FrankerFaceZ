<template>
	<section class="tw-background-c tw-relative">
		<div class="tw-background-c tw-full-width tw-flex tw-flex-row tw-pd-r-05 tw-pd-l-1 tw-pd-y-1">
			<div class="tw-mg-r-05">
				<div class="tw-inline-block">
					<button class="tw-button">
						<span class="tw-button__text" data-a-target="tw-button-text">Add Friend</span>
					</button>
				</div>
			</div>
			<div class="tw-mg-r-05">
				<div class="tw-inline-block">
					<button class="tw-button" data-a-target="usercard-whisper-button" data-test-selector="whisper-button">
						<span class="tw-button__text" data-a-target="tw-button-text">Whisper</span>
					</button>
				</div>
			</div>
			<div class="tw-flex-grow-1 tw-align-right">
				<div class="tw-inline-block">
					<button data-title="More Options" data-tooltip-type="html" class="tw-button-icon ffz-tooltip" @click="close">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-ellipsis-vert" />
						</span>
					</button>
				</div>
			</div>
		</div>
		<div class="tw-c-background-alt-2 tw-pd-x-1 tw-pd-y-05">
			<div>
				<div class="tw-inline-block tw-pd-r-1">
					<button data-title="Ban User" data-tooltip-type="html" class="tw-button-icon ffz-tooltip" @click="close">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-block" />
						</span>
					</button>
				</div>
				<div class="tw-inline-block tw-pd-r-1">
					<button data-title="Timeout User" data-tooltip-type="html" class="tw-button-icon ffz-tooltip" @click="close">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-clock" />
						</span>
					</button>
				</div>
				<div class="tw-inline-block tw-pd-r-1">
					<button data-title="Mod User" data-tooltip-type="html" class="tw-button-icon ffz-tooltip" @click="close">
						<span class="tw-button-icon__icon">
							<figure class="ffz-i-star" />
						</span>
					</button>
				</div>
			</div>
		</div>
	</section>
</template>

<script>

import TabMixin from '../tab-mixin';

export default {
	mixins: [TabMixin],
	props: ['tab', 'user', 'room', 'currentUser']
}

</script>