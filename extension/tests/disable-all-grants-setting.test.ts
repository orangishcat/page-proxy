import { beforeEach, describe, expect, mock, test } from "bun:test";

type StorageShape = Record<string, unknown>;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyDisableAllGrantsStorageState?: StorageShape;
};

const getStorageState = () => {
  if (!storageSlot.__pageProxyDisableAllGrantsStorageState) {
    storageSlot.__pageProxyDisableAllGrantsStorageState = {};
  }

  return storageSlot.__pageProxyDisableAllGrantsStorageState;
};

void mock.module("wxt/browser", () => ({
  browser: {
    storage: {
      local: {
        get: (keys: null | string | string[]) => {
          const storageState = getStorageState();
          if (keys === null) {
            return Promise.resolve({ ...storageState });
          }

          if (typeof keys === "string") {
            return Promise.resolve(keys in storageState ? { [keys]: storageState[keys] } : {});
          }

          return Promise.resolve(keys.reduce<Record<string, unknown>>((result, key) => {
            if (key in storageState) {
              result[key] = storageState[key];
            }
            return result;
          }, {}));
        },
        set: (items: Record<string, unknown>) => {
          Object.assign(getStorageState(), items);
          return Promise.resolve();
        },
      },
    },
  },
}));

const {
  coerceDisableAllGrantsSetting,
  disableAllGrantsStorageKey,
  readDisableAllGrantsSetting,
  saveDisableAllGrantsSetting,
} = await import("../src/lib/disable-all-grants-setting");

describe("disable all grants setting", () => {
  beforeEach(() => {
    const storageState = getStorageState();
    Object.keys(storageState).forEach((key) => {
      delete storageState[key];
    });
  });

  test("defaults to false when the setting is missing", async () => {
    expect(coerceDisableAllGrantsSetting(undefined)).toBe(false);
    expect(await readDisableAllGrantsSetting()).toBe(false);
  });

  test("round-trips the global setting through local storage", async () => {
    await saveDisableAllGrantsSetting(true);

    expect(getStorageState()[disableAllGrantsStorageKey]).toBe(true);
    expect(await readDisableAllGrantsSetting()).toBe(true);
  });
});
