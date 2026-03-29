import { buildAutoNumberedScriptName, defaultBlankScriptTitle } from "@/lib/script-names";
import { browser } from "wxt/browser";
import { buildWebsiteGlobForUrl, isRestrictedUrl } from "@/lib/utils/website-glob";
import {
  buildDefaultScript,
  buildProtectedDisplay,
  ensureDefineBlock,
  ensureWebsiteMetadata,
  resolveStoredToolStateForUrl,
  type ResolvedScriptMatch,
  type ScriptFormatConfig,
} from "../state-loading";
import { listStoredScriptNames, resolveBlankScriptName } from "../state-storage";
import { clearSelectedScriptForHostname, writeSelectedScriptForHostname } from "../script-selection-session";
import { getTabUrl, resolveActiveTab, shouldHandleTabUpdate, type ActiveTab } from "./tabs";
import { coerceToolPanelTool } from "@/lib/sidepanel-shortcuts";
import type { AutosaveManager } from "./autosave";
import type { ScriptSelectionOption } from "./state";

const getHostnameFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
};

const toScriptSelectionOption = (match: ResolvedScriptMatch): ScriptSelectionOption => ({
  scriptName: match.scriptName,
  websiteGlob: match.websiteGlob,
});

const resolveNewScriptName = async (state: TabLoaderState) => {
  const storedScriptNames = await listStoredScriptNames();
  const inMemoryScriptNames = [
    state.activeScriptName,
    ...state.availableScriptOptions.map((option) => option.scriptName),
  ]
    .map((scriptName) => scriptName?.trim() ?? "")
    .filter((scriptName) => scriptName.length > 0);

  return buildAutoNumberedScriptName(defaultBlankScriptTitle, [...storedScriptNames, ...inMemoryScriptNames]);
};

export type TabLoaderState = {
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
  editorValue: string;
};

export type TabLoaderDeps = {
  state: TabLoaderState;
  setActiveToolId: (tool: string) => void;
  setAllowedGrants: (grants: unknown[]) => void;
  setElementEntries: (entries: unknown[]) => void;
  setRecordPanelActiveTab: (tabId: number | null) => void;
  updateEditorContent: (content: string, opts?: { persist?: boolean }) => void;
  setEditorMessage: (msg: string | null, status: "success" | "error") => void;
  setEditorMessageFromUnknown: (err: unknown, fallback: string) => void;
  scriptFormatConfig: ScriptFormatConfig;
  autosave: Pick<AutosaveManager, "queuePendingTabRefresh">;
};

export const loadStateForUrl = async (url: string | null, deps: TabLoaderDeps): Promise<void> => {
  const { state, scriptFormatConfig } = deps;
  const normalizedUrl = url?.trim() ?? "";

  if (!normalizedUrl) {
    const blankScriptName = await resolveBlankScriptName(defaultBlankScriptTitle);
    state.activeScriptName = blankScriptName;
    state.defaultScriptName = null;
    state.activeWebsiteGlob = null;
    state.availableScriptOptions = [];
    deps.setActiveToolId("none");
    deps.setAllowedGrants([]);
    const baseContent = buildDefaultScript("", scriptFormatConfig, blankScriptName);
    const displayContent = state.isProtectedPage
      ? buildProtectedDisplay(baseContent, scriptFormatConfig)
      : baseContent;
    deps.updateEditorContent(displayContent, { persist: false });
    return;
  }

  const resolvedState = await resolveStoredToolStateForUrl(normalizedUrl, scriptFormatConfig);
  state.activeScriptName = resolvedState.scriptName;
  state.defaultScriptName = resolvedState.defaultMatch.scriptName;
  state.activeWebsiteGlob = resolvedState.websiteGlob;
  state.availableScriptOptions = resolvedState.matches.map(toScriptSelectionOption);
  deps.setActiveToolId(coerceToolPanelTool(resolvedState.state.activeTool));
  deps.setAllowedGrants(resolvedState.state.permissions.allowedGrants);
  const normalizedBaseContent = ensureDefineBlock(resolvedState.state.codeEditor.content, scriptFormatConfig);
  const contentWithWebsite = ensureWebsiteMetadata(normalizedBaseContent, resolvedState.websiteGlob);
  const displayContent = state.isProtectedPage
    ? buildProtectedDisplay(contentWithWebsite, scriptFormatConfig)
    : contentWithWebsite;
  deps.updateEditorContent(displayContent, { persist: false });
};

export const applyActiveTab = async (tab: ActiveTab | null, deps: TabLoaderDeps): Promise<void> => {
  const { state, scriptFormatConfig } = deps;

  state.canPersistEditorChanges = false;
  const nextTabId = tab?.id ?? null;
  const nextTabUrl = getTabUrl(tab);

  state.activeTabId = nextTabId;
  state.activeTabUrl = nextTabUrl;
  deps.setRecordPanelActiveTab(nextTabId);
  state.isProtectedPage = isRestrictedUrl(state.activeTabUrl ?? undefined);

  if (state.isProtectedPage) {
    deps.setElementEntries([]);
    deps.setAllowedGrants([]);
    state.activeWebsiteGlob = null;
    state.activeScriptName = null;
    state.defaultScriptName = null;
    state.availableScriptOptions = [];
    deps.setActiveToolId("none");
    const protectedContent = buildProtectedDisplay(buildDefaultScript("", scriptFormatConfig), scriptFormatConfig);
    deps.updateEditorContent(protectedContent, { persist: false });
    state.canPersistEditorChanges = true;
    return;
  }

  if (!state.activeTabUrl) {
    deps.setEditorMessage("No active tab found.", "error");
    await loadStateForUrl(null, deps).finally(() => {
      state.canPersistEditorChanges = true;
    });
    return;
  }

  await loadStateForUrl(state.activeTabUrl, deps)
    .catch((error) => {
      deps.setEditorMessageFromUnknown(error, "Unable to load saved script state.");
    })
    .finally(() => {
      state.canPersistEditorChanges = true;
    });
};

export const refreshActiveTab = (deps: TabLoaderDeps): void => {
  const { state } = deps;

  void resolveActiveTab()
    .then((tab) => {
      return applyActiveTab(tab, deps);
    })
    .catch(() => {
      deps.setEditorMessage("Unable to read the active tab.", "error");
      void loadStateForUrl(null, deps).finally(() => {
        state.canPersistEditorChanges = true;
      });
    });
};

export const selectScriptForCurrentTab = async (scriptName: string, deps: TabLoaderDeps): Promise<void> => {
  const { state } = deps;
  const normalizedScriptName = scriptName.trim();
  if (!normalizedScriptName || !state.activeTabUrl || state.isProtectedPage || !state.canPersistEditorChanges) {
    return;
  }

  if (state.activeScriptName?.trim() === normalizedScriptName) {
    return;
  }

  if (deps.autosave.queuePendingTabRefresh(state.editorValue, state.hasUnsavedChanges, state.isProgrammaticUpdate)) {
    return;
  }

  const hostname = getHostnameFromUrl(state.activeTabUrl);
  if (!hostname) {
    return;
  }

  if (state.defaultScriptName === normalizedScriptName) {
    await clearSelectedScriptForHostname(hostname);
  } else {
    await writeSelectedScriptForHostname(hostname, normalizedScriptName);
  }

  await loadStateForUrl(state.activeTabUrl, deps);
};

export const createNewScriptForCurrentTab = async (deps: TabLoaderDeps): Promise<void> => {
  const { state, scriptFormatConfig } = deps;
  if (!state.activeTabUrl || state.isProtectedPage || !state.canPersistEditorChanges) {
    return;
  }

  if (deps.autosave.queuePendingTabRefresh(state.editorValue, state.hasUnsavedChanges, state.isProgrammaticUpdate)) {
    return;
  }

  const nextScriptName = await resolveNewScriptName(state);
  const websiteGlob = state.activeWebsiteGlob?.trim() || buildWebsiteGlobForUrl(state.activeTabUrl);
  const baseContent = buildDefaultScript(websiteGlob, scriptFormatConfig, nextScriptName);
  const nextContent = ensureWebsiteMetadata(ensureDefineBlock(baseContent, scriptFormatConfig), websiteGlob);

  state.activeScriptName = nextScriptName;
  state.activeWebsiteGlob = websiteGlob || null;
  deps.setActiveToolId("none");
  deps.setAllowedGrants([]);
  deps.setElementEntries([]);
  deps.updateEditorContent(nextContent, { persist: false });
  deps.setEditorMessage(null, "error");
};

export const handleTabActivated = (activeInfo: { tabId: number }, deps: TabLoaderDeps): void => {
  const { state } = deps;

  if (deps.autosave.queuePendingTabRefresh(state.editorValue, state.hasUnsavedChanges, state.isProgrammaticUpdate)) {
    return;
  }

  void browser.tabs
    .get(activeInfo.tabId)
    .then((tab) => {
      return applyActiveTab(tab ?? null, deps);
    })
    .catch(() => {
      deps.setEditorMessage("Unable to read the active tab.", "error");
    });
};

export const handleTabUpdated = (
  tabId: number,
  changeInfo: { url?: string; status?: string },
  tab: ActiveTab,
  deps: TabLoaderDeps,
): void => {
  const { state } = deps;

  if (!shouldHandleTabUpdate(state.activeTabId, tabId, changeInfo)) {
    return;
  }
  if (deps.autosave.queuePendingTabRefresh(state.editorValue, state.hasUnsavedChanges, state.isProgrammaticUpdate)) {
    return;
  }
  void applyActiveTab(tab ?? null, deps);
};
