import log from "@/lib/logger";
import { get, writable } from "svelte/store";

import {
  buildDefaultRecordPanelState,
  readRecordPanelStateForTab,
  removeRecordPanelStateForTab,
  saveRecordPanelStateForTab,
  type RecordPanelState,
  type RecordTimelineEntry,
} from "../state-storage";

const logger = log.getLogger("record-tool-state");

const timelineLimit = 200;
let activeTabId: number | null = null;
let loadVersion = 0;
let timelineSequence = 0;

export const recordPanelState = writable<RecordPanelState>(buildDefaultRecordPanelState());

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

const persistRecordPanelState = () => {
  if (activeTabId === null) {
    return;
  }

  const state = get(recordPanelState);
  void saveRecordPanelStateForTab(activeTabId, {
    ...state,
    updatedAt: Date.now(),
  }).catch((error: unknown) => {
    logger.warn("Unable to save record tool state.", { tabId: activeTabId, error });
  });
};

export const setRecordPanelActiveTab = (tabId: number | null) => {
  activeTabId = tabId;
  loadVersion += 1;
  const currentLoadVersion = loadVersion;

  if (tabId === null) {
    recordPanelState.set(buildDefaultRecordPanelState());
    return;
  }

  recordPanelState.set({
    isRecording: true,
    timeline: [],
    updatedAt: 0,
  });

  void readRecordPanelStateForTab(tabId)
    .then((state) => {
      if (currentLoadVersion !== loadVersion) {
        return;
      }

      const currentState = get(recordPanelState);
      if (currentState.updatedAt > state.updatedAt) {
        return;
      }

      recordPanelState.set({
        ...state,
        timeline: trimTimeline(normalizeTimeline(state.timeline)),
      });
    })
    .catch((error: unknown) => {
      if (currentLoadVersion !== loadVersion) {
        return;
      }

      logger.warn("Unable to read record tool state.", { tabId, error });
      recordPanelState.set(buildDefaultRecordPanelState());
    });
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
  void removeRecordPanelStateForTab(tabId).catch((error: unknown) => {
    logger.warn("Unable to clear record tool state.", { tabId, error });
  });
};
