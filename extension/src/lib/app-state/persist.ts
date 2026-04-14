import { debounce } from "perfect-debounce";
import { browser } from "wxt/browser";
import { snapshot } from "svelte/internal/client";
import log from "../logger";
import { appState } from "./state.svelte";
import {
  RecordPanelMapSchema,
  ScriptStorageMapSchema,
  SessionSelectedScriptMapSchema,
  SidepanelLocalOptionsSchema,
} from "./schema";
import { createLocalStorageAdapter } from "./storage/local-adapter";
import { createSessionStorageAdapter } from "./storage/session-adapter";

const logger = log.getLogger("app-state-persist");

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

const snapshotState = snapshot as <T>(value: T) => T;
const clone = <T>(value: T): T => snapshotState(value);

let previousSettings = clone(appState.settings);
let previousSidepanel = clone(appState.sidepanel);
let previousScriptsByName = clone(appState.scriptsByName);
let previousRecordPanels = clone(appState.recordPanelsByTabId);
let previousSelectedScripts = clone(appState.session.selectedScriptByHostname);
let previousOpenTabs = clone(appState.session.openTabsByTabId);

const persistNow = async () => {
  try {
    const settingsPayload: Record<string, unknown> = {};
    if (appState.settings.showHelpButton !== previousSettings.showHelpButton) {
      settingsPayload["pageproxy:show-help-button"] = appState.settings.showHelpButton;
    }
    if (appState.settings.disableAllGrants !== previousSettings.disableAllGrants) {
      settingsPayload["pageproxy:disable-all-grants"] = appState.settings.disableAllGrants;
    }
    if (Object.keys(settingsPayload).length > 0) {
      await browser.storage.local.set(settingsPayload);
    }

    await sidepanelLocalAdapter.persist(
      {
        helpBannerDismissed: appState.sidepanel.helpBannerDismissed,
        toolPanelHeightPx: appState.sidepanel.toolPanelHeightPx,
        userscriptReloadBannerDismissed: appState.sidepanel.userscriptReloadBannerDismissed,
      },
      {
        helpBannerDismissed: previousSidepanel.helpBannerDismissed,
        toolPanelHeightPx: previousSidepanel.toolPanelHeightPx,
        userscriptReloadBannerDismissed: previousSidepanel.userscriptReloadBannerDismissed,
      },
    );
    await scriptStorageAdapter.persist(appState.scriptsByName, previousScriptsByName);
    await recordPanelAdapter.persist(appState.recordPanelsByTabId, previousRecordPanels);
    await selectedScriptAdapter.persist(appState.session.selectedScriptByHostname, previousSelectedScripts);

    if (JSON.stringify(appState.session.openTabsByTabId) !== JSON.stringify(previousOpenTabs)) {
      await browser.storage.session.set({
        "sidepanel:openTabs": appState.session.openTabsByTabId,
      });
    }

    previousSettings = clone(appState.settings);
    previousSidepanel = clone(appState.sidepanel);
    previousScriptsByName = clone(appState.scriptsByName);
    previousRecordPanels = clone(appState.recordPanelsByTabId);
    previousSelectedScripts = clone(appState.session.selectedScriptByHostname);
    previousOpenTabs = clone(appState.session.openTabsByTabId);
    appState.currentTab.lastPersistenceError = null;
  } catch (error) {
    logger.error("persist failed", { error });
    appState.currentTab.lastPersistenceError =
      error instanceof Error ? error.message : "Unable to persist app state.";
    throw error;
  }
};

export const flushAppStatePersistence = debounce(persistNow, 200);
