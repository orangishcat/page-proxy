import { defaultBlankScriptTitle, matchesScriptName } from "@/lib/script-names";
import { appState } from "@/lib/app-state/state.svelte.ts";
import { parseScriptMetadata } from "@/lib/utils/script-metadata";
import type { ScriptGrantValue } from "@/lib/grants";
import { matchWebsiteGlob } from "@/lib/utils/website-glob";
import {
  ensureWebsiteMetadata,
  isDefaultToolState,
  normalizeContentForStorage,
  resolveWebsiteGlob,
  type ScriptFormatConfig,
} from "../state-loading";
import type { StoredSelectorEntry, StoredToolState } from "@/lib/stored-tool-state";

const getStoredToolState = (scriptName: string): StoredToolState | null => appState.scriptsByName[scriptName] ?? null;

const hasStoredScriptNameConflict = (scriptName: string, excludedScriptNames: readonly string[] = []) => {
  const normalizedScriptName = scriptName.trim();
  if (!normalizedScriptName) {
    return false;
  }

  return Object.values(appState.scriptsByName).some((storedScript) => {
    if (!matchesScriptName(storedScript.scriptName, normalizedScriptName)) {
      return false;
    }

    return !excludedScriptNames.some((excludedScriptName) =>
      matchesScriptName(storedScript.scriptName, excludedScriptName),
    );
  });
};

type SaveStateOptions = {
  content: string;
  selectorEntries: StoredSelectorEntry[];
  allowedGrants: ScriptGrantValue[];
  isProtectedPage: boolean;
  scriptFormatConfig: ScriptFormatConfig;
  activeTabUrl: string | null;
  activeWebsiteGlob: string | null;
  activeScriptName: string | null;
  getDefinitionBlock: (content: string) => string;
  setActiveWebsiteGlob: (websiteGlob: string) => void;
  setActiveScriptName: (scriptName: string) => void;
};

export const saveState = (options: SaveStateOptions) => {
  if (options.isProtectedPage) {
    return;
  }

  let normalizedContent: string;
  let metadata: ReturnType<typeof parseScriptMetadata>;
  try {
    normalizedContent = normalizeContentForStorage(
      options.content,
      options.isProtectedPage,
      options.scriptFormatConfig,
    );
    metadata = parseScriptMetadata(normalizedContent);
    options.getDefinitionBlock(normalizedContent);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid script metadata or selector block.");
  }

  const scriptName = metadata.title.trim() || defaultBlankScriptTitle;
  const activeScriptName = options.activeScriptName?.trim() ?? "";
  let websiteGlob: string;
  try {
    websiteGlob = resolveWebsiteGlob(normalizedContent, options.activeTabUrl, options.activeWebsiteGlob);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid script metadata.");
  }

  if (!websiteGlob) {
    return;
  }

  const websiteGlobs = metadata.websites.map((glob) => glob.trim()).filter((glob) => glob.length > 0);
  const fallbackWebsite = metadata.website.trim();
  const websiteGlobsForMatch = websiteGlobs.length > 0 ? websiteGlobs : [fallbackWebsite || websiteGlob];
  const activeTabUrl = options.activeTabUrl?.trim() ?? "";
  const hasMatchingWebsite =
    activeTabUrl.length === 0
      ? true
      : websiteGlobsForMatch.some((glob) => glob.length > 0 && matchWebsiteGlob(glob, activeTabUrl));
  if (!hasMatchingWebsite && activeTabUrl.length > 0) {
    throw new Error(`Website glob "${websiteGlob}" does not match the current website (${options.activeTabUrl}).`);
  }

  if (hasStoredScriptNameConflict(scriptName, activeScriptName ? [activeScriptName] : [])) {
    throw new Error(`A script named "${scriptName}" already exists.`);
  }

  const contentWithWebsite = ensureWebsiteMetadata(normalizedContent, websiteGlob);
  const existingState =
    (activeScriptName ? getStoredToolState(activeScriptName) : null) ??
    (scriptName ? getStoredToolState(scriptName) : null);

  if (activeScriptName && activeScriptName !== scriptName) {
    delete appState.scriptsByName[activeScriptName];
  }

  const state: StoredToolState = {
    scriptName,
    codeEditor: {
      content: contentWithWebsite,
    },
    selectorPanel: {
      entries: options.selectorEntries,
    },
    permissions: {
      allowedGrants: Array.from(options.allowedGrants),
      enabled: existingState?.permissions.enabled ?? true,
    },
    websiteGlob,
    updatedAt: Date.now(),
    runtimeStorage: existingState?.runtimeStorage ?? {
      pt: {},
      pn: {},
    },
  };

  options.setActiveWebsiteGlob(websiteGlob);
  options.setActiveScriptName(scriptName);

  if (isDefaultToolState(state, options.scriptFormatConfig)) {
    delete appState.scriptsByName[scriptName];
    return;
  }

  appState.scriptsByName[scriptName] = state;
};
