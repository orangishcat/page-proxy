import { browser } from "wxt/browser";
import log from "../../logger";
import { replaceAppState } from "../state.svelte";
import { hydrateAppState } from "./hydrate/hydrate";

const logger = log.getLogger("app-state-sync");

export const isAppStateStorageChange = (changes: Record<string, unknown>, areaName: string) => {
  if (areaName !== "local" && areaName !== "session") {
    return false;
  }

  return Object.keys(changes).some((key) => key.startsWith("pageproxy:") || key.startsWith("sidepanel:"));
};

export const syncAppStateFromStorage = async () => {
  const state = await hydrateAppState();
  replaceAppState(state);
  logger.debug("app-state synchronized from storage", {
    scriptCount: Object.keys(state.scriptsByName).length,
  });
};

export const startAppStateStorageSync = (waitUntilReady: Promise<unknown> = Promise.resolve()) => {
  let pendingSync = waitUntilReady;
  const handleStorageChange = (changes: Record<string, unknown>, areaName: string) => {
    if (!isAppStateStorageChange(changes, areaName)) {
      return;
    }

    pendingSync = pendingSync.then(syncAppStateFromStorage).catch((error: unknown) => {
      logger.error("app-state storage synchronization failed", { error });
    });
    return pendingSync;
  };

  browser.storage.onChanged.addListener(handleStorageChange);
  return () => browser.storage.onChanged.removeListener(handleStorageChange);
};
