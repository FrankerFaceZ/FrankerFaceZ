<template lang="html">
<div class="ffz--widget ffz--filter-editor">
	<div ref="list" class="ffz--rule-list">
		<section v-for="(rule, idx) in rules">
			<div
				class="ffz--rule elevation-1 c-background border mg-b-05 pd-y-05 pd-r-1 flex flex--nowrap align-items-start"
				tabindex="0"
			>
				<div class="flex flex-shrink-0 align-items-center handle pd-x-05 pd-y-1">
					<span class="ffz-i-ellipsis-vert" />
				</div>

				<div class="flex-shrink-0 pd-y-05">
					Channel
				</div>

				<div class="mg-x-1 flex flex-grow-1">
					<div class="flex-shrink-0 mg-r-1">
						<select class="tw-select">
							<option>is one of</option>
							<option>is not one of</option>
						</select>
					</div>
					<div class="flex-grow-1">
						<input
							type="text"
							class="tw-input"
							value="SirStendec"
							/>
					</div>
				</div>

				<div class="flex flex-shrink-0 align-items-center">
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
		class="tw-button tw-button--hollow mg-y-1 full-width"
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