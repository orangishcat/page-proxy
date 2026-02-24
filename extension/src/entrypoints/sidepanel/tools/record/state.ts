import log from "loglevel";
import { get, writable } from "svelte/store";

import {
  buildDefaultRecordPanelState,
  readRecordPanelStateForTab,
  saveRecordPanelStateForTab,
  type RecordPanelState,
  type RecordTimelineEntry,
} from "../state-storage";

const logger = log.getLogger("record-tool-state");
logger.setLevel("debug", false);

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

const trimTimeline = (timeline: RecordTimelineEntry[]) => timeline.slice(0, timelineLimit);

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

      recordPanelState.set(state);
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
      timeline: trimTimeline([createTimelineEntry(normalizedAction, normalizedDetail), ...state.timeline]),
      updatedAt: Date.now(),
    };
  });

  if (shouldPersist) {
    persistRecordPanelState();
  }
};

export const toggleRecordPanelRecording = () => {
  recordPanelState.update((state) => {
    const nextIsRecording = !state.isRecording;
    const eventLabel = nextIsRecording ? "Recording resumed" : "Recording paused";
    return {
      ...state,
      isRecording: nextIsRecording,
      timeline: trimTimeline([createTimelineEntry(eventLabel, ""), ...state.timeline]),
      updatedAt: Date.now(),
    };
  });

  persistRecordPanelState();
};
