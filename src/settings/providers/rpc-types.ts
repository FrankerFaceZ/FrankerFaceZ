'use strict';

// ============================================================================
// Cross-Origin RPC Message Types
// Shared by RemoteSettingsProvider and its concrete implementations.
// ============================================================================

import type { JsonSerialized } from 'utilities/blobs';

export type CorsRpcTypes = {

	'ready': {
		input: void;
		output: void;
	};

	'load': {
		input: void;
		output: Record<string, any>;
	};

	'change': {
		input: {
			key: string;
			value: any;
			deleted: boolean;
		};
		output: void;
	};

	'init-load': {
		input: void;
		output: {
			blobs: boolean;
			values: Record<string, any>;
		}
	};

	'set': {
		input: {
			key: string;
			value: any;
		};
		output: void;
	};

	'delete': {
		input: {
			key: string;
		};
		output: void;
	};

	'clear': {
		input: void;
		output: void;
	};

	'get-blob': {
		input: {
			key: string;
		};
		output: JsonSerialized<SerializedBlobLike> | SerializedBlobLike | null;
	};

	'set-blob': {
		input: {
			key: string;
			value: JsonSerialized<SerializedBlobLike> | SerializedBlobLike | null;
		};
		output: void;
	};

	'change-blob': {
		input: {
			key: string;
			deleted: boolean;
		};
		output: void;
	}

	'delete-blob': {
		input: {
			key: string;
		};
		output: void;
	};

	'has-blob': {
		input: {
			key: string;
		};
		output: boolean;
	};

	'clear-blobs': {
		input: void;
		output: void;
	};

	'blob-keys': {
		input: void;
		output: string[];
	};

	'flush': {
		input: void;
		output: void;
	};

};

export type CorsInput<K extends keyof CorsRpcTypes> = CorsRpcTypes[K] extends { input: infer U } ? U : void;
export type CorsOutput<K extends keyof CorsRpcTypes> = CorsRpcTypes[K] extends { output: infer U } ? U : void;

export type RPCInputMessage<K extends keyof CorsRpcTypes> = {
	ffz_type: K;
	id?: number;
} & CorsInput<K>;

export type CorsReplyMessage = {
	ffz_type: 'reply';
	id: number;
	reply: any;
};

export type CorsReplyErrorMessage = {
	ffz_type: 'reply-error';
	id: number;
};

export type CorsMessage = CorsReplyMessage | CorsReplyErrorMessage | {
	[K in keyof CorsRpcTypes]: RPCInputMessage<K>
}[keyof CorsRpcTypes];
