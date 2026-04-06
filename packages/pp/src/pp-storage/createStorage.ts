import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { resolveScriptStorageScope } from "./resolveScriptStorageScope";
import { setItem } from "./setItem";
import { getItem } from "./getItem";
import { removeItem } from "./removeItem";

export const createStorage = (scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const scope = resolveScriptStorageScope(scopeOverride);
  return {
    setItem: (key: string, value: string) => setItem(key, value, scope, adapter),
    getItem: (key: string) => getItem(key, scope, adapter),
    removeItem: (key: string) => removeItem(key, scope, adapter),
  };
};
