import DOMPurify from "dompurify";
import { marked } from "marked";

export type MarkdownRenderOptions = {
  breaks?: boolean;
  linkTarget?: string;
  linkRel?: string;
  linkReferrerPolicy?: string;
};

export const renderMarkdown = (content: string, options: MarkdownRenderOptions = {}) => {
  const {
    breaks = true,
    linkTarget = "_blank",
    linkRel = "noreferrer noopener",
    linkReferrerPolicy = "no-referrer",
  } = options;

  const renderedMarkdown = marked.parse(content, { async: false, breaks });
  if (typeof renderedMarkdown !== "string") {
    throw new Error("Unable to render markdown content.");
  }

  const sanitizedHtml = DOMPurify.sanitize(renderedMarkdown);
  const template = document.createElement("template");
  template.innerHTML = sanitizedHtml;
  template.content.querySelectorAll("a[href]").forEach((link) => {
    link.setAttribute("target", linkTarget);
    link.setAttribute("rel", linkRel);
    link.setAttribute("referrerpolicy", linkReferrerPolicy);
  });

  return template.innerHTML;
};
