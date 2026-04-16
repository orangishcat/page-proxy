import log from "@/lib/logger";
import { get } from "svelte/store";
import { isRecord } from "@/lib/utils/type-guards";

import type { RecordConverterOpenResult, SelectToolMessage } from "@/lib/selection";
import { codeEditorContent } from "../code-editor/state";
import type { RecordTimelineEntry } from "../storage/record-panel";
import { isRestrictedUrl, readActiveTabContext, sendSelectToolMessage } from "../select-tool/content-messaging";
import { setToolMessage } from "../tool-errors";

const logger = log.getLogger("record-tool-actions");

const selectorDetailPattern = /^selector:\s*(.+)$/i;

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

export const getRecordedEntrySelector = (entry: RecordTimelineEntry | null | undefined) => {
  if (!entry) {
    return null;
  }

  const match = selectorDetailPattern.exec(entry.detail.trim());
  const selector = match?.[1]?.trim() ?? "";
  return selector.length > 0 ? selector : null;
};

export const findLastRecordedSelector = (entries: RecordTimelineEntry[]) => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const selector = getRecordedEntrySelector(entries[index]);
    if (selector) {
      return selector;
    }
  }

  return null;
};

export const openRecordConverter = (selectedEntries: RecordTimelineEntry[]) => {
  const timeline = toTimelinePayload(selectedEntries);
  const timelineSize = timeline.length;
  if (timeline.length === 0) {
    logger.error("record converter open failed: empty timeline selection");
    setToolMessage("Select at least one recorded action to convert.", "error");
    return;
  }

  if (!selectionStartsWithSelectedElement(selectedEntries)) {
    logger.error("record converter open failed: first selected action is not selected element", {
      timelineSize,
      firstAction: selectedEntries[0]?.action ?? null,
    });
    setToolMessage("The first selected action must be Selected element.", "error");
    return;
  }

  logger.debug("request record converter open", {
    selectedEntries: timeline.length,
  });

  setToolMessage(null, "error");
  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        logger.error("record converter open failed: no active tab", {
          timelineSize,
        });
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        logger.error("record converter open failed: restricted url", {
          tabId: tabContext.tabId,
          url: tabContext.url,
          timelineSize,
        });
        setToolMessage("Selection is unavailable on this page.", "error");
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
        setToolMessage("No response from page while opening record converter.", "error");
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
        setToolMessage("Record converter returned an invalid response.", "error");
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
        setToolMessage(response.error ?? "Unable to open record converter.", "error");
        return;
      }

      setToolMessage(null, "error");
    })
    .catch((error: unknown) => {
      logger.error("record converter open failed: active tab context error", {
        timelineSize,
        error,
      });
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};
