import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { toStorageStorageKey } from "./toStorageStorageKey";
import { getRawItem } from "./getRawItem";

export const getItem = (key: string, scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  return getRawItem(storageKey, adapter);
};
