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

			let file;
			try {
				const settings = this.item.getFFZ().resolve('settings');
				file = await settings.generateBackupFile();

			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.dump-error', 'Unable to export settings data to JSON.');
				this.error = true;
				return;
			}

			try {
				saveAs(file, file.name);
			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.save-error', 'Unable to save.');
			}
		},

		async restore() {
			this.error = false;
			this.message = null;

			let file;
			try {
				file = await openFile('application/json,application/zip');
				if ( ! file )
					return;

			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.read-error', 'Unable to read file.');
				this.error = true;
				return;
			}

			// We might get a different MIME than expected, roll with it.
			if ( file.type.toLowerCase().includes('zip') )
				return this.restoreZip(file);

			let contents;
			try {
				contents = await readFile(file);
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

			this.message = this.t('setting.backup-restore.restored', '{count,number} items have been restored. Please refresh this page.', {
				count: i
			});
		},

		async restoreZip(file) {
			const JSZip = (await import(/* webpackChunkName: "zip" */ 'jszip')).default;
			let input, blobs, data;

			try {
				input = await (new JSZip().loadAsync(file));

				blobs = await input.file('blobs.json').async('text');
				data = await input.file('settings.json').async('text');

			} catch(err) {
				this.error_desc = this.t('setting.backup-restore.zip-error', 'Unable to parse ZIP archive.');
				this.error = true;
			}

			try {
				blobs = JSON.parse(blobs);
				data = JSON.parse(data);
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

			const settings = this.item.getFFZ().resolve('settings');
			await settings.awaitProvider();
			const provider = settings.provider;
			await provider.awaitReady();

			if ( Object.keys(blobs).length && ! provider.supportsBlobs ) {
				this.error_desc = this.t('setting.backup-restore.blob-error', 'This backup contains binary data not supported by the current storage provider. Please change your storage provider in Data Management > Storage >> Provider.');
				this.error = true;
				return;
			}

			// Attempt to load all the blobs, to make sure they're all valid.
			const loaded_blobs = {};

			for(const [safe_key, data] of Object.entries(blobs)) {
				let blob;
				if ( data.type === 'file' ) {
					blob = await input.file(`blobs/${safe_key}`).async('blob'); // eslint-disable-line no-await-in-loop
					blob = new File([blob], data.name, {lastModified: data.modified, type: data.mime});
				} else if ( data.type === 'blob' )
					blob = await input.file(`blobs/${safe_key}`).async('blob'); // eslint-disable-line no-await-in-loop
				else if ( data.type === 'ab' )
					blob = await input.file(`blobs/${safe_key}`).async('arraybuffer'); // eslint-disable-line no-await-in-loop
				else if ( data.type === 'ui8' )
					blob = await input.file(`blobs/${safe_key}`).async('uint8array'); // eslint-disable-line no-await-in-loop
				else {
					this.error_desc = this.t('setting.backup-restore.invalid-blob', 'This file contains a binary blob with an invalid type: {type}', data);
					this.error = true;
				}

				loaded_blobs[data.key] = blob;
			}

			// We've loaded all data, let's get this installed.
			// Blobs first.
			let b = 0;
			await provider.clearBlobs();

			for(const [key, blob] of Object.entries(loaded_blobs)) {
				await provider.setBlob(key, blob); // eslint-disable-line no-await-in-loop
				b++;
			}

			// Settings second.
			provider.clear();
			let i = 0;
			for(const key of Object.keys(data.values)) {
				const val = data.values[key];
				provider.set(key, val);
				provider.emit('changed', key, val, false);
				i++;
			}

			this.message = this.t('setting.backup-restore.zip-restored', '{count,number} items and {blobs,number} binary blobs have been restored. Please refresh this page.', {
				count: i,
				blobs: b
			});
		}
	}
}

</script>