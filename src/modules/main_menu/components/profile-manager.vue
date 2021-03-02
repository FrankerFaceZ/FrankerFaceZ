<template lang="html">
	<div class="ffz--widget ffz--profile-manager tw-border-t tw-pd-y-1">
		<section v-if="context.exclusive" class="tw-pd-b-2">
			<div class="tw-c-background-accent tw-c-text-overlay tw-pd-1">
				<h3 class="ffz-i-info">
					{{ t('setting.context-difference', 'Your Profiles might not match.') }}
				</h3>

				{{ t('setting.context-difference.description',
					'Since the Control Center is open in a new window, profiles may match differently here than on other Twitch windows.')
				}}

				<div v-if="context.can_proxy" class="tw-flex tw-align-items-center tw-mg-t-1">
					<div class="ffz-checkbox tw-relative tw-tooltip__container">
						<input
							id="proxied"
							ref="proxied"
							type="checkbox"
							class="ffz-checkbox__input"
							:checked="context.proxied"
							@change="onProxyCheck"
						>

						<label for="proxied" class="ffz-checkbox__label">
							<span class="tw-mg-l-1">
								{{ t('setting.context-difference.use', 'Use Original Windows\'s Context') }}
							</span>
						</label>

						<div class="tw-tooltip ffz-balloon--md tw-tooltip--wrap tw-tooltip--down tw-tooltip--align-left">
							{{ t('setting.context-difference.tip', 'Checking this will use the context from the original window, causing profiles and thier rules to match like they would in the window that opened this Control Center.') }}
						</div>
					</div>
				</div>
			</div>
		</section>

		<div class="tw-flex tw-align-items-center tw-pd-b-05">
			<div class="tw-flex-grow-1">
				{{ t('setting.profiles.drag', 'Drag profiles to change their priority.') }}
			</div>
			<button
				:class="{'tw-button--disabled': importing}"
				:disabled="importing"
				class="tw-mg-l-1 tw-button tw-button--text"
				@click="edit()"
			>
				<span class="tw-button__text ffz-i-plus">
					{{ t('setting.profiles.new', 'New Profile') }}
				</span>
			</button>
			<div
				v-on-clickaway="closeMenu"
				class="tw-relative"
			>
				<button
					:class="{'tw-button--disabled': importing}"
					:disabled="importing"
					class="tw-mg-l-1 tw-button tw-button--text"
					@click="toggleMenu"
				>
					<span class="tw-button__text ffz-i-upload">
						{{ t('setting.import', 'Import…') }}
					</span>
					<span class="tw-button__icon tw-button__icon--right">
						<figure class="ffz-i-down-dir" />
					</span>
				</button>
				<balloon
					v-if="menu_open"
					color="background-alt-2"
					dir="down-right"
					:size="menu_pasting ? 'md' : 'sm'"
				>
					<simplebar class="ffz-mh-30">
						<div v-if="menu_pasting" class="tw-pd-1">
							<div class="tw-flex tw-align-items-center">
								<input
									ref="paste"
									:placeholder="t('setting.paste-url.url', '[url]')"
									class="tw-flex-grow-1 tw-border-radius-medium tw-font-size-6 tw-pd-x-1 tw-pd-y-05 ffz-input"
									@keydown.enter="doImportURL"
								>
								<button
									class="tw-mg-l-05 tw-button"
									@click="doImportURL"
								>
									<span class="tw-button__text ffz-i-plus">
										{{ t('setting.import.do', 'Import') }}
									</span>
								</button>
							</div>
						</div>
						<div v-else class="tw-pd-y-1">
							<button
								class="ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive tw-full-width"
								@click="preparePaste"
							>
								<div class="tw-flex tw-align-items-center tw-pd-y-05 tw-pd-x-1">
									<div class="tw-flex-grow-1 tw-mg-r-1 ffz-i-download-cloud">
										{{ t('setting.import.url', 'From URL') }}
									</div>
								</div>
							</button>
							<button
								class="ffz-interactable ffz-interactable--hover-enabled ffz-interactable--default tw-interactive tw-full-width"
								@click="doImport"
							>
								<div class="tw-flex tw-align-items-center tw-pd-y-05 tw-pd-x-1">
									<div class="tw-flex-grow-1 tw-mg-r-1 ffz-i-upload">
										{{ t('setting.import.file', 'From File') }}
									</div>
								</div>
							</button>
						</div>
					</simplebar>
				</balloon>
			</div>
		</div>

		<div v-if="import_error" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1 tw-flex tw-align-items-start">
			<section class="tw-flex-grow-1">
				<h4 class="ffz-i-attention">
					{{ t('setting.backup-restore.error', 'There was an error processing this backup.') }}
				</h4>
				<div v-if="import_error_message">
					{{ import_error_message }}
				</div>
			</section>
			<button
				class="tw-button tw-button--text tw-relative tw-tooltip__container"
				@click="resetImport"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.close', 'Close') }}
				</div>
			</button>
		</div>

		<div v-if="import_message" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1 tw-flex tw-align-items-start">
			<section class="tw-flex-grow-1">
				{{ import_message }}
			</section>
			<button
				v-if="import_closable"
				class="tw-button tw-button--text tw-relative tw-tooltip__container"
				@click="resetImport"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.close', 'Close') }}
				</div>
			</button>
		</div>

		<div v-if="import_profiles" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1 tw-flex tw-align-items-start">
			<section class="tw-flex-grow-1">
				<h4 class="ffz-i-upload">
					{{ t('setting.backup-restore.pick-profile', 'Please select a profile to import.') }}
				</h4>

				<button
					v-for="(profile, idx) in import_profiles"
					:key="idx"
					class="tw-block tw-full-width tw-mg-y-05 tw-mg-r-1 tw-pd-05 tw-button ffz-button--hollow tw-c-text-overlay tw-relative tw-tooltip__container"
					@click="importProfile(profile)"
				>
					<span class="tw-button__text tw-c-text-overlay">
						{{ profile.i18n_key ? t(profile.i18n_key, profile.name) : profile.name }}
					</span>
					<div v-if="profile.description" class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
						{{ profile.desc_i18n_key ? t(profile.desc_i18n_key, profile.description) : profile.description }}
					</div>
				</button>
			</section>
			<button
				class="tw-button tw-button--text tw-relative tw-tooltip__container"
				@click="resetImport"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.close', 'Close') }}
				</div>
			</button>
		</div>

		<div v-if="import_profile" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1 tw-flex tw-align-items-start">
			<section class="tw-flex-grow-1">
				<h4 class="ffz-i-help">
					{{ t('setting.backup-restore.confirm-updates', 'The profile you are importing has an automatic update URL. Do you want the profile to keep itself up to date?') }}
				</h4>

				<button
					class="tw-block tw-full-width tw-mg-y-05 tw-mg-r-1 tw-pd-05 tw-button ffz-button--hollow tw-c-text-overlay"
					@click="confirmImport(true)"
				>
					<span class="tw-button__text tw-c-text-overlay ffz-i-ok">
						{{ t('setting.backup-restore.enable-auto', 'Yes, allow automatic updates.') }}
					</span>
				</button>

				<button
					class="tw-block tw-full-width tw-mg-y-05 tw-mg-r-1 tw-pd-05 tw-button ffz-button--hollow tw-c-text-overlay"
					@click="confirmImport(false)"
				>
					<span class="tw-button__text tw-c-text-overlay ffz-i-cancel">
						{{ t('setting.backup-restore.disable-auto', 'No, prevent automatic updates.') }}
					</span>
				</button>
			</section>
			<button
				class="tw-button tw-button--text tw-relative tw-tooltip__container"
				@click="resetImport"
			>
				<span class="tw-button__text ffz-i-cancel" />
				<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
					{{ t('setting.close', 'Close') }}
				</div>
			</button>
		</div>

		<div ref="list" class="ffz--profile-list">
			<section
				v-for="p in context.profiles"
				:key="p.id"
				:data-profile="p.id"
			>
				<div
					:class="{live: p.live}"
					class="ffz--profile tw-elevation-1 tw-c-background-base tw-border tw-pd-y-05 tw-pd-r-1 tw-mg-y-05 tw-flex tw-flex-nowrap"
					tabindex="0"
				>
					<div class="tw-flex tw-flex-shrink-0 tw-align-items-center handle tw-pd-x-05 tw-pd-t-1 tw-pd-b-05">
						<span class="ffz-i-ellipsis-vert" />
					</div>

					<div
						v-if="p.url"
						class="tw-flex tw-flex-shrink-0 tw-align-items-center tw-mg-r-1 tw-relative tw-tooltip__container tw-font-size-4"
					>
						<span :class="`ffz-i-download-cloud${p.pause_updates ? ' ffz-unmatched-item' : ''}`" />
						<div v-if="! p.pause_updates" class="tw-tooltip tw-tooltip--down tw-tooltip--align-left">
							<div class="tw-mg-b-05">
								{{ t('setting.profile.updates', 'This profile will update automatically from the following URL:') }}
							</div>
							{{ p.url }}
						</div>
					</div>

					<div class="tw-flex-grow-1">
						<h4>{{ p.i18n_key ? t(p.i18n_key, p.title, p) : p.title }}</h4>
						<div v-if="p.description" class="description">
							{{ p.desc_i18n_key ? t(p.desc_i18n_key, p.description, p) : p.description }}
						</div>
					</div>

					<div class="tw-flex tw-flex-shrink-0 tw-align-items-center">
						<button class="tw-button tw-button--text" @click="edit(p)">
							<span class="tw-button__text ffz-i-cog">
								{{ t('setting.configure', 'Configure') }}
							</span>
						</button>
					</div>

					<div class="tw-flex tw-flex-shrink-0 tw-align-items-center tw-border-l tw-mg-l-1 tw-pd-l-1">
						<button class="tw-button tw-button--text" @click="toggle(p)">
							<div
								:class="{
									'ffz-i-ok': p.live,
									'ffz-i-cancel': ! p.toggled,
									'ffz-i-minus': p.toggled && ! p.live
								}"
								class="ffz--profile__icon tw-relative tw-tooltip__container"
							>
								<div class="tw-tooltip tw-tooltip--down tw-tooltip--align-right">
									<span v-if="p.live">
										{{ t('setting.profiles.active', 'This profile is enabled and active.') }}
									</span>
									<span v-if="! p.toggled">
										{{ t('setting.profiles.disabled', 'This profile is disabled.') }}
									</span>
									<span v-if="p.toggled && ! p.live">
										{{ t('setting.profiles.disabled.rules', 'This profile is enabled, but inactive due to its rules.') }}
									</span>
								</div>
							</div>
						</button>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>

<script>

import Sortable from 'sortablejs';

import {openFile, readFile} from 'utilities/dom';
import {deep_copy} from 'utilities/object';
import SettingsProfile from 'src/settings/profile';

export default {
	props: ['item', 'context'],

	data() {
		return {
			menu_open: false,
			menu_pasting: false,

			importing: false,
			import_error: false,
			import_closable: true,
			import_error_message: null,
			import_message: null,
			import_profiles: null,
			import_profile: null
		}
	},

	mounted() {
		this._sortable = Sortable.create(this.$refs.list, {
			draggable: 'section',
			filter: 'button',

			onUpdate: event => {
				const id = event.item.dataset.profile,
					profile = this.context.profile_keys[id];

				if ( profile )
					profile.move(event.newIndex);
			}
		});
	},

	beforeDestroy() {
		if ( this._sortable )
			this._sortable.destroy();

		this._sortable = null;
	},

	methods: {
		closeMenu() {
			this.menu_open = false;
			this.menu_pasting = false;
		},

		toggleMenu() {
			this.menu_open = ! this.menu_open;
			this.menu_pasting = false;
		},

		preparePaste() {
			this.menu_open = true;
			this.menu_pasting = true;
			requestAnimationFrame(() => {
				this.$refs.paste.focus()
			});
		},

		onProxyCheck() {
			const val = this.$refs.proxied.checked;
			this.context.setProxied(val);
		},

		edit(profile) {
			const item = {
				full_key: 'data_management.profiles.edit_profile',
				key: 'edit_profile',

				profile_warning: false,

				title: `Edit Profile`,
				i18n_key: 'setting.data_management.profiles.edit_profile',
				parent: this.item.parent,

				contents: [{
					page: true,
					profile,
					component: 'profile-editor'
				}]
			};

			item.contents[0].parent = item;
			this.$emit('change-item', item);
		},

		toggle(profile) {
			profile.toggle();
		},

		resetImport() {
			this.importing = false;
			this.import_url = null;
			this.import_error = false;
			this.import_closable = true;
			this.import_error_message = null;
			this.import_message = null;
			this.import_profiles = null;
			this.import_profile = null;
			this.import_profile_data = null;
			this.import_data = null;
		},

		async doImportURL() {
			const url = this.$refs.paste.value;

			this.closeMenu();
			this.resetImport();
			this.import_url = url;
			this.importing = true;
			this.import_closable = false;

			this.import_message = this.t('setting.backup-restore.http-loading', 'Loading...');

			let data;
			try {
				const response = await fetch(url);
				if ( ! response.ok )
					throw new Error;

				data = await response.json();

			} catch(err) {
				this.import_message = null;
				this.import_error = true;
				this.import_error_message = this.t('setting.backup-restore.http-error', 'Unable to read JSON from the provided URL.');
				return;
			}

			this.import_message = null;
			this.importData(data);
		},

		async doImport() {
			this.closeMenu();
			this.resetImport();
			this.importing = true;

			let file, contents;
			try {
				file = await openFile('application/json,application/zip');
				if ( ! file ) {
					this.resetImport();
					return;
				}

				// We might get a different MIME than expected, roll with it.
				if ( file.type.toLowerCase().includes('zip') ) {
					const JSZip = (await import(/* webpackChunkName: "zip" */ 'jszip')).default,
						zip = await (new JSZip().loadAsync(file));

					contents = await zip.file('settings.json').async('text');

				} else
					contents = await readFile(file);

			} catch(err) {
				this.import_error = true;
				this.import_error_message = this.t('setting.backup-restore.read-error', 'Unable to read file.');
				return;
			}

			let data;
			try {
				data = JSON.parse(contents);
			} catch(err) {
				this.import_error = true;
				this.import_error_message = this.t('setting.backup-restore.json-error', 'Unable to parse file as JSON.');
				return;
			}

			this.importData(data);
		},

		importData(data) {
			if ( data && data.type === 'full' ) {
				let profiles = data.values && data.values.profiles;
				if ( profiles === undefined )
					profiles = [
						SettingsProfile.Moderation,
						SettingsProfile.Default
					];

				if ( Array.isArray(profiles) ) {
					this.import_data = data;
					this.import_profiles = deep_copy(profiles);
					return;

				} else {
					this.import_message = Object.keys(data.values);
				}

			} else if ( data && data.type === 'profile' ) {
				if ( data.profile && data.values ) {
					this.importProfile(data.profile, data.values);
					return;
				}
			}

			this.import_error = true;
			this.import_error_message = this.t('setting.backup-restore.non-supported', 'This file is not recognized as a supported backup format.');
		},

		importProfile(profile_data, data) {
			if ( this.import_url && ! profile_data.url )
				profile_data.url = this.import_url;

			this.import_profile = profile_data;
			this.import_profile_data = data;

			if ( profile_data.url )
				return;

			this.confirmImport(false);
		},

		confirmImport(allow_update = false) {
			const profile_data = this.import_profile,
				data = this.import_profile_data;

			const id = profile_data.id;
			delete profile_data.id;
			if ( ! allow_update )
				delete profile_data.url;

			const prof = this.context.createProfile(profile_data);

			prof.update({
				i18n_key: undefined,
				desc_i18n_key: undefined,
				description: `${prof.description ? prof.description + '\n' : ''}${this.t('setting.backup-restore.imported-at', 'Imported at {now,datetime}.', {now: new Date})}`
			});

			let i = 0;

			if ( ! data ) {
				const values = this.import_data && this.import_data.values,
					prefix = `p:${id}:`;

				if ( values )
					for(const [key, value] of Object.entries(values)) {
						if ( key.startsWith(prefix) ) {
							prof.set(key.substr(prefix.length), value);
							i++;
						}
					}

			} else
				for(const [key, value] of Object.entries(data)) {
					prof.set(key, value);
					i++;
				}

			this.resetImport();

			this.import_message = this.t('setting.backup-restore.imported', 'The profile "{name}" has been successfully imported with {count,number} setting{count,en_plural}.', {
				name: prof.i18n_key ? this.t(prof.i18n_key, prof.title) : prof.title,
				count: i
			});
		}
	}
}

</script>