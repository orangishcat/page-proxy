import { beforeEach, describe, expect, mock, test } from "bun:test";

type StorageShape = Record<string, unknown>;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyLocalStorageState?: StorageShape;
  __pageProxySessionStorageState?: StorageShape;
};

let storageChangedListener: ((changes: Record<string, { newValue: unknown }>, areaName: string) => void) | null = null;

const getStorageState = (kind: "local" | "session") => {
  const key = kind === "local" ? "__pageProxyLocalStorageState" : "__pageProxySessionStorageState";
  if (!storageSlot[key]) {
    storageSlot[key] = {};
  }

  return storageSlot[key];
};

const createStorageApi = (kind: "local" | "session") => ({
  get: (keys: null | string | string[]) => {
    const storageState = getStorageState(kind);
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
    Object.assign(getStorageState(kind), items);
    return Promise.resolve();
  },
  remove: (keys: string | string[]) => {
    const storageState = getStorageState(kind);
    const normalizedKeys = Array.isArray(keys) ? keys : [keys];
    normalizedKeys.forEach((key) => {
      delete storageState[key];
    });
    return Promise.resolve();
  },
});

void mock.module("wxt/browser", () => ({
  browser: {
    storage: {
      local: createStorageApi("local"),
      session: createStorageApi("session"),
      onChanged: {
        addListener: (listener: typeof storageChangedListener) => {
          storageChangedListener = listener;
        },
      },
    },
  },
}));

describe("registerAppStateSync", () => {
  beforeEach(() => {
    const local = getStorageState("local");
    const session = getStorageState("session");
    Object.keys(local).forEach((key) => delete local[key]);
    Object.keys(session).forEach((key) => delete session[key]);
    storageChangedListener = null;
  });

  test("merges remote hostname overrides without writing local state", async () => {
    const { hydrateAppState } = await import("../../src/lib/app-state/storage/hydrate/hydrate.ts");
    const { registerAppStateSync } = await import("../../src/lib/app-state/sync.ts");
    const { replaceAppState } = await import("../../src/lib/app-state/state.svelte.ts");
    const { appStateSelectors } = await import("../../src/lib/app-state/selectors.ts");

    replaceAppState(await hydrateAppState());
    registerAppStateSync();

    storageChangedListener?.(
      {
        "sidepanel:docs.example.com": { newValue: "Docs Script" },
      },
      "session",
    );

    expect(appStateSelectors.getSelectedScriptForHostname("docs.example.com")).toBe("Docs Script");
    expect(getStorageState("local")).toEqual({});
  });
});
