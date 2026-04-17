import type { AppState } from "./types";

export const createDefaultAppState = (): AppState => ({
  settings: {
    showHelpButton: true,
    disableAllGrants: false,
  },
  sidepanel: {
    activeTool: "none",
    helpBannerDismissed: false,
    unsupportedBrowserBannerDismissed: false,
    firefoxExperimentalBannerDismissed: false,
    userscriptEnableBannerDismissed: false,
    toolPanelHeightPx: undefined,
    userscriptReloadBannerDismissed: false,
  },
  scriptsByName: {},
  recordPanelsByTabId: {},
  session: {
    openTabsByTabId: {},
    selectedScriptByHostname: {},
  },
  currentTab: {
    activeTabId: null,
    activeTabUrl: null,
    activeWebsiteGlob: null,
    activeScriptName: null,
    defaultScriptName: null,
    availableScriptOptions: [],
    isProtectedPage: false,
    canPersistEditorChanges: true,
    hasUnsavedChanges: false,
    isProgrammaticUpdate: false,
    lastHydrationError: null,
    lastPersistenceError: null,
    elementEntries: [],
    scriptMetadata: {
      title: "Page Proxy",
      website: "",
      description: "",
      author: "",
      credits: "",
    },
    editorApi: null,
  },
});
