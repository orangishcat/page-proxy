import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { toStorageStorageKey } from "./toStorageStorageKey";
import { setRawItem } from "./setRawItem";

export const setItem = (key: string, value: string, scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  setRawItem(storageKey, String(value), {
    scope: scopeOverride,
    enforceLimit: true,
  }, adapter);
};
