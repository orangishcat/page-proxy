import { beforeEach, describe, expect, mock, test } from "bun:test";

type StorageShape = Record<string, unknown>;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyShowHelpButtonStorageState?: StorageShape;
};

const getStorageState = () => {
  if (!storageSlot.__pageProxyShowHelpButtonStorageState) {
    storageSlot.__pageProxyShowHelpButtonStorageState = {};
  }

  return storageSlot.__pageProxyShowHelpButtonStorageState;
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
  coerceShowHelpButtonSetting,
  showHelpButtonStorageKey,
  readShowHelpButtonSetting,
  saveShowHelpButtonSetting,
} = await import("../src/lib/show-help-button-setting");

describe("show help button setting", () => {
  beforeEach(() => {
    const storageState = getStorageState();
    Object.keys(storageState).forEach((key) => {
      delete storageState[key];
    });
  });

  test("defaults to true when the setting is missing", async () => {
    expect(coerceShowHelpButtonSetting(undefined)).toBe(true);
    expect(await readShowHelpButtonSetting()).toBe(true);
  });

  test("round-trips the setting through local storage", async () => {
    await saveShowHelpButtonSetting(false);

    expect(getStorageState()[showHelpButtonStorageKey]).toBe(false);
    expect(await readShowHelpButtonSetting()).toBe(false);
  });
});
