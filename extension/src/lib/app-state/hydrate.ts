import { browser } from "wxt/browser";
import { createDefaultAppState } from "./defaults";
import {
  RecordPanelMapSchema,
  ScriptStorageMapSchema,
  SessionOpenTabsSchema,
  SessionSelectedScriptMapSchema,
  SidepanelLocalOptionsSchema,
} from "./schema";
import { createLocalStorageAdapter } from "./storage/local-adapter";
import { createSessionStorageAdapter } from "./storage/session-adapter";
import type { AppState } from "./types";

const scriptStorageAdapter = createLocalStorageAdapter({
  prefix: "pageproxy:",
  loggerName: "app-state-scripts",
  excludeKeys: new Set(["show-help-button", "disable-all-grants"]),
  schema: ScriptStorageMapSchema,
});

const sidepanelLocalAdapter = createLocalStorageAdapter({
  prefix: "sidepanel:",
  loggerName: "app-state-sidepanel-local",
  excludeKeys: new Set(["recordPanel:"]),
  schema: SidepanelLocalOptionsSchema,
});

const recordPanelAdapter = createLocalStorageAdapter({
  prefix: "sidepanel:recordPanel:",
  loggerName: "app-state-record-panels",
  schema: RecordPanelMapSchema,
});

const selectedScriptAdapter = createSessionStorageAdapter({
  prefix: "sidepanel:",
  loggerName: "app-state-selected-scripts",
  excludeKeys: new Set(["openTabs"]),
  schema: SessionSelectedScriptMapSchema,
});

export const hydrateAppState = async (): Promise<AppState> => {
  const state = createDefaultAppState();

  try {
    const [localValues, sessionValues, scriptsByName, sidepanelOptions, recordPanelsByTabId, selectedScriptByHostname] =
      await Promise.all([
        browser.storage.local.get(null),
        browser.storage.session.get("sidepanel:openTabs"),
        scriptStorageAdapter.load(),
        sidepanelLocalAdapter.load(),
        recordPanelAdapter.load(),
        selectedScriptAdapter.load(),
      ]);

    state.settings.showHelpButton = localValues["pageproxy:show-help-button"] !== false;
    state.settings.disableAllGrants = localValues["pageproxy:disable-all-grants"] === true;
    state.sidepanel = {
      ...state.sidepanel,
      ...sidepanelOptions,
    };
    state.scriptsByName = scriptsByName;
    state.recordPanelsByTabId = recordPanelsByTabId;
    state.session.openTabsByTabId = SessionOpenTabsSchema.safeParse(sessionValues["sidepanel:openTabs"]).success
      ? SessionOpenTabsSchema.parse(sessionValues["sidepanel:openTabs"])
      : {};
    state.session.selectedScriptByHostname = selectedScriptByHostname;
  } catch (error) {
    state.currentTab.lastHydrationError = error instanceof Error ? error.message : "Unable to hydrate app state.";
  }

  return state;
};
