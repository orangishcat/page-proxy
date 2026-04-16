import { snapshot } from "svelte/internal/client";
import type { ZodType } from "zod";
import log from "../../logger";
import equal from "fast-deep-equal";

export type StorageAreaLike = {
  get: (keys: null | string | string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
};

export type CreateStorageAdapterOptions<TRecord extends Record<string, unknown>> = {
  area: StorageAreaLike;
  prefix: string;
  schema: ZodType<TRecord>;
  loggerName: string;
  excludeKeys?: Set<string>;
  removeWhen?: (value: unknown) => boolean;
};

export type StorageAdapter<TRecord extends Record<string, unknown>> = {
  prefix: string;
  toStorageKey: (key: string) => string;
  fromStorageKey: (key: string) => string | null;
  load: () => Promise<TRecord>;
  persist: (nextRecord: TRecord, previousRecord?: TRecord) => Promise<void>;
};

const isExcludedKey = (rawKey: string, excludeKeys: Set<string>) =>
  Array.from(excludeKeys).some((excludedKey) => rawKey === excludedKey || rawKey.startsWith(excludedKey));

const toPlain = snapshot as <T>(value: T) => T;

export const createStorageAdapter = <TRecord extends Record<string, unknown>>({
  area,
  prefix,
  schema,
  loggerName,
  excludeKeys = new Set<string>(),
  removeWhen = (value) => value === undefined || value === null,
}: CreateStorageAdapterOptions<TRecord>): StorageAdapter<TRecord> => {
  const logger = log.getLogger(loggerName);
  const toStorageKey = (key: string) => `${prefix}${key}`;
  const fromStorageKey = (key: string) => {
    if (!key.startsWith(prefix)) {
      return null;
    }

    const raw = key.slice(prefix.length);
    return raw.length > 0 && !isExcludedKey(raw, excludeKeys) ? raw : null;
  };

  return {
    prefix,
    toStorageKey,
    fromStorageKey,
    async load() {
      try {
        const values = await area.get(null);
        const raw = Object.fromEntries(
          Object.entries(values).flatMap(([key, value]) => {
            const entryKey = fromStorageKey(key);
            return entryKey ? [[entryKey, value]] : [];
          }),
        );
        const parsed = schema.safeParse(raw);
        logger.debug("loaded storage", { prefix, raw, parsed });
        return parsed.success ? parsed.data : schema.parse({});
      } catch (error) {
        logger.error("storage load failed", { prefix, error });
        throw new Error(`Unable to load storage for prefix "${prefix}".`);
      }
    },
    async persist(nextRecord: TRecord, previousRecord: TRecord = {} as TRecord) {
      try {
        logger.debug("attempting to persist storage", { prefix, nextRecord, previousRecord });
        const setPayload = Object.fromEntries(
          Object.entries(nextRecord)
            .filter(([, value]) => !removeWhen(value))
            .filter(([key, value]) => !equal(previousRecord[key as keyof TRecord], value))
            .map(([key, value]) => [toStorageKey(key), value]),
        );
        const removeKeys = Object.keys(previousRecord)
          .filter((key) => !(key in nextRecord) || removeWhen(nextRecord[key as keyof TRecord]))
          .map(toStorageKey);

        if (Object.keys(setPayload).length > 0) {
          const plainPayload = toPlain(setPayload);
          logger.debug("persisting payload", { prefix, setPayload: plainPayload });
          await area.set(plainPayload);
        }
        if (removeKeys.length > 0) {
          await area.remove(removeKeys);
        }
      } catch (error) {
        logger.error("storage persist failed", { prefix, error });
        throw new Error(`Unable to persist storage for prefix "${prefix}".`);
      }
    },
  };
};
