import { beforeEach, describe, expect, mock, test } from "bun:test";

type StorageShape = Record<string, unknown>;
type StorageChangeListener = (changes: StorageShape, areaName: string) => unknown;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyLocalStorageState?: StorageShape;
  __pageProxySessionStorageState?: StorageShape;
  __pageProxyStorageChangeListeners?: Set<StorageChangeListener>;
};

const getStorageChangeListeners = () =>
  (storageSlot.__pageProxyStorageChangeListeners ??= new Set<StorageChangeListener>());

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
        addListener: (listener: StorageChangeListener) => getStorageChangeListeners().add(listener),
        removeListener: (listener: StorageChangeListener) => getStorageChangeListeners().delete(listener),
      },
    },
  },
}));

const hydrateModule = await import("../../src/lib/app-state/storage/hydrate/hydrate.ts");
const stateModule = await import("../../src/lib/app-state/state.svelte.ts");
const selectorsModule = await import("../../src/lib/app-state/selectors.ts");
const syncModule = await import("../../src/lib/app-state/storage/sync.ts");
const runHydrateAppState = hydrateModule.hydrateAppState;
const replaceHydratedState = stateModule.replaceAppState;
const appStateSelectors = selectorsModule.appStateSelectors;

const buildStoredState = (scriptName: string, websiteGlob: string, updatedAt: number) => ({
  scriptName,
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

describe("hydrateAppState", () => {
  beforeEach(() => {
    const local = getStorageState("local");
    const session = getStorageState("session");
    Object.keys(local).forEach((key) => delete local[key]);
    Object.keys(session).forEach((key) => delete session[key]);
    getStorageChangeListeners().clear();
  });

  test("loads scripts and settings from keyed storage entries", async () => {
    const local = getStorageState("local");
    const session = getStorageState("session");
    local["pageproxy:show-help-button"] = false;
    local["pageproxy:disable-all-grants"] = true;
    local["sidepanel:activeTool"] = "record";
    local["pageproxy:Docs Script"] = buildStoredState("Docs Script", "https://docs.example.com/*", 1);
    local["sidepanel:legacy-selected-script"] = "Docs Script";
    local["sidepanel:toolPanelHeightPx"] = 320;
    local["sidepanel:helpBannerDismissed"] = true;
    local["sidepanel:unsupportedBrowserBannerDismissed"] = true;
    local["sidepanel:firefoxExperimentalBannerDismissed"] = true;
    local["sidepanel:userscriptEnableBannerDismissed"] = true;
    local["sidepanel:recordPanel:12"] = {
      isRecording: false,
      timeline: [{ id: "entry-1", action: "Click", detail: "", timestamp: 1 }],
      updatedAt: 1,
    };
    session["sidepanel:openTabs"] = { "12": true };
    session["sidepanel:docs.example.com"] = "Docs Script";

    const state = await runHydrateAppState();
    replaceHydratedState(state);

    expect(state.settings.showHelpButton).toBe(false);
    expect(state.settings.disableAllGrants).toBe(true);
    expect(state.sidepanel.activeTool).toBe("record");
    expect(state.sidepanel.toolPanelHeightPx).toBe(320);
    expect(state.sidepanel.helpBannerDismissed).toBe(true);
    expect(state.sidepanel.unsupportedBrowserBannerDismissed).toBe(true);
    expect(state.sidepanel.firefoxExperimentalBannerDismissed).toBe(true);
    expect(state.sidepanel.userscriptEnableBannerDismissed).toBe(true);
    expect(state.scriptsByName["Docs Script"]?.scriptName).toBe("Docs Script");
    expect(state.recordPanelsByTabId["12"]?.isRecording).toBe(false);
    expect(state.session.openTabsByTabId).toEqual({ "12": true });
    expect(state.session.selectedScriptByHostname["docs.example.com"]).toBe("Docs Script");

    expect(appStateSelectors.getShowHelpButton()).toBe(false);
  });

  test("synchronizes script edits from another extension context", async () => {
    const local = getStorageState("local");
    local["pageproxy:Docs Script"] = buildStoredState("Docs Script", "https://docs.example.com/*", 1);
    replaceHydratedState(await runHydrateAppState());

    const updatedState = buildStoredState("Docs Script", "https://docs.example.com/*", 2);
    updatedState.codeEditor.content += "\nconsole.log(\"updated\");\n";
    local["pageproxy:Docs Script"] = updatedState;

    const stopSync = syncModule.startAppStateStorageSync();
    const listener = Array.from(getStorageChangeListeners())[0];
    await listener?.({ "pageproxy:Docs Script": { newValue: updatedState } }, "local");

    expect(appStateSelectors.getStoredToolState("Docs Script")?.codeEditor.content).toContain('console.log("updated")');
    stopSync();
    expect(getStorageChangeListeners()).toHaveLength(0);
  });

  test("ignores unrelated storage changes", () => {
    expect(syncModule.isAppStateStorageChange({ unrelated: { newValue: true } }, "local")).toBe(false);
    expect(syncModule.isAppStateStorageChange({ "pageproxy:Docs Script": {} }, "sync")).toBe(false);
  });
});
