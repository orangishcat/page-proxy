import { injectCSS } from "../pp-style";
import pageNotificationStyles from "./pp-notification-style.css?raw";

export type NotificationLevel = "log" | "info" | "warn" | "error" | "debug" | "notification";

export const notificationSinkGlobalKey = "__pageProxyNotificationSink__";

const maxViewerDepth = 4;
const maxViewerEntries = 20;

const notificationBodyClass = "pp-page-notification__body";
const notificationValueClass = "pp-page-notification__value";
const notificationKeyClass = "pp-page-notification__key";
const notificationDetailsClass = "pp-page-notification__details";
const notificationSummaryClass = "pp-page-notification__summary";
const notificationNestedClass = "pp-page-notification__nested";
const notificationTruncatedClass = "pp-page-notification__truncated";
const notificationElementClass = "pp-page-notification__element";
const notificationHoverClass = "pp-hover";

const createSpan = (text: string, className?: string) => {
  const element = document.createElement("span");
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
};

const toPropertyName = (key: string | symbol) => (typeof key === "symbol" ? key.toString() : key);

const isElementValue = (value: unknown): value is Element => typeof Element !== "undefined" && value instanceof Element;

const describeElement = (element: Element) => {
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((token) => token.length > 0)
    .slice(0, 2)
    .join(".");
  const classSuffix = classes ? `.${classes}` : "";
  return `<${element.tagName.toLowerCase()}${id}${classSuffix}>`;
};

type ViewerContext = {
  cleanupCallbacks: Array<() => void>;
  hoveredElements: Set<Element>;
};

const bindElementHover = (node: HTMLElement, element: Element, context: ViewerContext) => {
  const addHover = () => {
    if (!element.isConnected) {
      return;
    }
    element.classList.add(notificationHoverClass);
    context.hoveredElements.add(element);
  };

  const removeHover = () => {
    element.classList.remove(notificationHoverClass);
    context.hoveredElements.delete(element);
  };

  node.addEventListener("mouseenter", addHover);
  node.addEventListener("mouseleave", removeHover);
  context.cleanupCallbacks.push(() => {
    node.removeEventListener("mouseenter", addHover);
    node.removeEventListener("mouseleave", removeHover);
    removeHover();
  });
};

const getSummaryLabel = (value: unknown) => {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (value && typeof value === "object") {
    const constructor = (value as { constructor?: { name?: string } }).constructor;
    const name = constructor?.name || "Object";
    const count = Reflect.ownKeys(value).length;
    return `${name} {${count}}`;
  }
  return "";
};

const formatInline = (value: unknown, seen: WeakSet<object>, depth: number): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") {
    const functionName = (value as { name?: string }).name || "anonymous";
    return `[Function ${functionName}]`;
  }
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (!value || typeof value !== "object") return "";
  if (seen.has(value)) return "[Circular]";
  if (depth >= maxViewerDepth) return getSummaryLabel(value);
  return getSummaryLabel(value);
};

const isExpandable = (value: unknown, seen: WeakSet<object>, depth: number) => {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  if (depth >= maxViewerDepth) return false;
  return Array.isArray(value) || value instanceof Error || Reflect.ownKeys(value).length > 0;
};

const createValueNode = (
  value: unknown,
  context: ViewerContext,
  seen: WeakSet<object>,
  depth: number,
  propertyName?: string,
): HTMLElement => {
  const row = document.createElement("div");
  row.className = notificationValueClass;

  if (isElementValue(value)) {
    if (propertyName) {
      row.appendChild(createSpan(`${propertyName}: `, notificationKeyClass));
    }
    const elementValue = createSpan(describeElement(value), notificationElementClass);
    bindElementHover(elementValue, value, context);
    row.appendChild(elementValue);
    return row;
  }

  if (!isExpandable(value, seen, depth)) {
    if (propertyName) {
      row.appendChild(createSpan(`${propertyName}: `, notificationKeyClass));
    }
    row.appendChild(createSpan(formatInline(value, seen, depth)));
    return row;
  }

  const objectValue = value as object;
  seen.add(objectValue);

  const details = document.createElement("details");
  details.className = notificationDetailsClass;
  const summary = document.createElement("summary");
  summary.className = notificationSummaryClass;
  if (propertyName) {
    summary.appendChild(createSpan(`${propertyName}: `, notificationKeyClass));
  }
  summary.appendChild(createSpan(getSummaryLabel(value)));
  details.appendChild(summary);

  const nested = document.createElement("div");
  nested.className = notificationNestedClass;

  if (Array.isArray(value)) {
    const list = value.slice(0, maxViewerEntries);
    list.forEach((item, index) => {
      nested.appendChild(createValueNode(item, context, seen, depth + 1, String(index)));
    });
    if (value.length > maxViewerEntries) {
      nested.appendChild(createSpan("...more items", notificationTruncatedClass));
    }
  } else if (value instanceof Error) {
    nested.appendChild(createValueNode(value.name, context, seen, depth + 1, "name"));
    nested.appendChild(createValueNode(value.message, context, seen, depth + 1, "message"));
    if (value.stack) {
      nested.appendChild(createValueNode(value.stack, context, seen, depth + 1, "stack"));
    }
  } else {
    const keys = Reflect.ownKeys(objectValue).slice(0, maxViewerEntries);
    keys.forEach((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
      const entryName = toPropertyName(key);
      if (!descriptor) {
        nested.appendChild(createValueNode(undefined, context, seen, depth + 1, entryName));
        return;
      }
      if ("value" in descriptor) {
        nested.appendChild(createValueNode(descriptor.value, context, seen, depth + 1, entryName));
        return;
      }
      const parts: string[] = [];
      if (descriptor.get) parts.push("Getter");
      if (descriptor.set) parts.push("Setter");
      nested.appendChild(createValueNode(`[${parts.join("/")}]`, context, seen, depth + 1, entryName));
    });
    if (Reflect.ownKeys(objectValue).length > maxViewerEntries) {
      nested.appendChild(createSpan("...more properties", notificationTruncatedClass));
    }
  }

  details.appendChild(nested);
  row.appendChild(details);
  return row;
};

const buildNotificationBody = (values: unknown[]) => {
  const body = document.createElement("div");
  body.className = notificationBodyClass;
  const context: ViewerContext = {
    cleanupCallbacks: [],
    hoveredElements: new Set<Element>(),
  };

  if (values.length === 0) {
    body.appendChild(createValueNode("Notification", context, new WeakSet<object>(), 0));
    return {
      body,
      cleanup: () => {
        context.cleanupCallbacks.forEach((callback) => callback());
        context.hoveredElements.forEach((element) => element.classList.remove(notificationHoverClass));
        context.hoveredElements.clear();
      },
    };
  }

  const needsArgLabels = values.length > 1;
  values.forEach((value, index) => {
    const label = needsArgLabels ? `arg${index}` : undefined;
    body.appendChild(createValueNode(value, context, new WeakSet<object>(), 0, label));
  });
  return {
    body,
    cleanup: () => {
      context.cleanupCallbacks.forEach((callback) => callback());
      context.hoveredElements.forEach((element) => element.classList.remove(notificationHoverClass));
      context.hoveredElements.clear();
    },
  };
};

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

  injectCSS(pageNotificationStyles);
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
