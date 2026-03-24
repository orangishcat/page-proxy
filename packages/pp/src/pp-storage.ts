export const scriptStorageScopeGlobalKey = "__pageProxyScriptStorageScope__";
export const storageKeyPrefix = "pp-storage:";
export const networkCacheKeyPrefix = "pp-network-cache:";
export const maxSavedKeysPerScript = 50;

export type RawStorageAdapter = {
  listKeys: () => string[];
  getItem: (storageKey: string) => string | null;
  setItem: (storageKey: string, value: string) => void;
  removeItem: (storageKey: string) => void;
};

type ScopedRawSetOptions = {
  scope?: string;
  enforceLimit?: boolean;
};

const localStorageAdapter: RawStorageAdapter = {
  listKeys: () => {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) {
        keys.push(key);
      }
    }
    return keys;
  },
  getItem: (storageKey) => localStorage.getItem(storageKey),
  setItem: (storageKey, value) => {
    localStorage.setItem(storageKey, value);
  },
  removeItem: (storageKey) => {
    localStorage.removeItem(storageKey);
  },
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

export const listSavedStorageKeys = (scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) =>
  adapter.listKeys().filter((storageKey) => isScopedSavedKey(storageKey, scopeOverride));

export const listNetworkCacheStorageKeys = (scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const networkPrefix = toScopedPrefix(networkCacheKeyPrefix, scopeOverride);
  return listSavedStorageKeys(scopeOverride, adapter).filter((storageKey) => storageKey.startsWith(networkPrefix));
};

export const getRawItem = (storageKey: string, adapter: RawStorageAdapter = localStorageAdapter) =>
  adapter.getItem(storageKey);

export const removeRawItem = (storageKey: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  adapter.removeItem(storageKey);
};

export const enforceSavedKeyLimit = (
  scopeOverride?: string,
  nextStorageKey?: string,
  adapter: RawStorageAdapter = localStorageAdapter,
) => {
  const keys = listSavedStorageKeys(scopeOverride, adapter).filter((storageKey) => storageKey !== nextStorageKey);

  while (keys.length >= maxSavedKeysPerScript) {
    const oldestStorageKey = keys.shift();
    if (!oldestStorageKey) {
      return;
    }

    removeRawItem(oldestStorageKey, adapter);
  }
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

export const setItem = (key: string, value: string, scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  setRawItem(storageKey, String(value), {
    scope: scopeOverride,
    enforceLimit: true,
  }, adapter);
};

export const getItem = (key: string, scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  return getRawItem(storageKey, adapter);
};

export const removeItem = (key: string, scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const storageKey = toStorageStorageKey(String(key), scopeOverride);
  removeRawItem(storageKey, adapter);
};

export const createStorage = (scopeOverride?: string, adapter: RawStorageAdapter = localStorageAdapter) => {
  const scope = resolveScriptStorageScope(scopeOverride);
  return {
    setItem: (key: string, value: string) => setItem(key, value, scope, adapter),
    getItem: (key: string) => getItem(key, scope, adapter),
    removeItem: (key: string) => removeItem(key, scope, adapter),
  };
};

export const pt = createStorage();
