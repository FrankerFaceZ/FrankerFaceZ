<template lang="html">
	<div class="ffz--backup-restore tw-pd-t-05">
		<div class="tw-pd-b-1 tw-mg-b-1 tw-border-b">
			{{ t('setting.backup-restore.about', 'This tool allows you to backup and restore your FrankerFaceZ settings, including all settings from the Control Center along with other data such as favorited emotes and blocked games.') }}
		</div>

		<div class="tw-flex tw-align-items-center tw-justify-content-center tw-mg-b-1">
			<button
				class="tw-button tw-mg-x-1"
				@click="backup"
			>
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-download" />
				</span>
				<span class="tw-button__text">
					{{ t('setting.backup-restore.save-backup', 'Save Backup') }}
				</span>
			</button>

			<button
				class="tw-button tw-mg-x-1"
				@click="restore"
			>
				<span class="tw-button__icon tw-button__icon--left">
					<figure class="ffz-i-upload" />
				</span>
				<span class="tw-button__text">
					{{ t('setting.backup-restore.restore-backup', 'Restore Backup') }}
				</span>
			</button>
		</div>

		<div v-if="error" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1">
			<h3 class="ffz-i-attention">
				{{ t('setting.backup-restore.error', 'There was an error processing this backup.') }}
			</h3>
			<div v-if="error_desc">
				{{ error_desc }}
			</div>
		</div>

		<div v-if="message" class="tw-c-background-accent-alt-2 tw-c-text-overlay tw-pd-1 tw-mg-b-1">
			{{ message }}
		</div>
	</div>
</template>

<script>

import {openFile, readFile} from 'utilities/dom';
import { saveAs } from 'file-saver';

export default {
	props: ['item'],

	data() {
		return {
			error_desc: null,
			error: false,
			message: null
		}
	},

	methods: {
		async backup() {
			this.error = false;
			this.message = null;

			let blob;
			try {
				const settings = this.item.getFFZ().resolve('settings'),
					data = await settings.getFullBackup();
				blob = new Blob([JSON.stringify(data)], {type: 'application/json;charset=utf-8'});
			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.dump-error', 'Unable to export settings data to JSON.');
				this.error = true;
				return;
			}

			try {
				saveAs(blob, 'ffz-settings.json');
			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.save-error', 'Unable to save.');
			}
		},

		async restore() {
			this.error = false;
			this.message = null;

			let contents;
			try {
				contents = await readFile(await openFile('application/json'));
			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.read-error', 'Unable to read file.');
				this.error = true;
				return;
			}

			let data;
			try {
				data = JSON.parse(contents);
			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.json-error', 'Unable to parse file as JSON.');
				this.error = true;
				return;
			}

			if ( ! data || data.version !== 2 ) {
				this.error_desc = this.t('setting.backup-restore.old-file', 'This file is invalid or was created in another version of FrankerFaceZ and cannot be loaded.');
				this.error = true;
				return;
			}

			if ( data.type !== 'full' ) {
				this.error_desc = this.t('setting.backup-restore.non-full', 'This file is not a full backup and cannot be restored with this tool.');
				this.error = true;
				return;
			}

			const settings = this.item.getFFZ().resolve('settings'),
				provider = settings.provider;

			await provider.awaitReady();

			provider.clear();
			let i = 0;
			for(const key of Object.keys(data.values)) {
				const val = data.values[key];
				provider.set(key, val);
				provider.emit('changed', key, val, false);
				i++;
			}

			this.message = this.t('setting.backup-restore.restored', '%{count} items have been restored. Please refresh this page.', {
				count: i
			});
		}
	}
}

</script>