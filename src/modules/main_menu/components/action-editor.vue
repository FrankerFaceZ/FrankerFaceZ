<template lang="html">
	<div class="ffz--action tw-elevation-1 tw-c-background-base tw-border tw-pd-y-05 tw-pd-r-1 tw-mg-y-05 tw-flex tw-flex-nowrap">
		<div class="tw-flex tw-flex-shrink-0 tw-align-items-start handle tw-pd-x-05 tw-pd-t-1 tw-pd-b-05">
			<span class="ffz-i-ellipsis-vert" />
		</div>

		<div class="tw-flex-grow-1">
			<template v-if="! editing">
				<h4>{{ title }}</h4>
				<div class="description">{{ description }}</div>
				<div v-if="canEdit" class="visibility tw-c-text-alt">
					{{ t('setting.actions.visible', 'visible: {list}', {list: visibility}) }}
				</div>
			</template>
			<template v-else>
				<section>
					<h5>{{ t('setting.actions.appearance', 'Appearance') }}</h5>

					<div class="tw-flex tw-align-items-center">
						<label for="tooltip">
							{{ t('setting.actions.tooltip', 'Custom Tooltip') }}
						</label>

						<input
							v-model="edit_data.appearance.tooltip"
							class="tw-border-radius-medium tw-font-size-6 tw-full-width tw-input tw-pd-x-1 tw-pd-y-05 tw-mg-y-05"
						>
					</div>

					<div class="tw-flex tw-align-items-center">
						<label for="renderer_type">
							{{ t('setting.actions.type', 'Type') }}
						</label>

						<select
							id="renderer_type"
							ref="renderer_type"
							v-model="edit_data.appearance.type"
							class="tw-border-radius-medium tw-font-size-6 tw-full-width tw-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-y-05"
						>
							<option
								v-for="(r, key) in data.renderers"
								:key="key"
								:value="key"
							>
								{{ r.title_i18n ? t(r.title_i18n, r.title, r) : r.title }}
							</option>
						</select>
					</div>

					<div v-if="renderer && renderer.colored" class="tw-flex tw-align-items-start">
						<label for="color" class="tw-mg-y-05">
							{{ t('setting.actions.color', 'Color') }}
						</label>

						<div class="tw-full-width">
							<color-picker v-model="edit_data.appearance.color" :nullable="true" />

							<div class="tw-c-text-alt-2 tw-mg-b-1">
								{{ t('setting.actions.color.warn', 'This value will be automatically adjusted for visibility based on your chat color settings.') }}
							</div>
						</div>
					</div>

					<component
						v-if="renderer"
						:is="renderer.editor"
						v-model="edit_data.appearance"
					/>
				</section>

				<section class="tw-mg-t-1 tw-border-t tw-pd-t-1">
					<h5>{{ t('setting.actions.visibility', 'Visibility') }}</h5>

					<div class="tw-flex tw-align-items-center">
						<label for="vis_mod">
							{{ t('setting.actions.edit-visible.mod', 'Moderator') }}
						</label>

						<select
							id="vis_mod"
							v-model="edit_data.display.mod"
							class="tw-border-radius-medium tw-font-size-6 tw-full-width tw-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-y-05"
						>
							<option :value="undefined" selected>{{ t('setting.unset', 'Unset') }}</option>
							<option :value="true">{{ t('setting.true', 'True') }}</option>
							<option :value="false">{{ t('setting.false', 'False') }}</option>
						</select>
					</div>

					<div class="tw-flex tw-align-items-center">
						<label for="vis_mod_icons">
							{{ t('setting.actions.edit-visible.mod-icons', 'Mod Icons') }}
						</label>

						<select
							id="vis_mod_icons"
							v-model="edit_data.display.mod_icons"
							class="tw-border-radius-medium tw-font-size-6 tw-full-width tw-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-y-05"
						>
							<option :value="undefined" selected>{{ t('setting.unset', 'Unset') }}</option>
							<option :value="true">{{ t('setting.visible', 'Visible') }}</option>
							<option :value="false">{{ t('setting.hidden', 'Hidden') }}</option>
						</select>
					</div>

					<div v-if="has_message" class="tw-flex tw-align-items-center">
						<label for="vis_deleted">
							{{ t('setting.actions.edit-visible.deleted', 'Message Deleted') }}
						</label>

						<select
							id="vis_deleted"
							v-model="edit_data.display.deleted"
							class="tw-border-radius-medium tw-font-size-6 tw-full-width tw-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-y-05"
						>
							<option :value="undefined" selected>{{ t('setting.unset', 'Unset') }}</option>
							<option :value="true">{{ t('setting.true', 'True') }}</option>
							<option :value="false">{{ t('setting.false', 'False') }}</option>
						</select>
					</div>

					<div v-if="has_modifiers" class="tw-flex tw-align-items-start">
						<label for="vis_modifiers">
							{{ t('setting.actions.edit-visible.modifier', 'Modifiers') }}
						</label>

						<div>
							<div class="ffz--inline tw-flex">
								<div class="tw-pd-r-1 tw-checkbox">
									<input
										ref="key_ctrl"
										:id="'key_ctrl$' + id"
										:checked="edit_data.display.keys & 1"
										type="checkbox"
										class="tw-checkbox__input"
										@change="onChangeKeys"
									>
									<label :for="'key_ctrl$' + id" class="tw-checkbox__label">
										{{ t('setting.key.ctrl', 'Ctrl') }}
									</label>
								</div>

								<div class="tw-pd-r-1 tw-checkbox">
									<input
										ref="key_shift"
										:id="'key_shift$' + id"
										:checked="edit_data.display.keys & 2"
										type="checkbox"
										class="tw-checkbox__input"
										@change="onChangeKeys"
									>
									<label :for="'key_shift$' + id" class="tw-checkbox__label">
										{{ t('setting.key.shift', 'Shift') }}
									</label>
								</div>

								<div class="tw-pd-r-1 tw-checkbox">
									<input
										ref="key_alt"
										:id="'key_alt$' + id"
										:checked="edit_data.display.keys & 4"
										type="checkbox"
										class="tw-checkbox__input"
										@change="onChangeKeys"
									>
									<label :for="'key_alt$' + id" class="tw-checkbox__label">
										{{ t('setting.key.alt', 'Alt') }}
									</label>
								</div>

								<div class="tw-pd-r-1 tw-checkbox">
									<input
										ref="key_meta"
										:id="'key_meta$' + id"
										:checked="edit_data.display.keys & 8"
										type="checkbox"
										class="tw-checkbox__input"
										@change="onChangeKeys"
									>
									<label :for="'key_meta$' + id" class="tw-checkbox__label">
										{{ t('setting.key.meta', 'Meta') }}
									</label>
								</div>
							</div>

							<div class="tw-pd-t-05">
								Note: This currently requires Chat > Behavior > Freeze Chat Scrolling to be enabled.
							</div>
						</div>
					</div>
				</section>

				<section class="tw-mg-t-1 tw-border-t tw-pd-t-1">
					<h5>{{ t('setting.actions.action', 'Action') }}</h5>

					<div class="tw-flex tw-align-items-center">
						<label for="action_type">
							{{ t('setting.actions.type', 'Type') }}
						</label>

						<select
							id="action_type"
							v-model="edit_data.action"
							class="tw-border-radius-medium tw-font-size-6 tw-full-width tw-select tw-pd-l-1 tw-pd-r-3 tw-pd-y-05 tw-mg-y-05"
						>
							<option
								v-for="(a, key) in data.actions"
								:key="key"
								:value="key"
							>
								{{ a.title_i18n ? t(a.title_i18n, a.title, a) : a.title }}
							</option>
						</select>
					</div>

					<component
						v-if="action_def && action_def.editor"
						:is="action_def.editor"
						:value="edit_data.options"
						:defaults="action_def.defaults"
						:vars="vars"
						@input="onChangeAction($event)"
					/>

				</section>
			</template>
		</div>

		<div v-if="canPreview" class="tw-mg-l-1 tw-border-l tw-pd-l-1 tw-pd-y-05 tw-flex tw-flex-shrink-0 tw-align-items-start">
			<action-preview
				:act="display"
				:color="display.appearance && data.color(display.appearance.color)"
				:renderers="data.renderers"
			/>
		</div>

		<div class="tw-mg-l-1 tw-border-l tw-pd-l-1 tw-flex tw-flex-wrap tw-flex-column tw-justify-content-start tw-align-items-start">
			<template v-if="editing">
				<button class="tw-button tw-button--text" @click="save">
					<span class="tw-button__text ffz-i-floppy">
						{{ t('setting.save', 'Save') }}
					</span>
				</button>
				<button class="tw-button tw-button--text" @click="cancel">
					<span class="tw-button__text ffz-i-cancel">
						{{ t('setting.cancel', 'Cancel') }}
					</span>
				</button>
			</template>
			<template v-else-if="deleting">
				<button class="tw-button tw-button--text" @click="$emit('remove', action)">
					<span class="tw-button__text ffz-i-trash">
						{{ t('setting.delete', 'Delete') }}
					</span>
				</button>
				<button class="tw-button tw-button--text" @click="deleting = false">
					<span class="tw-button__text ffz-i-cancel">
						{{ t('setting.cancel', 'Cancel') }}
					</span>
				</button>
			</template>
			<template v-else>
				<button
					v-if="canEdit"
					class="tw-button tw-button--text"
					@click="edit"
				>
					<span class="tw-button__text ffz-i-cog">
						{{ t('setting.edit', 'Edit') }}
					</span>
				</button>
				<button class="tw-button tw-button--text" @click="deleting = true">
					<span class="tw-button__text ffz-i-trash">
						{{ t('setting.delete', 'Delete') }}
					</span>
				</button>
			</template>
		</div>
	</div>
</template>

<script>

import {has, maybe_call, deep_copy} from 'utilities/object';

let id = 0;

export default {
	props: ['action', 'data', 'inline', 'context', 'modifiers'],

	data() {
		return {
			id: id++,
			deleting: false,
			editing: false,
			edit_data: null
		}
	},

	computed: {
		display() {
			if ( this.editing )
				return this.edit_data;

			return this.action.v;
		},

		has_message() {
			return this.context && this.context.includes('message')
		},

		has_modifiers() {
			return this.modifiers
		},

		vars() {
			const out = [],
				ctx = this.context || [];

			if ( ctx.includes('user') ) {
				out.push('user.login');
				out.push('user.displayName');
				out.push('user.id');
				out.push('user.type');
			}

			if ( ctx.includes('room') ) {
				out.push('room.login');
				out.push('room.id');
			}

			if ( ctx.includes('message') ) {
				out.push('message.id');
				out.push('message.text');
			}

			return out.map(x => `{{${x}}}`).join(', ');
		},

		renderer() {
			return this.canPreview && this.data.renderers[this.display.appearance.type];
		},

		action_def() {
			return this.display && this.data.actions[this.display.action];
		},

		canEdit() {
			return this.action.v != null && ! this.action.v.type;
		},

		canPreview() {
			return this.display && this.display.appearance;
		},

		title() {
			if ( this.action.t === 'inherit' )
				return this.t('setting.inheritance', 'Inheritance Point');

			else if ( ! this.display )
				return this.t('setting.unknown', 'Unknown Value');

			const type = this.display.type;

			if ( type === 'new-line' )
				return this.t('setting.new-line', 'New Line');

			else if ( type === 'space-small' )
				return this.t('setting.space-small', 'Space (Small)');

			else if ( type === 'space' )
				return this.t('setting.space', 'Space');

			const def = this.data.actions[this.display.action];
			if ( ! def )
				return this.t('setting.actions.unknown', 'Unknown Action Type: {action}', this.display);

			if ( def.title ) {
				const data = this.getData(),
					out = maybe_call(def.title, this, data, def),
					i18n = def.title_i18n || `chat.actions.${this.display.action}`;

				if ( out )
					return this.t(i18n, out, data);
			}

			return this.t('setting.actions.untitled', 'Action: {action}', this.display);

		},

		description() {
			if ( this.action.t === 'inherit' )
				return this.t('setting.inheritance.desc', 'Inherit values from lower priority profiles at this position.');

			const type = this.display && this.display.type;

			if ( type === 'new-line' )
				return this.t('setting.new-line.desc', 'Place all items following this on a new line.');

			else if ( type === 'space-small' )
				return this.t('setting.space-small.desc', 'Place a small space between the previous item and the next item.');

			else if ( type === 'space' )
				return this.t('setting.space.desc', 'Place as large a space as possible between the previous item and the next item.');

			const def = this.display && this.data.actions[this.display.action];
			if ( ! def || ! def.description )
				return;

			const data = this.getData(),
				out = maybe_call(def.description, this, data, def),
				i18n = def.description_i18n || `chat.actions.${this.display.action}.desc`;

			if ( out )
				return this.t(i18n, out, data);
		},

		visibility() {
			if ( ! this.display || ! this.display.appearance )
				return;

			const disp = this.display.display || {},
				out = [];

			if ( disp.disable )
				return this.t('setting.actions.visible.never', 'never');

			if ( disp.mod === true )
				out.push(this.t('setting.actions.visible.mod', 'when moderator'));

			else if ( disp.mod === false )
				out.push(this.t('setting.actions.visible.unmod', 'when not moderator'));

			if ( disp.mod_icons === true )
				out.push(this.t('setting.actions.visible.mod_icons', 'when mod icons are shown'));

			else if ( disp.mod_icons === false )
				out.push(this.t('setting.actions.visible.mod_icons_off', 'when mod icons are hidden'));

			if ( disp.staff === true )
				out.push(this.t('setting.actions.visible.staff', 'when staff'));

			else if ( disp.staff === false )
				out.push(this.t('setting.actions.visible.unstaff', 'when not staff'));

			if ( disp.deleted === true )
				out.push(this.t('setting.actions.visible.deleted', 'if message deleted'));

			else if ( disp.deleted === false )
				out.push(this.t('setting.actions.visible.undeleted', 'if message not deleted'));

			if ( disp.keys ) {
				const key_out = [];
				if ( disp.keys & 1 )
					key_out.push(this.t('setting.key.ctrl', 'Ctrl'));
				if ( disp.keys & 2 )
					key_out.push(this.t('setting.key.shift', 'Shift'));
				if ( disp.keys & 4 )
					key_out.push(this.t('setting.key.alt', 'Alt'));
				if ( disp.keys & 8 )
					key_out.push(this.t('setting.key.meta', 'Meta'));

				if ( key_out.length )
					out.push(this.t('setting.actions.visible.modifier', 'when {key_list} {keys, plural, one {is} other {are}} held', {
						key_list: key_out.join(' + '),
						keys: key_out.length
					}));
			}

			if ( ! out.length )
				return this.t('setting.actions.visible.always', 'always');

			return out.join(', ');
		}
	},

	methods: {
		onChangeAction(val) {
			for(const key in val)
				if ( has(val, key) ) {
					const v = val[key];
					if ( typeof v === 'string' && ! v.length )
						delete val[key];
				}

			this.edit_data.options = val;
		},

		onChangeKeys() {
			if ( ! this.editing )
				return;

			let i = 0;
			if ( this.$refs.key_ctrl.checked )
				i |= 1;
			if ( this.$refs.key_shift.checked )
				i |= 2;
			if ( this.$refs.key_alt.checked )
				i |= 4;
			if ( this.$refs.key_meta.checked )
				i |= 8;

			this.edit_data.display.keys = i;
		},

		edit() {
			if ( ! this.canEdit )
				return;

			this.editing = true;
			this.edit_data = deep_copy(this.action.v);

			if ( ! this.edit_data.options )
				this.edit_data.options = {};

			if ( ! this.edit_data.display )
				this.edit_data.display = {};

			if ( ! this.edit_data.appearance )
				this.edit_data.appearance = {};
		},

		save() {
			this.$emit('save', this.edit_data);
			this.cancel();
		},

		cancel() {
			this.editing = false;
			this.edit_data = null;
		},

		getData() {
			const def = this.display && this.data.actions[this.display.action];
			if ( ! def )
				return;

			return Object.assign({}, this.display, {
				options: Object.assign({}, def && def.defaults, this.display.options)
			})
		}
	}

}

</script>