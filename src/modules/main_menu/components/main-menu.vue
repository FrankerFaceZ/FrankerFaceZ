<template lang="html">
<div class="ffz-main-menu elevation-3 c-background-alt border flex flex--nowrap flex-column" :class="{ maximized }">
	<header class="c-background full-width align-items-center flex flex-nowrap" @dblclick="resize">
		<h3 class="ffz-i-zreknarf ffz-i-pd-1">FrankerFaceZ</h3>
		<div class="flex-grow-1 pd-x-2">
			<!--div class="tw-search-input">
				<label for="ffz-main-menu.search" class="hide-accessible">{{ t('main-menu.search', 'Search Settings') }}</label>
				<div class="relative">
					<div class="tw-input__icon-group">
						<div class="tw-input__icon">
							<figure class="ffz-i-search" />
						</div>
					</div>
					<input type="search" class="tw-input tw-input--icon-left" :placeholder="t('main-menu.search', 'Search Settings')" autocapitalize="off" autocorrect="off" autocomplete="off" id="ffz-main-menu.search">
				</div>
			</div-->
		</div>
		<button class="tw-button-icon mg-x-05" @click="resize">
			<span class="tw-button-icon__icon">
				 <figure :class="{'ffz-i-window-maximize': !maximized, 'ffz-i-window-restore': maximized}" />
			</span>
		</button>
		<button class="tw-button-icon mg-x-05" @click="close">
			<span class="tw-button-icon__icon">
				<figure class="ffz-i-window-close" />
			</span>
		</button>
	</header>
	<section class="border-t full-height full-width flex flex-nowrap overflow-hidden">
		<nav class="ffz-vertical-nav c-background-alt-2 border-r full-height flex flex-column flex-shrink-0 flex-nowrap">
			<header class="border-b pd-1">
				<profile-selector
					:context="context"
					@navigate="navigate"
					/>
			</header>
			<div class="full-width full-height overflow-hidden flex flex-nowrap relative">
				<div class="ffz-vertical-nav__items full-width flex-grow-1 scrollable-area" data-simplebar>
					<div class="simplebar-scroll-content">
						<div class="simplebar-content">
							<menu-tree
								:currentItem="currentItem"
								:modal="nav"
								@change-item="changeItem"
								@navigate="navigate"
							/>
						</div>
					</div>
				</div>
			</div>
			<footer class="c-text-alt border-t pd-1">
				<div>
					{{ t('main-menu.version', 'Version %{version}', {version: version.toString()}) }}
				</div>
				<div class="c-text-alt-2">
					{{version.build}}
				</div>
			</footer>
		</nav>
		<main class="flex-grow-1 scrollable-area" data-simplebar>
			<div class="simplebar-scroll-content">
				<div class="simplebar-content">
					<menu-page
						ref="page"
						:context="context"
						:item="currentItem"
						@change-item="changeItem"
						@navigate="navigate"
						v-if="currentItem"
					/>
				</div>
			</div>
		</main>
	</section>
</div>
</template>

<script>

import displace from 'displacejs';

export default {
	data() {
		return this.$vnode.data;
	},

	created() {
		this.context.context._add_user();
	},

	destroyed() {
		this.context.context._remove_user();
	},

	methods: {
		changeProfile() {
			const new_id = this.$refs.profiles.value,
				new_profile = this.context.profiles[new_id];

			if ( new_profile )
				this.context.currentProfile = new_profile;
		},

		changeItem(item) {
			if ( this.$refs.page && this.$refs.page.onBeforeChange ) {
				if ( this.$refs.page.onBeforeChange(this.currentItem, item) === false )
					return;
			}

			this.currentItem = item;
			let current = item;
			while(current = current.parent)
				current.expanded = true;
		},

		updateDrag() {
			if ( this.maximized )
				this.destroyDrag();
			else
				this.createDrag();
		},

		destroyDrag() {
			if ( this.displace ) {
				this.displace.destroy();
				this.displace = null;
			}
		},

		createDrag() {
			this.$nextTick(() => {
				if ( ! this.maximized )
					this.displace = displace(this.$el, {
						handle: this.$el.querySelector('header'),
						highlightInputs: true,
						constrain: true
					});
			})
		},

		handleResize() {
			if ( this.displace )
				this.displace.reinit();
		},

		navigate(key) {
			let item = this.nav_keys[key];
			while(item && item.page)
				item = item.parent;

			if ( ! item )
				return;

			this.changeItem(item);
		}
	},

	watch: {
		maximized() {
			this.updateDrag();
		}
	},

	mounted() {
		this.updateDrag();

		this._on_resize = this.handleResize.bind(this);
		window.addEventListener('resize', this._on_resize);
	},

	beforeDestroy() {
		this.destroyDrag();

		if ( this._on_resize ) {
			window.removeEventListener('resize', this._on_resize);
			this._on_resize = null;
		}
	}
}
</script>