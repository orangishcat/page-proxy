import DOMPurify from "dompurify";
import { marked } from "marked";
import { pn } from "@page-proxy/pp";

const helpContentCacheDurationMs = 2 * 24 * 60 * 60 * 1000;
const helpContentCacheKey = `sidepanel:helpContentMarkdownCache`;
const helpContentUrl = "https://raw.githubusercontent.com/orangishcat/page-proxy/main/extension/HELP.md";

export const renderHelpContentMarkdown = (content: string) => {
  const renderedMarkdown = marked.parse(content, { async: false, breaks: true });
  if (typeof renderedMarkdown !== "string") {
    throw new Error("Unable to render help content.");
  }

  const sanitizedHtml = DOMPurify.sanitize(renderedMarkdown);
  const template = document.createElement("template");
  template.innerHTML = sanitizedHtml;
  template.content.querySelectorAll("a[href]").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer noopener");
    link.setAttribute("referrerpolicy", "no-referrer");
  });

  return template.innerHTML;
};

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
