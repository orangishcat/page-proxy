import { resolveScriptStorageScope } from "./resolveScriptStorageScope";
import { storageKeyPrefix, networkCacheKeyPrefix } from "./_constants";

export const toScopedPrefix = (prefix: string, scopeOverride?: string) =>
  `${prefix}${resolveScriptStorageScope(scopeOverride)}:`;

export const isScopedSavedKey = (storageKey: string, scopeOverride?: string) => {
  const storagePrefix = toScopedPrefix(storageKeyPrefix, scopeOverride);
  const networkPrefix = toScopedPrefix(networkCacheKeyPrefix, scopeOverride);
  return storageKey.startsWith(storagePrefix) || storageKey.startsWith(networkPrefix);
};
