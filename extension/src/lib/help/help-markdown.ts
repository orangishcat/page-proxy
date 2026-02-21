import { pa, pn } from "@page-proxy/pp";

export const loadAndRenderHelpMarkdown = async () =>
  pa.renderMarkdown(
    await (
      await pn.fetch("https://raw.githubusercontent.com/orangishcat/page-proxy/main/extension/HELP.md", {
        cache: true,
        cacheDuration: 2 * 24 * 60 * 60 * 1000,
        cacheKey: "sidepanel:helpContentMarkdownCache",
        requestCache: "no-cache",
      })
    ).text(),
  );
