import log from "@/lib/logger";
import { get } from "svelte/store";

import type { RecordConverterOpenResult, SelectToolMessage } from "@/lib/selection";
import { codeEditorContent } from "../code-editor/state";
import type { RecordTimelineEntry } from "../state-storage";
import { isRestrictedUrl, readActiveTabContext, sendSelectToolMessage } from "../select-tool/content-messaging";
import { clearRecordConverterOpenError, setRecordConverterOpenError } from "./error-state";

const logger = log.getLogger("record-tool-actions");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isRecordConverterOpenResult = (value: unknown): value is RecordConverterOpenResult =>
  isRecord(value) &&
  typeof value.opened === "boolean" &&
  (value.error === undefined || typeof value.error === "string");

const toTimelinePayload = (entries: RecordTimelineEntry[]) =>
  entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    detail: entry.detail,
    timestamp: entry.timestamp,
  }));

export const selectionStartsWithSelectedElement = (selectedEntries: RecordTimelineEntry[]) => {
  const firstEntry = selectedEntries[0];
  if (!firstEntry) {
    return false;
  }

  return firstEntry.action.trim().toLowerCase() === "selected element";
};

export const openRecordConverter = (selectedEntries: RecordTimelineEntry[]) => {
  const timeline = toTimelinePayload(selectedEntries);
  const timelineSize = timeline.length;
  if (timeline.length === 0) {
    logger.error("record converter open failed: empty timeline selection");
    setRecordConverterOpenError("Select at least one recorded action to convert.");
    return;
  }

  if (!selectionStartsWithSelectedElement(selectedEntries)) {
    logger.error("record converter open failed: first selected action is not selected element", {
      timelineSize,
      firstAction: selectedEntries[0]?.action ?? null,
    });
    setRecordConverterOpenError("The first selected action must be Selected element.");
    return;
  }

  logger.debug("request record converter open", {
    selectedEntries: timeline.length,
  });

  clearRecordConverterOpenError();
  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        logger.error("record converter open failed: no active tab", {
          timelineSize,
        });
        setRecordConverterOpenError("No active tab found.");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        logger.error("record converter open failed: restricted url", {
          tabId: tabContext.tabId,
          url: tabContext.url,
          timelineSize,
        });
        setRecordConverterOpenError("Selection is unavailable on this page.");
        return;
      }

      const existingCode = get(codeEditorContent);
      const existingCodeLength = typeof existingCode === "string" ? existingCode.length : 0;
      const response: unknown = await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "record:converter:open",
          payload: {
            timeline,
            existingCode,
          },
        } satisfies SelectToolMessage,
        0,
      ).catch((error: unknown) => {
        logger.error("record converter open message failed", {
          tabId: tabContext.tabId,
          url: tabContext.url,
          timelineSize,
          existingCodeLength,
          error,
        });
        return null;
      });

      if (response === null || response === undefined) {
        logger.error("record converter open failed: null response", {
          tabId: tabContext.tabId,
          url: tabContext.url,
          timelineSize,
          existingCodeLength,
          rawResponse: response,
        });
        setRecordConverterOpenError("No response from page while opening record converter.");
        return;
      }

      if (!isRecordConverterOpenResult(response)) {
        logger.error("record converter open failed: invalid response", {
          tabId: tabContext.tabId,
          url: tabContext.url,
          timelineSize,
          existingCodeLength,
          rawResponse: response,
        });
        setRecordConverterOpenError("Record converter returned an invalid response.");
        return;
      }

      if (!response.opened) {
        logger.error("record converter open failed: opened=false", {
          tabId: tabContext.tabId,
          url: tabContext.url,
          timelineSize,
          existingCodeLength,
          error: response.error,
        });
        setRecordConverterOpenError(response.error ?? "Unable to open record converter.");
        return;
      }

      clearRecordConverterOpenError();
    })
    .catch((error: unknown) => {
      logger.error("record converter open failed: active tab context error", {
        timelineSize,
        error,
      });
      setRecordConverterOpenError("Unable to connect to the active tab.");
    });
};
