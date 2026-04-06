import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { toStorageStorageKey } from "./toStorageStorageKey";
import { removeRawItem } from "./removeRawItem";

export const removeItem = (key: string, scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  removeRawItem(storageKey, adapter);
};
