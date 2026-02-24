import { writable } from "svelte/store";
import { browser } from "wxt/browser";

import { coerceScriptGrantValues, type ScriptGrantValue } from "@/lib/grants";
import { parseScriptMetadata } from "@/lib/utils/script-metadata";
import { matchWebsiteGlob } from "@/lib/utils/website-glob";
import { createSidepanelBannerManager, type BannerDefinition } from "../banners/banner-manager";

export type ToolId = "select" | "create" | "selectors" | "help" | "share" | "none";

export type StoredSelectorEntry = {
  name: string;
  ruleKeys: string[];
  rules?: string[];
};

export type StoredToolState = {
  scriptName: string;
  activeTool: ToolId;
  codeEditor: {
    content: string;
  };
  selectorPanel: {
    entries: StoredSelectorEntry[];
  };
  permissions: {
    allowedGrants: ScriptGrantValue[];
  };
  websiteGlob: string;
  updatedAt: number;
};

type StoredStateMatch = {
  scriptName: string;
  matchedWebsiteGlob: string;
  state: StoredToolState;
};

const storageKeyPrefix = "pageproxy:";
const toolPanelHeightStorageKey = "sidepanel:toolPanelHeightPx";
const helpBannerDismissedStorageKey = "sidepanel:helpBannerDismissed";
const userscriptReloadBannerDismissedStorageKey = "sidepanel:userscriptReloadBannerDismissed";
const sidepanelBannerManager = createSidepanelBannerManager();
const helpBanner: BannerDefinition = {
  id: "helpBannerDismissed",
  storageKey: helpBannerDismissedStorageKey,
};
const userscriptReloadBanner: BannerDefinition = {
  id: "userscriptReloadBannerDismissed",
  storageKey: userscriptReloadBannerDismissedStorageKey,
};

const isToolId = (value: unknown): value is ToolId =>
  value === "select" ||
  value === "create" ||
  value === "selectors" ||
  value === "help" ||
  value === "share" ||
  value === "none";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const coerceStoredSelectorEntries = (value: unknown): StoredSelectorEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: StoredSelectorEntry[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }

    const data = entry as {
      name?: unknown;
      ruleKeys?: unknown;
      rules?: unknown;
    };

    if (typeof data.name !== "string" || !isStringArray(data.ruleKeys)) {
      return;
    }

    const rules = isStringArray(data.rules) ? data.rules : undefined;
    entries.push({
      name: data.name,
      ruleKeys: data.ruleKeys,
      rules,
    });
  });

  return entries;
};

export const toStorageKey = (scriptName: string) => `${storageKeyPrefix}${scriptName.trim()}`;

export const fromStorageKey = (key: string) => {
  if (!key.startsWith(storageKeyPrefix)) {
    return null;
  }

  const scriptName = key.slice(storageKeyPrefix.length).trim();
  return scriptName.length > 0 ? scriptName : null;
};

const resolveMetadataFallback = (content: string) => {
  try {
    return parseScriptMetadata(content);
  } catch {
    return null;
  }
};

const getWebsiteGlobsFromContent = (content: string) => {
  const metadata = resolveMetadataFallback(content);
  if (!metadata) {
    return [];
  }

  const websites = metadata.websites
    .map((website) => website.trim())
    .filter((website) => website.length > 0);
  if (websites.length > 0) {
    return websites;
  }

  const website = metadata.website.trim();
  return website.length > 0 ? [website] : [];
};

const findBestMatchingWebsiteGlob = (websiteGlobs: string[], url: string) => {
  return websiteGlobs
    .filter((websiteGlob) => matchWebsiteGlob(websiteGlob, url))
    .sort((left, right) => right.length - left.length)[0] ?? null;
};

const coerceStoredToolState = (value: unknown, scriptNameFromKey: string): StoredToolState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as {
    scriptName?: unknown;
    activeTool?: unknown;
    codeEditor?: unknown;
    selectorPanel?: unknown;
    permissions?: unknown;
    websiteGlob?: unknown;
    updatedAt?: unknown;
  };

  if (!isToolId(data.activeTool)) {
    return null;
  }

  const codeEditor = data.codeEditor as { content?: unknown } | undefined;
  if (typeof codeEditor?.content !== "string") {
    return null;
  }

  const selectorPanel = data.selectorPanel as { entries?: unknown } | undefined;
  const permissions = data.permissions as { allowedGrants?: unknown } | undefined;
  const metadata = resolveMetadataFallback(codeEditor.content);
  const metadataScriptName = metadata?.title?.trim() ?? "";
  const resolvedScriptName =
    typeof data.scriptName === "string" && data.scriptName.trim().length > 0
      ? data.scriptName.trim()
      : metadataScriptName.length > 0
        ? metadataScriptName
        : scriptNameFromKey;

  const metadataWebsites = metadata?.websites.map((website) => website.trim()).filter((website) => website.length > 0) ?? [];
  const metadataWebsite = metadata?.website?.trim() ?? "";
  const fallbackWebsiteGlob = metadataWebsites[0] ?? metadataWebsite;

  return {
    scriptName: resolvedScriptName,
    activeTool: data.activeTool,
    codeEditor: {
      content: codeEditor.content,
    },
    selectorPanel: {
      entries: coerceStoredSelectorEntries(selectorPanel?.entries),
    },
    permissions: {
      allowedGrants: coerceScriptGrantValues(permissions?.allowedGrants),
    },
    websiteGlob:
      typeof data.websiteGlob === "string" && data.websiteGlob.trim().length > 0 ? data.websiteGlob : fallbackWebsiteGlob,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
};

export const activeToolState = writable<ToolId>("none");
export const allowedScriptGrantsState = writable<ScriptGrantValue[]>([]);

export const listStoredToolStates = async () => {
  const allValues = await browser.storage.local.get(null);
  const dedupedStates = new Map<string, { scriptName: string; state: StoredToolState }>();

  Object.entries(allValues).forEach(([key, value]) => {
    const scriptName = fromStorageKey(key);
    if (!scriptName) {
      return;
    }

    const state = coerceStoredToolState(value, scriptName);
    if (!state) {
      return;
    }

    const existing = dedupedStates.get(state.scriptName);
    if (!existing || state.updatedAt >= existing.state.updatedAt) {
      dedupedStates.set(state.scriptName, { scriptName: state.scriptName, state });
    }
  });

  return Array.from(dedupedStates.values());
};

export const saveStoredToolState = async (state: StoredToolState) => {
  const key = toStorageKey(state.scriptName);
  await browser.storage.local.set({
    [key]: state,
  });
};

export const removeStoredToolState = async (scriptName: string) => {
  const normalized = scriptName.trim();
  if (!normalized) {
    return;
  }

  await browser.storage.local.remove(toStorageKey(normalized));
};

const coerceToolPanelHeight = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return value;
};

export const readToolPanelHeightSetting = async () => {
  return browser.storage.local
    .get(toolPanelHeightStorageKey)
    .then((stored) => coerceToolPanelHeight(stored[toolPanelHeightStorageKey]))
    .catch(() => null);
};

export const saveToolPanelHeightSetting = async (height: number) => {
  const normalizedHeight = coerceToolPanelHeight(height);
  if (normalizedHeight === null) {
    return;
  }

  await browser.storage.local
    .set({
      [toolPanelHeightStorageKey]: normalizedHeight,
    })
    .catch(() => undefined);
};

export const readHelpBannerDismissedSetting = async () => {
  return sidepanelBannerManager.isDismissed(helpBanner);
};

export const saveHelpBannerDismissedSetting = async (dismissed: boolean) => {
  if (dismissed) {
    await sidepanelBannerManager.dismiss(helpBanner);
    return;
  }

  await sidepanelBannerManager.reset(helpBanner);
};

export const readUserscriptReloadBannerDismissedSetting = async () => {
  return sidepanelBannerManager.isDismissed(userscriptReloadBanner);
};

export const saveUserscriptReloadBannerDismissedSetting = async (dismissed: boolean) => {
  if (dismissed) {
    await sidepanelBannerManager.dismiss(userscriptReloadBanner);
    return;
  }

  await sidepanelBannerManager.reset(userscriptReloadBanner);
};

export const findStoredToolStateForUrl = async (url: string) => {
  const states = await listStoredToolStates();
  const matches: StoredStateMatch[] = [];

  states.forEach((entry) => {
    const websiteGlobs = getWebsiteGlobsFromContent(entry.state.codeEditor.content);
    const matchedWebsiteGlob = findBestMatchingWebsiteGlob(websiteGlobs, url);
    if (!matchedWebsiteGlob) {
      return;
    }

    matches.push({
      scriptName: entry.state.scriptName,
      matchedWebsiteGlob,
      state: entry.state,
    });
  });

  return (
    matches.sort((left, right) => {
      const byGlobLength = right.matchedWebsiteGlob.length - left.matchedWebsiteGlob.length;
      if (byGlobLength !== 0) {
        return byGlobLength;
      }

      return right.state.updatedAt - left.state.updatedAt;
    })[0] ?? null
  );
};
