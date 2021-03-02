<template lang="html">
	<div class="ffz--widget ffz--profile-selector">
		<div
			ref="button"
			:class="{active: opened}"
			tabindex="0"
			class="tw-flex tw-align-items-center tw-border-radius-medium tw-font-size-6 tw-full-width ffz-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05"
			@keyup.up.stop.prevent="focusShow"
			@keyup.left.stop.prevent="focusShow"
			@keyup.down.stop.prevent="focusShow"
			@keyup.right.stop.prevent="focusShow"
			@keyup.enter="focusShow"
			@keyup.space="focusShow"
			@click="togglePopup"
		>
			{{ context.currentProfile.i18n_key ? t(context.currentProfile.i18n_key, context.currentProfile.title, context.currentProfile) : context.currentProfile.title }}
		</div>
		<div
			v-if="opened"
			v-on-clickaway="hide"
			class="ffz-balloon tw-block ffz-balloon--lg ffz-balloon--down ffz-balloon--left tw-z-above"
		>
			<div
				class="ffz--profile-list tw-elevation-2 tw-c-background-alt"
				@keyup.escape="focusHide"
				@focusin="focus"
				@focusout="blur"
			>
				<div class="scrollable-area tw-border-b" data-simplebar>
					<div class="simplebar-scroll-content">
						<div ref="popup" class="simplebar-content">
							<div
								v-for="p in context.profiles"
								:key="p.id"
								:class="{
									live: p.live,
									current: p === context.currentProfile
								}"
								tabindex="0"
								class="ffz--profile-row tw-relative tw-border-b tw-pd-y-05 tw-pd-r-3 tw-pd-l-1"
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
								<div class="ffz--profile-row__icon-tray tw-flex">
									<div
										v-if="p.url"
										:class="`tw-tooltip__container ffz--profile-row__icon ffz-i-download-cloud tw-relative${p.pause_updates ? ' ffz-unmatched-item' : ''}`"
									>
										<div v-if="! p.pause_updates" class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
											{{ t('setting.profiles.updates', 'This profile will update automatically.') }}
										</div>
									</div>
									<div
										v-if="! p.toggled"
										class="tw-tooltip__container ffz--profile-row__icon ffz-i-cancel tw-relative"
									>
										<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
											{{ t('setting.profiles.disabled', 'This profile is disabled.') }}
										</div>
									</div>
									<div
										v-if="p.live"
										class="tw-tooltip__container ffz--profile-row__icon ffz-i-ok tw-relative"
									>
										<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
											{{ t('setting.profiles.active', 'This profile is enabled and active.') }}
										</div>
									</div>
								</div>

								<h4>{{ p.i18n_key ? t(p.i18n_key, p.title, p) : p.title }}</h4>
								<div v-if="p.description" class="description">
									{{ p.desc_i18n_key ? t(p.desc_i18n_key, p.description, p) : p.description }}
								</div>
							</div>
						</div>
					</div>
				</div>
				<div class="tw-pd-y-05 tw-pd-x-05 tw-align-right">
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

const indexOf = Array.prototype.indexOf;

export default {
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

			try {
				window.history.replaceState({
					...window.history.state,
					ffzccp: profile.id
				}, document.title);
			} catch(err) {
				/* no-op */
				console.error(err);
			}

			this.focusHide();
		}
	}
}

</script>