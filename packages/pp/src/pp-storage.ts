export const scriptStorageScopeGlobalKey = "__pageProxyScriptStorageScope__";
export const storageKeyPrefix = "pp-storage:";
export const networkCacheKeyPrefix = "pp-network-cache:";
export const maxSavedKeysPerScript = 50;

type ScopedRawSetOptions = {
  scope?: string;
  enforceLimit?: boolean;
};

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

const toScopedPrefix = (prefix: string, scopeOverride?: string) =>
  `${prefix}${resolveScriptStorageScope(scopeOverride)}:`;

export const toStorageStorageKey = (key: string, scopeOverride?: string) =>
  `${toScopedPrefix(storageKeyPrefix, scopeOverride)}${key}`;

export const toNetworkCacheStorageKey = (key: string, scopeOverride?: string) =>
  `${toScopedPrefix(networkCacheKeyPrefix, scopeOverride)}${key}`;

const isScopedSavedKey = (storageKey: string, scopeOverride?: string) => {
  const storagePrefix = toScopedPrefix(storageKeyPrefix, scopeOverride);
  const networkPrefix = toScopedPrefix(networkCacheKeyPrefix, scopeOverride);
  return storageKey.startsWith(storagePrefix) || storageKey.startsWith(networkPrefix);
};

export const listSavedStorageKeys = (scopeOverride?: string) => {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) {
      continue;
    }

    if (!isScopedSavedKey(key, scopeOverride)) {
      continue;
    }

    keys.push(key);
  }

  return keys;
};

export const listNetworkCacheStorageKeys = (scopeOverride?: string) => {
  const networkPrefix = toScopedPrefix(networkCacheKeyPrefix, scopeOverride);
  return listSavedStorageKeys(scopeOverride).filter((storageKey) => storageKey.startsWith(networkPrefix));
};

export const getRawItem = (storageKey: string) => localStorage.getItem(storageKey);

export const removeRawItem = (storageKey: string) => {
  localStorage.removeItem(storageKey);
};

export const enforceSavedKeyLimit = (scopeOverride?: string, nextStorageKey?: string) => {
  const keys = listSavedStorageKeys(scopeOverride).filter((storageKey) => storageKey !== nextStorageKey);

  while (keys.length >= maxSavedKeysPerScript) {
    const oldestStorageKey = keys.shift();
    if (!oldestStorageKey) {
      return;
    }

    removeRawItem(oldestStorageKey);
  }
};

export const setRawItem = (storageKey: string, value: string, options: ScopedRawSetOptions = {}) => {
  const scope = resolveScriptStorageScope(options.scope);
  const isNewKey = getRawItem(storageKey) === null;
  if (options.enforceLimit === true && isNewKey) {
    enforceSavedKeyLimit(scope, storageKey);
  }

  localStorage.setItem(storageKey, value);
};

export const setItem = (key: string, value: string, scopeOverride?: string) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  setRawItem(storageKey, String(value), {
    scope: scopeOverride,
    enforceLimit: true,
  });
};

export const getItem = (key: string, scopeOverride?: string) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  return getRawItem(storageKey);
};

export const removeItem = (key: string, scopeOverride?: string) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  removeRawItem(storageKey);
};

export const createStorage = (scopeOverride?: string) => {
  const scope = resolveScriptStorageScope(scopeOverride);
  return {
    setItem: (key: string, value: string) => setItem(key, value, scope),
    getItem: (key: string) => getItem(key, scope),
    removeItem: (key: string) => removeItem(key, scope),
  };
};

export const pt = createStorage();
