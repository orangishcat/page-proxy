import DOMPurify from "dompurify";
import { marked } from "marked";
import { buildNotificationBody } from "./pp-notification-viewer";
import pageNotificationStyles from "./pp-event-notification-style.css?raw";
import * as ps from "./pp-style";

export type NotificationLevel = "log" | "info" | "warn" | "error" | "debug" | "notification";
export type MarkdownRenderOptions = {
  breaks?: boolean;
  linkTarget?: string;
  linkRel?: string;
  linkReferrerPolicy?: string;
};
export type MoveNodePasteLocation = "child" | "before" | "after";
export type MoveNodeOptions = {
  pasteLocation?: MoveNodePasteLocation;
  copy?: boolean;
};

export const notificationSinkGlobalKey = "__pageProxyNotificationSink__";

const pageNotificationHostId = "__pageProxyNotificationHost";
const pageNotificationClass = "pp-page-notification";
const noSelectToolClass = "pp-no-select-tool";

type NotificationSink = (payload: { level: NotificationLevel; values: unknown[] }) => void;

const getNotificationSink = () => {
  const sink = (globalThis as Record<string, unknown>)[notificationSinkGlobalKey];
  return typeof sink === "function" ? (sink as NotificationSink) : null;
};

const ensurePageNotificationStyles = () => {
  if (typeof document === "undefined") {
    return;
  }

  ps.injectCSS(pageNotificationStyles);
};

const ensurePageNotificationHost = () => {
  if (typeof document === "undefined") {
    return null;
  }

  ensurePageNotificationStyles();
  const existing = document.getElementById(pageNotificationHostId);
  if (existing instanceof HTMLDivElement) {
    existing.classList.add(noSelectToolClass);
    return existing;
  }

  const host = document.createElement("div");
  host.id = pageNotificationHostId;
  host.classList.add(noSelectToolClass);
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-atomic", "false");
  (document.body ?? document.documentElement).appendChild(host);
  return host;
};

const showPageNotification = (values: unknown[]) => {
  const host = ensurePageNotificationHost();
  if (!host) {
    return;
  }

  const notificationElement = document.createElement("article");
  notificationElement.className = pageNotificationClass;
  notificationElement.setAttribute("role", "status");

  const { body, cleanup } = buildNotificationBody(values);

  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";
  let removeTimer: number | null = null;
  let removed = false;

  const hasOpenViewer = () => Boolean(body.querySelector("details[open]"));

  const scheduleRemove = (delay: number) => {
    if (removeTimer !== null) {
      window.clearTimeout(removeTimer);
    }
    removeTimer = window.setTimeout(() => {
      if (removed) {
        return;
      }
      if (hasOpenViewer()) {
        scheduleRemove(1000);
        return;
      }
      remove();
    }, delay);
  };

  const remove = () => {
    if (removed) {
      return;
    }
    removed = true;
    if (removeTimer !== null) {
      window.clearTimeout(removeTimer);
      removeTimer = null;
    }
    cleanup();
    notificationElement.classList.remove("pp-page-notification--visible");
    window.setTimeout(() => {
      notificationElement.remove();
    }, 160);
  };

  close.addEventListener("click", remove);

  notificationElement.appendChild(body);
  notificationElement.appendChild(close);
  host.appendChild(notificationElement);

  while (host.children.length > 4) {
    host.firstElementChild?.remove();
  }

  requestAnimationFrame(() => {
    notificationElement.classList.add("pp-page-notification--visible");
  });

  scheduleRemove(4200);
};

export const notification = (...values: unknown[]) => {
  console.log(...values);
  showPageNotification(values);
  const sink = getNotificationSink();
  if (!sink) {
    return;
  }
  sink({
    level: "notification",
    values,
  });
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

export const moveNode = (
  node: Element,
  position = -1,
  parent: Element | null = node.parentElement,
  options: MoveNodeOptions = {},
) => {
  const { pasteLocation = "child", copy = false } = options;
  const nextNode = (copy ? node.cloneNode(true) : node) as Element;

  if (!parent) {
    return nextNode;
  }

  if (pasteLocation === "before" || pasteLocation === "after") {
    const anchor = parent;
    const anchorParent = anchor.parentElement;
    if (!anchorParent) {
      return nextNode;
    }

    const referenceNode = pasteLocation === "before" ? anchor : anchor.nextSibling;
    anchorParent.insertBefore(nextNode, referenceNode);
    return nextNode;
  }

  const siblings = copy
    ? Array.from(parent.children)
    : Array.from(parent.children).filter((child) => child !== node);
  const siblingCount = siblings.length;
  const normalizedPosition = Math.min(
    Math.max(position < 0 ? siblingCount + position + 1 : position, 0),
    siblingCount,
  );
  const target = siblings[normalizedPosition] ?? null;

  parent.insertBefore(nextNode, target);
  return nextNode;
};

export const createApi = () => ({
  notification,
  renderMarkdown,
  moveNode,
});

export const pp = createApi();
