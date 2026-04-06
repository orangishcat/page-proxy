import { toScopedPrefix } from "./_prefixHelpers";
import { networkCacheKeyPrefix } from "./_constants";

export const toNetworkCacheStorageKey = (key: string, scopeOverride?: string) =>
  `${toScopedPrefix(networkCacheKeyPrefix, scopeOverride)}${key}`;
