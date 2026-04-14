import type { RecordPanelState } from "../../entrypoints/sidepanel/tools/storage/record-panel";
import type { StoredToolState } from "../stored-tool-state";

export type ScriptSelectionOption = {
  scriptName: string;
  websiteGlob: string;
};

export type AppStateSettings = {
  showHelpButton: boolean;
  disableAllGrants: boolean;
};

export type AppStateSidepanel = {
  helpBannerDismissed: boolean;
  toolPanelHeightPx: number | undefined;
  userscriptReloadBannerDismissed: boolean;
};

export type AppStateSession = {
  openTabsByTabId: Record<string, boolean>;
  selectedScriptByHostname: Record<string, string>;
};

export type AppStateCurrentTab = {
  activeTabId: number | null;
  activeTabUrl: string | null;
  activeWebsiteGlob: string | null;
  activeScriptName: string | null;
  defaultScriptName: string | null;
  availableScriptOptions: ScriptSelectionOption[];
  isProtectedPage: boolean;
  canPersistEditorChanges: boolean;
  hasUnsavedChanges: boolean;
  isProgrammaticUpdate: boolean;
  lastHydrationError: string | null;
  lastPersistenceError: string | null;
};

export type AppState = {
  settings: AppStateSettings;
  sidepanel: AppStateSidepanel;
  scriptsByName: Record<string, StoredToolState>;
  recordPanelsByTabId: Record<string, RecordPanelState>;
  session: AppStateSession;
  currentTab: AppStateCurrentTab;
};
