import {
  networkCacheKeyPrefix,
  storageKeyPrefix,
  type RawStorageAdapter,
} from "@page-proxy/pp/pp-storage";

export type StoredRuntimeStorage = {
  pt: Record<string, string>;
  pn: Record<string, string>;
};

const coerceStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((result, [key, entryValue]) => {
    if (typeof entryValue === "string") {
      result[key] = entryValue;
    }
    return result;
  }, {});
};

export const createEmptyStoredRuntimeStorage = (): StoredRuntimeStorage => ({
  pt: {},
  pn: {},
});

export const cloneStoredRuntimeStorage = (value: StoredRuntimeStorage): StoredRuntimeStorage => ({
  pt: { ...value.pt },
  pn: { ...value.pn },
});

export const coerceStoredRuntimeStorage = (value: unknown): StoredRuntimeStorage => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyStoredRuntimeStorage();
  }

  const data = value as { pt?: unknown; pn?: unknown };
  return {
    pt: coerceStringRecord(data.pt),
    pn: coerceStringRecord(data.pn),
  };
};

const resolveStorageBucket = (storageKey: string): keyof StoredRuntimeStorage | null => {
  if (storageKey.startsWith(storageKeyPrefix)) {
    return "pt";
  }

  if (storageKey.startsWith(networkCacheKeyPrefix)) {
    return "pn";
  }

  return null;
};

export const createStoredRuntimeStorageAdapter = (storage: StoredRuntimeStorage): RawStorageAdapter => ({
  listKeys: () => [...Object.keys(storage.pt), ...Object.keys(storage.pn)],
  getItem: (storageKey) => {
    const bucket = resolveStorageBucket(storageKey);
    if (!bucket) {
      return null;
    }

    return storage[bucket][storageKey] ?? null;
  },
  setItem: (storageKey, value) => {
    const bucket = resolveStorageBucket(storageKey);
    if (!bucket) {
      return;
    }

    storage[bucket][storageKey] = value;
  },
  removeItem: (storageKey) => {
    const bucket = resolveStorageBucket(storageKey);
    if (!bucket) {
      return;
    }

    delete storage[bucket][storageKey];
  },
});
