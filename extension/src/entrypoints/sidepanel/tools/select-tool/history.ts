import log from "@/lib/logger";
import type { SelectToolMessage } from "@/lib/selection";
import { findLastRecordedSelector } from "../record/actions";
import { popRecordPanelTimelineEntry } from "../record/state";
import type { RecordTimelineEntry } from "../state-storage";
import { setToolMessage } from "../tool-errors";
import { setSelection } from "./state";
import { isSelectParentResponse } from "./guards";
import {
  armSelectedElementRecordSuppression,
  clearSelectedElementRecordSuppression,
} from "./recording";
import {
  isRestrictedUrl,
  readActiveTabContext,
  sendSelectToolMessage,
} from "./content-messaging";

const logger = log.getLogger("select-tool-sidepanel");

const logIgnoredError = (message: string, error: unknown) => {
  logger.debug(message, { error });
};

export type RestoreSelectionBySelectorResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error?: string;
    };

export type UndoLastRecordedActionDeps = {
  popRecordedAction: () => {
    removed: RecordTimelineEntry | null;
    timeline: RecordTimelineEntry[];
  };
  restoreSelectionBySelector: (selector: string) => Promise<RestoreSelectionBySelectorResult>;
  suppressNextSelectedElementRecord: () => void;
  clearSelectedElementRecordSuppression: () => void;
  clearSelection: () => void | Promise<void>;
  setToolMessage: (message: string | null, status: "success" | "error") => void;
};

export const clearActiveSelection = async () => {
  setSelection(null);

  let tabContext = null;
  try {
    tabContext = await readActiveTabContext();
  } catch (error) {
    logIgnoredError("Unable to read active tab while clearing selection.", error);
  }

  if (!tabContext || isRestrictedUrl(tabContext.url)) {
    return;
  }

  try {
    await sendSelectToolMessage(
      tabContext.tabId,
      {
        type: "select:clear",
      } satisfies SelectToolMessage,
      0,
    );
  } catch (error) {
    logIgnoredError("Unable to send select:clear message.", error);
  }
};

const restoreSelectionBySelector = async (selector: string): Promise<RestoreSelectionBySelectorResult> => {
  const normalizedSelector = selector.trim();
  if (!normalizedSelector) {
    return {
      ok: false,
      error: "Unable to restore the previous recorded selection.",
    };
  }

  const tabContext = await readActiveTabContext();
  if (!tabContext) {
    return {
      ok: false,
      error: "No active tab found.",
    };
  }

  if (isRestrictedUrl(tabContext.url)) {
    return {
      ok: false,
      error: "Selection is unavailable on this page.",
    };
  }

  let response: unknown = null;
  try {
    response = await sendSelectToolMessage(
      tabContext.tabId,
      {
        type: "select:restore",
        selector: normalizedSelector,
      } satisfies SelectToolMessage,
      0,
    );
  } catch (error) {
    logIgnoredError("Unable to send select:restore message.", error);
  }

  if (response === null) {
    return {
      ok: false,
      error: "Unable to connect to the active tab.",
    };
  }

  if (!isSelectParentResponse(response)) {
    return {
      ok: false,
      error: "Unable to restore the previous selected element.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: response.error ?? "Unable to restore the previous selected element.",
    };
  }

  return { ok: true };
};

const defaultUndoLastRecordedActionDeps: UndoLastRecordedActionDeps = {
  popRecordedAction: popRecordPanelTimelineEntry,
  restoreSelectionBySelector,
  suppressNextSelectedElementRecord: armSelectedElementRecordSuppression,
  clearSelectedElementRecordSuppression,
  clearSelection: clearActiveSelection,
  setToolMessage,
};

export const undoLastRecordedAction = async (deps: UndoLastRecordedActionDeps = defaultUndoLastRecordedActionDeps) => {
  const { removed, timeline } = deps.popRecordedAction();
  if (!removed) {
    deps.setToolMessage("No recorded action to undo.", "error");
    return;
  }

  const selectorToRestore = findLastRecordedSelector(timeline);
  if (!selectorToRestore) {
    await deps.clearSelection();
    return;
  }

  deps.suppressNextSelectedElementRecord();
  const restoreResult = await deps.restoreSelectionBySelector(selectorToRestore);
  if (!restoreResult.ok) {
    deps.clearSelectedElementRecordSuppression();
    deps.setToolMessage(`Undid ${removed.action}, but couldn't restore the previous recorded selection.`, "error");
  }
};
