import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { maxSavedKeysPerScript } from "./_constants";
import { listSavedStorageKeys } from "./listSavedStorageKeys";
import { removeRawItem } from "./removeRawItem";

export const enforceSavedKeyLimit = (
  scopeOverride?: string,
  nextStorageKey?: string,
  adapter: RawStorageAdapter = localStorageAdapter,
) => {
  const keys = listSavedStorageKeys(scopeOverride, adapter).filter((storageKey) => storageKey !== nextStorageKey);

  while (keys.length >= maxSavedKeysPerScript) {
    const oldestStorageKey = keys.shift();
    if (!oldestStorageKey) {
      return;
    }

    removeRawItem(oldestStorageKey, adapter);
  }
};
