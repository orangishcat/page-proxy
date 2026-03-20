import { browser } from "wxt/browser";

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

const recordPanelStorageKeyPrefix = "sidepanel:recordPanel:";
const recordPanelRetentionLimit = 5;

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

const isRecordPanelStorageKey = (key: string) => key.startsWith(recordPanelStorageKeyPrefix);

export const buildDefaultRecordPanelState = (): RecordPanelState => ({
  isRecording: true,
  timeline: [],
  updatedAt: Date.now(),
});

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
  if (state.timeline.length === 0) {
    await browser.storage.local.remove(storageKey);
    return;
  }

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

export const trimStoredRecordPanelStates = async (limit = recordPanelRetentionLimit) => {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  const allValues = await browser.storage.local.get(null);
  const removableKeys: string[] = [];
  const validEntries: Array<{ storageKey: string; state: RecordPanelState }> = [];

  Object.entries(allValues).forEach(([key, value]) => {
    if (!isRecordPanelStorageKey(key)) {
      return;
    }

    const state = coerceRecordPanelState(value);
    if (!state) {
      return;
    }

    if (state.timeline.length === 0) {
      removableKeys.push(key);
      return;
    }

    validEntries.push({
      storageKey: key,
      state,
    });
  });

  validEntries.sort((left, right) => {
    if (left.state.updatedAt !== right.state.updatedAt) {
      return right.state.updatedAt - left.state.updatedAt;
    }

    return right.storageKey.localeCompare(left.storageKey);
  });

  removableKeys.push(...validEntries.slice(normalizedLimit).map((entry) => entry.storageKey));

  if (removableKeys.length === 0) {
    return;
  }

  await browser.storage.local.remove(removableKeys);
};
