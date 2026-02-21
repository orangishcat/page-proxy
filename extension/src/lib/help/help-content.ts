import { pn } from "@page-proxy/pp";

const helpContentCacheDurationMs = 2 * 24 * 60 * 60 * 1000;
const helpContentCacheKey = `sidepanel:helpContentMarkdownCache:v1:${chrome.runtime.getManifest().version}`;
const helpContentUrl = "https://raw.githubusercontent.com/orangishcat/page-proxy/main/extension/HELP.md";

export const loadHelpContentMarkdown = async () => {
  const response = await pn.fetch(helpContentUrl, {
    cache: true,
    cacheDuration: helpContentCacheDurationMs,
    cacheKey: helpContentCacheKey,
    requestCache: "no-cache",
  });

  if (!response.ok) {
    throw new Error(`Unable to load help content (HTTP ${response.status}).`);
  }

  const content = await response.text();
  if (!content.trim()) {
    throw new Error("Help content is empty.");
  }

  return content;
};
