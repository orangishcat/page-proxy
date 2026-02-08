import { parseScriptMetadata } from "@/lib/utils/script-metadata";
import { buildWebsiteGlobForUrl } from "@/lib/utils/website-glob";

import { findStoredToolStateForUrl, type StoredToolState } from "./state-storage";

export type ScriptFormatConfig = {
  ppImportLines: string[];
  defineBlockStart: string;
  defineBlockEnd: string;
  protectedComment: string;
};

export const buildDefaultScript = (websiteGlob: string, config: ScriptFormatConfig) => {
  const normalizedWebsite = websiteGlob.trim();
  return [
    ...config.ppImportLines,
    "",
    "// ==Page Proxy==",
    "// @title Page Proxy",
    normalizedWebsite ? `// @website ${normalizedWebsite}` : "// @website",
    "// @description",
    "// ==/Page Proxy==",
    "",
    config.defineBlockStart,
    config.defineBlockEnd,
    "",
  ].join("\n");
};

export const ensureScriptImports = (content: string, config: ScriptFormatConfig) => {
  const withoutLegacyAlias = content
    .split("\n")
    .filter((line) => line.trim() !== "const pp = pa.pp;")
    .join("\n");

  const hasAllImports = config.ppImportLines.every((line) => withoutLegacyAlias.includes(line));
  if (hasAllImports) {
    return withoutLegacyAlias;
  }

  return [...config.ppImportLines, "", withoutLegacyAlias.trimStart()].join("\n");
};

export const ensureDefineBlock = (content: string, config: ScriptFormatConfig) => {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === config.defineBlockStart);
  const endIndex = lines.findIndex((line) => line.trim() === config.defineBlockEnd);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return content;
  }

  return [content.trimEnd(), "", config.defineBlockStart, config.defineBlockEnd, ""].join("\n");
};

export const buildProtectedDisplay = (content: string, config: ScriptFormatConfig) => {
  const baseContent = content.trim() ? content : buildDefaultScript("", config);
  const lines = baseContent.split("\n");
  if (lines[0]?.trim() === config.protectedComment) {
    return baseContent;
  }
  return [config.protectedComment, "", baseContent].join("\n");
};

export const stripProtectedDisplay = (content: string, config: ScriptFormatConfig) => {
  const lines = content.split("\n");
  if (!lines[0] || lines[0].trim() !== config.protectedComment) {
    return content;
  }

  lines.shift();
  if (lines[0] === "") {
    lines.shift();
  }
  return lines.join("\n");
};

export const normalizeContentForStorage = (content: string, isProtectedPage: boolean, config: ScriptFormatConfig) => {
  const rawContent = isProtectedPage ? stripProtectedDisplay(content, config) : content;
  return ensureScriptImports(ensureDefineBlock(rawContent, config), config);
};

export const resolveWebsiteGlob = (content: string, activeTabUrl: string | null, activeWebsiteGlob: string | null) => {
  const metadata = parseScriptMetadata(content);
  const fromMetadata = metadata?.website.trim() ?? "";
  if (fromMetadata) {
    return fromMetadata;
  }

  if (activeTabUrl) {
    return buildWebsiteGlobForUrl(activeTabUrl);
  }

  return activeWebsiteGlob ?? "";
};

export const buildDefaultToolState = (websiteGlob: string, config: ScriptFormatConfig): StoredToolState => ({
  activeTool: "none",
  codeEditor: {
    content: normalizeContentForStorage(buildDefaultScript(websiteGlob, config), false, config),
  },
  websiteGlob,
  updatedAt: Date.now(),
});

export const isDefaultToolState = (state: StoredToolState, config: ScriptFormatConfig) => {
  const defaultState = buildDefaultToolState(state.websiteGlob, config);
  return state.activeTool === defaultState.activeTool && state.codeEditor.content === defaultState.codeEditor.content;
};

export const resolveStoredToolStateForUrl = async (url: string, config: ScriptFormatConfig) => {
  const matched = await findStoredToolStateForUrl(url);
  const fallbackWebsiteGlob = buildWebsiteGlobForUrl(url);
  const state = matched?.state ?? buildDefaultToolState(fallbackWebsiteGlob, config);
  return {
    websiteGlob: matched?.websiteGlob ?? fallbackWebsiteGlob,
    state,
  };
};
