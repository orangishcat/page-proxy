import { browser } from "wxt/browser";
import log from "./logger";
import { isAppStateHydrated } from "./app-state/storage/hydrate/hydration";

const loadAppState: () => Promise<typeof import("./app-state.ts")> = () => import("./app-state.ts");

export type SidePanelOpenTabs = Record<string, boolean>;

export const sidePanelStorageKey = "sidepanel:openTabs";

const logger = log.getLogger("sidepanel-state");

export const readSidePanelOpenTabs = async (): Promise<SidePanelOpenTabs> => {
  if (!isAppStateHydrated) {
    return browser.storage.session
      .get(sidePanelStorageKey)
      .then((stored: Record<string, unknown>) => {
        const openTabs = Object.fromEntries(
          Object.entries((stored[sidePanelStorageKey] as Record<string, unknown>) ?? {}).filter(
            ([, entryValue]) => typeof entryValue === "boolean",
          ),
        ) as SidePanelOpenTabs;
        logger.debug("readSidePanelOpenTabs", { openTabs });
        return openTabs;
      })
      .catch((error: unknown) => {
        logger.error("readSidePanelOpenTabs failed", error);
        throw error;
      });
  }

  const { appStateSelectors } = await loadAppState();
  const openTabs = appStateSelectors.getOpenTabsByTabId();
  logger.debug("readSidePanelOpenTabs", { openTabs });
  return openTabs;
};

export const writeSidePanelOpenTabs = async (openTabs: SidePanelOpenTabs) => {
  if (!isAppStateHydrated) {
    return browser.storage.session
      .set({ [sidePanelStorageKey]: openTabs })
      .then(() => {
        logger.debug("writeSidePanelOpenTabs", { openTabs });
      })
      .catch((error: unknown) => {
        logger.error("writeSidePanelOpenTabs failed", { openTabs, error });
        throw error;
      });
  }

  const { appState } = await loadAppState();
  appState.session.openTabsByTabId = { ...openTabs };
  logger.debug("writeSidePanelOpenTabs", { openTabs });
};

export const setSidePanelOpenForTab = async (tabId: number, isOpen: boolean) => {
  logger.debug("setSidePanelOpenForTab start", { tabId, isOpen });
  const { appStateActions } = await loadAppState();
  appStateActions.setSidePanelOpenForTab(tabId, isOpen);
  const next = await readSidePanelOpenTabs();
  logger.debug("setSidePanelOpenForTab done", { tabId, isOpen, openTabs: next });
  return next;
};

export const isSidePanelOpenForTab = async (tabId: number) => {
  const { appStateSelectors } = await loadAppState();
  const isOpen = Boolean(appStateSelectors.getOpenTabsByTabId()[String(tabId)]);
  logger.debug("isSidePanelOpenForTab", { tabId, isOpen });
  return isOpen;
};
