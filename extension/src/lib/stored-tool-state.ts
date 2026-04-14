import { coerceScriptGrantValues, type ScriptGrantValue } from "./grants";
import {
  coerceStoredRuntimeStorage,
  createEmptyStoredRuntimeStorage,
  type StoredRuntimeStorage,
} from "./script-runtime-storage";
import { parseScriptMetadata } from "./utils/script-metadata";
import { matchWebsiteGlob } from "./utils/website-glob";

export type ToolId = "select" | "create" | "selectors" | "record" | "settings" | "help" | "share" | "none";

export type StoredSelectorEntry = {
  name: string;
  ruleKeys: string[];
  rules?: string[];
  mode?: "pp-api" | "css";
  cssText?: string;
};

export type StoredToolState = {
  scriptName: string;
  activeTool: ToolId;
  codeEditor: { content: string };
  selectorPanel: { entries: StoredSelectorEntry[] };
  permissions: {
    allowedGrants: ScriptGrantValue[];
    enabled: boolean;
  };
  websiteGlob: string;
  updatedAt: number;
  runtimeStorage: StoredRuntimeStorage;
};

export const storageKeyPrefix = "pageproxy:";

export const isToolId = (value: unknown): value is ToolId =>
  value === "select" ||
  value === "create" ||
  value === "selectors" ||
  value === "record" ||
  value === "settings" ||
  value === "help" ||
  value === "share" ||
  value === "none";

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const coerceStoredSelectorEntries = (value: unknown): StoredSelectorEntry[] => {
  if (!Array.isArray(value)) return [];
  const entries: StoredSelectorEntry[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const data = entry as { name?: unknown; ruleKeys?: unknown; rules?: unknown; mode?: unknown; cssText?: unknown };
    if (typeof data.name !== "string" || !isStringArray(data.ruleKeys)) return;
    const rules = isStringArray(data.rules) ? data.rules : undefined;
    const mode = data.mode === "pp-api" || data.mode === "css" ? data.mode : undefined;
    const cssText = typeof data.cssText === "string" ? data.cssText : undefined;
    entries.push({ name: data.name, ruleKeys: data.ruleKeys, rules, mode, cssText });
  });
  return entries;
};

export const toStorageKey = (scriptName: string) => `${storageKeyPrefix}${scriptName.trim()}`;

export const fromStorageKey = (key: string) => {
  if (!key.startsWith(storageKeyPrefix)) return null;
  const scriptName = key.slice(storageKeyPrefix.length).trim();
  return scriptName.length > 0 ? scriptName : null;
};

export const resolveMetadataFallback = (content: string) => {
  try {
    return parseScriptMetadata(content);
  } catch {
    return null;
  }
};

export const getWebsiteGlobsFromContent = (content: string) => {
  const metadata = resolveMetadataFallback(content);
  if (!metadata) return [];
  const websites = metadata.websites.map((w) => w.trim()).filter((w) => w.length > 0);
  if (websites.length > 0) return websites;
  const website = metadata.website.trim();
  return website.length > 0 ? [website] : [];
};

export const findBestMatchingWebsiteGlob = (websiteGlobs: string[], url: string) =>
  websiteGlobs.filter((glob) => matchWebsiteGlob(glob, url)).sort((a, b) => b.length - a.length)[0] ?? null;

export const coerceStoredToolState = (value: unknown, scriptNameFromKey: string): StoredToolState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as {
    scriptName?: unknown;
    activeTool?: unknown;
    codeEditor?: unknown;
    selectorPanel?: unknown;
    permissions?: unknown;
    websiteGlob?: unknown;
    updatedAt?: unknown;
    runtimeStorage?: unknown;
  };
  if (!isToolId(data.activeTool)) return null;
  const codeEditor = data.codeEditor as { content?: unknown } | undefined;
  if (typeof codeEditor?.content !== "string") return null;
  const selectorPanel = data.selectorPanel as { entries?: unknown } | undefined;
  const permissions = data.permissions as { allowedGrants?: unknown; enabled?: unknown } | undefined;
  const metadata = resolveMetadataFallback(codeEditor.content);
  const metadataScriptName = metadata?.title?.trim() ?? "";
  const resolvedScriptName =
    typeof data.scriptName === "string" && data.scriptName.trim().length > 0
      ? data.scriptName.trim()
      : metadataScriptName.length > 0
        ? metadataScriptName
        : scriptNameFromKey;
  const metadataWebsites = metadata?.websites.map((w) => w.trim()).filter((w) => w.length > 0) ?? [];
  const metadataWebsite = metadata?.website?.trim() ?? "";
  const fallbackWebsiteGlob = metadataWebsites[0] ?? metadataWebsite;
  return {
    scriptName: resolvedScriptName,
    activeTool: data.activeTool,
    codeEditor: { content: codeEditor.content },
    selectorPanel: { entries: coerceStoredSelectorEntries(selectorPanel?.entries) },
    permissions: {
      allowedGrants: coerceScriptGrantValues(permissions?.allowedGrants),
      enabled: permissions?.enabled !== false,
    },
    websiteGlob:
      typeof data.websiteGlob === "string" && data.websiteGlob.trim().length > 0
        ? data.websiteGlob
        : fallbackWebsiteGlob,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
    runtimeStorage: data.runtimeStorage
      ? coerceStoredRuntimeStorage(data.runtimeStorage)
      : createEmptyStoredRuntimeStorage(),
  };
};

export const normalizeStoredToolState = (state: StoredToolState): StoredToolState => ({
  ...state,
  permissions: {
    ...state.permissions,
    allowedGrants: coerceScriptGrantValues(state.permissions.allowedGrants),
  },
});
