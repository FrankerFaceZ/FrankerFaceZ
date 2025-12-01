
/** A union of the various Blob types that are supported. */
export type BlobLike = Blob | File | ArrayBuffer | Uint8Array;

/** A union of the various serialized blob types. */
export type SerializedBlobLike = SerializedBlob | SerializedFile | SerializedArrayBuffer | SerializedUint8Array;

/** A serialized {@link Blob} representation. */
export type SerializedBlob = {
	type: 'blob';
	mime: string;
	buffer: ArrayBuffer
};

/** A serialized {@link File} representation. */
export type SerializedFile = {
	type: 'file';
	mime: string;
	name: string;
	modified: number;
	buffer: ArrayBuffer
};

/** A serialized {@link ArrayBuffer} representation. */
export type SerializedArrayBuffer = {
	type: 'ab';
	buffer: ArrayBuffer;
};

/** A serialized {@link Uint8Array} representation. */
export type SerializedUint8Array = {
	type: 'u8',
	buffer: ArrayBuffer
};

export type JsonSerialized<T> = Omit<T, "buffer"> & {
	buffer: string;
}


/**
 * Determine if the provided object is a valid Blob that can be serialized
 * for transmission via a messaging API.
 */
export function isValidBlob(blob: any): blob is BlobLike {
	return blob instanceof Blob || blob instanceof File || blob instanceof ArrayBuffer || blob instanceof Uint8Array;
}

/**
 * Serialize the provided {@link BlobLike} object into a format that can be
 * transmitted via a messaging API.
 */
export async function serializeBlob(blob?: BlobLike): Promise<SerializedBlobLike | null> {
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

/**
 * Deserialize the provided {@link SerializedBlobLike} object into a copy of
 * the original {@link BlobLike}.
 */
export function deserializeBlob(data: SerializedBlobLike): BlobLike | null {
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


export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer),
		len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary_string = atob(base64),
		len = binary_string.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary_string.charCodeAt(i);
	}
	return bytes.buffer;
}

export function jsonSerialize<T extends SerializedBlobLike>(data: T): JsonSerialized<T> {
	return {
		...data,
		buffer: arrayBufferToBase64(data.buffer)
	};
}

export function jsonDeserialize<T extends SerializedBlobLike>(data: JsonSerialized<T>): T {
	return {
		...data,
		buffer: base64ToArrayBuffer(data.buffer)
	} as T;
}
