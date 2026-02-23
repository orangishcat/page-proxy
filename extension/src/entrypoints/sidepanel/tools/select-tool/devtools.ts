import { browser } from "wxt/browser";

import type {
  DevtoolsSelectionChangedRuntimeMessage,
  DevtoolsSelectionResponseMessage,
  DevtoolsSelectionStatusChangedRuntimeMessage,
  DevtoolsSelectionStatusResponseMessage,
} from "@/lib/devtools-selection";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isStatusResponse = (value: unknown): value is DevtoolsSelectionStatusResponseMessage =>
  isRecord(value) && typeof value.open === "boolean";

const isDevtoolsSelectionResponse = (value: unknown): value is DevtoolsSelectionResponseMessage =>
  isRecord(value) && typeof value.ok === "boolean" && "selection" in value;

export const isDevtoolsSelectionChangedMessage = (value: unknown): value is DevtoolsSelectionChangedRuntimeMessage =>
  isRecord(value) && value.type === "devtools:selection:changed" && typeof value.tabId === "number" && "selection" in value;

export const isDevtoolsStatusChangedMessage = (value: unknown): value is DevtoolsSelectionStatusChangedRuntimeMessage =>
  isRecord(value) && value.type === "devtools:status:changed" && typeof value.tabId === "number" && typeof value.open === "boolean";

export const requestDevtoolsStatus = async (tabId: number) => {
  const response: unknown = await browser.runtime
    .sendMessage({
      type: "devtools:status:get",
      tabId,
    })
    .catch(() => null);

  if (!isStatusResponse(response)) {
    return false;
  }

  return response.open;
};

export const requestDevtoolsSelection = async (
  tabId: number,
  type: "devtools:selection:get" | "devtools:selection:parent",
) => {
  const response: unknown = await browser.runtime
    .sendMessage({
      type,
      tabId,
    })
    .catch(() => null);

  if (!isDevtoolsSelectionResponse(response)) {
    return null;
  }

  return response;
};
