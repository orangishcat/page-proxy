import { parseScriptMetadata } from "@/lib/utils/script-metadata";
import type { ScriptGrantValue } from "@/lib/grants";
import { matchWebsiteGlob } from "@/lib/utils/website-glob";
import {
  ensureWebsiteMetadata,
  isDefaultToolState,
  normalizeContentForStorage,
  resolveWebsiteGlob,
  type ScriptFormatConfig,
} from "../state-loading";
import {
  removeStoredToolState,
  saveStoredToolState,
  type StoredSelectorEntry,
  type StoredToolState,
  type ToolId,
} from "../state-storage";

type SaveStateOptions = {
  content: string;
  selectorEntries: StoredSelectorEntry[];
  allowedGrants: ScriptGrantValue[];
  isProtectedPage: boolean;
  scriptFormatConfig: ScriptFormatConfig;
  activeTabUrl: string | null;
  activeWebsiteGlob: string | null;
  activeScriptName: string | null;
  activeTool: ToolId;
  getDefinitionBlock: (content: string) => string;
  setActiveWebsiteGlob: (websiteGlob: string) => void;
  setActiveScriptName: (scriptName: string) => void;
};

export const saveState = async (options: SaveStateOptions) => {
  if (options.isProtectedPage) {
    return;
  }

  let normalizedContent: string;
  let metadata: ReturnType<typeof parseScriptMetadata>;
  try {
    normalizedContent = normalizeContentForStorage(
      options.content,
      options.isProtectedPage,
      options.scriptFormatConfig,
    );
    metadata = parseScriptMetadata(normalizedContent);
    options.getDefinitionBlock(normalizedContent);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid script metadata or selector block.");
  }

  const scriptName = metadata.title.trim() || "Page Proxy";
  let websiteGlob: string;
  try {
    websiteGlob = resolveWebsiteGlob(normalizedContent, options.activeTabUrl, options.activeWebsiteGlob);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid script metadata.");
  }

  if (!websiteGlob) {
    return;
  }

  const websiteGlobs = metadata.websites.map((glob) => glob.trim()).filter((glob) => glob.length > 0);
  const fallbackWebsite = metadata.website.trim();
  const websiteGlobsForMatch = websiteGlobs.length > 0 ? websiteGlobs : [fallbackWebsite || websiteGlob];
  const activeTabUrl = options.activeTabUrl?.trim() ?? "";
  const hasMatchingWebsite =
    activeTabUrl.length === 0
      ? true
      : websiteGlobsForMatch.some((glob) => glob.length > 0 && matchWebsiteGlob(glob, activeTabUrl));
  if (!hasMatchingWebsite && activeTabUrl.length > 0) {
    throw new Error(`Website glob "${websiteGlob}" does not match the current website (${options.activeTabUrl}).`);
  }

  const contentWithWebsite = ensureWebsiteMetadata(normalizedContent, websiteGlob);

  if (options.activeScriptName && options.activeScriptName !== scriptName) {
    await removeStoredToolState(options.activeScriptName).catch(() => {
      throw new Error("Unable to save script state to extension storage.");
    });
  }

  const state: StoredToolState = {
    scriptName,
    activeTool: options.activeTool,
    codeEditor: {
      content: contentWithWebsite,
    },
    selectorPanel: {
      entries: options.selectorEntries,
    },
    permissions: {
      allowedGrants: Array.from(options.allowedGrants),
    },
    websiteGlob,
    updatedAt: Date.now(),
  };

  options.setActiveWebsiteGlob(websiteGlob);
  options.setActiveScriptName(scriptName);

  if (isDefaultToolState(state, options.scriptFormatConfig)) {
    await removeStoredToolState(scriptName)
      .catch((e: Error) => {
        throw new Error(`Unable to save script state to extension storage: ${e.message}`);
      });
    return;
  }

  await saveStoredToolState(state)
    .catch((e: Error) => {
      throw new Error(`Unable to save script state to extension storage: ${e.message}`);
    });
};
