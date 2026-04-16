import { beforeEach, describe, expect, test } from "bun:test";

import { appState } from "../src/lib/app-state";
import { createDefaultAppState } from "../src/lib/app-state/defaults.ts";
import { replaceAppState } from "../src/lib/app-state/state.svelte.ts";
import { appStateSelectors } from "../src/lib/app-state/selectors.ts";
import type { StoredToolState } from "../src/lib/stored-tool-state";

const { normalizeContentForStorage, resolveStoredToolStateForUrl } = await import(
  "../src/entrypoints/sidepanel/tools/state-loading"
);
const { toStorageKey } = await import("../src/lib/stored-tool-state");
const {
  buildSelectedScriptStorageKey,
  clearSelectedScriptForHostname,
  readSelectedScriptForHostname,
  writeSelectedScriptForHostname,
} = await import("../src/entrypoints/sidepanel/tools/script-selection-session");

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

describe("script selection session", () => {
  beforeEach(() => {
    replaceAppState(createDefaultAppState());
  });

  test("stores the selected script name under a hostname-scoped session key", async () => {
    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();

    await writeSelectedScriptForHostname("docs.example.com", "Page Proxy 2");

    expect(appStateSelectors.getSelectedScriptForHostname("docs.example.com")).toBe("Page Proxy 2");
    expect(buildSelectedScriptStorageKey("docs.example.com")).toBe("sidepanel:docs.example.com");

    await clearSelectedScriptForHostname("docs.example.com");

    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();
  });

  test("resolves the selected script from the hostname override when multiple scripts match", async () => {
    appState.scriptsByName["Page Proxy"] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);
    appState.scriptsByName["Page Proxy 2"] = buildStoredState("Page Proxy 2", "https://docs.example.com/reference/*", 2);
    await writeSelectedScriptForHostname("docs.example.com", "Page Proxy");

    const result = await resolveStoredToolStateForUrl("https://docs.example.com/reference/api", scriptFormatConfig);

    expect(result.defaultMatch.scriptName).toBe("Page Proxy 2");
    expect(result.selectedMatch.scriptName).toBe("Page Proxy");
    expect(result.matches.map((entry) => entry.scriptName)).toEqual(["Page Proxy 2", "Page Proxy"]);
    expect(result.scriptName).toBe("Page Proxy");
    expect(result.websiteGlob).toBe("https://docs.example.com/*");
    expect(toStorageKey("Page Proxy")).toBe("pageproxy:Page Proxy");
  });

  test("clears stale hostname overrides when the stored selection is no longer needed", async () => {
    appState.scriptsByName["Page Proxy"] = buildStoredState("Page Proxy", "https://docs.example.com/*", 1);
    await writeSelectedScriptForHostname("docs.example.com", "Missing Script");

    const result = await resolveStoredToolStateForUrl("https://docs.example.com/page", scriptFormatConfig);

    expect(result.defaultMatch.scriptName).toBe("Page Proxy");
    expect(result.selectedMatch.scriptName).toBe("Page Proxy");
    expect(await readSelectedScriptForHostname("docs.example.com")).toBeNull();
  });
});
