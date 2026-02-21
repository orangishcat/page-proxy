import axios from "axios";
import { browser } from "wxt/browser";

type HelpContentCacheEntry = {
  content: string;
  expiresAt: number;
};

const helpContentCacheStorageKey = `sidepanel:helpContentMarkdownCache:v1:${chrome.runtime.getManifest().version}`;
const helpContentCacheDurationMs = 2 * 24 * 60 * 60 * 1000;

const isHelpContentCacheEntry = (value: unknown): value is HelpContentCacheEntry => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as {
    content?: unknown;
    expiresAt?: unknown;
  };

  return typeof data.content === "string" && typeof data.expiresAt === "number";
};

const readCachedHelpContent = async (): Promise<string | null> => {
  return browser.storage.local
    .get(helpContentCacheStorageKey)
    .then((stored) => {
      const cachedValue = stored[helpContentCacheStorageKey];
      if (!isHelpContentCacheEntry(cachedValue)) {
        return null;
      }

      if (cachedValue.expiresAt <= Date.now()) {
        return null;
      }

      return cachedValue.content;
    })
    .catch(() => null);
};

const writeCachedHelpContent = async (content: string) => {
  const cacheEntry: HelpContentCacheEntry = {
    content,
    expiresAt: Date.now() + helpContentCacheDurationMs,
  };

  await browser.storage.local
    .set({
      [helpContentCacheStorageKey]: cacheEntry,
    })
    .catch(() => undefined);
};

export const loadHelpContentMarkdown = async () => {
  const cachedContent = await readCachedHelpContent();
  if (cachedContent !== null) {
    return cachedContent;
  }

  const helpContentUrl = chrome.runtime.getURL("HELP.md");
  const response = await axios.get<string>(helpContentUrl, {
    responseType: "text",
    transformResponse: [(rawValue) => rawValue],
  });

  if (typeof response.data !== "string" || !response.data.trim()) {
    throw new Error("Help content is empty.");
  }

  await writeCachedHelpContent(response.data);
  return response.data;
};
