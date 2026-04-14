import { debounce } from "perfect-debounce";
import log from "../../../logger";
import { appState } from "../../state.svelte";
import { browser } from "wxt/browser";
import {
  RecordPanelMapSchema,
  ScriptStorageMapSchema,
  SessionSelectedScriptMapSchema,
  SidepanelLocalOptionsSchema,
} from "../../schema";
import { createLocalStorageAdapter } from "../local-adapter";
import { createSessionStorageAdapter } from "../session-adapter";
import { AppStatePersistHandler, type AppStatePersistEntry } from "./persist-handler";
import type { AppStateSettings, AppStateSession, AppStateSidepanel } from "../../types";
import type { RecordPanelState } from "../../../../entrypoints/sidepanel/tools/storage/record-panel";
import { normalizeStoredToolState, type StoredToolState } from "../../../stored-tool-state";

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

const appStatePersistHandler = new AppStatePersistHandler([
  {
    name: "settings",
    read() {
      return appState.settings;
    },
    async persist(current: AppStateSettings, previous: AppStateSettings) {
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
  },
  {
    name: "sidepanel",
    read() {
      return appState.sidepanel;
    },
    async persist(current: AppStateSidepanel, previous: AppStateSidepanel) {
      await sidepanelLocalAdapter.persist(current, previous);
    },
  },
  {
    name: "scriptsByName",
    read() {
      return appState.scriptsByName;
    },
    async persist(current: Record<string, StoredToolState>, previous: Record<string, StoredToolState>) {
      const normalizeScriptMap = (value: Record<string, StoredToolState>) =>
        Object.fromEntries(Object.entries(value).map(([key, state]) => [key, normalizeStoredToolState(state)]));

      await scriptStorageAdapter.persist(normalizeScriptMap(current), normalizeScriptMap(previous));
    },
  },
  {
    name: "recordPanelsByTabId",
    read() {
      return appState.recordPanelsByTabId;
    },
    async persist(current: Record<string, RecordPanelState>, previous: Record<string, RecordPanelState>) {
      await recordPanelAdapter.persist(current, previous);
    },
  },
  {
    name: "selectedScriptByHostname",
    read() {
      return appState.session.selectedScriptByHostname;
    },
    async persist(
      current: AppStateSession["selectedScriptByHostname"],
      previous: AppStateSession["selectedScriptByHostname"],
    ) {
      await selectedScriptAdapter.persist(current, previous);
    },
  },
  {
    name: "openTabsByTabId",
    read() {
      return appState.session.openTabsByTabId;
    },
    async persist(current: AppStateSession["openTabsByTabId"]) {
      await browser.storage.session.set({
        "sidepanel:openTabs": current,
      });
    },
  },
] satisfies readonly AppStatePersistEntry[]);

const persistNow = async () => {
  try {
    await appStatePersistHandler.checkPersist();
    appState.currentTab.lastPersistenceError = null;
  } catch (error) {
    logger.error("persist failed", { error });
    appState.currentTab.lastPersistenceError = error instanceof Error ? error.message : "Unable to persist app state.";
    throw error;
  }
};

export const flushAppStatePersistence = debounce(persistNow, 1000);
