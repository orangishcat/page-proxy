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
import { createSidepanelBannerManager, type BannerDefinition } from "../banners/banner-manager";

export type { StoredSelectorEntry, StoredToolState, ToolId };
export { toStorageKey, fromStorageKey };

export type RecordTimelineEntry = {
  id: string;
  action: string;
  detail: string;
  timestamp: number;
};

export type RecordPanelState = {
  isRecording: boolean;
  timeline: RecordTimelineEntry[];
  updatedAt: number;
};

type StoredStateMatch = {
  scriptName: string;
  matchedWebsiteGlob: string;
  state: StoredToolState;
};

const recordPanelStorageKeyPrefix = "sidepanel:recordPanel:";
const toolPanelHeightStorageKey = "sidepanel:toolPanelHeightPx";
const helpBannerDismissedStorageKey = "sidepanel:helpBannerDismissed";
const userscriptReloadBannerDismissedStorageKey = "sidepanel:userscriptReloadBannerDismissed";
const sidepanelBannerManager = createSidepanelBannerManager();
const helpBanner: BannerDefinition = {
  id: "helpBannerDismissed",
  storageKey: helpBannerDismissedStorageKey,
};
const userscriptReloadBanner: BannerDefinition = {
  id: "userscriptReloadBannerDismissed",
  storageKey: userscriptReloadBannerDismissedStorageKey,
};

const coerceRecordTimelineEntries = (value: unknown): RecordTimelineEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: RecordTimelineEntry[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }

    const data = entry as {
      id?: unknown;
      action?: unknown;
      detail?: unknown;
      timestamp?: unknown;
    };

    if (
      typeof data.id !== "string" ||
      typeof data.action !== "string" ||
      typeof data.detail !== "string" ||
      typeof data.timestamp !== "number"
    ) {
      return;
    }

    entries.push({
      id: data.id,
      action: data.action,
      detail: data.detail,
      timestamp: data.timestamp,
    });
  });

  return entries;
};

const coerceRecordPanelState = (value: unknown): RecordPanelState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as {
    isRecording?: unknown;
    timeline?: unknown;
    updatedAt?: unknown;
  };

  if (typeof data.isRecording !== "boolean") {
    return null;
  }

  return {
    isRecording: data.isRecording,
    timeline: coerceRecordTimelineEntries(data.timeline),
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
};

const buildRecordPanelStorageKey = (tabId: number) => `${recordPanelStorageKeyPrefix}${tabId}`;

export const buildDefaultRecordPanelState = (): RecordPanelState => ({
  isRecording: true,
  timeline: [],
  updatedAt: Date.now(),
});

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

export const readRecordPanelStateForTab = async (tabId: number) => {
  if (!Number.isInteger(tabId) || tabId < 0) {
    return buildDefaultRecordPanelState();
  }

  const storageKey = buildRecordPanelStorageKey(tabId);
  return browser.storage.local
    .get(storageKey)
    .then((stored) => coerceRecordPanelState(stored[storageKey]) ?? buildDefaultRecordPanelState())
    .catch(() => buildDefaultRecordPanelState());
};

export const saveRecordPanelStateForTab = async (tabId: number, state: RecordPanelState) => {
  if (!Number.isInteger(tabId) || tabId < 0) {
    return;
  }

  const storageKey = buildRecordPanelStorageKey(tabId);
  await browser.storage.local.set({
    [storageKey]: {
      isRecording: state.isRecording,
      timeline: state.timeline,
      updatedAt: state.updatedAt,
    },
  });
};

export const removeRecordPanelStateForTab = async (tabId: number) => {
  if (!Number.isInteger(tabId) || tabId < 0) {
    return;
  }

  const storageKey = buildRecordPanelStorageKey(tabId);
  await browser.storage.local.remove(storageKey);
};

const coerceToolPanelHeight = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return value;
};

export const readToolPanelHeightSetting = async () => {
  return browser.storage.local
    .get(toolPanelHeightStorageKey)
    .then((stored) => coerceToolPanelHeight(stored[toolPanelHeightStorageKey]))
    .catch(() => null);
};

export const saveToolPanelHeightSetting = async (height: number) => {
  const normalizedHeight = coerceToolPanelHeight(height);
  if (normalizedHeight === null) {
    return;
  }

  await browser.storage.local
    .set({
      [toolPanelHeightStorageKey]: normalizedHeight,
    })
    .catch(() => undefined);
};

export const readHelpBannerDismissedSetting = async () => {
  return sidepanelBannerManager.isDismissed(helpBanner);
};

export const saveHelpBannerDismissedSetting = async (dismissed: boolean) => {
  if (dismissed) {
    await sidepanelBannerManager.dismiss(helpBanner);
    return;
  }

  await sidepanelBannerManager.reset(helpBanner);
};

export const readUserscriptReloadBannerDismissedSetting = async () => {
  return sidepanelBannerManager.isDismissed(userscriptReloadBanner);
};

export const saveUserscriptReloadBannerDismissedSetting = async (dismissed: boolean) => {
  if (dismissed) {
    await sidepanelBannerManager.dismiss(userscriptReloadBanner);
    return;
  }

  await sidepanelBannerManager.reset(userscriptReloadBanner);
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
