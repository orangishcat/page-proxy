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
  setErrorMessage: (message: string | null) => void;
};

export const saveState = async (options: SaveStateOptions) => {
  if (options.isProtectedPage) {
    return;
  }

  let normalizedContent: string;
  try {
    normalizedContent = normalizeContentForStorage(options.content, options.isProtectedPage, options.scriptFormatConfig);
    parseScriptMetadata(normalizedContent);
    options.getDefinitionBlock(normalizedContent);
  } catch (error) {
    options.setErrorMessage(error instanceof Error ? error.message : "Invalid script metadata or selector block.");
    return;
  }

  let websiteGlob: string;
  try {
    websiteGlob = resolveWebsiteGlob(normalizedContent, options.activeTabUrl, options.activeWebsiteGlob);
  } catch (error) {
    options.setErrorMessage(error instanceof Error ? error.message : "Invalid script metadata.");
    return;
  }

  if (!websiteGlob) {
    return;
  }

  if (options.activeTabUrl && !matchWebsiteGlob(websiteGlob, options.activeTabUrl)) {
    options.setErrorMessage(`Website glob "${websiteGlob}" does not match the current website.`);
    return;
  }

  const contentWithWebsite = ensureWebsiteMetadata(normalizedContent, websiteGlob);

  if (options.activeWebsiteGlob && options.activeWebsiteGlob !== websiteGlob) {
    await removeStoredToolState(options.activeWebsiteGlob).catch(() => {
      options.setErrorMessage("Unable to save script state to extension storage.");
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
      .then(() => {
        options.setErrorMessage(null);
      })
      .catch(() => {
        options.setErrorMessage("Unable to save script state to extension storage.");
      });
    return;
  }

  await saveStoredToolState(state)
    .then(() => {
      options.setErrorMessage(null);
    })
    .catch(() => {
      options.setErrorMessage("Unable to save script state to extension storage.");
    });
};
