<template lang="html">
<div class="ffz-auto-host-options">
	<header class="c-background full-width align-items-center flex flex-nowrap">
		<h4>Auto Host Management</h4>
	</header>
	<section class="border-t full-height full-width flex flex-nowrap overflow-hidden">
		<main class="flex-grow-1 scrollable-area" data-simplebar="init">
			<div class="simplebar-scroll-content">
				<!-- <div class="simplebar-content ffz-host-options-sortable"> -->
				<draggable v-model="hosts" class="simplebar-content ffz-host-options-sortable" :options="{
					handle: '.handle',
					draggable: '.ffz--host-user',
					animation: 150,
				}" @update="rearrangeHosts">
					<div v-for="host in hosts" class="border-t ffz--host-user" :data-id="host._id">
						<div class="tw-interactable">
							<div class="align-items-center flex flex-row flex-nowrap mg-x-1 mg-y-05">
								<figure class="ffz-i-ellipsis-vert handle" style="padding: 0 0.4rem 0 0;"></figure>
								<div class="ffz-channel-avatar">
									<img :src="host.logo" :alt="host.display_name + '(' + host.name + ')'">
								</div>
								<p class="ellipsis flex-grow-1 mg-l-1 font-size-5">{{ host.name }}</p>
								<div class="flex-grow-1 pd-x-2"></div>
								<button class="tw-button-icon mg-x-05 ffz--host-remove-user" @click="removeFromHosts">
									<figure class="ffz-i-trash" style="padding: 0.4rem 0.2rem;"></figure>
								</button>
							</div>
						</div>
					</div>
				</draggable>
				<!-- </div> -->
			</div>
		</main>
	</section>
	<header class="border-t c-background full-width align-items-center flex flex-nowrap">
		<div class="flex-grow-1 pd-x-2"></div>
		<button class="tw-button tw-button--hollow mg-x-05" v-bind:class="{'tw-button--disabled': addedToHosts}" @click="addToAutoHosts">
			<span class="tw-button__text">Add To Auto Host</span>
		</button>
	</header>
</div>
</template>


<script>
import Sortable from 'sortablejs';
import draggable from 'vuedraggable';

export default {
	components: {
		draggable
	},

  	data() {
		return this.$vnode.data;
	}
}
</script>
