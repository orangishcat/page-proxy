import {
  networkCacheKeyPrefix,
  storageKeyPrefix,
  type RawStorageAdapter,
} from "@page-proxy/pp/pp-storage";
import { z } from "zod";

export type StoredRuntimeStorage = {
  pt: Record<string, string>;
  pn: Record<string, string>;
};

const StoredStringRecordSchema = z.record(z.string(), z.unknown()).catch({}).transform((record): Record<string, string> => {
  const next: Record<string, string> = {};
  Object.entries(record).forEach(([key, value]) => {
    if (typeof value === "string") {
      next[key] = value;
    }
  });
  return next;
});

export const StoredRuntimeStorageSchema = z.object({
  pt: StoredStringRecordSchema,
  pn: StoredStringRecordSchema,
});

export const createEmptyStoredRuntimeStorage = (): StoredRuntimeStorage => ({
  pt: {},
  pn: {},
});

export const cloneStoredRuntimeStorage = (value: StoredRuntimeStorage): StoredRuntimeStorage => ({
  pt: { ...value.pt },
  pn: { ...value.pn },
});

export const coerceStoredRuntimeStorage = (value: unknown): StoredRuntimeStorage => {
  const parsed = StoredRuntimeStorageSchema.safeParse(value);
  return parsed.success ? parsed.data : createEmptyStoredRuntimeStorage();
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
