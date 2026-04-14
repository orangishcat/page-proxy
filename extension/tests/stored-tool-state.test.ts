import { beforeEach, describe, expect, mock, test } from "bun:test";

type StorageShape = Record<string, unknown>;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyLocalStorageState?: StorageShape;
};

const getStorageState = () => {
  if (!storageSlot.__pageProxyLocalStorageState) {
    storageSlot.__pageProxyLocalStorageState = {};
  }

  return storageSlot.__pageProxyLocalStorageState;
};

const storageApi = {
  get: (keys: null | string | string[]) => {
    const storageState = getStorageState();
    if (keys === null) {
      return Promise.resolve({ ...storageState });
    }

    if (typeof keys === "string") {
      return Promise.resolve(keys in storageState ? { [keys]: storageState[keys] } : {});
    }

    return Promise.resolve(
      keys.reduce<Record<string, unknown>>((result, key) => {
        if (key in storageState) {
          result[key] = storageState[key];
        }
        return result;
      }, {}),
    );
  },
  set: (items: StorageShape) => {
    Object.assign(getStorageState(), items);
    return Promise.resolve();
  },
  remove: (keys: string | string[]) => {
    const storageState = getStorageState();
    const normalizedKeys = Array.isArray(keys) ? keys : [keys];
    normalizedKeys.forEach((key) => {
      delete storageState[key];
    });
    return Promise.resolve();
  },
};

void mock.module("wxt/browser", () => ({
  browser: {
    storage: {
      local: storageApi,
      session: storageApi,
    },
  },
}));

const { saveStoredToolState, readStoredToolState, toStorageKey } = await import(
  "../src/entrypoints/sidepanel/tools/state-storage"
);
import type { StoredToolState } from "../src/lib/stored-tool-state";

const buildStoredState = (): StoredToolState => ({
  scriptName: "Page Proxy",
  activeTool: "none",
  codeEditor: {
    content: [
      "// ==Page Proxy==",
      "// @title Page Proxy",
      "// @website https://example.com/*",
      "// ==/Page Proxy==",
      "",
      "// ==Selectors==",
      "// ==/Selectors==",
      "",
    ].join("\n"),
  },
  selectorPanel: {
    entries: [],
  },
  permissions: {
    allowedGrants: ["run-on-page-load"],
    enabled: true,
  },
  websiteGlob: "https://example.com/*",
  updatedAt: 1,
  runtimeStorage: {
    pt: {},
    pn: {},
  },
});

describe("stored tool state persistence", () => {
  beforeEach(() => {
    const storageState = getStorageState();
    Object.keys(storageState).forEach((key) => delete storageState[key]);
  });

  test("writes allowed grants as a list and reads them as a list", async () => {
    const state = buildStoredState();

    await saveStoredToolState(state);

    const raw = getStorageState()[toStorageKey("Page Proxy")] as { permissions?: { allowedGrants?: unknown } } | undefined;
    expect(Array.isArray(raw?.permissions?.allowedGrants)).toBe(true);
    expect(raw?.permissions?.allowedGrants).toEqual(["run-on-page-load"]);

    const loaded = await readStoredToolState("Page Proxy");
    expect(loaded?.permissions.allowedGrants).toEqual(["run-on-page-load"]);
  });
});
