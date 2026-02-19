import { writable } from "svelte/store";
import { browser } from "wxt/browser";

import { coerceScriptGrantValues, type ScriptGrantValue } from "@/lib/grants";
import { matchWebsiteGlob } from "@/lib/utils/website-glob";

export type ToolId = "select" | "create" | "selectors" | "help" | "share" | "none";

export type StoredSelectorEntry = {
  name: string;
  ruleKeys: string[];
  rules?: string[];
};

export type StoredToolState = {
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

const storageKeyPrefix = "pageproxy:";
const toolPanelHeightStorageKey = "sidepanel:toolPanelHeightPx";
const helpBannerDismissedStorageKey = "sidepanel:helpBannerDismissed";
const userscriptReloadBannerDismissedStorageKey = "sidepanel:userscriptReloadBannerDismissed";

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

export const toStorageKey = (websiteGlob: string) => `${storageKeyPrefix}${websiteGlob.trim()}`;

export const fromStorageKey = (key: string) => {
  if (!key.startsWith(storageKeyPrefix)) {
    return null;
  }

  const websiteGlob = key.slice(storageKeyPrefix.length).trim();
  return websiteGlob.length > 0 ? websiteGlob : null;
};

const coerceStoredToolState = (value: unknown, websiteGlob: string): StoredToolState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as {
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

  return {
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
      typeof data.websiteGlob === "string" && data.websiteGlob.trim().length > 0 ? data.websiteGlob : websiteGlob,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
};

export const activeToolState = writable<ToolId>("none");
export const allowedScriptGrantsState = writable<ScriptGrantValue[]>([]);

export const listStoredToolStates = async () => {
  const allValues = await browser.storage.local.get(null);
  const states: Array<{ websiteGlob: string; state: StoredToolState }> = [];

  Object.entries(allValues).forEach(([key, value]) => {
    const websiteGlob = fromStorageKey(key);
    if (!websiteGlob) {
      return;
    }

    const state = coerceStoredToolState(value, websiteGlob);
    if (!state) {
      return;
    }

    states.push({ websiteGlob, state });
  });

  return states;
};

export const saveStoredToolState = async (state: StoredToolState) => {
  const key = toStorageKey(state.websiteGlob);
  await browser.storage.local.set({
    [key]: state,
  });
};

export const removeStoredToolState = async (websiteGlob: string) => {
  const normalized = websiteGlob.trim();
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
  return browser.storage.local
    .get(helpBannerDismissedStorageKey)
    .then((stored) => stored[helpBannerDismissedStorageKey] === true)
    .catch(() => false);
};

export const saveHelpBannerDismissedSetting = async (dismissed: boolean) => {
  await browser.storage.local
    .set({
      [helpBannerDismissedStorageKey]: dismissed,
    })
    .catch(() => undefined);
};

export const readUserscriptReloadBannerDismissedSetting = async () => {
  return browser.storage.local
    .get(userscriptReloadBannerDismissedStorageKey)
    .then((stored) => stored[userscriptReloadBannerDismissedStorageKey] === true)
    .catch(() => false);
};

export const saveUserscriptReloadBannerDismissedSetting = async (dismissed: boolean) => {
  await browser.storage.local
    .set({
      [userscriptReloadBannerDismissedStorageKey]: dismissed,
    })
    .catch(() => undefined);
};

export const findStoredToolStateForUrl = async (url: string) => {
  const states = await listStoredToolStates();
  const matches = states
    .filter((entry) => matchWebsiteGlob(entry.websiteGlob, url))
    .sort((left, right) => right.websiteGlob.length - left.websiteGlob.length);

  return matches[0] ?? null;
};
