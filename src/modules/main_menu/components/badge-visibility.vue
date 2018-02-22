<template lang="html">
<div class="ffz--badge-visibility tw-pd-t-05">
	<section class="ffz--menu-container tw-border-t" v-for="sec in data">
		<header>{{ sec.title }}</header>
		<ul class="tw-flex tw-flex-wrap tw-align-content-start">
			<li v-for="i in sort(sec.badges)" class="ffz--badge-info tw-pd-y-1 tw-pd-r-1 tw-flex" :class="{default: isDefault}">
				<input
					type="checkbox"
					class="tw-checkbox__input"
					checked="checked"
					:id="i.id"
					>

				<label class="tw-checkbox__label tw-flex" :for="i.id">
					<div class="preview-image ffz-badge tw-mg-r-1 tw-flex-shrink-0" :style="{backgroundColor: i.color, backgroundImage: i.styleImage }" />
					<div>
						<h5>{{ i.name }}</h5>
						<section class="tw-mg-t-05" v-if="i.versions && i.versions.length > 1">
							<span v-for="v in i.versions" data-tooltip-type="html" class="ffz-badge ffz-tooltip" :title="v.name" :style="{backgroundColor: i.color, backgroundImage: v.styleImage}" />
						</section>
						<!--button class="tw-mg-t-05 tw-button tw-button--hollow tw-tooltip-wrapper">
							<span class="tw-button__text">Reset</span>
							<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
								{{ t('setting.reset', 'Reset to Default') }}
							</span>
						</button-->
					</div>
				</label>
			</li>
		</ul>
	</section>
</div>
</template>

<script>

import SettingMixin from '../setting-mixin';

export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	methods: {
		sort(items) {
			return items.sort((a, b) => {
				const an = a.name.toLowerCase(),
					bn = b.name.toLowerCase();

				if ( an < bn ) return -1;
				if ( an > bn ) return 1;
				return 0;
			});
		},

		onChange() {
			this.set(this.$refs.control.checked);
		}
	}
}

</script>

<style lang="scss" scoped>
.ffz--badge-info {
	&.default {
		label:before, label:after {
			opacity: 0.5
		}
	}

	.tw-checkbox__input:checked+.tw-checkbox__label:after,
	label:before, label:after {
		top: 1.05rem;
	}

	.ffz-badge.preview-image {
		width: 7.2rem;
		height: 7.2rem;
		background-size: 7.2rem;
		background-repeat: no-repeat;
	}

	width: 30rem;
}
</style>
