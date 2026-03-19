import { browser } from "wxt/browser";
import log from "@/lib/logger";
import type {
  RecordConverterOpenResult,
  SelectElementActionResult,
  SelectorOpenResult,
  SelectToolMessage,
} from "@/lib/selection";
import { isScriptRunRequest } from "@/lib/script-runner";
import { isGrantPermissionRequestMessage } from "@/lib/grant-permissions";
import { forwardScriptRunToMainWorld } from "./script-run-bridge";
import { getElementInfo } from "./element-info";
import type { SelectionController } from "./SelectionController";

const logger = log.getLogger("message-router");

export const addMessageListener = (ctrl: SelectionController): void => {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isScriptRunRequest(message)) {
      logger.debug("script run bridge received", { requestId: message.requestId });
      return forwardScriptRunToMainWorld(message, sendResponse);
    }

    if (isGrantPermissionRequestMessage(message)) {
      logger.debug("grant:request received", {
        scriptName: message.payload.scriptName,
        grants: message.payload.grants,
      });
      void ctrl.grantManager.open(message.payload);
      return false;
    }

    if (!message || typeof message !== "object" || typeof (message as { type?: unknown }).type !== "string") {
      return false;
    }

    const msg = message as SelectToolMessage;
    logger.debug("select tool message received", msg);

    if (msg.type === "selector:open") {
      ctrl.recordManager.clear();
      void ctrl.selectorManager
        .open(msg.payload, msg.mode ?? "pp-api", msg.initialCssContent, msg.initialCode, { applyStyle: msg.applyStyle })
        .then((opened) => sendResponse({ opened } satisfies SelectorOpenResult))
        .catch(() => sendResponse({ opened: false } satisfies SelectorOpenResult));
      return true;
    }

    if (msg.type === "record:converter:open") {
      const payload = msg.payload;
      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray(payload.timeline) ||
        typeof payload.existingCode !== "string"
      ) {
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
    }

    if (msg.type === "dev:screenshot:popup") {
      void ctrl.takePopupScreenshot()
        .then((result) => sendResponse(result))
        .catch((error: unknown) => {
          logger.error("Failed to capture popup screenshot", { error });
          sendResponse({ open: false });
        });
      return true;
    }

    if (msg.type === "select:parent") {
      if (!ctrl.selectedTarget) {
        sendResponse({ ok: false, error: "Select an element first." });
        return false;
      }
      const parent = ctrl.selectedTarget.parentElement;
      if (!parent) {
        logger.debug("select parent skipped", { reason: "no-parent" });
        sendResponse({ ok: false, error: "Selected element has no parent." });
        return false;
      }
      ctrl.hover.clearHoverAndNotify();
      ctrl.applySelection(parent);
      sendResponse({ ok: true, payload: getElementInfo(parent) });
      return false;
    }

    if (msg.type === "select:action") {
      void ctrl
        .runAction(msg.action, msg.clipboardText)
        .then((result) => sendResponse(result))
        .catch((error: unknown) => {
          const errorMsg = error instanceof Error ? error.message : "Unable to update the selected element.";
          sendResponse({ ok: false, error: errorMsg } satisfies SelectElementActionResult);
        });
      return true;
    }

    if (msg.type === "select:toggle") {
      if (ctrl.selectorManager.hasPopup) {
        if (msg.enabled) {
          ctrl.selectorManager.resumeSelectionAfterPopup = true;
          if (ctrl.selectionEnabled) {
            ctrl.setSelectionEnabled(false);
          } else {
            ctrl.postMessage({ type: "select:mode", enabled: false });
          }
          return false;
        }
        ctrl.selectorManager.resumeSelectionAfterPopup = false;
      }
      ctrl.setSelectionEnabled(msg.enabled, { clearSelection: msg.clearSelection });
    }

    if (msg.type === "selectors:hover") {
      ctrl.applyHoveredSelectorElements(msg.payload);
    }

    return false;
  });
};
