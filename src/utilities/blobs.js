'use strict';

export function isValidBlob(blob) {
	return blob instanceof Blob || blob instanceof File || blob instanceof ArrayBuffer || blob instanceof Uint8Array;
}

export async function serializeBlob(blob) {
	if ( ! blob )
		return null;

	if ( blob instanceof Blob )
		return {
			type: 'blob',
			mime: blob.type,
			buffer: await blob.arrayBuffer(),
		}

	if ( blob instanceof File )
		return {
			type: 'file',
			mime: blob.type,
			name: blob.name,
			modified: blob.lastModified,
			buffer: await blob.arrayBuffer()
		}

	if ( blob instanceof ArrayBuffer )
		return {
			type: 'ab',
			buffer: blob
		}

	if ( blob instanceof Uint8Array )
		return {
			type: 'u8',
			buffer: blob.buffer
		}

	throw new TypeError('Invalid type');
}

export function deserializeBlob(data) {
	if ( ! data || ! data.type )
		return null;

	if ( data.type === 'blob' )
		return new Blob([data.buffer], {type: data.mime});

	if ( data.type === 'file' )
		return new File([data.buffer], data.name, {type: data.mime, lastModified: data.modified});

	if ( data.type === 'ab' )
		return data.buffer;

	if ( data.type === 'u8' )
		return new Uint8Array(data.buffer);

	throw new TypeError('Invalid type');
}