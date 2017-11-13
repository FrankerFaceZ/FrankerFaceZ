<template lang="html">
<div class="ffz--widget ffz--profile-selector">
	<div
		tabindex="0"
		class="tw-select"
		:class="{active: opened}"
		ref="button"
		@keyup.up.stop.prevent="focusShow"
		@keyup.left.stop.prevent="focusShow"
		@keyup.down.stop.prevent="focusShow"
		@keyup.right.stop.prevent="focusShow"
		@keyup.enter="focusShow"
		@keyup.space="focusShow"
		@click="togglePopup"
	>
		{{ t(context.currentProfile.i18n_key, context.currentProfile.title, context.currentProfile) }}
	</div>
	<div v-if="opened" v-on-clickaway="hide" class="tw-balloon block tw-balloon--lg tw-balloon--down tw-balloon--left">
		<div
			class="ffz--profile-list elevation-2 c-background-alt"
			@keyup.escape="focusHide"
			@focusin="focus"
			@focusout="blur"
		>
			<div class="scrollable-area border-b" data-simplebar>
				<div class="simplebar-scroll-content">
					<div class="simplebar-content" ref="popup">
						<div
							v-for="(p, idx) in context.profiles"
							tabindex="0"
							class="ffz--profile-row relative border-b pd-y-05 pd-r-3 pd-l-1"
							:class="{
								live: p.live,
								current: p === context.currentProfile
							}"
							@keydown.up.stop.prevent=""
							@keydown.down.stop.prevent=""
							@keydown.page-up.stop.prevent=""
							@keydown.page-down.stop.prevent=""
							@keyup.up.stop="prevItem"
							@keyup.down.stop="nextItem"
							@keyup.home="firstItem"
							@keyup.end="lastItem"
							@keyup.page-up.stop="prevPage"
							@keyup.page-down.stop="nextPage"
							@keyup.enter="changeProfile(p)"
							@click="changeProfile(p)"
						>
							<div
								v-if="p.live"
								class="tw-tooltip-wrapper ffz--profile-row__icon ffz-i-ok absolute"
							>
								<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
									{{ t('setting.profiles.active', 'This profile is active.') }}
								</div>
							</div>


							<h4>{{ t(p.i18n_key, p.title, p) }}</h4>
							<div v-if="p.description" class="description">
								{{ t(p.desc_i18n_key, p.description, p) }}
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="pd-y-05 pd-x-05 align-right">
				<button class="tw-button tw-button--text" @click="openConfigure">
					<span class="tw-button__text ffz-i-cog">
						{{ t('setting.profiles.configure', 'Configure') }}
					</span>
				</button>
			</div>
		</div>
	</div>
</div>
</template>

<script>

import { mixin as clickaway} from 'vue-clickaway';

const indexOf = Array.prototype.indexOf;

export default {
	mixins: [clickaway],
	props: ['context'],

	data() {
		return {
			opened: false
		}
	},

	methods: {
		openConfigure() {
			this.hide();
			this.$emit('navigate', 'data_management.profiles');
		},

		focus() {
			this._focused = true;
		},

		blur() {
			this._focused = false;
			if ( ! this._blur_timer )
				this._blur_timer = setTimeout(() => {
					this._blur_timer = null;
					if ( ! this._focused && document.hasFocus() )
						this.hide();
				}, 10);
		},


		hide() {
			this.opened = false;
		},

		show() {
			if ( ! this.opened )
				this.opened = true;
		},

		togglePopup() {
			if ( this.opened )
				this.hide();
			else
				this.show();
		},


		focusHide() {
			this.hide();
			this.$refs.button.focus();
		},

		focusShow() {
			this.show();
			this.$nextTick(() => this.$refs.popup.querySelector('.current').focus());
		},

		prevItem(e) {
			const el = e.target.previousSibling;
			if ( el ) {
				this.scroll(el);
				el.focus();
			}
		},

		nextItem(e) {
			const el = e.target.nextSibling;
			if ( el ) {
				this.scroll(el);
				el.focus();
			}
		},

		firstItem() {
			const el = this.$refs.popup.firstElementChild;
			if ( el ) {
				this.scroll(el);
				el.focus();
			}
		},

		prevPage(e) {
			this.select(indexOf.call(this.$refs.popup.children, e.target) - 5);
		},

		nextPage(e) {
			this.select(indexOf.call(this.$refs.popup.children, e.target) + 5);
		},

		select(idx) {
			const kids = this.$refs.popup.children,
				el = kids[idx <= 0 ? 0 : Math.min(idx, kids.length - 1)];

			if ( el ) {
				this.scroll(el);
				el.focus();
			}
		},

		lastItem() {
			const el = this.$refs.popup.lastElementChild;
			if ( el ) {
				this.scroll(el);
				el.focus();
			}
		},

		scroll(el) {
			const scroller = this.$refs.popup.parentElement,

				top = el.offsetTop,
				bottom = el.offsetHeight + top,

				// We need to use the margin-bottom because of the scrollbar library.
				// In fact, the scrollbar library is why any of this function exists.
				scroll_top = scroller.scrollTop,
				scroll_bottom = scroller.offsetHeight + parseInt(scroller.style.marginBottom || 0, 10) + scroll_top;

			if ( top < scroll_top )
				scroller.scrollBy(0, top - scroll_top);

			else if ( bottom > scroll_bottom )
				scroller.scrollBy(0, bottom - scroll_bottom);
		},

		changeProfile(profile) {
			this.context.currentProfile = profile;
			this.focusHide();
		}
	}
}

</script>