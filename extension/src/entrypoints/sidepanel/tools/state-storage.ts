import { browser } from "wxt/browser";
import { buildAutoNumberedScriptName, matchesScriptName } from "../../../lib/script-names";
import {
  coerceStoredToolState,
  findBestMatchingWebsiteGlob,
  fromStorageKey,
  getWebsiteGlobsFromContent,
  StoredToolStateSchema,
  toStorageKey,
  type StoredSelectorEntry,
  type StoredToolState,
  type ToolId,
} from "../../../lib/stored-tool-state";

export type { StoredSelectorEntry, StoredToolState, ToolId };
export { toStorageKey, fromStorageKey };

export type { RecordTimelineEntry, RecordPanelState } from "./storage/record-panel";
export {
  buildDefaultRecordPanelState,
  readRecordPanelStateForTab,
  saveRecordPanelStateForTab,
  removeRecordPanelStateForTab,
  trimStoredRecordPanelStates,
} from "./storage/record-panel";

export {
  readToolPanelHeightSetting,
  saveToolPanelHeightSetting,
} from "./storage/tool-panel";

export {
  readHelpBannerDismissedSetting,
  saveHelpBannerDismissedSetting,
  readUserscriptReloadBannerDismissedSetting,
  saveUserscriptReloadBannerDismissedSetting,
} from "./storage/banners";

export type StoredStateMatch = {
  scriptName: string;
  matchedWebsiteGlob: string;
  state: StoredToolState;
};

export const listStoredToolStates = async () => {
  const allValues = await browser.storage.local.get(null);
  const dedupedStates = new Map<string, { scriptName: string; state: StoredToolState }>();

  Object.entries(allValues).forEach(([key, value]) => {
    const scriptName = fromStorageKey(key);
    if (!scriptName) {
      return;
    }

    const state = coerceStoredToolState(value, scriptName);
    if (!state) {
      return;
    }

    const existing = dedupedStates.get(state.scriptName);
    if (!existing || state.updatedAt >= existing.state.updatedAt) {
      dedupedStates.set(state.scriptName, { scriptName: state.scriptName, state });
    }
  });

  return Array.from(dedupedStates.values());
};

export const listStoredScriptNames = async () =>
  (await listStoredToolStates()).map((entry) => entry.scriptName);

export const resolveBlankScriptName = async (
  baseScriptName: string,
  excludedScriptNames: readonly string[] = [],
) => {
  const storedScriptNames = await listStoredScriptNames();
  const filteredStoredScriptNames = storedScriptNames.filter(
    (scriptName) => !excludedScriptNames.some((excludedScriptName) => matchesScriptName(scriptName, excludedScriptName)),
  );
  return buildAutoNumberedScriptName(baseScriptName, filteredStoredScriptNames);
};

export const hasStoredScriptNameConflict = async (
  scriptName: string,
  excludedScriptNames: readonly string[] = [],
) => {
  const normalizedScriptName = scriptName.trim();
  if (!normalizedScriptName) {
    return false;
  }

  const storedScriptNames = await listStoredScriptNames();
  return storedScriptNames.some((storedScriptName) => {
    if (!matchesScriptName(storedScriptName, normalizedScriptName)) {
      return false;
    }

    return !excludedScriptNames.some((excludedScriptName) => matchesScriptName(storedScriptName, excludedScriptName));
  });
};

export const saveStoredToolState = async (state: StoredToolState) => {
  const key = toStorageKey(state.scriptName);
  await browser.storage.local.set({
    [key]: StoredToolStateSchema.parse(state),
  });
};

export const readStoredToolState = async (scriptName: string) => {
  const normalized = scriptName.trim();
  if (!normalized) {
    return null;
  }

  const key = toStorageKey(normalized);
  const stored = await browser.storage.local.get(key);
  return coerceStoredToolState(stored[key], normalized);
};

export const readStoredScriptEnabled = async (scriptName: string) =>
  (await readStoredToolState(scriptName))?.permissions.enabled ?? true;

export const saveStoredScriptEnabled = async (scriptName: string, enabled: boolean) => {
  const state = await readStoredToolState(scriptName);
  if (!state) {
    throw new Error(`No stored script found for "${scriptName}".`);
  }

  const nextState: StoredToolState = {
    ...state,
    permissions: {
      ...state.permissions,
      enabled,
    },
    updatedAt: Date.now(),
  };

  await saveStoredToolState(nextState);
  return nextState;
};

export const removeStoredToolState = async (scriptName: string) => {
  const normalized = scriptName.trim();
  if (!normalized) {
    return;
  }

  await browser.storage.local.remove(toStorageKey(normalized));
};

export const findStoredToolStatesForUrl = async (url: string) => {
  const states = await listStoredToolStates();
  const matches: StoredStateMatch[] = [];

  states.forEach((entry) => {
    const websiteGlobs = getWebsiteGlobsFromContent(entry.state.codeEditor.content);
    const matchedWebsiteGlob = findBestMatchingWebsiteGlob(websiteGlobs, url);
    if (!matchedWebsiteGlob) {
      return;
    }

    matches.push({
      scriptName: entry.state.scriptName,
      matchedWebsiteGlob,
      state: entry.state,
    });
  });

  return matches.sort((left, right) => {
    const byGlobLength = right.matchedWebsiteGlob.length - left.matchedWebsiteGlob.length;
    if (byGlobLength !== 0) {
      return byGlobLength;
    }

    return right.state.updatedAt - left.state.updatedAt;
  });
};

export const findStoredToolStateForUrl = async (url: string) => (await findStoredToolStatesForUrl(url))[0] ?? null;
