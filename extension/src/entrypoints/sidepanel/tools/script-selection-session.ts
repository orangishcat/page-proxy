import { browser } from "wxt/browser";
import log from "@/lib/logger";

const logger = log.getLogger("script-selection-session");

export const buildSelectedScriptStorageKey = (hostname: string) => `sidepanel:${hostname.trim().toLowerCase()}`;

export const readSelectedScriptForHostname = async (hostname: string): Promise<string | null> => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return null;
  }

  const storageKey = buildSelectedScriptStorageKey(normalizedHostname);
  const stored = await browser.storage.session.get(storageKey);
  const selectedScriptName = stored[storageKey];
  const resolvedValue = typeof selectedScriptName === "string" && selectedScriptName.trim().length > 0
    ? selectedScriptName.trim()
    : null;
  logger.debug("readSelectedScriptForHostname", { hostname: normalizedHostname, selectedScriptName: resolvedValue });
  return resolvedValue;
};

export const writeSelectedScriptForHostname = async (hostname: string, scriptName: string) => {
  const normalizedHostname = hostname.trim().toLowerCase();
  const normalizedScriptName = scriptName.trim();
  if (!normalizedHostname || !normalizedScriptName) {
    return;
  }

  const storageKey = buildSelectedScriptStorageKey(normalizedHostname);
  await browser.storage.session.set({ [storageKey]: normalizedScriptName });
  logger.debug("writeSelectedScriptForHostname", { hostname: normalizedHostname, scriptName: normalizedScriptName });
};

export const clearSelectedScriptForHostname = async (hostname: string) => {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return;
  }

  const storageKey = buildSelectedScriptStorageKey(normalizedHostname);
  await browser.storage.session.remove(storageKey);
  logger.debug("clearSelectedScriptForHostname", { hostname: normalizedHostname });
};
