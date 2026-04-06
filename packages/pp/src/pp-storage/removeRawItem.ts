import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";

export const removeRawItem = (storageKey: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  adapter.removeItem(storageKey);
};
