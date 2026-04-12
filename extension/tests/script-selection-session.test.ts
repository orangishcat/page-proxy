import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { StoredToolState } from "../src/entrypoints/sidepanel/tools/state-storage";

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

const cloneStorageState = (kind: "local" | "session") => ({ ...getStorageState(kind) });

const createStorageApi = (kind: "local" | "session") => ({
  get: (keys: null | string | string[]) => {
    if (keys === null) {
      return Promise.resolve(cloneStorageState(kind));
    }

    if (typeof keys === "string") {
      const storageState = getStorageState(kind);
      return Promise.resolve(keys in storageState ? { [keys]: storageState[keys] } : {});
    }

    const storageState = getStorageState(kind);
    return Promise.resolve(keys.reduce<StorageShape>((result, key) => {
      if (key in storageState) {
        result[key] = storageState[key];
      }
      return result;
    }, {}));
  },
  set: (items: StorageShape) => {
    const storageState = getStorageState(kind);
    Object.assign(storageState, items);
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
    tabs: {
      get: () => Promise.resolve(null),
      onActivated: {
        addListener: () => undefined,
        removeListener: () => undefined,
      },
      onUpdated: {
        addListener: () => undefined,
        removeListener: () => undefined,
      },
    },
  },
}));

const { normalizeContentForStorage, resolveStoredToolStateForUrl } = await import(
  "../src/entrypoints/sidepanel/tools/state-loading"
);
const { toStorageKey } = await import("../src/entrypoints/sidepanel/tools/state-storage");
const {
  clearSelectedScriptForHostname,
  readSelectedScriptForHostname,
  writeSelectedScriptForHostname,
} = await import("../src/entrypoints/sidepanel/tools/script-selection-session");
const { resetScriptToDefault } = await import("../src/entrypoints/sidepanel/tools/code-editor/editor-actions");
const {
  createNewScriptForCurrentTab: createNewScriptForCurrentTabInLoader,
  loadStateForUrl,
  selectScriptForCurrentTab,
} = await import("../src/entrypoints/sidepanel/tools/code-editor/tab-loader");

const scriptFormatConfig = {
  ppImportLines: ['import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";'],
  defineBlockStart: "// ==Selectors==",
  defineBlockEnd: "// ==/Selectors==",
  protectedComment: "// protected",
} as const;

const buildScriptContent = (title: string, websiteGlob: string) =>
  [
    'import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";',
    "",
    "// ==Page Proxy==",
    `// @title ${title}`,
    `// @website ${websiteGlob}`,
    "// @description",
    "// @author",
    "// @grant",
    "// ==/Page Proxy==",
    "",
    "// ==Selectors==",
    "// ==/Selectors==",
    "",
    'pa.notification("Hello world!");',
    "",
  ].join("\n");

const buildStoredState = (scriptName: string, websiteGlob: string, updatedAt: number): StoredToolState => ({
  scriptName,
  activeTool: "none",
  codeEditor: {
    content: normalizeContentForStorage(buildScriptContent(scriptName, websiteGlob), false, scriptFormatConfig),
  },
  selectorPanel: {
    entries: [],
  },
  permissions: {
    allowedGrants: [],
  },
  websiteGlob,
  updatedAt,
  runtimeStorage: {
    pt: {},
    pn: {},
  },
});

describe("script selection session", () => {
  beforeEach(() => {
    Object.keys(getStorageState("local")).forEach((key) => {
      delete getStorageState("local")[key];
    });
    Object.keys(getStorageState("session")).forEach((key) => {
      delete getStorageState("session")[key];
    });
  });

  test("stores the selected script name under a hostname-scoped session key", async () => {
    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();

    await writeSelectedScriptForHostname("docs.example.com", "Page Proxy 2");

    expect(getStorageState("session")["sidepanel:docs.example.com"]).toBe("Page Proxy 2");
    expect(await readSelectedScriptForHostname("docs.example.com")).toBe("Page Proxy 2");

    await clearSelectedScriptForHostname("docs.example.com");

    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();
    expect("sidepanel:docs.example.com" in getStorageState("session")).toBe(false);
  });

  test("resolves the selected script from the hostname session override when multiple scripts match", async () => {
    const localStorageState = getStorageState("local");
    localStorageState[toStorageKey("Page Proxy")] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);
    localStorageState[toStorageKey("Page Proxy 2")] = buildStoredState("Page Proxy 2", "https://docs.example.com/reference/*", 2);
    await writeSelectedScriptForHostname("docs.example.com", "Page Proxy");

    const result = await resolveStoredToolStateForUrl("https://docs.example.com/reference/api", scriptFormatConfig);

    expect(result.defaultMatch.scriptName).toBe("Page Proxy 2");
    expect(result.selectedMatch.scriptName).toBe("Page Proxy");
    expect(result.matches.map((entry) => entry.scriptName)).toEqual(["Page Proxy 2", "Page Proxy"]);
    expect(result.scriptName).toBe("Page Proxy");
    expect(result.websiteGlob).toBe("https://docs.example.com/*");
  });

  test("falls back to the default match and clears stale hostname overrides", async () => {
    const localStorageState = getStorageState("local");
    localStorageState[toStorageKey("Page Proxy")] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);
    await writeSelectedScriptForHostname("docs.example.com", "Missing Script");

    const result = await resolveStoredToolStateForUrl("https://docs.example.com/page", scriptFormatConfig);

    expect(result.defaultMatch.scriptName).toBe("Page Proxy");
    expect(result.selectedMatch.scriptName).toBe("Page Proxy");
    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();
  });

  test("clears hostname overrides that point at the current default match", async () => {
    const localStorageState = getStorageState("local");
    localStorageState[toStorageKey("Page Proxy")] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);
    localStorageState[toStorageKey("Page Proxy 2")] = buildStoredState("Page Proxy 2", "https://docs.example.com/reference/*", 2);
    await writeSelectedScriptForHostname("docs.example.com", "Page Proxy 2");

    const result = await resolveStoredToolStateForUrl("https://docs.example.com/reference/api", scriptFormatConfig);

    expect(result.defaultMatch.scriptName).toBe("Page Proxy 2");
    expect(result.selectedMatch.scriptName).toBe("Page Proxy 2");
    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();
  });

  test("switches to a selected matching script and clears the hostname key when switching back to default", async () => {
    const localStorageState = getStorageState("local");
    localStorageState[toStorageKey("Page Proxy")] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);
    localStorageState[toStorageKey("Page Proxy 2")] = buildStoredState("Page Proxy 2", "https://docs.example.com/reference/*", 2);

    const state = {
      activeTabId: 1,
      activeTabUrl: "https://docs.example.com/reference/api",
      activeWebsiteGlob: "https://docs.example.com/reference/*",
      activeScriptName: "Page Proxy 2",
      defaultScriptName: "Page Proxy 2",
      availableScriptOptions: [],
      isProtectedPage: false,
      canPersistEditorChanges: true,
      hasUnsavedChanges: false,
      isProgrammaticUpdate: false,
      editorValue: "",
    };

    let activeToolId = "none";
    let allowedGrants: unknown[] = [];
    let latestEditorContent = "";
    let latestMessage: string | null = null;

    const deps = {
      state,
      setActiveToolId: (tool: string) => {
        activeToolId = tool;
      },
      setAllowedGrants: (grants: unknown[]) => {
        allowedGrants = grants;
      },
      setElementEntries: () => undefined,
      setRecordPanelActiveTab: () => undefined,
      updateEditorContent: (content: string) => {
        latestEditorContent = content;
      },
      setEditorMessage: (message: string | null) => {
        latestMessage = message;
      },
      setEditorMessageFromUnknown: () => undefined,
      scriptFormatConfig,
      autosave: {
        queuePendingTabRefresh: () => false,
      },
    };

    await selectScriptForCurrentTab("Page Proxy", deps);

    expect(await readSelectedScriptForHostname("docs.example.com")).toBe("Page Proxy");
    expect(state.activeScriptName).toBe("Page Proxy");
    expect(state.activeWebsiteGlob).toBe("https://docs.example.com/*");
    expect(state.defaultScriptName).toBe("Page Proxy 2");
    expect(latestEditorContent).toContain("// @title Page Proxy");
    expect(activeToolId).toBe("none");
    expect(allowedGrants).toEqual([]);
    expect(latestMessage).toBeNull();

    await selectScriptForCurrentTab("Page Proxy 2", deps);

    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();
    expect(state.activeScriptName).toBe("Page Proxy 2");
    expect(state.activeWebsiteGlob).toBe("https://docs.example.com/reference/*");
    expect(latestEditorContent).toContain("// @title Page Proxy 2");
  });

  test("creates a new blank script for the current tab without overwriting matching stored scripts", async () => {
    const localStorageState = getStorageState("local");
    localStorageState[toStorageKey("Page Proxy")] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);

    const state = {
      activeTabId: 1,
      activeTabUrl: "https://docs.example.com/reference/api",
      activeWebsiteGlob: "https://docs.example.com/*",
      activeScriptName: "Page Proxy",
      defaultScriptName: "Page Proxy",
      availableScriptOptions: [{ scriptName: "Page Proxy", websiteGlob: "https://docs.example.com/*" }],
      isProtectedPage: false,
      canPersistEditorChanges: true,
      hasUnsavedChanges: false,
      isProgrammaticUpdate: false,
      editorValue: buildScriptContent("Page Proxy", "https://docs.example.com/*"),
    };

    let latestEditorContent = "";
    let latestMessage: string | null = null;

    const deps = {
      state,
      setActiveToolId: () => undefined,
      setAllowedGrants: () => undefined,
      setElementEntries: () => undefined,
      setRecordPanelActiveTab: () => undefined,
      updateEditorContent: (content: string) => {
        latestEditorContent = content;
      },
      setEditorMessage: (message: string | null) => {
        latestMessage = message;
      },
      setEditorMessageFromUnknown: () => undefined,
      scriptFormatConfig,
      autosave: {
        queuePendingTabRefresh: () => false,
      },
    };

    await createNewScriptForCurrentTabInLoader(deps);

    expect(state.activeScriptName).toBe("Page Proxy 2");
    expect(state.activeWebsiteGlob).toBe("https://docs.example.com/*");
    expect(state.defaultScriptName).toBe("Page Proxy");
    expect(state.availableScriptOptions).toEqual([{ scriptName: "Page Proxy", websiteGlob: "https://docs.example.com/*" }]);
    expect(latestEditorContent).toContain("// @title Page Proxy 2");
    expect(latestEditorContent).toContain("// @website https://docs.example.com/*");
    expect(localStorageState[toStorageKey("Page Proxy")]).toEqual(
      buildStoredState("Page Proxy", "https://docs.example.com/*", 1),
    );
    expect(latestMessage).toBeNull();
  });

  test("creates a new blank script using the active tab domain when the current website glob is stale", async () => {
    const localStorageState = getStorageState("local");
    localStorageState[toStorageKey("Page Proxy")] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);

    const state = {
      activeTabId: 1,
      activeTabUrl: "https://docs.example.com/reference/api",
      activeWebsiteGlob: "*://*/*",
      activeScriptName: "Page Proxy",
      defaultScriptName: "Page Proxy",
      availableScriptOptions: [{ scriptName: "Page Proxy", websiteGlob: "https://docs.example.com/*" }],
      isProtectedPage: false,
      canPersistEditorChanges: true,
      hasUnsavedChanges: false,
      isProgrammaticUpdate: false,
      editorValue: buildScriptContent("Page Proxy", "*://*/*"),
    };

    let latestEditorContent = "";
    let latestMessage: string | null = null;

    const deps = {
      state,
      setActiveToolId: () => undefined,
      setAllowedGrants: () => undefined,
      setElementEntries: () => undefined,
      setRecordPanelActiveTab: () => undefined,
      updateEditorContent: (content: string) => {
        latestEditorContent = content;
      },
      setEditorMessage: (message: string | null) => {
        latestMessage = message;
      },
      setEditorMessageFromUnknown: () => undefined,
      scriptFormatConfig,
      autosave: {
        queuePendingTabRefresh: () => false,
      },
    };

    await createNewScriptForCurrentTabInLoader(deps);

    expect(state.activeScriptName).toBe("Page Proxy 2");
    expect(state.activeWebsiteGlob).toBe("https://docs.example.com/*");
    expect(latestEditorContent).toContain("// @title Page Proxy 2");
    expect(latestEditorContent).toContain("// @website https://docs.example.com/*");
    expect(latestMessage).toBeNull();
  });

  test("restores another stored script that still matches active tab when deleting current script", async () => {
    const localStorageState = getStorageState("local");
    localStorageState[toStorageKey("Docs Script")] = buildStoredState("Docs Script", "https://docs.example.com/*", 1);
    localStorageState[toStorageKey("Reference Script")] = buildStoredState(
      "Reference Script",
      "https://docs.example.com/reference/*",
      2,
    );
    await writeSelectedScriptForHostname("docs.example.com", "Docs Script");

    const tabState = {
      activeTabId: 1,
      activeTabUrl: "https://docs.example.com/reference/api",
      activeWebsiteGlob: "https://docs.example.com/*",
      activeScriptName: "Docs Script",
      defaultScriptName: "Reference Script",
      availableScriptOptions: [
        { scriptName: "Reference Script", websiteGlob: "https://docs.example.com/reference/*" },
        { scriptName: "Docs Script", websiteGlob: "https://docs.example.com/*" },
      ],
      isProtectedPage: false,
      canPersistEditorChanges: true,
      hasUnsavedChanges: false,
      isProgrammaticUpdate: false,
      editorValue: buildScriptContent("Docs Script", "https://docs.example.com/*"),
    };

    let latestEditorContent = "";
    let latestMessage: string | null = "existing";
    let activeToolId = "record";
    let allowedGrants: unknown[] = ["pn"];
    let elementEntries: unknown[] = ["stale"];

    await resetScriptToDefault({
      tabState,
      allowedGrants: [],
      activeTool: "none",
      scriptMetadata: {
        title: "Docs Script",
        website: "https://docs.example.com/*",
      },
      scriptFormatConfig,
      setHasUnsavedChanges: () => undefined,
      autosaveOnSaveSuccess: () => false,
      refreshActiveTab: () => undefined,
      getEditorMessage: () => null,
      setEditorMessage: (message: string | null) => {
        latestMessage = message;
      },
      updateEditorContent: (content: string) => {
        latestEditorContent = content;
      },
      reloadStateForUrl: async (url: string) => {
        await loadStateForUrl(url, {
          state: tabState,
          setActiveToolId: (tool: string) => {
            activeToolId = tool;
          },
          setAllowedGrants: (grants: unknown[]) => {
            allowedGrants = grants;
          },
          setElementEntries: (entries: unknown[]) => {
            elementEntries = entries;
          },
          setRecordPanelActiveTab: () => undefined,
          updateEditorContent: (content: string) => {
            latestEditorContent = content;
          },
          setEditorMessage: (message: string | null) => {
            latestMessage = message;
          },
          setEditorMessageFromUnknown: () => undefined,
          scriptFormatConfig,
          autosave: {
            queuePendingTabRefresh: () => false,
          },
        });
      },
    });

    expect("pp:Docs Script" in localStorageState).toBe(false);
    expect(tabState.activeScriptName).toBe("Reference Script");
    expect(tabState.defaultScriptName).toBe("Reference Script");
    expect(tabState.activeWebsiteGlob).toBe("https://docs.example.com/reference/*");
    expect(tabState.availableScriptOptions).toEqual([
      { scriptName: "Reference Script", websiteGlob: "https://docs.example.com/reference/*" },
    ]);
    expect(latestEditorContent).toContain("// @title Reference Script");
    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();
    expect(latestMessage).toBeNull();
    expect(activeToolId).toBe("none");
    expect(allowedGrants).toEqual([]);
    expect(elementEntries).toEqual(["stale"]);
  });
});
