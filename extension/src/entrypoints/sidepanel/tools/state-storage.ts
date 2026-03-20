import { browser } from "wxt/browser";
import {
  coerceStoredToolState,
  findBestMatchingWebsiteGlob,
  fromStorageKey,
  getWebsiteGlobsFromContent,
  toStorageKey,
  type StoredSelectorEntry,
  type StoredToolState,
  type ToolId,
} from "@/lib/stored-tool-state";

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

type StoredStateMatch = {
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

export const saveStoredToolState = async (state: StoredToolState) => {
  const key = toStorageKey(state.scriptName);
  await browser.storage.local.set({
    [key]: state,
  });
};

export const removeStoredToolState = async (scriptName: string) => {
  const normalized = scriptName.trim();
  if (!normalized) {
    return;
  }

  await browser.storage.local.remove(toStorageKey(normalized));
};

export const findStoredToolStateForUrl = async (url: string) => {
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

  return (
    matches.sort((left, right) => {
      const byGlobLength = right.matchedWebsiteGlob.length - left.matchedWebsiteGlob.length;
      if (byGlobLength !== 0) {
        return byGlobLength;
      }

      return right.state.updatedAt - left.state.updatedAt;
    })[0] ?? null
  );
};
