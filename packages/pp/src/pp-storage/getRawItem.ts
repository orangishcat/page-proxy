import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";

export const getRawItem = (storageKey: string, adapter: RawStorageAdapter = localStorageAdapter) =>
  adapter.getItem(storageKey);
