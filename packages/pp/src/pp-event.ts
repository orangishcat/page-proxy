import { buildNotificationBody } from "./pp-notification-viewer";
import pageNotificationStyles from "./pp-event-notification-style.css?raw";
import * as pq from "./pp-style";

export type OnElementCreatedHandler = (element: Element) => void;
export type NotificationLevel = "log" | "info" | "warn" | "error" | "debug" | "notification";

export const notificationSinkGlobalKey = "__pageProxyNotificationSink__";

const defaultCreateObserverOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
};
const pageNotificationHostId = "__pageProxyNotificationHost";
const pageNotificationClass = "pp-page-notification";
const noSelectToolClass = "pp-no-select-tool";

type NotificationSink = (payload: { level: NotificationLevel; values: unknown[] }) => void;

const getNodeCreatedElements = (node: Node): Element[] => {
  if (node instanceof Element) {
    return [node, ...Array.from(node.querySelectorAll("*"))];
  }

  if (node instanceof DocumentFragment) {
    return Array.from(node.querySelectorAll("*"));
  }

  return [];
};

const runOnCreatedElements = (node: Node, func: OnElementCreatedHandler) => {
  getNodeCreatedElements(node).forEach(func);
};

const getNotificationSink = () => {
  const sink = (globalThis as Record<string, unknown>)[notificationSinkGlobalKey];
  return typeof sink === "function" ? (sink as NotificationSink) : null;
};

const ensurePageNotificationStyles = () => {
  if (typeof document === "undefined") {
    return;
  }

  pq.injectCSS(pageNotificationStyles);
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

export class ElementCreatedObserver extends MutationObserver {
  private readonly func: OnElementCreatedHandler;
  private readonly targetNode: Node;

  constructor(func: OnElementCreatedHandler, targetNode: Node) {
    super((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
          return;
        }

        mutation.addedNodes.forEach((node) => {
          runOnCreatedElements(node, func);
        });
      });
    });
    this.func = func;
    this.targetNode = targetNode;
  }

  runOnTargetNode() {
    runOnCreatedElements(this.targetNode, this.func);
  }
}

export const onElementCreated = (
  func: OnElementCreatedHandler,
  targetNode: Node = document.body ?? document.documentElement,
  observerOptions: MutationObserverInit = defaultCreateObserverOptions,
) => {
  const observer = new ElementCreatedObserver(func, targetNode);
  observer.observe(targetNode, observerOptions);
  observer.runOnTargetNode();
  return observer;
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

export const createApi = () => ({
  notification,
});

export const pp = createApi();

export const pageModificationFunctions = [
  "pv.notification",
  "pv.onElementCreated",
  "pq.element",
  "pq.selector",
  "ps.applyStyle",
  "ps.injectCSS",
  "pq.propMatches",
  "pq.propContains",
  "pq.propExists",
  "pq.tagMatches",
  "pq.selectorMatches",
  "pq.innerTextMatches",
  "pq.bboxMatches",
  "pq.traverseParents",
];
