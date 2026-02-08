import { writable } from "svelte/store";
import { browser } from "wxt/browser";

import { matchWebsiteGlob } from "@/lib/utils/website-glob";

export type ToolId = "select" | "new-element" | "selectors" | "help" | "share" | "none";

export type StoredToolState = {
  activeTool: ToolId;
  codeEditor: {
    content: string;
  };
  websiteGlob: string;
  updatedAt: number;
};

const storageKeyPrefix = "pageproxy:";
const legacyBrowserStorageKeys = [
  "page-proxy:sidepanel:scripts",
  "page-proxy:sidepanel:script",
  "page-proxy:sidepanel:tab-code-states",
  "page-proxy:sidepanel:tab-tool-states",
];

const isToolId = (value: unknown): value is ToolId =>
  value === "select" ||
  value === "new-element" ||
  value === "selectors" ||
  value === "help" ||
  value === "share" ||
  value === "none";

const toStorageKey = (websiteGlob: string) => `${storageKeyPrefix}${websiteGlob}`;

const fromStorageKey = (key: string) => {
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

  return {
    activeTool: data.activeTool,
    codeEditor: {
      content: codeEditor.content,
    },
    websiteGlob:
      typeof data.websiteGlob === "string" && data.websiteGlob.trim().length > 0 ? data.websiteGlob : websiteGlob,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
};

const readStoredState = (websiteGlob: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(toStorageKey(websiteGlob));
  if (!raw || !raw.trim().startsWith("{")) {
    return null;
  }

  const parsed = JSON.parse(raw) as unknown;
  return coerceStoredToolState(parsed, websiteGlob);
};

const listStoredStates = () => {
  if (typeof window === "undefined") {
    return [];
  }

  const states: Array<{ websiteGlob: string; state: StoredToolState }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }

    const websiteGlob = fromStorageKey(key);
    if (!websiteGlob) {
      continue;
    }

    const state = readStoredState(websiteGlob);
    if (!state) {
      continue;
    }

    states.push({ websiteGlob, state });
  }

  return states;
};

export const activeToolState = writable<ToolId>("none");

export const saveStoredToolState = (state: StoredToolState) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(toStorageKey(state.websiteGlob), JSON.stringify(state));
};

export const removeStoredToolState = (websiteGlob: string) => {
  if (typeof window === "undefined" || !websiteGlob.trim()) {
    return;
  }
  window.localStorage.removeItem(toStorageKey(websiteGlob));
};

export const findStoredToolStateForUrl = (url: string) => {
  const matches = listStoredStates()
    .filter((entry) => matchWebsiteGlob(entry.websiteGlob, url))
    .sort((left, right) => right.websiteGlob.length - left.websiteGlob.length);

  return matches[0] ?? null;
};
