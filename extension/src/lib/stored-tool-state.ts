import { z } from "zod";
import { ScriptGrantValuesSchema, type ScriptGrantValue } from "./grants";
import {
  createEmptyStoredRuntimeStorage,
  StoredRuntimeStorageSchema,
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

export const ToolIdSchema = z.enum(["select", "create", "selectors", "record", "settings", "help", "share", "none"]);

const StoredSelectorEntrySchema = z
  .object({
    name: z.string().catch(""),
    ruleKeys: z.array(z.string()).catch([]),
    rules: z.array(z.string()).optional(),
    mode: z.enum(["pp-api", "css"]).optional(),
    cssText: z.string().optional(),
  })
  .passthrough();

const StoredSelectorEntriesSchema = z.array(StoredSelectorEntrySchema).catch([]).transform((entries) =>
  entries.filter((entry) => entry.name.trim().length > 0 && entry.ruleKeys.length > 0),
);

export const StoredToolStateSchema = z
  .object({
    scriptName: z.string().catch(""),
    codeEditor: z.object({ content: z.string().catch("") }).catch({ content: "" }),
    selectorPanel: z.object({ entries: StoredSelectorEntriesSchema }).catch({ entries: [] }),
    permissions: z
      .object({
        allowedGrants: ScriptGrantValuesSchema,
        enabled: z.boolean().catch(true),
      })
      .catch({ allowedGrants: [], enabled: true }),
    websiteGlob: z.string().catch(""),
    updatedAt: z.unknown().transform((value) => (typeof value === "number" && Number.isFinite(value) ? value : Date.now())),
    runtimeStorage: StoredRuntimeStorageSchema.catch(createEmptyStoredRuntimeStorage()),
  })
  .passthrough();

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
  const parsed = StoredToolStateSchema.safeParse(value);
  if (!parsed.success) return null;

  const data = parsed.data;
  const metadata = resolveMetadataFallback(data.codeEditor.content);
  const metadataScriptName = metadata?.title?.trim() ?? "";
  const resolvedScriptName =
    data.scriptName.trim().length > 0 ? data.scriptName.trim() : metadataScriptName.length > 0 ? metadataScriptName : scriptNameFromKey;
  const metadataWebsites = metadata?.websites.map((w) => w.trim()).filter((w) => w.length > 0) ?? [];
  const metadataWebsite = metadata?.website?.trim() ?? "";
  const fallbackWebsiteGlob = metadataWebsites[0] ?? metadataWebsite;
  return {
    scriptName: resolvedScriptName,
    codeEditor: { content: data.codeEditor.content },
    selectorPanel: { entries: data.selectorPanel.entries },
    permissions: data.permissions,
    websiteGlob: data.websiteGlob.trim().length > 0 ? data.websiteGlob : fallbackWebsiteGlob,
    updatedAt: data.updatedAt,
    runtimeStorage: data.runtimeStorage,
  };
};
