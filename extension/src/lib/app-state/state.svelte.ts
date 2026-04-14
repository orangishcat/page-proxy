import { createDefaultAppState } from "./defaults";
import {
  createStateProxy,
  setAppStateHydrated as setAppStateHydratedFlag,
  setApplyingRemoteSync as setApplyingRemoteSyncFlag,
} from "./storage/hydrate/hydration";
import type { AppState } from "./types";

export const appState: AppState = createStateProxy(createDefaultAppState());
export let isAppStateHydrated: boolean = false;
export let isApplyingRemoteSync: boolean = false;

export const replaceAppState = (nextState: AppState) => {
  appState.settings = nextState.settings;
  appState.sidepanel = nextState.sidepanel;
  appState.scriptsByName = nextState.scriptsByName;
  appState.recordPanelsByTabId = nextState.recordPanelsByTabId;
  appState.session = nextState.session;
  appState.currentTab = nextState.currentTab;
  isAppStateHydrated = true;
  setAppStateHydratedFlag(true);
};

export const setApplyingRemoteSync = (value: boolean) => {
  isApplyingRemoteSync = value;
  setApplyingRemoteSyncFlag(value);
};
