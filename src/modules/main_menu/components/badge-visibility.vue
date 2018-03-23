<template lang="html">
<div class="ffz--badge-visibility tw-pd-t-05">
	<div
		class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-1"
		v-if="source && source !== profile"
	>
		<span class="ffz-i-info" />
		{{ t('setting.badge-inheritence', 'These values are being overridden by another profile and may not take effect.') }}
	</div>

	<div class="tw-mg-b-2 tw-align-right">
		<button
			class="tw-mg-l-05 tw-button tw-button--hollow tw-tooltip-wrapper"
			@click="clear"
			:disabled="! has_value"
		>
			<span class="tw-button__icon tw-button__icon--left">
				<figure class="ffz-i-cancel" />
			</span>
			<span class="tw-button__text">
				{{ t('setting.reset-all', 'Reset All to Default') }}
			</span>
		</button>
	</div>

	<section class="ffz--menu-container tw-border-t" v-for="sec in data">
		<header>{{ sec.title }}</header>
		<ul class="tw-flex tw-flex-wrap tw-align-content-start">
			<li v-for="i in sort(sec.badges)" class="ffz--badge-info tw-pd-y-1 tw-pd-r-1 tw-flex" :class="{default: badgeDefault(i.id)}">
				<input
					type="checkbox"
					class="tw-checkbox__input"
					:checked="badgeChecked(i.id)"
					:id="i.id"
					@click="onChange(i.id, $event)"
					>

				<label class="tw-checkbox__label tw-flex" :for="i.id">
					<div class="preview-image ffz-badge tw-mg-r-1 tw-flex-shrink-0" :style="{backgroundColor: i.color, backgroundImage: i.styleImage }" />
					<div>
						<h5>{{ i.name }}</h5>
						<section class="tw-mg-t-05" v-if="i.versions && i.versions.length > 1">
							<span v-for="v in i.versions" data-tooltip-type="html" class="ffz-badge ffz-tooltip" :title="v.name" :style="{backgroundColor: i.color, backgroundImage: v.styleImage}" />
						</section>
						<button
							class="tw-mg-t-05 tw-button tw-button--hollow tw-tooltip-wrapper"
							@click="reset(i.id)"
							v-if="! badgeDefault(i.id)"
							>
							<span class="tw-button__text">Reset</span>
							<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
								{{ t('setting.reset', 'Reset to Default') }}
							</span>
						</button>
					</div>
				</label>
			</li>
		</ul>
	</section>
</div>
</template>

<script>

import SettingMixin from '../setting-mixin';
import {has} from 'utilities/object';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	methods: {
		badgeChecked(id) {
			return ! this.value[id];
		},

		badgeDefault(id) {
			return ! has(this.value, id);
		},

		onChange(id, event) {
			const control = event.target,
				new_val = {[id]: ! control.checked};

			this.set(Object.assign({}, this.value, new_val));
		},

		reset(id) {
			const val = Object.assign({}, this.value);
			delete val[id];

			if ( ! Object.keys(val).length )
				this.clear();
			else
				this.set(val);
		},

		sort(items) {
			return items.sort((a, b) => {
				const an = a.name.toLowerCase(),
					bn = b.name.toLowerCase();

				if ( an < bn ) return -1;
				if ( an > bn ) return 1;
				return 0;
			});
		}
	}
}

</script>