<template lang="html">
	<div class="ffz--profile-editor">
		<div class="tw-flex tw-align-items-center tw-border-t tw-pd-1">
			<div class="tw-flex-grow-1" />
			<button
				class="tw-button tw-button--text"
				@click="save"
			>
				<span class="tw-button__text ffz-i-floppy">
					{{ t('setting.save', 'Save') }}
				</span>
			</button>
			<button
				:disabled="item.profile && context.profiles.length < 2"
				:class="{'tw-button--disabled': item.profile && context.profiles.length < 2}"
				class="tw-mg-l-1 tw-button tw-button--text"
				@click="del"
			>
				<span class="tw-button__text ffz-i-trash">
					{{ t('setting.delete', 'Delete') }}
				</span>
			</button>
			<button
				:class="{'tw-button--disabled': ! canExport}"
				:disabled="! canExport"
				class="tw-mg-l-1 tw-button tw-button--text"
				@click="doExport"
			>
				<span class="tw-button__text ffz-i-download">
					{{ t('setting.export', 'Export') }}
				</span>
			</button>
		</div>

		<div v-if="export_error" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1 tw-flex tw-align-items-start">
			<section class="tw-flex-grow-1">
				<h4 class="ffz-i-attention">
					{{ t('setting.backup-restore.error', 'There was an error processing this backup.') }}
				</h4>
				<div v-if="export_error_message">
					{{ export_error_message }}
				</div>
			</section>
			<button
				class="tw-button tw-button--text tw-relative tw-tooltip__container"
				@click="resetExport"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.close', 'Close') }}
				</div>
			</button>
		</div>

		<div v-if="export_message" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1 tw-flex tw-align-items-start">
			<section class="tw-flex-grow-1">
				{{ export_message }}
			</section>
			<button
				class="tw-button tw-button--text tw-relative tw-tooltip__container"
				@click="resetExport"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.close', 'Close') }}
				</div>
			</button>
		</div>

		<div class="ffz--menu-container tw-border-t">
			<header>
				{{ t('setting.data_management.profiles.edit.general', 'General') }}
			</header>

			<div class="ffz--widget tw-flex tw-flex-nowrap">
				<label for="ffz:editor:name">
					{{ t('setting.data_management.profiles.edit.name', 'Name') }}
				</label>

				<input
					id="ffz:editor:name"
					ref="name"
					v-model="name"
					class="tw-full-width tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
				>
			</div>

			<div class="ffz--widget tw-flex tw-flex-nowrap">
				<label for="ffz:editor:description">
					{{ t('setting.data_management.profiles.edit.desc', 'Description') }}
				</label>

				<textarea
					id="ffz:editor:description"
					ref="desc"
					v-model="desc"
					class="tw-full-width tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
				/>
			</div>

			<div class="ffz--widget">
				<div class="tw-flex tw-align-items-center">
					<label for="ffz:editor:hotkey">
						{{ t('setting.data_management.profiles.edit.hotkey', 'Hotkey') }}
					</label>

					<key-picker
						id="ffz:editor:hotkey"
						ref="hotkey"
						v-model="hotkey"
					/>
				</div>

				<section class="tw-mg-t-05 tw-c-text-alt-2">
					<markdown :source="t('setting.data_management.profiles.hotkey.desc', 'Setting a hotkey allows you to toggle a profile on or off at any time by using the hotkey.\n\n**Note:** A profile that is toggled on may still be inactive due to its rules.')" />
				</section>
			</div>
		</div>

		<div v-if="url" class="ffz--menu-container tw-border-t">
			<header>
				<figure class="tw-inline tw-mg-r-05 ffz-i-download-cloud" />
				{{ t('setting.data_management.profiles.edit.updates', 'Automatic Updates') }}
			</header>

			<section class="tw-pd-b-1 tw-c-text-alt-2">
				{{ t('setting.data_management.profiles.edit.updates.description',
					'This profile has an associated URL for automatic updates. When updates are enabled and the profile updates, all settings associated with the profile will be reset. The profile\'s rules will be reset as well. The Name, Description, and Hotkey will not reset.')
				}}
			</section>

			<div class="ffz--widget tw-flex tw-flex-nowrap">
				<label for="ffz:editor:url">
					{{ t('setting.data_management.profiles.edit.url', 'Update URL') }}
				</label>

				<input
					id="ffz:editor:url"
					readonly
					:value="url"
					class="tw-full-width tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
				>
			</div>

			<div class="ffz--widget ffz--checkbox">
				<div class="tw-flex tw-align-items-center ffz-checkbox">
					<input
						id="ffz:editor:update"
						ref="update"
						:checked="! pause"
						type="checkbox"
						class="ffz-checkbox__input"
						@change="onPauseChange"
					>

					<label for="ffz:editor:update" class="ffz-checkbox__label">
						<span class="tw-mg-l-1">
							{{ t('setting.data_management.profiles.edit.update', 'Automatically update this profile.') }}
						</span>
					</label>
				</div>
			</div>
		</div>

		<div class="ffz--menu-container tw-border-t">
			<header>
				{{ t('setting.data_management.profiles.edit.rules', 'Rules') }}
			</header>
			<section class="tw-pd-b-1 tw-c-text-alt-2">
				{{ t('setting.data_management.profiles.edit.rules.description',
					'Rules allows you to define a series of conditions under which this profile will be active. When there are multiple rules, they must all match for the profile to activate. Please use an `Or` rule to create a profile that activates by matching one of several rules.')
				}}
			</section>

			<filter-editor
				v-model="rules"
				:filters="filters"
				:context="test_context"
			/>
		</div>
	</div>
</template>

<script>

import {deep_copy, deep_equals} from 'utilities/object';
import { saveAs } from 'file-saver';

export default {
	props: ['item', 'context'],

	data() {
		const settings = this.context.getFFZ().resolve('settings');

		return {
			filters: deep_copy(settings.filters),

			old_name: null,
			old_desc: null,
			old_rules: null,
			old_hotkey: null,
			old_pause: null,

			name: null,
			desc: null,
			hotkey: null,
			url: null,
			pause: null,
			unsaved: false,

			rules: null,
			test_context: null,

			export_error: false,
			export_error_message: null,
			export_message: null
		}
	},

	computed: {
		canExport() {
			return this.item.profile != null
		}
	},

	watch: {
		name() {
			if ( this.name !== this.old_name )
				this.unsaved = true;
		},

		desc() {
			if ( this.desc !== this.old_desc )
				this.unsaved = true;
		},

		hotkey() {
			if ( this.hotkey !== this.old_hotkey )
				this.unsaved = true;
		},

		pause() {
			if ( this.pause !== this.old_pause )
				this.unsaved = true;
		},

		rules: {
			handler() {
				if ( ! deep_equals(this.rules, this.old_rules) )
					this.unsaved = true;
			},
			deep: true
		}
	},

	created() {
		this.context.context.on('context_changed', this.updateContext, this);
		this.updateContext();
		this.revert();
	},

	beforeDestroy() {
		this.context.context.off('context_changed', this.updateContext, this);
	},

	methods: {
		onPauseChange() {
			this.pause = ! this.$refs.update.checked;
		},

		resetExport() {
			this.export_error = false;
			this.export_error_message = null;
			this.export_message = null;
		},

		doExport() {
			this.resetExport();

			let blob;
			try {
				const data = this.item.profile.getBackup();
				blob = new Blob([JSON.stringify(data)], {type: 'application/json;charset=utf-8'});
			} catch(err) {
				this.export_error = true;
				this.export_error_message = this.t('setting.backup-restore.dump-error', 'Unable to export settings data to JSON.');
				return;
			}

			try {
				saveAs(blob, `ffz-profile - ${this.name}.json`);
			} catch(err) {
				this.export_error = true;
				this.export_error_message = this.t('setting.backup-restore.save-error', 'Unable to save.');
			}
		},

		revert() {
			const profile = this.item.profile;

			this.old_name = this.name = profile ?
				profile.i18n_key ?
					this.t(profile.i18n_key, profile.title, profile) :
					profile.title :
				'Unnamed Profile';

			this.old_desc = this.desc = profile ?
				profile.desc_i18n_key ?
					this.t(profile.desc_i18n_key, profile.description, profile) :
					profile.description :
				'';

			this.old_hotkey = this.hotkey = profile ? profile.hotkey : null;
			this.old_rules = this.rules = profile ? deep_copy(profile.context) : [];
			this.old_url = this.url = profile ? profile.url : null;
			this.old_pause = this.pause = profile ? profile.pause_updates : null;
			this.unsaved = ! profile;
		},

		del() {
			if ( this.item.profile || this.unsaved ) {
				if ( ! confirm(this.t( // eslint-disable-line no-alert
					'setting.profiles.warn-delete',
					'Are you sure you wish to delete this profile? It cannot be undone.'
				)) )
					return

				if ( this.item.profile )
					this.context.deleteProfile(this.item.profile);
			}

			this.unsaved = false;
			this.$emit('navigate', 'data_management.profiles');
		},

		save() {
			if ( ! this.item.profile ) {
				this.item.profile = this.context.createProfile({
					name: this.name,
					description: this.desc,
					context: this.rules,
					hotkey: this.hotkey,
					pause_updates: this.pause
				});

			} else if ( this.unsaved ) {
				const changes = {
					name: this.name,
					description: this.desc,
					context: this.rules,
					hotkey: this.hotkey,
					pause_updates: this.pause
				};

				// Disable i18n if required.
				if ( this.name !== this.old_name )
					changes.i18n_key = undefined;

				if ( this.desc !== this.old_desc )
					changes.desc_i18n_key = undefined;

				this.item.profile.update(changes);
			}

			this.unsaved = false;
			this.$emit('navigate', 'data_management.profiles');
		},

		updateContext() {
			this.test_context = this.context.context.context;
		},

		onBeforeChange() {
			if ( this.unsaved )
				return confirm( // eslint-disable-line no-alert
					this.t(
						'setting.warn-unsaved',
						'You have unsaved changes. Are you sure you want to leave the editor?'
					));
		}
	}

}

</script>