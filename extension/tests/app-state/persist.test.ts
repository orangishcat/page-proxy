import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createDefaultAppState } from "../../src/lib/app-state/defaults";
import { replaceAppState } from "../../src/lib/app-state/state.svelte.ts";
import type { StoredToolState } from "../../src/lib/stored-tool-state";

type StorageShape = Record<string, unknown>;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyLocalStorageState?: StorageShape;
  __pageProxySessionStorageState?: StorageShape;
};

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
    },
  },
}));

const buildStoredState = (scriptName: string, websiteGlob: string, updatedAt: number): StoredToolState => ({
  scriptName,
  activeTool: "none",
  codeEditor: {
    content: [
      "import { pa, pn, pq, ps, pt, pv } from \"@page-proxy/pp\";",
      "",
      "// ==Page Proxy==",
      `// @title ${scriptName}`,
      `// @website ${websiteGlob}`,
      "// ==/Page Proxy==",
      "",
      "// ==Selectors==",
      "// ==/Selectors==",
      "",
    ].join("\n"),
  },
  selectorPanel: { entries: [] },
  permissions: { allowedGrants: [], enabled: true },
  websiteGlob,
  updatedAt,
  runtimeStorage: { pt: {}, pn: {} },
});

describe("flushAppStatePersistence", () => {
  beforeEach(() => {
    const local = getStorageState("local");
    const session = getStorageState("session");
    Object.keys(local).forEach((key) => delete local[key]);
    Object.keys(session).forEach((key) => delete session[key]);
    replaceAppState(createDefaultAppState());
  });

  test("writes active script and settings back to keyed storage", async () => {
    const { flushAppStatePersistence } = await import("../../src/lib/app-state/storage/persist/persist.ts");
    const { hydrateAppState } = await import("../../src/lib/app-state/storage/hydrate/hydrate.ts");
    const { replaceAppState } = await import("../../src/lib/app-state/state.svelte.ts");
    const { appStateActions } = await import("../../src/lib/app-state/actions.ts");

    replaceAppState(await hydrateAppState());

    appStateActions.setShowHelpButton(false);
    appStateActions.setDisableAllGrants(true);
    appStateActions.dismissBanner("helpBannerDismissed");
    appStateActions.dismissBanner("unsupportedBrowserBannerDismissed");
    appStateActions.dismissBanner("firefoxExperimentalBannerDismissed");
    appStateActions.dismissBanner("userscriptEnableBannerDismissed");
    appStateActions.upsertStoredToolState(buildStoredState("Docs Script", "https://docs.example.com/*", 1));

    await flushAppStatePersistence();

    const local = getStorageState("local");
    expect(local["pageproxy:show-help-button"]).toBe(false);
    expect(local["pageproxy:disable-all-grants"]).toBe(true);
    expect(local["sidepanel:helpBannerDismissed"]).toBe(true);
    expect(local["sidepanel:unsupportedBrowserBannerDismissed"]).toBe(true);
    expect(local["sidepanel:firefoxExperimentalBannerDismissed"]).toBe(true);
    expect(local["sidepanel:userscriptEnableBannerDismissed"]).toBe(true);
    expect(local["pageproxy:Docs Script"]).toMatchObject({ scriptName: "Docs Script" });
  });

  test("writes allowed grants back as a list", async () => {
    const { flushAppStatePersistence } = await import("../../src/lib/app-state/storage/persist/persist.ts");
    const { hydrateAppState } = await import("../../src/lib/app-state/storage/hydrate/hydrate.ts");
    const { replaceAppState } = await import("../../src/lib/app-state/state.svelte.ts");
    const local = getStorageState("local");
    local["pageproxy:Docs Script"] = {
      ...buildStoredState("Docs Script", "https://docs.example.com/*", 1),
      permissions: {
        allowedGrants: ["run-on-page-load"],
        enabled: true,
      },
    };

    replaceAppState(await hydrateAppState());
    await flushAppStatePersistence();

    const stored = getStorageState("local")["pageproxy:Docs Script"] as
      | { permissions?: { allowedGrants?: unknown } }
      | undefined;

    expect(stored?.permissions?.allowedGrants).toEqual(["run-on-page-load"]);
  });
});
