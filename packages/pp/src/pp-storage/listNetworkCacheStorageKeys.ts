import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { toScopedPrefix } from "./_prefixHelpers";
import { networkCacheKeyPrefix } from "./_constants";
import { listSavedStorageKeys } from "./listSavedStorageKeys";

export const listNetworkCacheStorageKeys = (scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const networkPrefix = toScopedPrefix(networkCacheKeyPrefix, scopeOverride);
  return listSavedStorageKeys(scopeOverride, adapter).filter((storageKey) => storageKey.startsWith(networkPrefix));
};
