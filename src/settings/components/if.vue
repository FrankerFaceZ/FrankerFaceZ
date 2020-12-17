<template>
	<section class="tw-flex-grow-1 tw-align-self-start">
		<div>
			<header class="tw-mg-y-05">
				{{ t(type.i18n, type.title) }}
			</header>

			<filter-editor
				v-model="value.data[0]"
				class="tw-flex-grow-1"
				:filters="filters"
				:context="context"
				:max-rules="type.maxRules"
			/>
		</div>

		<div class="tw-border-t tw-mg-t-05 tw-pd-t-05">
			<header class="tw-flex tw-align-items-center">
				<div class="ffz--profile__icon tw-pd-r-05 tw-pd-y-05 tw-relative tw-tooltip__container">
					<figure :class="[passes ? 'ffz-i-ok' : 'ffz-i-cancel']" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
						<span v-if="passes">
							{{ t('setting.filters.if.pass', 'This branch is active because the condition is true.') }}
						</span>
						<span v-else>
							{{ t('setting.filters.if.no_pass', 'This branch is not active because the condition is false.') }}
						</span>
					</div>
				</div>
				<div class="tw-mg-y-05">
					{{ t('setting.filter.if.then', 'Then') }}
				</div>
			</header>

			<filter-editor
				v-model="value.data[1]"
				class="tw-flex-grow-1"
				:filters="filters"
				:context="context"
				:max-rules="type.maxRules"
			/>
		</div>

		<div class="tw-border-t tw-mg-t-05 tw-pd-t-05">
			<header class="tw-flex tw-align-items-center">
				<div class="ffz--profile__icon tw-pd-r-05 tw-pd-y-05 tw-relative tw-tooltip__container">
					<figure :class="[passes ? 'ffz-i-cancel' : 'ffz-i-ok']" />
					<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
						<span v-if="passes">
							{{ t('setting.filters.if.no_fail', 'This branch is not active because the condition is true.') }}
						</span>
						<span v-else>
							{{ t('setting.filters.if.fail', 'This branch is active because the condition is false.') }}
						</span>
					</div>
				</div>
				<div class="tw-mg-y-05">
					{{ t('setting.filter.if.else', 'Else') }}
				</div>
			</header>

			<filter-editor
				v-model="value.data[2]"
				class="tw-flex-grow-1"
				:filters="filters"
				:context="context"
				:max-rules="type.maxRules"
			/>
		</div>
	</section>
</template>

<script>

import {createTester} from 'utilities/filtering';

let last_id = 0;

export default {
	props: ['value', 'type', 'filters', 'context'],

	data() {
		return {
			id: last_id++
		}
	},

	computed: {
		tester() {
			return createTester(this.value.data[0], this.filters);
		},

		passes() {
			return this.tester && this.tester(this.context)
		}
	}
}

</script>