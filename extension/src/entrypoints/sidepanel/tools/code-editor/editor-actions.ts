import { get } from "svelte/store";
import type { ScriptGrantValue } from "@/lib/grants";
import { defaultBlankScriptTitle } from "@/lib/script-names";
import { readHostnameFromUrl } from "@/lib/utils/website-glob";
import type { ToolId } from "../state-storage";
import { saveState } from "./save";
import { selectorEntries } from "./state";
import { removeStoredToolState, resolveBlankScriptName } from "../state-storage";
import { clearSelectedScriptForHostname, writeSelectedScriptForHostname } from "../script-selection-session";
import {
  buildDefaultScript,
  ensureDefineBlock,
  ensureWebsiteMetadata,
  type ScriptFormatConfig,
} from "../state-loading";
import { getDefinitionBlock } from "./definition-manager";
import type { TabLoaderState } from "./tab-loader";

export const unsavedTabSwitchWarning = "Unsaved changes! Please manually save (Ctrl/Cmd+S) to continue.";
export const saveFailurePrefix = "Saving failed:";

type EditorMessage = { text: string; status: string; stackTrace: string | null } | null;

export type EditorActionsDeps = {
  tabState: TabLoaderState;
  allowedGrants: ScriptGrantValue[];
  activeTool: ToolId;
  scriptMetadata: { title: string; website: string };
  scriptFormatConfig: ScriptFormatConfig;
  setHasUnsavedChanges: (v: boolean) => void;
  autosaveOnSaveSuccess: () => boolean;
  refreshActiveTab: () => void;
  reloadStateForUrl: (url: string) => Promise<void>;
  getEditorMessage: () => EditorMessage;
  setEditorMessage: (msg: string | null, status: "success" | "error", stack?: string | null) => void;
  updateEditorContent: (content: string, opts?: { persist?: boolean }) => void;
};

const shouldClearErrorOnSuccessfulSave = (message: EditorMessage): boolean => {
  if (!message || message.status !== "error") return false;
  return message.text === unsavedTabSwitchWarning || message.text.startsWith(saveFailurePrefix);
};

export const saveToolState = async (content: string, deps: EditorActionsDeps): Promise<void> => {
  const previousActiveScriptName = deps.tabState.activeScriptName?.trim() ?? "";
  const previousDefaultScriptName = deps.tabState.defaultScriptName?.trim() ?? "";

  try {
    await saveState({
      content,
      selectorEntries: get(selectorEntries),
      allowedGrants: deps.allowedGrants,
      isProtectedPage: deps.tabState.isProtectedPage,
      scriptFormatConfig: deps.scriptFormatConfig,
      activeTabUrl: deps.tabState.activeTabUrl,
      activeWebsiteGlob: deps.tabState.activeWebsiteGlob,
      activeScriptName: deps.tabState.activeScriptName,
      activeTool: deps.activeTool,
      getDefinitionBlock,
      setActiveWebsiteGlob: (v) => { deps.tabState.activeWebsiteGlob = v; },
      setActiveScriptName: (v) => { deps.tabState.activeScriptName = v; },
    });
    const nextActiveScriptName = deps.tabState.activeScriptName?.trim() ?? "";
    if (previousActiveScriptName && nextActiveScriptName && previousActiveScriptName !== nextActiveScriptName) {
      deps.tabState.availableScriptOptions = deps.tabState.availableScriptOptions.map((option) =>
        option.scriptName === previousActiveScriptName
          ? { ...option, scriptName: nextActiveScriptName }
          : option);

      if (previousDefaultScriptName === previousActiveScriptName) {
        deps.tabState.defaultScriptName = nextActiveScriptName;
      }

      const hostname = readHostnameFromUrl(deps.tabState.activeTabUrl);
      const wasNonDefaultSelection =
        previousDefaultScriptName.length > 0 && previousDefaultScriptName !== previousActiveScriptName;
      if (hostname && wasNonDefaultSelection) {
        await writeSelectedScriptForHostname(hostname, nextActiveScriptName);
      }
    }
    deps.setHasUnsavedChanges(false);
    const shouldRefreshPendingTab = deps.autosaveOnSaveSuccess();
    if (shouldClearErrorOnSuccessfulSave(deps.getEditorMessage())) {
      deps.setEditorMessage(null, "error");
    }
    if (shouldRefreshPendingTab) {
      deps.refreshActiveTab();
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      deps.setEditorMessage(`${saveFailurePrefix} ${e.message}`, "error", typeof e.stack === "string" ? e.stack : null);
    } else {
      deps.setEditorMessage(`${saveFailurePrefix} ${String(e)}`, "error");
    }
  }
};

export const resetScriptToDefault = async (deps: EditorActionsDeps): Promise<void> => {
  if (deps.tabState.isProtectedPage) {
    throw new Error("This page is protected and cannot store scripts.");
  }

  const activeWebsite = deps.tabState.activeWebsiteGlob?.trim() ?? "";
  const activeScript = deps.tabState.activeScriptName?.trim() ?? "";
  const metadataScriptName = deps.scriptMetadata.title.trim();
  const metadataWebsite = deps.scriptMetadata.website.trim();
  const websiteGlob = activeWebsite || metadataWebsite;
  const scriptNamesToRemove = Array.from(
    new Set([activeScript, metadataScriptName].filter((name) => name.length > 0)),
  );

  if (scriptNamesToRemove.length > 0) {
    await Promise.all(scriptNamesToRemove.map((name) => removeStoredToolState(name))).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown storage error.";
      throw new Error(`Unable to delete script from extension storage: ${message}`);
    });
  }

  const hostname = readHostnameFromUrl(deps.tabState.activeTabUrl);
  if (hostname && activeScript && deps.tabState.defaultScriptName && activeScript !== deps.tabState.defaultScriptName) {
    await clearSelectedScriptForHostname(hostname);
  }

  const activeTabUrl = deps.tabState.activeTabUrl?.trim() ?? "";
  if (activeTabUrl) {
    await deps.reloadStateForUrl(activeTabUrl);
    deps.setEditorMessage(null, "error");
    return;
  }

  const defaultScriptName = await resolveBlankScriptName(defaultBlankScriptTitle, scriptNamesToRemove);
  const defaultContent = buildDefaultScript(websiteGlob, deps.scriptFormatConfig, defaultScriptName);
  const normalizedContent = ensureWebsiteMetadata(ensureDefineBlock(defaultContent, deps.scriptFormatConfig), websiteGlob);
  deps.tabState.activeWebsiteGlob = websiteGlob || null;
  deps.tabState.activeScriptName = null;
  deps.tabState.defaultScriptName = null;
  deps.tabState.availableScriptOptions = [];
  deps.updateEditorContent(normalizedContent, { persist: false });
  deps.setEditorMessage(null, "error");
};
