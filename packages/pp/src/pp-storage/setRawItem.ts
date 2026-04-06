import { localStorageAdapter } from "./_adapter";
import type { RawStorageAdapter } from "./_adapter";
import { resolveScriptStorageScope } from "./resolveScriptStorageScope";
import { getRawItem } from "./getRawItem";
import { enforceSavedKeyLimit } from "./enforceSavedKeyLimit";

type ScopedRawSetOptions = {
  scope?: string;
  enforceLimit?: boolean;
};

export const setRawItem = (
  storageKey: string,
  value: string,
  options: ScopedRawSetOptions = {},
  adapter: RawStorageAdapter = localStorageAdapter,
) => {
  const scope = resolveScriptStorageScope(options.scope);
  const isNewKey = getRawItem(storageKey, adapter) === null;
  if (options.enforceLimit === true && isNewKey) {
    enforceSavedKeyLimit(scope, storageKey, adapter);
  }

  adapter.setItem(storageKey, value);
};
