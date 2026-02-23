import type { ElementInfo } from "./selection";

export const devtoolsSelectionPortName = "page-proxy:devtools-selection";

export type DevtoolsCommandAction = "get-selected" | "select-parent";

export type DevtoolsElementSelection = {
  info: ElementInfo;
  frameId: number | null;
  frameUrl: string | null;
  updatedAt: number;
};

export type DevtoolsSelectionCommandMessage = {
  type: "devtools:command";
  requestId: string;
  action: DevtoolsCommandAction;
};

export type DevtoolsSelectionCommandResultMessage = {
  type: "devtools:command:result";
  requestId: string;
  ok: boolean;
  selection: DevtoolsElementSelection | null;
  error?: string;
};

export type DevtoolsSelectionUpdateMessage = {
  type: "devtools:selection:update";
  tabId: number;
  selection: DevtoolsElementSelection | null;
};

export type DevtoolsSelectionPortMessage =
  | DevtoolsSelectionCommandMessage
  | DevtoolsSelectionCommandResultMessage
  | DevtoolsSelectionUpdateMessage;

export type DevtoolsSelectionStatusRequestMessage = {
  type: "devtools:status:get";
  tabId: number;
};

export type DevtoolsSelectionStatusResponseMessage = {
  open: boolean;
};

export type DevtoolsSelectionGetRequestMessage = {
  type: "devtools:selection:get";
  tabId: number;
};

export type DevtoolsSelectionParentRequestMessage = {
  type: "devtools:selection:parent";
  tabId: number;
};

export type DevtoolsSelectionResponseMessage = {
  ok: boolean;
  selection: DevtoolsElementSelection | null;
  error?: string;
};

export type DevtoolsSelectionChangedRuntimeMessage = {
  type: "devtools:selection:changed";
  tabId: number;
  selection: DevtoolsElementSelection | null;
};

export type DevtoolsSelectionStatusChangedRuntimeMessage = {
  type: "devtools:status:changed";
  tabId: number;
  open: boolean;
};

export type DevtoolsSelectionRuntimeMessage =
  | DevtoolsSelectionStatusRequestMessage
  | DevtoolsSelectionGetRequestMessage
  | DevtoolsSelectionParentRequestMessage
  | DevtoolsSelectionChangedRuntimeMessage
  | DevtoolsSelectionStatusChangedRuntimeMessage;
