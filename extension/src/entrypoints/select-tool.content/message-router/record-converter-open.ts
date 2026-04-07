import log from "@/lib/logger";
import type { RecordConverterOpenResult } from "@/lib/selection";
import type { RoutedSelectToolHandler } from "./types";

const logger = log.getLogger("message-router");

export const handleRecordConverterOpen: RoutedSelectToolHandler<"record:converter:open"> = (
  content,
  { ctrl, sendResponse },
) => {
  const payload = content.payload;
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.timeline) || typeof payload.existingCode !== "string") {
    logger.error("Invalid record converter open payload", { payload });
    sendResponse({ opened: false, error: "Invalid record converter payload." } satisfies RecordConverterOpenResult);
    return false;
  }

  let hasResponded = false;
  const safeSendResponse = (result: RecordConverterOpenResult, reason: string) => {
    logger.debug("record converter open response", { reason, opened: result.opened, error: result.error });
    try {
      sendResponse(result);
    } catch (error: unknown) {
      logger.error("Failed to send record converter open response", { reason, error, result });
    }
  };

  const responseTimeoutId = globalThis.setTimeout(() => {
    if (hasResponded) return;
    hasResponded = true;
    logger.error("Record converter open timed out before responding", {
      timelineSize: payload.timeline.length,
      existingCodeLength: payload.existingCode.length,
    });
    safeSendResponse(
      {
        opened: false,
        error: "Timed out while opening record converter popup.",
      } satisfies RecordConverterOpenResult,
      "timeout",
    );
  }, 4000);

  const reply = (result: RecordConverterOpenResult) => {
    if (hasResponded) return;
    hasResponded = true;
    globalThis.clearTimeout(responseTimeoutId);
    safeSendResponse(result, "resolved");
  };

  if (ctrl.selectionEnabled) ctrl.setSelectionEnabled(false, { clearSelection: false });
  ctrl.selectorManager.clear({ resumeSelection: false });
  void ctrl.recordManager
    .open(payload)
    .then((result) => reply(result))
    .catch((error: unknown) => {
      logger.error("Failed to handle record converter open request", {
        error,
        timelineSize: payload.timeline.length,
        existingCodeLength: payload.existingCode.length,
      });
      reply({ opened: false, error: "Unable to open record converter popup." });
    });
  return true;
};
