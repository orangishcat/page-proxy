import { beforeEach, describe, expect, test } from "bun:test";

import { createDefaultAppState } from "../src/lib/app-state/defaults.ts";
import { appState, replaceAppState } from "../src/lib/app-state/state.svelte.ts";
import { appStateSelectors } from "../src/lib/app-state/selectors.ts";
import type { StoredToolState } from "../src/lib/stored-tool-state";

const {
  resolveStoredToolStateForUrl,
  normalizeContentForStorage,
} = await import("../src/entrypoints/sidepanel/tools/state-loading");
const { saveState } = await import("../src/entrypoints/sidepanel/tools/code-editor/save");

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
  codeEditor: {
    content: normalizeContentForStorage(buildScriptContent(scriptName, websiteGlob), false, scriptFormatConfig),
  },
  selectorPanel: {
    entries: [],
  },
  permissions: {
    allowedGrants: [],
    enabled: true,
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
    replaceAppState(createDefaultAppState());
  });

  test("generates the next blank Page Proxy title when matching names already exist", async () => {
    appState.scriptsByName["Page Proxy"] = buildStoredState("Page Proxy", "https://other.example.com/*", 1);
    appState.scriptsByName["Page Proxy 2"] = buildStoredState("Page Proxy 2", "https://another.example.com/*", 2);

    const result = await resolveStoredToolStateForUrl("https://example.com/page", scriptFormatConfig);

    expect(result.scriptName).toBe("Page Proxy 3");
    expect(result.state.scriptName).toBe("Page Proxy 3");
    expect(result.state.codeEditor.content).toContain("// @title Page Proxy 3");
  });

  test("blocks saving when the target script name already belongs to another stored script", () => {
    appState.scriptsByName["Original Script"] = buildStoredState("Original Script", "https://example.com/*", 1);
    appState.scriptsByName["Conflicting Script"] = buildStoredState("Conflicting Script", "https://example.com/*", 2);

    const nextContent = normalizeContentForStorage(
      buildScriptContent("Conflicting Script", "https://example.com/*"),
      false,
      scriptFormatConfig,
    );

    expect(() =>
      saveState({
      content: nextContent,
      selectorEntries: [],
      allowedGrants: [],
      isProtectedPage: false,
      scriptFormatConfig,
      activeTabUrl: "https://example.com/page",
      activeWebsiteGlob: "https://example.com/*",
      activeScriptName: "Original Script",
      getDefinitionBlock: (content) => content,
      setActiveWebsiteGlob: () => {
        throw new Error("saveState should not update the active website on conflict.");
      },
      setActiveScriptName: () => {
        throw new Error("saveState should not update the active script name on conflict.");
      },
      }),
    ).toThrow('A script named "Conflicting Script" already exists.');

    expect(appStateSelectors.getStoredToolState("Original Script")).toEqual(
      buildStoredState("Original Script", "https://example.com/*", 1),
    );
    expect(appStateSelectors.getStoredToolState("Conflicting Script")).toEqual(
      buildStoredState("Conflicting Script", "https://example.com/*", 2),
    );
  });

  test("preserves runtime storage when saving a renamed script", () => {
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
    appState.scriptsByName[existingState.scriptName] = existingState;

    const renamedContent = normalizeContentForStorage(
      `${buildScriptContent("Renamed Script", "https://example.com/*").trimEnd()}\npt.setItem("token", "secret");\n`,
      false,
      scriptFormatConfig,
    );

    saveState({
      content: renamedContent,
      selectorEntries: [],
      allowedGrants: [],
      isProtectedPage: false,
      scriptFormatConfig,
      activeTabUrl: "https://example.com/page",
      activeWebsiteGlob: "https://example.com/*",
      activeScriptName: "Original Script",
      getDefinitionBlock: (content) => content,
      setActiveWebsiteGlob: () => undefined,
      setActiveScriptName: () => undefined,
    });

    expect(appStateSelectors.getStoredToolState("Original Script")).toBeNull();
    expect(appStateSelectors.getStoredToolState("Renamed Script")).toMatchObject({
      runtimeStorage: existingState.runtimeStorage,
    });
  });

  test("does not persist a global disableAllGrants flag into script state", () => {
    const content = normalizeContentForStorage(
      `${buildScriptContent("Grantless Script", "https://example.com/*").trimEnd()}\npt.setItem("mode", "grantless");\n`,
      false,
      scriptFormatConfig,
    );

    saveState({
      content,
      selectorEntries: [],
      allowedGrants: [],
      isProtectedPage: false,
      scriptFormatConfig,
      activeTabUrl: "https://example.com/page",
      activeWebsiteGlob: "https://example.com/*",
      activeScriptName: null,
      getDefinitionBlock: (value) => value,
      setActiveWebsiteGlob: () => undefined,
      setActiveScriptName: () => undefined,
    });

    expect(appStateSelectors.getStoredToolState("Grantless Script")?.permissions.allowedGrants).toEqual([]);
  });

  test("preserves per-script enabled state when saving an existing disabled script", () => {
    appState.scriptsByName["Disabled Script"] = {
      ...buildStoredState("Disabled Script", "https://example.com/*", 1),
      permissions: {
        allowedGrants: [],
        enabled: false,
      },
    };
    const content = normalizeContentForStorage(
      `${buildScriptContent("Disabled Script", "https://example.com/*").trimEnd()}\nconsole.log("still disabled");\n`,
      false,
      scriptFormatConfig,
    );

    saveState({
      content,
      selectorEntries: [],
      allowedGrants: [],
      isProtectedPage: false,
      scriptFormatConfig,
      activeTabUrl: "https://example.com/page",
      activeWebsiteGlob: "https://example.com/*",
      activeScriptName: "Disabled Script",
      getDefinitionBlock: (value) => value,
      setActiveWebsiteGlob: () => undefined,
      setActiveScriptName: () => undefined,
    });

    expect(appStateSelectors.getStoredToolState("Disabled Script")?.permissions.allowedGrants).toEqual([]);
    expect(appStateSelectors.getStoredToolState("Disabled Script")?.permissions.enabled).toBe(false);
  });
});
