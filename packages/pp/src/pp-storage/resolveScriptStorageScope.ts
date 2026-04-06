import { scriptStorageScopeGlobalKey } from "./_constants";

const normalizeScope = (value: string | undefined) => {
  const normalized = value?.trim();
  if (!normalized) {
    return "global";
  }

  return normalized;
};

export const resolveScriptStorageScope = (scopeOverride?: string) => {
  const normalizedOverride = scopeOverride?.trim();
  if (normalizedOverride) {
    return normalizedOverride;
  }

  const rawScope = (globalThis as Record<string, unknown>)[scriptStorageScopeGlobalKey];
  if (typeof rawScope !== "string") {
    return "global";
  }

  return normalizeScope(rawScope);
};
