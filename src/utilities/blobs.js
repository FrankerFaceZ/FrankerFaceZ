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

export function serializeBlobUrl(blob) {
	return new Promise((s,f) => {
		const reader = new FileReader();
		reader.onabort = f;
		reader.onerror = f;
		reader.onload = e => {
			s(e.target.result);
		}
		reader.readAsDataURL(blob);
	});
}

export function deserializeBlobUrl(url) {
	return fetch(blob).then(res => res.blob())
}

export function deserializeABUrl(url) {
	return fetch(blob).then(res => res.arrayBuffer())
}

export async function serializeBlobForExt(blob) {
	if ( ! blob )
		return null;

	if ( blob instanceof Blob )
		return {
			type: 'blob',
			mime: blob.type,
			url: await serializeBlobUrl(blob)
		}

	if ( blob instanceof File )
		return {
			type: 'file',
			mime: blob.type,
			name: blob.name,
			modified: blob.lastModified,
			url: await serializeBlobUrl(blob)
		}

	if ( blob instanceof ArrayBuffer )
		return {
			type: 'ab',
			url: await serializeBlobUrl(new Blob([blob]))
		}

	if ( blob instanceof Uint8Array )
		return {
			type: 'u8',
			url: await serializeBlobUrl(new Blob([blob]))
		}

	throw new TypeError('Invalid type');

}

export async function deserializeBlobForExt(data) {
	if ( ! data || ! data.type )
		return null;

	if ( data.type === 'blob' )
		return await deserializeBlobUrl(data.url);

	if ( data.type === 'file' )
		return new File(
			[await deserializeBlobUrl(data.url)],
			data.name,
			{type: data.mime, lastModified: data.modified}
		);

	if ( data.type === 'ab' )
		return await deserializeABUrl(data.url);

	if ( data.type === 'u8' )
		return new Uint8Array(await deserializeABUrl(data.url));

	throw new TypeError('Invalid type');
}
