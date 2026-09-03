'use strict';

// ============================================================================
// Settings Providers
// ============================================================================

import { SettingsProvider } from './base';
import { LocalStorageProvider } from './local-storage';
import { IndexedDBProvider } from './indexeddb';
import { CrossOriginStorageBridge } from './cross-origin';
import { ExtensionProvider } from './extension';

export { IGNORE_CONTENT_KEYS, SettingsProvider, AdvancedSettingsProvider, RemoteSettingsProvider } from './base';
export { LocalStorageProvider } from './local-storage';
export { IndexedDBProvider } from './indexeddb';
export { CrossOriginStorageBridge } from './cross-origin';
export { ExtensionProvider } from './extension';


// ============================================================================
// Available Providers Map
// ============================================================================

export const Providers: Record<string, typeof SettingsProvider> = {

	local: LocalStorageProvider,
	idb: IndexedDBProvider,
	cosb: CrossOriginStorageBridge,
	ext: ExtensionProvider

};
