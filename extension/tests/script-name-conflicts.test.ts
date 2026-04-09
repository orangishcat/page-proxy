import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { StoredToolState } from "../src/entrypoints/sidepanel/tools/state-storage";

type StorageShape = Record<string, unknown>;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyScriptNameStorageState?: StorageShape;
};

const getStorageState = () => {
  if (!storageSlot.__pageProxyScriptNameStorageState) {
    storageSlot.__pageProxyScriptNameStorageState = {};
  }

  return storageSlot.__pageProxyScriptNameStorageState;
};

const cloneStorageState = () => ({ ...getStorageState() });

const storageApi = {
  get: (keys: null | string | string[]) => {
    if (keys === null) {
      return Promise.resolve(cloneStorageState());
    }

    if (typeof keys === "string") {
      const storageState = getStorageState();
      return Promise.resolve(keys in storageState ? { [keys]: storageState[keys] } : {});
    }

    const storageState = getStorageState();
    return Promise.resolve(keys.reduce<StorageShape>((result, key) => {
      if (key in storageState) {
        result[key] = storageState[key];
      }
      return result;
    }, {}));
  },
  set: (items: StorageShape) => {
    const storageState = getStorageState();
    Object.assign(storageState, items);
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

const {
  resolveStoredToolStateForUrl,
  normalizeContentForStorage,
} = await import("../src/entrypoints/sidepanel/tools/state-loading");
const { saveState } = await import("../src/entrypoints/sidepanel/tools/code-editor/save");
const { toStorageKey } = await import("../src/entrypoints/sidepanel/tools/state-storage");

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

describe("script name conflicts", () => {
  beforeEach(() => {
    const storageState = getStorageState();
    Object.keys(storageState).forEach((key) => {
      delete storageState[key];
    });
  });

  test("generates the next blank Page Proxy title when matching names already exist", async () => {
    const storageState = getStorageState();
    storageState[toStorageKey("Page Proxy")] = buildStoredState("Page Proxy", "https://other.example.com/*", 1);
    storageState[toStorageKey("Page Proxy 2")] = buildStoredState("Page Proxy 2", "https://another.example.com/*", 2);

    const result = await resolveStoredToolStateForUrl("https://example.com/page", scriptFormatConfig);

    expect(result.scriptName).toBe("Page Proxy 3");
    expect(result.state.scriptName).toBe("Page Proxy 3");
    expect(result.state.codeEditor.content).toContain("// @title Page Proxy 3");
  });

  test("blocks saving when the target script name already belongs to another stored script", async () => {
    const storageState = getStorageState();
    storageState[toStorageKey("Original Script")] = buildStoredState("Original Script", "https://example.com/*", 1);
    storageState[toStorageKey("Conflicting Script")] = buildStoredState("Conflicting Script", "https://example.com/*", 2);

    const nextContent = normalizeContentForStorage(
      buildScriptContent("Conflicting Script", "https://example.com/*"),
      false,
      scriptFormatConfig,
    );

    await saveState({
      content: nextContent,
      selectorEntries: [],
      allowedGrants: [],
      isProtectedPage: false,
      scriptFormatConfig,
      activeTabUrl: "https://example.com/page",
      activeWebsiteGlob: "https://example.com/*",
      activeScriptName: "Original Script",
      activeTool: "none",
      getDefinitionBlock: (content) => content,
      setActiveWebsiteGlob: () => {
        throw new Error("saveState should not update the active website on conflict.");
      },
      setActiveScriptName: () => {
        throw new Error("saveState should not update the active script name on conflict.");
      },
    }).then(
      () => {
        throw new Error("Expected saveState to reject on a conflicting script name.");
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('A script named "Conflicting Script" already exists.');
      },
    );

    expect(storageState[toStorageKey("Original Script")]).toEqual(
      buildStoredState("Original Script", "https://example.com/*", 1),
    );
    expect(storageState[toStorageKey("Conflicting Script")]).toEqual(
      buildStoredState("Conflicting Script", "https://example.com/*", 2),
    );
  });

  test("preserves runtime storage when saving a renamed script", async () => {
    const existingState = {
      ...buildStoredState("Original Script", "https://example.com/*", 1),
      runtimeStorage: {
        pt: {
          "pp-storage:global:token": "secret",
        },
        pn: {
          "pp-network-cache:global:https://api.example.com/items": '{"cached":true}',
        },
      },
    } satisfies StoredToolState;
    const storageState = getStorageState();
    storageState[toStorageKey("Original Script")] = existingState;

    const renamedContent = normalizeContentForStorage(
      `${buildScriptContent("Renamed Script", "https://example.com/*").trimEnd()}\npt.setItem("token", "secret");\n`,
      false,
      scriptFormatConfig,
    );

    await saveState({
      content: renamedContent,
      selectorEntries: [],
      allowedGrants: [],
      isProtectedPage: false,
      scriptFormatConfig,
      activeTabUrl: "https://example.com/page",
      activeWebsiteGlob: "https://example.com/*",
      activeScriptName: "Original Script",
      activeTool: "none",
      getDefinitionBlock: (content) => content,
      setActiveWebsiteGlob: () => undefined,
      setActiveScriptName: () => undefined,
    });

    expect(storageState[toStorageKey("Original Script")]).toBeUndefined();
    expect(storageState[toStorageKey("Renamed Script")]).toMatchObject({
      runtimeStorage: existingState.runtimeStorage,
    });
  });

  test("does not persist a global disableAllGrants flag into script state", async () => {
    const storageState = getStorageState();
    const content = normalizeContentForStorage(
      `${buildScriptContent("Grantless Script", "https://example.com/*").trimEnd()}\npt.setItem("mode", "grantless");\n`,
      false,
      scriptFormatConfig,
    );

    await saveState({
      content,
      selectorEntries: [],
      allowedGrants: [],
      isProtectedPage: false,
      scriptFormatConfig,
      activeTabUrl: "https://example.com/page",
      activeWebsiteGlob: "https://example.com/*",
      activeScriptName: null,
      activeTool: "none",
      getDefinitionBlock: (value) => value,
      setActiveWebsiteGlob: () => undefined,
      setActiveScriptName: () => undefined,
    });

    expect(storageState[toStorageKey("Grantless Script")]).toMatchObject({
      permissions: {
        allowedGrants: [],
      },
    });
  });
});
