import type {
  DevtoolsSelectionCommandResultMessage,
  DevtoolsSelectionGetRequestMessage,
  DevtoolsSelectionParentRequestMessage,
  DevtoolsSelectionStatusRequestMessage,
  DevtoolsSelectionUpdateMessage,
} from "@/lib/devtools-selection";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasType = <T extends string>(value: unknown, type: T): value is { type: T } =>
  isRecord(value) && value.type === type;

export const isStatusRequestMessage = (value: unknown): value is DevtoolsSelectionStatusRequestMessage =>
  hasType(value, "devtools:status:get") && typeof value.tabId === "number";

export const isSelectionGetRequestMessage = (value: unknown): value is DevtoolsSelectionGetRequestMessage =>
  hasType(value, "devtools:selection:get") && typeof value.tabId === "number";

export const isSelectionParentRequestMessage = (value: unknown): value is DevtoolsSelectionParentRequestMessage =>
  hasType(value, "devtools:selection:parent") && typeof value.tabId === "number";

export const isSelectionUpdateMessage = (value: unknown): value is DevtoolsSelectionUpdateMessage =>
  hasType(value, "devtools:selection:update") && typeof value.tabId === "number" && "selection" in value;

export const isCommandResultMessage = (value: unknown): value is DevtoolsSelectionCommandResultMessage =>
  hasType(value, "devtools:command:result") &&
  typeof value.requestId === "string" &&
  typeof value.ok === "boolean" &&
  "selection" in value;

