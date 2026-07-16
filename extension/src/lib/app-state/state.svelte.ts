import { createDefaultAppState } from "./defaults";
import { createStateProxy, setAppStateHydrated } from "./storage/hydrate/hydration";
import type { AppState } from "./types";

export const appState: AppState = createStateProxy(createDefaultAppState());
export { isAppStateHydrated } from "./storage/hydrate/hydration";

export const replaceAppState = (nextState: AppState) => {
  appState.settings = nextState.settings;
  appState.sidepanel = nextState.sidepanel;
  appState.scriptsByName = nextState.scriptsByName;
  appState.recordPanelsByTabId = nextState.recordPanelsByTabId;
  appState.session = nextState.session;
  appState.currentTab.lastHydrationError = nextState.currentTab.lastHydrationError;
  appState.currentTab.lastPersistenceError = nextState.currentTab.lastPersistenceError;
  setAppStateHydrated(true);
};
