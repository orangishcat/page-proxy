import { browser } from "wxt/browser";
import { appState } from "./state.svelte";
import {
  RecordPanelMapSchema,
  ScriptStorageMapSchema,
  SessionSelectedScriptMapSchema,
  SidepanelLocalOptionsSchema,
} from "./schema";
import { createLocalStorageAdapter } from "./storage/local-adapter";
import { createSessionStorageAdapter } from "./storage/session-adapter";
import {
  AppStatePersistHandler,
  defineAppStatePersistEntry,
  type AppStatePersistEntry,
} from "./persist-handler";
import type { AppStateSettings, AppStateSession, AppStateSidepanel } from "./types";
import type { RecordPanelState } from "../../entrypoints/sidepanel/tools/storage/record-panel";
import type { StoredToolState } from "../stored-tool-state";

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

export const appStatePersistRegistry: readonly AppStatePersistEntry[] = [
  defineAppStatePersistEntry({
    name: "settings",
    read: () => appState.settings,
    persist: async (current: AppStateSettings, previous: AppStateSettings) => {
      const payload: Record<string, unknown> = {};
      if (current.showHelpButton !== previous.showHelpButton) {
        payload["pageproxy:show-help-button"] = current.showHelpButton;
      }
      if (current.disableAllGrants !== previous.disableAllGrants) {
        payload["pageproxy:disable-all-grants"] = current.disableAllGrants;
      }
      if (Object.keys(payload).length > 0) {
        await browser.storage.local.set(payload);
      }
    },
  }),
  defineAppStatePersistEntry({
    name: "sidepanel",
    read: () => appState.sidepanel,
    persist: async (current: AppStateSidepanel, previous: AppStateSidepanel) => {
      await sidepanelLocalAdapter.persist(current, previous);
    },
  }),
  defineAppStatePersistEntry({
    name: "scriptsByName",
    read: () => appState.scriptsByName,
    persist: async (current: Record<string, StoredToolState>, previous: Record<string, StoredToolState>) => {
      await scriptStorageAdapter.persist(current, previous);
    },
  }),
  defineAppStatePersistEntry({
    name: "recordPanelsByTabId",
    read: () => appState.recordPanelsByTabId,
    persist: async (current: Record<string, RecordPanelState>, previous: Record<string, RecordPanelState>) => {
      await recordPanelAdapter.persist(current, previous);
    },
  }),
  defineAppStatePersistEntry({
    name: "selectedScriptByHostname",
    read: () => appState.session.selectedScriptByHostname,
    persist: async (current: AppStateSession["selectedScriptByHostname"], previous: AppStateSession["selectedScriptByHostname"]) => {
      await selectedScriptAdapter.persist(current, previous);
    },
  }),
  defineAppStatePersistEntry({
    name: "openTabsByTabId",
    read: () => appState.session.openTabsByTabId,
    persist: async (current: AppStateSession["openTabsByTabId"]) => {
      await browser.storage.session.set({
        "sidepanel:openTabs": current,
      });
    },
  }),
];

export const appStatePersistHandler = new AppStatePersistHandler(appStatePersistRegistry);
