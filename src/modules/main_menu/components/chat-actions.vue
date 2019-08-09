<template lang="html">
	<div class="ffz--widget ffz--chat-actions tw-border-t tw-pd-y-1">
		<div
			v-if="source && source !== profile"
			class="tw-c-background-accent tw-c-text-overlay tw-pd-1 tw-mg-b-1"
		>
			<span class="ffz-i-info" />
			{{ t('setting.warn-inheritence', 'These values are being overridden by another profile and may not take effect.') }}
		</div>

		<div class="tw-pd-b-1 tw-border-b tw-mg-b-1">
			<div class="tw-flex tw-align-items-center ffz--inline">
				{{ t('setting.actions.preview', 'Preview:') }}

				<div class="tw-pd-x-1 tw-checkbox">
					<input
						id="as_mod"
						ref="as_mod"
						:checked="is_moderator"
						type="checkbox"
						class="tw-checkbox__input"
						@change="onPreview"
					>

					<label for="as_mod" class="tw-checkbox__label">
						{{ t('setting.actions.preview.mod', 'As Moderator') }}
					</label>
				</div>

				<div v-if="has_msg" class="tw-pd-x-1 tw-checkbox">
					<input
						id="is_deleted"
						ref="is_deleted"
						:checked="is_deleted"
						type="checkbox"
						class="tw-checkbox__input"
						@change="onPreview"
					>

					<label for="is_deleted" class="tw-checkbox__label">
						{{ t('setting.actions.preview.deleted', 'Deleted Message') }}
					</label>
				</div>

				<div v-if="has_icons" class="tw-pd-x-1 tw-checkbox">
					<input
						id="with_mod_icons"
						ref="with_mod_icons"
						:checked="with_mod_icons"
						type="checkbox"
						class="tw-checkbox__input"
						@change="onPreview"
					>

					<label for="with_mod_icons" class="tw-checkbox__label">
						{{ t('setting.actions.preview.mod_icons', 'With Mod Icons') }}
					</label>
				</div>

				<div class="tw-pd-x-1 tw-checkbox">
					<input
						id="show_all"
						ref="show_all"
						:checked="show_all"
						type="checkbox"
						class="tw-checkbox__input"
						@change="onPreview"
					>

					<label for="show_all" class="tw-checkbox__label">
						{{ t('setting.actions.preview.all', 'Show All') }}
					</label>
				</div>
			</div>

			<div
				:data-user="JSON.stringify(sample_user)"
				:data-room="JSON.stringify(sample_room)"
				:data-message="JSON.stringify(sample_message)"
				class="ffz-action-data tw-pd-t-1"
				data-msg-id="1234-5678"
			>
				<div
					v-if="! display.length"
					class="tw-align-center tw-c-text-alt-2 tw-pd-05 tw-font-size-4"
				>
					{{ t('setting.actions.no-visible', 'no visible actions') }}
				</div>

				<div
					v-for="(actions, idx) in display"
					:key="idx"
					class="tw-flex tw-align-items-center tw-justify-content-center"
				>
					<action-preview
						v-for="act in actions"
						:key="act.id"
						:act="act.v"
						:color="color(act.v.appearance.color)"
						:renderers="data.renderers"
						tooltip="true"
						pad="true"
					/>
				</div>
			</div>
		</div>

		<div class="tw-flex tw-align-items-center tw-pd-b-05">
			<div class="tw-flex-grow-1">
				{{ t('setting.actions.drag', 'Drag actions to re-order them.') }}
			</div>
			<div
				v-if="! maybe_clear"
				v-on-clickaway="closeAdd"
				class="tw-relative"
			>
				<button
					class="tw-mg-l-1 tw-button tw-button--text"
					@click="toggleAdd"
				>
					<span class="tw-button__text ffz-i-plus">
						{{ t('setting.actions.new', 'New...') }}
					</span>
					<span class="tw-button__icon tw-button__icon--right">
						<figure class="ffz-i-down-dir" />
					</span>
				</button>
				<balloon
					v-if="add_open"
					color="background-alt-2"
					dir="down-right"
					size="sm"
				>
					<simplebar classes="ffz-mh-30">
						<div class="tw-pd-y-1">
							<template v-for="(preset, idx) in presets">
								<div
									v-if="preset.divider"
									:key="idx"
									class="tw-mg-1 tw-border-b"
								/>
								<button
									v-else
									:key="idx"
									:disabled="preset.disabled"
									class="tw-interactable tw-interactable--hover-enabled tw-interactable--inverted tw-interactive tw-full-width"
									@click="add(preset.value)"
								>
									<div class="tw-flex tw-align-items-center tw-pd-y-05 tw-pd-x-1">
										<div class="tw-flex-grow-1 tw-mg-r-1">
											{{ preset.title_i18n ? t(preset.title_i18n, preset.title, preset) : preset.title }}
										</div>
										<action-preview v-if="preset.appearance" :act="preset" :renderers="data.renderers" />
									</div>
								</button>
							</template>
						</div>
					</simplebar>
				</balloon>
			</div>
			<button
				v-if="! maybe_clear && val.length"
				class="tw-mg-l-1 tw-button tw-button--text tw-tooltip-wrapper"
				@click="maybe_clear = true"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.delete-all', 'Delete All') }}
				</span>
				<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.actions.delete-all', "Delete all of this profile's actions.") }}
				</span>
			</button>
			<button
				v-if="maybe_clear"
				class="tw-mg-l-1 tw-button tw-button--text tw-tooltip-wrapper"
				@click="doClear"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.delete-all', 'Delete All') }}
				</span>
				<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.actions.delete-all', "Delete all of this profile's actions.") }}
				</span>
			</button>
			<button
				v-if="maybe_clear"
				class="tw-mg-l-1 tw-button tw-button--text tw-tooltip-wrapper"
				@click="maybe_clear = false"
			>
				<span class="tw-button__text ffz-i-cancel">
					{{ t('setting.cancel', 'Cancel') }}
				</span>
			</button>
			<button
				v-if="! val.length && has_default"
				class="tw-mg-l-1 tw-button tw-button--text tw-tooltip-wrapper"
				@click="populate"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.actions.add-default', 'Add Defaults') }}
				</span>
				<span class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.actions.add-default-tip', 'Add all of the default actions to this profile.') }}
				</span>
			</button>
		</div>

		<div ref="list" class="ffz--action-list">
			<div v-if="! val.length" class="tw-c-text-alt-2 tw-font-size-4 tw-align-center tw-c-text-alt-2 tw-pd-1">
				{{ t('setting.actions.no-actions', 'no actions are defined in this profile') }}
			</div>
			<section v-for="act in val" :key="act.id">
				<action-editor
					:action="act"
					:data="data"
					:inline="item.inline"
					:mod_icons="has_icons"
					:context="item.context"
					:modifiers="item.modifiers"
					@remove="remove(act)"
					@save="save(act, $event)"
				/>
			</section>
		</div>
	</div>
</template>

<script>

import SettingMixin from '../setting-mixin';
import Sortable from 'sortablejs';
import {deep_copy} from 'utilities/object';

let last_id = 0;


export default {
	mixins: [SettingMixin],
	props: ['item', 'context'],

	data() {
		return {
			is_moderator: true,
			with_mod_icons: true,
			is_staff: false,
			is_deleted: false,
			show_all: false,

			maybe_clear: false,
			add_open: false,
		}
	},

	computed: {
		hasInheritance() {
			for(const val of this.val)
				if ( val.t === 'inherit' )
					return true;

			return false;
		},

		sample_user() {
			return this.has_user ? {
				displayName: 'SirStendec',
				login: 'sirstendec',
				id: 49399878,
				color: '#008000'
			} : null
		},

		sample_room() {
			return this.has_room ? {
				displayName: 'FrankerFaceZ',
				login: 'frankerfacez',
				id: 46622312
			} : null
		},

		sample_message() {
			return this.has_msg ? {
				id: '46a473ee-a3c4-4556-a5ca-c0f1eac93ec0',
				text: 'sirstendec: Please do not do that.'
			} : null
		},

		has_icons() {
			return this.item.mod_icons || this.item.inline
		},

		has_default() {
			return this.default_value && this.default_value.length
		},

		has_user() {
			return this.item.context && this.item.context.includes('user')
		},

		has_room() {
			return this.item.context && this.item.context.includes('room')
		},

		has_msg() {
			return this.item.context && this.item.context.includes('message')
		},

		presets() {
			const out = [],
				contexts = this.item.context || [];

			out.push({
				disabled: this.hasInheritance,

				title: 'Inheritance Point',
				title_i18n: 'setting.inheritance',
				value: {t: 'inherit'}
			});

			if ( ! this.item.inline ) {
				out.push({
					title: 'New Line',
					value: {
						v: {type: 'new-line'}
					}
				});

				out.push({
					title: 'Space (Small)',
					value: {
						v: {type: 'space-small'}
					}
				});

				out.push({
					title: 'Space (Expanding)',
					value: {
						v: {type: 'space'}
					}
				});
			}

			out.push({divider: true});

			for(const key in this.data.actions) { // eslint-disable-line guard-for-in
				const act = this.data.actions[key];
				if ( act && act.presets ) {
					if ( act.required_context ) {
						let okay = true;
						for(const ctx of act.required_context)
							if ( ! contexts.includes(ctx) ) {
								okay = false;
								break;
							}

						if ( ! okay )
							continue;
					}

					for(const preset of act.presets) {
						if ( typeof act.title !== 'string' && ! preset.title )
							continue;

						out.push(Object.assign({
							action: key,
							title: act.title,
							title_i18n: act.title_i18n || `chat.actions.${key}`,
							value: {
								v: Object.assign({
									action: key
								}, preset)
							}
						}, preset));
					}
				}
			}

			return out;
		},

		display() {
			const out = [];
			let current = [];

			if ( this.val )
				for(const val of this.val) {
					if ( ! val.v )
						continue;

					const type = val.v.type;
					if ( type === 'new-line' ) {
						out.push(current);
						current = [];

					} else if ( this.displayAction(val.v) )
						current.push(val);
				}

			if ( current.length )
				out.push(current);

			return out;
		},

		val() {
			if ( ! this.has_value )
				return [];

			return this.value.map(x => {
				x.id = x.id || `${Date.now()}-${Math.random()}-${last_id++}`;
				return x;
			});
		}
	},

	mounted() {
		this._sortable = Sortable.create(this.$refs.list, {
			draggable: 'section',
			filter: 'button',

			onUpdate: event => {
				if ( event.newIndex === event.oldIndex )
					return;

				const new_val = Array.from(this.val);
				new_val.splice(event.newIndex, 0, ...new_val.splice(event.oldIndex, 1));

				this.set(new_val);
			}
		});
	},

	beforeDestroy() {
		if ( this._sortable )
			this._sortable.destroy();

		this._sortable = null;
	},

	methods: {
		doClear() {
			this.maybe_clear = false;
			this.clear();
		},

		closeAdd() {
			this.add_open = false;
		},

		toggleAdd() {
			this.add_open = ! this.add_open;
		},

		populate() {
			this.set(deep_copy(this.default_value));
		},

		add(val) {
			const vals = Array.from(this.val);
			vals.push(val);
			this.set(deep_copy(vals));
			this.add_open = false;
		},

		remove(val) {
			const vals = Array.from(this.val),
				idx = vals.indexOf(val);

			if ( idx !== -1 ) {
				vals.splice(idx, 1);
				if ( vals.length )
					this.set(vals);
				else
					this.clear();
			}
		},

		save(val, new_val) {
			val.v = new_val;
			this.set(deep_copy(this.val));
		},

		onPreview() {
			this.show_all = this.$refs.show_all.checked;
			this.is_moderator = this.$refs.as_mod.checked;
			this.is_staff = false; //this.$refs.as_staff.checked;
			this.with_mod_icons = this.has_icons && this.$refs.with_mod_icons.checked;
			this.is_deleted = this.has_msg && this.$refs.is_deleted.checked;
		},

		displayAction(action) {
			if ( ! action.appearance )
				return false;

			const disp = action.display;
			if ( ! disp || this.show_all )
				return true;

			if ( disp.disable )
				return false;

			if ( disp.mod != null && disp.mod !== this.is_moderator )
				return false;

			if ( disp.mod_icons != null && disp.mod_icons !== this.with_mod_icons )
				return false;

			if ( disp.staff != null && disp.staff !== this.is_staff )
				return false;

			if ( disp.deleted != null && disp.deleted !== this.is_deleted )
				return false;

			return true;
		},

		color(input) {
			if ( ! input )
				return input;

			return this.data.color(input)
		}
	}
}

</script>