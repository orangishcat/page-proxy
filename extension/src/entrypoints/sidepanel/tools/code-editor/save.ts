import { parseScriptMetadata } from "@/lib/utils/script-metadata";
import { matchWebsiteGlob } from "@/lib/utils/website-glob";
import {
  ensureWebsiteMetadata,
  isDefaultToolState,
  normalizeContentForStorage,
  resolveWebsiteGlob,
  type ScriptFormatConfig,
} from "../state-loading";
import { removeStoredToolState, saveStoredToolState, type StoredToolState, type ToolId } from "../state-storage";

type SaveStateOptions = {
  content: string;
  isProtectedPage: boolean;
  scriptFormatConfig: ScriptFormatConfig;
  activeTabUrl: string | null;
  activeWebsiteGlob: string | null;
  activeTool: ToolId;
  getDefinitionBlock: (content: string) => string;
  setActiveWebsiteGlob: (websiteGlob: string) => void;
};

export const saveState = async (options: SaveStateOptions) => {
  if (options.isProtectedPage) {
    return;
  }

  let normalizedContent: string;
  try {
    normalizedContent = normalizeContentForStorage(
      options.content,
      options.isProtectedPage,
      options.scriptFormatConfig,
    );
    parseScriptMetadata(normalizedContent);
    options.getDefinitionBlock(normalizedContent);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid script metadata or selector block.");
  }

  let websiteGlob: string;
  try {
    websiteGlob = resolveWebsiteGlob(normalizedContent, options.activeTabUrl, options.activeWebsiteGlob);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid script metadata.");
  }

  if (!websiteGlob) {
    return;
  }

  if (options.activeTabUrl && !matchWebsiteGlob(websiteGlob, options.activeTabUrl)) {
    throw new Error(`Website glob "${websiteGlob}" does not match the current website (${options.activeTabUrl}).`);
  }

  const contentWithWebsite = ensureWebsiteMetadata(normalizedContent, websiteGlob);

  if (options.activeWebsiteGlob && options.activeWebsiteGlob !== websiteGlob) {
    await removeStoredToolState(options.activeWebsiteGlob).catch(() => {
      throw new Error("Unable to save script state to extension storage.");
    });
  }

  const state: StoredToolState = {
    activeTool: options.activeTool,
    codeEditor: {
      content: contentWithWebsite,
    },
    websiteGlob,
    updatedAt: Date.now(),
  };

  options.setActiveWebsiteGlob(websiteGlob);

  if (isDefaultToolState(state, options.scriptFormatConfig)) {
    await removeStoredToolState(websiteGlob)
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
