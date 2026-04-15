import log from "@/lib/logger";
import { get, writable } from "svelte/store";
import { appStateActions } from "@/lib/app-state/actions.ts";
import { appStateSelectors } from "@/lib/app-state/selectors.ts";

import {
  buildDefaultRecordPanelState,
  type RecordPanelState,
  type RecordTimelineEntry,
} from "../state-storage";

const logger = log.getLogger("record-tool-state");

const timelineLimit = 200;
let activeTabId: number | null = null;
let loadVersion = 0;
let timelineSequence = 0;

export const recordPanelState = writable<RecordPanelState>(buildDefaultRecordPanelState());

export type RecordPanelTimelinePopResult = {
  removed: RecordTimelineEntry | null;
  timeline: RecordTimelineEntry[];
};

const createTimelineEntry = (action: string, detail: string): RecordTimelineEntry => {
  timelineSequence += 1;
  return {
    id: `${Date.now()}-${timelineSequence}`,
    action,
    detail,
    timestamp: Date.now(),
  };
};

const trimTimeline = (timeline: RecordTimelineEntry[]) => timeline.slice(-timelineLimit);
const normalizeTimeline = (timeline: RecordTimelineEntry[]) =>
  [...timeline].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }

    return left.id.localeCompare(right.id);
  });

const resetRecordPanelState = () => {
  recordPanelState.set({
    isRecording: true,
    timeline: [],
    updatedAt: 0,
  });
};

const loadRecordPanelStateForTab = (tabId: number, currentLoadVersion: number) => {
  const state = appStateSelectors.getRecordPanelState(tabId) ?? buildDefaultRecordPanelState();
  if (currentLoadVersion !== loadVersion || activeTabId !== tabId) {
    return Promise.resolve();
  }

  const currentState = get(recordPanelState);
  if (currentState.updatedAt > state.updatedAt) {
    return Promise.resolve();
  }

  recordPanelState.set({
    ...state,
    timeline: trimTimeline(normalizeTimeline(state.timeline)),
  });
  return Promise.resolve();
};

const persistRecordPanelState = () => {
  if (activeTabId === null) {
    return;
  }

  const state = get(recordPanelState);
  const nextState = {
    ...state,
    updatedAt: Date.now(),
  };

  if (nextState.timeline.length === 0) {
    appStateActions.removeRecordPanelState(activeTabId);
    return;
  }

  appStateActions.setRecordPanelState(activeTabId, nextState);
};

export const setRecordPanelActiveTab = (tabId: number | null) => {
  activeTabId = tabId;
  loadVersion += 1;
  const currentLoadVersion = loadVersion;

  if (tabId === null) {
    recordPanelState.set(buildDefaultRecordPanelState());
    return;
  }

  resetRecordPanelState();

  void loadRecordPanelStateForTab(tabId, currentLoadVersion)
    .catch((error: unknown) => {
      if (currentLoadVersion !== loadVersion) {
        return;
      }

      logger.warn("Unable to read record tool state.", { tabId, error });
      recordPanelState.set(buildDefaultRecordPanelState());
    });
};

export const prepareRecordToolForDisplay = async () => {
  const tabId = activeTabId;
  const currentLoadVersion = loadVersion + 1;
  loadVersion = currentLoadVersion;

  if (tabId === null) {
    try {
      appStateActions.trimRecordPanels();
    } catch (error: unknown) {
      logger.warn("Unable to trim stored record tool state.", { error });
    }
    return;
  }

  resetRecordPanelState();

  try {
    appStateActions.trimRecordPanels();
  } catch (error: unknown) {
    logger.warn("Unable to trim stored record tool state.", { tabId, error });
  }

  try {
    await loadRecordPanelStateForTab(tabId, currentLoadVersion);
  } catch (error: unknown) {
    if (currentLoadVersion !== loadVersion) {
      return;
    }

    logger.warn("Unable to read record tool state.", { tabId, error });
    recordPanelState.set(buildDefaultRecordPanelState());
  }
};

export const recordSidepanelAction = (action: string, detail = "") => {
  if (activeTabId === null) {
    return;
  }

  const normalizedAction = action.trim();
  if (!normalizedAction) {
    return;
  }

  const normalizedDetail = detail.trim();
  let shouldPersist = false;

  recordPanelState.update((state) => {
    if (!state.isRecording) {
      return state;
    }

    shouldPersist = true;
    return {
      ...state,
      timeline: trimTimeline([...state.timeline, createTimelineEntry(normalizedAction, normalizedDetail)]),
      updatedAt: Date.now(),
    };
  });

  if (shouldPersist) {
    persistRecordPanelState();
  }
};

export const toggleRecordPanelRecording = () => {
  recordPanelState.update((state) => {
    return {
      ...state,
      isRecording: !state.isRecording,
      updatedAt: Date.now(),
    };
  });

  persistRecordPanelState();
};

export const clearRecordPanelState = () => {
  if (activeTabId === null) {
    return;
  }

  const tabId = activeTabId;
  recordPanelState.set(buildDefaultRecordPanelState());
  appStateActions.removeRecordPanelState(tabId);
};

export const popRecordPanelTimelineEntry = (): RecordPanelTimelinePopResult => {
  let removed: RecordTimelineEntry | null = null;
  let timeline = get(recordPanelState).timeline;

  recordPanelState.update((state) => {
    const lastEntry = state.timeline.at(-1) ?? null;
    if (!lastEntry) {
      timeline = state.timeline;
      return state;
    }

    removed = lastEntry;
    timeline = state.timeline.slice(0, -1);

    return {
      ...state,
      timeline,
      updatedAt: Date.now(),
    };
  });

  if (removed) {
    persistRecordPanelState();
  }

  return {
    removed,
    timeline,
  };
};
