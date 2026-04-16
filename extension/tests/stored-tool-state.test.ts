import { beforeEach, describe, expect, test } from "bun:test";

import { appState } from "../src/lib/app-state";
import { createDefaultAppState } from "../src/lib/app-state/defaults.ts";
import { replaceAppState } from "../src/lib/app-state/state.svelte.ts";
import type { StoredToolState } from "../src/lib/stored-tool-state";

const { toStorageKey } = await import("../src/entrypoints/sidepanel/tools/state-storage");

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

describe("stored tool state", () => {
  beforeEach(() => {
    replaceAppState(createDefaultAppState());
  });

  test("writes allowed grants as a list and reads them as a list", () => {
    const state = buildStoredState();

    appState.scriptsByName[state.scriptName] = state;

    const loaded = appState.scriptsByName["Page Proxy"] ?? null;
    expect(loaded?.permissions.allowedGrants).toEqual(["run-on-page-load"]);
    expect(toStorageKey("Page Proxy")).toBe("pageproxy:Page Proxy");
  });
});
