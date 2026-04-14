import { debounce } from "perfect-debounce";
import log from "../logger";
import { appState } from "./state.svelte";
import { appStatePersistHandler } from "./persist-registry";

const logger = log.getLogger("app-state-persist");

const persistNow = async () => {
  try {
    await appStatePersistHandler.checkPersist();
    appState.currentTab.lastPersistenceError = null;
  } catch (error) {
    logger.error("persist failed", { error });
    appState.currentTab.lastPersistenceError = error instanceof Error ? error.message : "Unable to persist app state.";
    throw error;
  }
};

export const flushAppStatePersistence = debounce(persistNow, 1000);
