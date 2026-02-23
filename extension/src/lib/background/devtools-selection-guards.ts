import type {
  DevtoolsSelectionCommandResultMessage,
  DevtoolsSelectionGetRequestMessage,
  DevtoolsSelectionParentRequestMessage,
  DevtoolsSelectionStatusRequestMessage,
  DevtoolsSelectionUpdateMessage,
} from "@/lib/devtools-selection";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isStatusRequestMessage = (value: unknown): value is DevtoolsSelectionStatusRequestMessage =>
  isRecord(value) && value.type === "devtools:status:get" && typeof value.tabId === "number";

export const isSelectionGetRequestMessage = (value: unknown): value is DevtoolsSelectionGetRequestMessage =>
  isRecord(value) && value.type === "devtools:selection:get" && typeof value.tabId === "number";

export const isSelectionParentRequestMessage = (value: unknown): value is DevtoolsSelectionParentRequestMessage =>
  isRecord(value) && value.type === "devtools:selection:parent" && typeof value.tabId === "number";

export const isSelectionUpdateMessage = (value: unknown): value is DevtoolsSelectionUpdateMessage =>
  isRecord(value) && value.type === "devtools:selection:update" && typeof value.tabId === "number" && "selection" in value;

export const isCommandResultMessage = (value: unknown): value is DevtoolsSelectionCommandResultMessage =>
  isRecord(value) &&
  value.type === "devtools:command:result" &&
  typeof value.requestId === "string" &&
  typeof value.ok === "boolean" &&
  "selection" in value;
