import { buildAutoNumberedScriptName, matchesScriptName } from "../../../lib/script-names";
import {
  findBestMatchingWebsiteGlob,
  fromStorageKey,
  getWebsiteGlobsFromContent,
  toStorageKey,
  type StoredSelectorEntry,
  type StoredToolState,
  type ToolId,
} from "../../../lib/stored-tool-state";
import { appStateActions } from "../../../lib/app-state/actions.ts";
import { appStateSelectors } from "../../../lib/app-state/selectors.ts";

export type { StoredSelectorEntry, StoredToolState, ToolId };
export { toStorageKey, fromStorageKey };

export type { RecordTimelineEntry, RecordPanelState } from "./storage/record-panel";
export { buildDefaultRecordPanelState } from "./storage/record-panel";

export type StoredStateMatch = {
  scriptName: string;
  matchedWebsiteGlob: string;
  state: StoredToolState;
};

export const listStoredToolStates = (): Promise<StoredToolState[]> =>
  Promise.resolve(appStateSelectors.getStoredToolStates());

export const listStoredScriptNames = (): Promise<string[]> =>
  listStoredToolStates().then((entries) => entries.map((entry) => entry.scriptName));

export const resolveBlankScriptName = async (baseScriptName: string, excludedScriptNames: readonly string[] = []) => {
  const storedScriptNames = await listStoredScriptNames();
  const filteredStoredScriptNames = storedScriptNames.filter(
    (scriptName) =>
      !excludedScriptNames.some((excludedScriptName) => matchesScriptName(scriptName, excludedScriptName)),
  );
  return buildAutoNumberedScriptName(baseScriptName, filteredStoredScriptNames);
};

export const hasStoredScriptNameConflict = (scriptName: string, excludedScriptNames: readonly string[] = []) => {
  const normalizedScriptName = scriptName.trim();
  if (!normalizedScriptName) {
    return false;
  }

  return listStoredScriptNames().then((storedScriptNames) =>
    storedScriptNames.some((storedScriptName) => {
      if (!matchesScriptName(storedScriptName, normalizedScriptName)) {
        return false;
      }

      return !excludedScriptNames.some((excludedScriptName) => matchesScriptName(storedScriptName, excludedScriptName));
    }),
  );
};

export const saveStoredToolState = (state: StoredToolState): Promise<void> => {
  appStateActions.upsertStoredToolState(state);
  return Promise.resolve();
};

export const readStoredToolState = (scriptName: string): Promise<StoredToolState | null> => {
  const normalized = scriptName.trim();
  if (!normalized) {
    return Promise.resolve(null);
  }

  return Promise.resolve(appStateSelectors.getStoredToolState(normalized));
};

export const readStoredScriptEnabled = (scriptName: string): Promise<boolean> =>
  Promise.resolve(appStateSelectors.getStoredScriptEnabled(scriptName));

export const saveStoredScriptEnabled = (scriptName: string, enabled: boolean): Promise<StoredToolState | null> => {
  appStateActions.setStoredScriptEnabled(scriptName, enabled);
  return Promise.resolve(appStateSelectors.getStoredToolState(scriptName));
};

export const removeStoredToolState = (scriptName: string): Promise<void> => {
  const normalized = scriptName.trim();
  if (!normalized) {
    return Promise.resolve();
  }

  appStateActions.removeStoredToolState(normalized);
  return Promise.resolve();
};

export const findStoredToolStatesForUrl = (url: string): Promise<StoredStateMatch[]> => {
  const states = appStateSelectors.getStoredToolStates();
  const matches: StoredStateMatch[] = [];

  states.forEach((entry) => {
    const websiteGlobs = getWebsiteGlobsFromContent(entry.codeEditor.content);
    const matchedWebsiteGlob = findBestMatchingWebsiteGlob(websiteGlobs, url);
    if (!matchedWebsiteGlob) {
      return;
    }

    matches.push({
      scriptName: entry.scriptName,
      matchedWebsiteGlob,
      state: entry,
    });
  });

  return Promise.resolve(
    matches.sort((left, right) => {
      const byGlobLength = right.matchedWebsiteGlob.length - left.matchedWebsiteGlob.length;
      if (byGlobLength !== 0) {
        return byGlobLength;
      }

      return right.state.updatedAt - left.state.updatedAt;
    }),
  );
};

export const findStoredToolStateForUrl = (url: string) =>
  findStoredToolStatesForUrl(url).then((entries) => entries[0] ?? null);
