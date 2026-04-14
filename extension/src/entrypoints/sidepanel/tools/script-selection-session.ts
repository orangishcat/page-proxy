import { browser } from "wxt/browser";
import log from "../../../lib/logger";
import { isAppStateHydrated } from "../../../lib/app-state/hydration";

const loadAppState: () => Promise<typeof import("../../../lib/app-state.ts")> = () =>
  import("../../../lib/app-state.ts");

const logger = log.getLogger("script-selection-session");

export const buildSelectedScriptStorageKey = (hostname: string) => `sidepanel:${hostname.trim().toLowerCase()}`;

export const readSelectedScriptForHostname = async (hostname: string): Promise<string | null> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return null;
  }

  if (!isAppStateHydrated) {
    const storageKey = buildSelectedScriptStorageKey(normalizedHostname);
    const stored = await browser.storage.session.get(storageKey);
    const selectedScriptName = stored[storageKey];
    const resolvedValue =
      typeof selectedScriptName === "string" && selectedScriptName.trim().length > 0 ? selectedScriptName.trim() : null;
    logger.debug("readSelectedScriptForHostname", { hostname: normalizedHostname, selectedScriptName: resolvedValue });
    return resolvedValue;
  }

  const { appStateSelectors } = await loadAppState();
  const resolvedValue = appStateSelectors.getSelectedScriptForHostname(normalizedHostname);
  logger.debug("readSelectedScriptForHostname", { hostname: normalizedHostname, selectedScriptName: resolvedValue });
  return resolvedValue;
};

export const writeSelectedScriptForHostname = async (hostname: string, scriptName: string): Promise<void> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  const normalizedScriptName = scriptName.trim();
  if (!normalizedHostname || !normalizedScriptName) {
    return;
  }

  if (!isAppStateHydrated) {
    const storageKey = buildSelectedScriptStorageKey(normalizedHostname);
    await browser.storage.session.set({ [storageKey]: normalizedScriptName });
    logger.debug("writeSelectedScriptForHostname", { hostname: normalizedHostname, scriptName: normalizedScriptName });
    return;
  }

  const { appStateActions } = await loadAppState();
  appStateActions.setSelectedScriptForHostname(normalizedHostname, normalizedScriptName);
  logger.debug("writeSelectedScriptForHostname", { hostname: normalizedHostname, scriptName: normalizedScriptName });
};

export const clearSelectedScriptForHostname = async (hostname: string): Promise<void> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return;
  }

  if (!isAppStateHydrated) {
    const storageKey = buildSelectedScriptStorageKey(normalizedHostname);
    await browser.storage.session.remove(storageKey);
    logger.debug("clearSelectedScriptForHostname", { hostname: normalizedHostname });
    return;
  }

  const { appStateActions } = await loadAppState();
  appStateActions.clearSelectedScriptForHostname(normalizedHostname);
  logger.debug("clearSelectedScriptForHostname", { hostname: normalizedHostname });
};
