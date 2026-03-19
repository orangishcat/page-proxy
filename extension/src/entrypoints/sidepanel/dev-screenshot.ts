import log from "@/lib/logger";
import {
  buildDevScreenshotFileName,
  captureElementAsTransparentPng,
  downloadPngDataUrl,
  isDevScreenshotShortcut,
  takeDevScreenshots,
} from "@/lib/dev-screenshots";
import type { DevPopupScreenshotResult, SelectToolMessage } from "@/lib/selection";
import { getSelectionContext } from "./tools/select-tool/state";
import { isRestrictedUrl, readActiveTabContext, sendSelectToolMessage } from "./tools/select-tool/content-messaging";

type SidepanelScreenshotTargets = {
  sidepanel: Element | null;
  toolPanel: Element | null;
  codeEditor: Element | null;
};

const logger = log.getLogger("sidepanel-dev-screenshot");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isDevPopupScreenshotResult = (value: unknown): value is DevPopupScreenshotResult => {
  if (!isRecord(value) || typeof value.open !== "boolean") {
    return false;
  }

  if (!value.open) {
    return true;
  }

  return typeof value.name === "string" && typeof value.dataUrl === "string";
};

const requestPopupScreenshot = async (): Promise<DevPopupScreenshotResult | null> => {
  const tabContext = await readActiveTabContext();
  if (!tabContext || isRestrictedUrl(tabContext.url)) {
    return null;
  }

  const response = await sendSelectToolMessage(
    tabContext.tabId,
    {
      type: "dev:screenshot:popup",
    } satisfies SelectToolMessage,
    getSelectionContext().frameId ?? 0,
  ).catch((error: unknown) => {
    logger.debug("popup screenshot request failed", { error });
    return null;
  });

  if (!isDevPopupScreenshotResult(response)) {
    return null;
  }

  return response;
};

const detectSidepanelPopupCapture = () => {
  const selectActionsMenu = document.querySelector('[data-dev-screenshot-target="select-actions-menu"]');
  if (selectActionsMenu instanceof HTMLElement) {
    return {
      element: selectActionsMenu,
      name: "select-actions-menu" as const,
    };
  }

  return null;
};

export const takeSidepanelDevScreenshots = async (event: KeyboardEvent, targets: SidepanelScreenshotTargets) => {
  if (!import.meta.env.DEV || !isDevScreenshotShortcut(event)) {
    return "ignored" as const;
  }

  event.preventDefault();

  const timestamp = new Date();
  const popupResult = await requestPopupScreenshot();
  if (popupResult?.open) {
    downloadPngDataUrl(buildDevScreenshotFileName(popupResult.name, timestamp), popupResult.dataUrl);
    return "popup" as const;
  }

  if (!targets.sidepanel || !targets.toolPanel || !targets.codeEditor) {
    logger.error("missing sidepanel screenshot targets", {
      sidepanel: Boolean(targets.sidepanel),
      toolPanel: Boolean(targets.toolPanel),
      codeEditor: Boolean(targets.codeEditor),
    });
    return "ignored" as const;
  }

  const sidepanelTarget = targets.sidepanel;
  const toolPanelTarget = targets.toolPanel;
  const codeEditorTarget = targets.codeEditor;

  return takeDevScreenshots(event, {
    isDev: true,
    detectPopupCapture: () => Promise.resolve(detectSidepanelPopupCapture()),
    getSidepanelTargets: () => ({
      sidepanel: {
        element: sidepanelTarget,
        name: "sidepanel",
      },
      toolPanel: {
        element: toolPanelTarget,
        name: "tool-panel",
      },
      codeEditor: {
        element: codeEditorTarget,
        name: "code-editor",
      },
    }),
    capturePng: (target) => captureElementAsTransparentPng(target as Element),
    downloadPng: downloadPngDataUrl,
    now: () => timestamp,
  });
};
