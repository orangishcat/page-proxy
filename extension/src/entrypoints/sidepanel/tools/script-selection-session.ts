import log from "../../../lib/logger";
import { appStateActions } from "../../../lib/app-state/actions.ts";
import { appStateSelectors } from "../../../lib/app-state/selectors.ts";

const logger = log.getLogger("script-selection-session");

export const buildSelectedScriptStorageKey = (hostname: string) => `sidepanel:${hostname.trim().toLowerCase()}`;

export const readSelectedScriptForHostname = (hostname: string): Promise<string | null> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return Promise.resolve(null);
  }

  const resolvedValue = appStateSelectors.getSelectedScriptForHostname(normalizedHostname);
  logger.debug("readSelectedScriptForHostname", { hostname: normalizedHostname, selectedScriptName: resolvedValue });
  return Promise.resolve(resolvedValue);
};

export const writeSelectedScriptForHostname = (hostname: string, scriptName: string): Promise<void> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  const normalizedScriptName = scriptName.trim();
  if (!normalizedHostname || !normalizedScriptName) {
    return Promise.resolve();
  }

  appStateActions.setSelectedScriptForHostname(normalizedHostname, normalizedScriptName);
  logger.debug("writeSelectedScriptForHostname", { hostname: normalizedHostname, scriptName: normalizedScriptName });
  return Promise.resolve();
};

export const clearSelectedScriptForHostname = (hostname: string): Promise<void> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return Promise.resolve();
  }

  appStateActions.clearSelectedScriptForHostname(normalizedHostname);
  logger.debug("clearSelectedScriptForHostname", { hostname: normalizedHostname });
  return Promise.resolve();
};
