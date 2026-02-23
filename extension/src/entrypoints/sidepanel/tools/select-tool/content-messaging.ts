import { browser } from "wxt/browser";
import log from "loglevel";

import type { SelectToolMessage } from "@/lib/selection";

export type ActiveTabContext = {
  tabId: number;
  url: string | undefined;
};

const logger = log.getLogger("select-tool-messaging");
logger.setLevel("debug", false);

export const isRestrictedUrl = (url: string | undefined) => {
  if (!url) {
    return true;
  }

  const normalized = url.toLowerCase();
  return (
    normalized.startsWith("chrome://") ||
    normalized.startsWith("brave://") ||
    normalized.startsWith("edge://") ||
    normalized.startsWith("about:") ||
    normalized.startsWith("chrome-extension://") ||
    normalized.startsWith("moz-extension://") ||
    normalized.startsWith("view-source:")
  );
};

const injectSelectTool = (tabId: number) =>
  browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["content-scripts/select-tool.js"],
  });

const sendMessageToTab = async (
  tabId: number,
  message: SelectToolMessage,
  options?: { frameId: number },
): Promise<unknown> => {
  logger.debug("send select tool message", {
    tabId,
    frameId: options?.frameId ?? null,
    type: message.type,
  });
  const response: unknown = await browser.tabs.sendMessage(tabId, message, options);
  logger.debug("received select tool response", {
    tabId,
    frameId: options?.frameId ?? null,
    type: message.type,
  });
  return response;
};

export const readActiveTabContext = async (): Promise<ActiveTabContext | null> => {
  logger.debug("query active tab context");
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  const tabId = activeTab?.id;
  if (tabId === undefined) {
    return null;
  }

  return {
    tabId,
    url: activeTab?.url,
  };
};

export const sendSelectToolMessage = async (
  tabId: number,
  message: SelectToolMessage,
  frameId: number | null,
  allowInjectRetry = true,
): Promise<unknown> => {
  const options = frameId === null ? undefined : ({ frameId } as { frameId: number });

  try {
    return await sendMessageToTab(tabId, message, options);
  } catch (error) {
    logger.debug("select tool message failed, attempting inject retry", {
      tabId,
      frameId: frameId ?? null,
      type: message.type,
    });
    if (!allowInjectRetry) {
      throw error;
    }

    logger.debug("inject select tool content script", { tabId });
    await injectSelectTool(tabId);
    return sendMessageToTab(tabId, message, options);
  }
};

export const runContentSelectionToggle = async (tabId: number, enabled: boolean) => {
  await sendSelectToolMessage(
    tabId,
    {
      type: "select:toggle",
      enabled,
    } satisfies SelectToolMessage,
    0,
  );
};
