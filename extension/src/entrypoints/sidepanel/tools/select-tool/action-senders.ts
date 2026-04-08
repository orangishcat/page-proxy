import { get } from "svelte/store";
import log from "@/lib/logger";

import type { SelectElementAction, SelectToolMessage, SelectorPopupMode } from "@/lib/selection";
import { buildSelectorTemplateCode } from "@/entrypoints/select-tool.content/popup/selector";
import { buildCssDocument } from "@/entrypoints/select-tool.content/css-inspector/css-editor-utils";
import { recordSidepanelAction } from "../record/state";
import { setToolMessage } from "../tool-errors";
import {
  getSelectionContext,
  selectedInfo,
  setDevtoolsIntegrationDetected,
  setSelectModeEnabled,
  setSelection,
} from "./state";
import {
  isRestrictedUrl,
  readActiveTabContext,
  runContentSelectionToggle,
  sendSelectToolMessage,
} from "./content-messaging";
import { requestDevtoolsSelection } from "./devtools";
import {
  isSelectElementActionResult,
  isSelectParentResponse,
  isSelectorOpenResult,
} from "./guards";
import {
  armSelectedElementRecordSuppression,
  clearSelectedElementRecordSuppression,
  recordSelectedParentElement,
} from "./recording";
import { trySelectWithDevtools, applyDevtoolsSelection } from "./devtools-follow";
import { undoLastRecordedAction } from "./history";

const logger = log.getLogger("select-tool-sidepanel");

let copyBufferHtml: string | null = null;

const logIgnoredError = (message: string, error: unknown, extra: Record<string, unknown> = {}) => {
  logger.debug(message, { error, ...extra });
};

export const sendSelectionToggle = (enabled: boolean, options: { clearSelection?: boolean } = {}) => {
  const clearSelection = options.clearSelection ?? true;
  logger.debug("toggle selection mode requested", { enabled });
  const shouldReportError = enabled;
  setToolMessage(null, "error");
  setSelectModeEnabled(enabled);

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setDevtoolsIntegrationDetected(false);
        setSelectModeEnabled(false);
        if (shouldReportError) {
          setToolMessage("No active tab found.", "error");
        }
        return;
      }

      if (shouldReportError && isRestrictedUrl(tabContext.url)) {
        setDevtoolsIntegrationDetected(false);
        setSelectModeEnabled(false);
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      if (!enabled) {
        if (clearSelection) {
          setSelection(null);
        }

        try {
          await runContentSelectionToggle(tabContext.tabId, false, { clearSelection });
        } catch (error) {
          logIgnoredError("Unable to disable content selection.", error, { tabId: tabContext.tabId });
        }
        return;
      }

      const appliedDevtoolsSelection = await trySelectWithDevtools(tabContext.tabId);
      if (appliedDevtoolsSelection) {
        try {
          await runContentSelectionToggle(tabContext.tabId, false);
        } catch (error) {
          logIgnoredError("Unable to disable content selection after DevTools selection applied.", error, {
            tabId: tabContext.tabId,
          });
        }
        return;
      }

      await runContentSelectionToggle(tabContext.tabId, true).catch((error: unknown) => {
        logIgnoredError("Unable to enable content selection.", error, { tabId: tabContext.tabId });
        setSelectModeEnabled(false);
        setToolMessage("Unable to connect to the active tab.", "error");
      });
    })
    .catch((error: unknown) => {
      logIgnoredError("Unable to read the active tab context for selection mode.", error, { enabled });
      setSelectModeEnabled(false);
      if (!shouldReportError) {
        return;
      }

      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendSelectParent = () => {
  logger.debug("request select parent");
  setToolMessage(null, "error");

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      const context = getSelectionContext();
      if (context.source === "devtools") {
        const response = await requestDevtoolsSelection(tabContext.tabId, "devtools:selection:parent");
        if (!response || !applyDevtoolsSelection(tabContext.tabId, response)) {
          setToolMessage(response?.error ?? "Unable to select parent element.", "error");
          return;
        }
        recordSelectedParentElement();
        return;
      }

      armSelectedElementRecordSuppression();
      let response: unknown = null;
      try {
        response = await sendSelectToolMessage(
          tabContext.tabId,
          {
            type: "select:parent",
          } satisfies SelectToolMessage,
          context.frameId ?? 0,
        );
      } catch (error) {
        clearSelectedElementRecordSuppression();
        logIgnoredError("Unable to send select:parent message.", error, { tabId: tabContext.tabId });
      }

      if (response === null) {
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      let selectorHint: string | null = null;
      if (isSelectParentResponse(response)) {
        if (!response.ok) {
          clearSelectedElementRecordSuppression();
          setToolMessage(response.error ?? "Unable to select parent element.", "error");
          return;
        }
        selectorHint = response.payload?.selector ?? null;
      }

      if (!selectorHint) {
        const currentSelection = get(selectedInfo);
        selectorHint = currentSelection?.selector ?? null;
      }

      recordSelectedParentElement(selectorHint);
    })
    .catch((error: unknown) => {
      logIgnoredError("Unable to read the active tab context for select parent.", error);
      clearSelectedElementRecordSuppression();
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendUndoLastRecordedAction = () => {
  logger.debug("request undo recorded action");
  setToolMessage(null, "error");
  void undoLastRecordedAction();
};

export const sendSelectorPopup = (
  mode: SelectorPopupMode = "pp-api",
  initialCssContent?: string,
  initialCode?: string,
) => {
  logger.debug("request selector popup open", { mode });
  setToolMessage(null, "error");
  const selection = get(selectedInfo);
  const context = getSelectionContext();

  const selectorValue = selection?.selector ?? "body";
  const resolvedInitialCode =
    initialCode !== undefined
      ? initialCode
      : mode === "pp-api"
        ? buildSelectorTemplateCode(selectorValue)
        : initialCssContent !== undefined
          ? initialCssContent
          : buildCssDocument(selectorValue, "");

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      let response: unknown = null;
      try {
        response = await sendSelectToolMessage(
          tabContext.tabId,
          {
            type: "selector:open",
            payload: selection,
            mode,
            initialCssContent,
            initialCode: resolvedInitialCode,
          } satisfies SelectToolMessage,
          context.frameId ?? 0,
        );
      } catch (error) {
        logIgnoredError("Unable to open selector popup.", error, { tabId: tabContext.tabId, mode });
      }

      if (response === null) {
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      if (isSelectorOpenResult(response) && !response.opened) {
        setToolMessage("Unable to open selector details for the selected element.", "error");
      }
    })
    .catch((error: unknown) => {
      logIgnoredError("Unable to read the active tab context for selector popup.", error, { mode });
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendApplyStylePopup = () => {
  logger.debug("request apply style popup");
  setToolMessage(null, "error");
  const selection = get(selectedInfo);
  const context = getSelectionContext();
  const selectorValue = selection?.selector ?? "body";
  const initialCssContent = buildCssDocument(selectorValue, "");

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      let response: unknown = null;
      try {
        response = await sendSelectToolMessage(
          tabContext.tabId,
          {
            type: "selector:open",
            payload: selection,
            mode: "css",
            initialCssContent,
            applyStyle: true,
          } satisfies SelectToolMessage,
          context.frameId ?? 0,
        );
      } catch (error) {
        logIgnoredError("Unable to open apply-style popup.", error, { tabId: tabContext.tabId });
      }

      if (response === null) {
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      if (isSelectorOpenResult(response) && !response.opened) {
        setToolMessage("Unable to open style editor for the selected element.", "error");
      }
    })
    .catch((error: unknown) => {
      logIgnoredError("Unable to read the active tab context for apply-style popup.", error);
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

const sendSelectionAction = (action: SelectElementAction) => {
  logger.debug("request selected element action", { action });
  setToolMessage(null, "error");

  const selection = get(selectedInfo);
  if (!selection) {
    setToolMessage("Select an element first.", "error");
    return;
  }

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext) {
        setToolMessage("No active tab found.", "error");
        return;
      }

      if (isRestrictedUrl(tabContext.url)) {
        setToolMessage("Selection is unavailable on this page.", "error");
        return;
      }

      const context = getSelectionContext();

      let pasteHtml: string | undefined;
      if (action === "paste") {
        if (!copyBufferHtml) {
          setToolMessage("Nothing to paste. Copy or cut an element first.", "error");
          return;
        }
        pasteHtml = copyBufferHtml;
      }

      let response: unknown = null;
      try {
        response = await sendSelectToolMessage(
          tabContext.tabId,
          {
            type: "select:action",
            action,
            pasteHtml,
          } satisfies SelectToolMessage,
          context.frameId ?? 0,
        );
      } catch (error) {
        logIgnoredError("Unable to send select element action.", error, { action, tabId: tabContext.tabId });
      }

      if (response === null) {
        setToolMessage("Unable to connect to the active tab.", "error");
        return;
      }

      if (!isSelectElementActionResult(response)) {
        setToolMessage("Unable to update the selected element.", "error");
        return;
      }

      if (!response.ok) {
        setToolMessage(response.error, "error");
        return;
      }

      if (response.html !== undefined) {
        copyBufferHtml = response.html;
      }

      if (action === "copy") {
        recordSidepanelAction("Copied element");
        return;
      }

      if (action === "cut") {
        const selectorDetail = get(selectedInfo)?.selector?.trim() ?? "";
        recordSidepanelAction("Cut element", selectorDetail ? `selector: ${selectorDetail}` : "");
        return;
      }

      if (action === "click") {
        recordSidepanelAction("Clicked element");
        return;
      }

      if (action === "paste") {
        recordSidepanelAction("Pasted element");
        return;
      }

      if (action === "delete") {
        recordSidepanelAction("Deleted element");
      }
    })
    .catch((error: unknown) => {
      logIgnoredError("Unable to read the active tab context for selected element action.", error, { action });
      setToolMessage("Unable to connect to the active tab.", "error");
    });
};

export const sendCopySelection = () => {
  sendSelectionAction("copy");
};

export const sendClickSelection = () => {
  sendSelectionAction("click");
};

export const sendCutSelection = () => {
  sendSelectionAction("cut");
};

export const sendPasteSelection = () => {
  sendSelectionAction("paste");
};

export const sendDeleteSelection = () => {
  sendSelectionAction("delete");
};
