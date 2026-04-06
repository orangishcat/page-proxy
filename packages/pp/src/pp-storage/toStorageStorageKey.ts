import { toScopedPrefix } from "./_prefixHelpers";
import { storageKeyPrefix } from "./_constants";

export const toStorageStorageKey = (key: string, scopeOverride?: string) =>
  `${toScopedPrefix(storageKeyPrefix, scopeOverride)}${key}`;
