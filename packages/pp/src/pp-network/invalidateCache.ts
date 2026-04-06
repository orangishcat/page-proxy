import { buildCacheStorageKeysForInvalidate } from "./_core";
import { getRawItem, removeRawItem } from "../pp-storage";
import type { RawStorageAdapter } from "../pp-storage";

export const invalidateCache = (key: string, scopeOverride?: string, adapter?: RawStorageAdapter) => {
  const storageKeys = buildCacheStorageKeysForInvalidate(key, scopeOverride);
  if (storageKeys.length === 0) {
    return false;
  }

  let invalidated = false;
  storageKeys.forEach((storageKey) => {
    const hasEntry = getRawItem(storageKey, adapter) !== null;
    if (!hasEntry) {
      return;
    }

    removeRawItem(storageKey, adapter);
    invalidated = true;
  });

  return invalidated;
};
