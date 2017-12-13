<template lang="html">
<div class="ffz--widget ffz--filter-editor">
	<div ref="list" class="ffz--rule-list">
		<section v-for="(rule, idx) in rules">
			<div
				class="ffz--rule tw-elevation-1 tw-c-background tw-border tw-mg-b-05 tw-pd-y-05 tw-pd-r-1 tw-flex tw-flex-nowrap tw-align-items-start"
				tabindex="0"
			>
				<div class="tw-flex tw-flex-shrink-0 tw-align-items-center tw-handle tw-pd-x-05 tw-pd-y-1">
					<span class="ffz-i-ellipsis-vert" />
				</div>

				<div class="tw-flex-shrink-0 tw-pd-y-05">
					Channel
				</div>

				<div class="tw-mg-x-1 tw-flex tw-flex-grow-1">
					<div class="tw-flex-shrink-0 tw-mg-r-1">
						<select class="tw-select">
							<option>is one of</option>
							<option>is not one of</option>
						</select>
					</div>
					<div class="tw-flex-grow-1">
						<input
							type="text"
							class="tw-input"
							value="SirStendec"
							/>
					</div>
				</div>

				<div class="tw-flex tw-flex-shrink-0 tw-align-items-center">
					<button class="tw-button tw-button--text" @click="del(idx)">
						<span class="tw-button__text ffz-i-trash">
							{{ t('setting.filters.delete', 'Delete') }}
						</span>
					</button>
				</div>
			</div>
		</section>
	</div>

	<button
		class="tw-button tw-button--hollow tw-mg-y-1 tw-full-width"
		@click="newRule"
	>
		<span class="tw-button__text ffz-i-plus">
			{{ t('', 'Add New Rule') }}
		</span>
	</button>
</div>
</template>

<script>

export default {
	props: ['filters', 'rules', 'context'],

	methods: {
		newRule() {

		}
	}
}

</script>