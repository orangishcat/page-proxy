import { beforeEach, describe, expect, test } from "bun:test";

import { createDefaultAppState } from "../../src/lib/app-state/defaults";
import { appState, replaceAppState } from "../../src/lib/app-state/state.svelte.ts";
import type { StoredToolState } from "../../src/lib/stored-tool-state";

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
    allowedGrants: [],
    enabled: true,
  },
  websiteGlob: "https://example.com/*",
  updatedAt: 1,
  runtimeStorage: {
    pt: {},
    pn: {},
  },
});

describe("active tool state", () => {
  beforeEach(() => {
    replaceAppState(createDefaultAppState());
  });

  test("tracks the current tab tool when no active script is selected", async () => {
    const { appStateActions } = await import("../../src/lib/app-state/actions.ts");
    const { appStateSelectors } = await import("../../src/lib/app-state/selectors.ts");

    appState.currentTab.isProtectedPage = true;
    appState.currentTab.activeScriptName = null;

    appStateActions.setActiveTool("selectors");

    expect(appState.currentTab.activeTool).toBe("selectors");
    expect(appStateSelectors.getActiveTool()).toBe("selectors");
  });

  test("keeps the stored script and current tab tool in sync when a script is active", async () => {
    const { appStateActions } = await import("../../src/lib/app-state/actions.ts");
    const { appStateSelectors } = await import("../../src/lib/app-state/selectors.ts");

    appState.scriptsByName["Page Proxy"] = buildStoredState();
    appState.currentTab.activeScriptName = "Page Proxy";

    appStateActions.setActiveTool("record");

    expect(appState.currentTab.activeTool).toBe("record");
    expect(appState.scriptsByName["Page Proxy"]?.activeTool).toBe("record");
    expect(appStateSelectors.getActiveTool()).toBe("record");
  });
});
