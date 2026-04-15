import { beforeEach, describe, expect, test } from "bun:test";

import { createDefaultAppState } from "../src/lib/app-state/defaults.ts";
import { replaceAppState } from "../src/lib/app-state/state.svelte.ts";
import { appStateSelectors } from "../src/lib/app-state/selectors.ts";
import type { StoredToolState } from "../src/entrypoints/sidepanel/tools/state-storage";

const {
  resolveStoredToolStateForUrl,
  normalizeContentForStorage,
} = await import("../src/entrypoints/sidepanel/tools/state-loading");
const { saveState } = await import("../src/entrypoints/sidepanel/tools/code-editor/save");
const { saveStoredToolState } = await import("../src/entrypoints/sidepanel/tools/state-storage");

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
    await saveStoredToolState(buildStoredState("Page Proxy", "https://other.example.com/*", 1));
    await saveStoredToolState(buildStoredState("Page Proxy 2", "https://another.example.com/*", 2));

    const result = await resolveStoredToolStateForUrl("https://example.com/page", scriptFormatConfig);

    expect(result.scriptName).toBe("Page Proxy 3");
    expect(result.state.scriptName).toBe("Page Proxy 3");
    expect(result.state.codeEditor.content).toContain("// @title Page Proxy 3");
  });

  test("blocks saving when the target script name already belongs to another stored script", async () => {
    await saveStoredToolState(buildStoredState("Original Script", "https://example.com/*", 1));
    await saveStoredToolState(buildStoredState("Conflicting Script", "https://example.com/*", 2));

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

    expect(appStateSelectors.getStoredToolState("Original Script")).toEqual(
      buildStoredState("Original Script", "https://example.com/*", 1),
    );
    expect(appStateSelectors.getStoredToolState("Conflicting Script")).toEqual(
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
    await saveStoredToolState(existingState);

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

    expect(appStateSelectors.getStoredToolState("Original Script")).toBeNull();
    expect(appStateSelectors.getStoredToolState("Renamed Script")).toMatchObject({
      runtimeStorage: existingState.runtimeStorage,
    });
  });

  test("does not persist a global disableAllGrants flag into script state", async () => {
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

    expect(appStateSelectors.getStoredToolState("Grantless Script")?.permissions.allowedGrants).toEqual([]);
  });

  test("preserves per-script enabled state when saving an existing disabled script", async () => {
    await saveStoredToolState({
      ...buildStoredState("Disabled Script", "https://example.com/*", 1),
      permissions: {
        allowedGrants: [],
        enabled: false,
      },
    });
    const content = normalizeContentForStorage(
      `${buildScriptContent("Disabled Script", "https://example.com/*").trimEnd()}\nconsole.log("still disabled");\n`,
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
      activeScriptName: "Disabled Script",
      activeTool: "none",
      getDefinitionBlock: (value) => value,
      setActiveWebsiteGlob: () => undefined,
      setActiveScriptName: () => undefined,
    });

    expect(appStateSelectors.getStoredToolState("Disabled Script")?.permissions.allowedGrants).toEqual([]);
    expect(appStateSelectors.getStoredToolState("Disabled Script")?.permissions.enabled).toBe(false);
  });
});
