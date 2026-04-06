import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { isScopedSavedKey } from "./_prefixHelpers";

export const listSavedStorageKeys = (scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) =>
  adapter.listKeys().filter((storageKey) => isScopedSavedKey(storageKey, scopeOverride));
