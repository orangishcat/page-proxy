import { pqSelectorReference } from "./function-references";
import { buildNotificationBody } from "./pp-notification-viewer";
import type { ScriptRunLogLevel } from "../script-runner";

export const notificationSinkGlobalKey = "__pageProxyNotificationSink__";
const pageNotificationHostId = "__pageProxyNotificationHost";
const pageNotificationStyleId = "__pageProxyNotificationStyle";
const pageNotificationClass = "pp-page-notification";
const noSelectToolClass = "pp-no-select-tool";

type NotificationSink = (payload: { level: ScriptRunLogLevel; values: unknown[] }) => void;

const getNotificationSink = () => {
  const sink = (globalThis as Record<string, unknown>)[notificationSinkGlobalKey];
  return typeof sink === "function" ? (sink as NotificationSink) : null;
};

const ensurePageNotificationStyles = () => {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById(pageNotificationStyleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = pageNotificationStyleId;
  style.textContent = `
#${pageNotificationHostId} {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(28rem, calc(100vw - 2rem));
  pointer-events: none;
}

.${pageNotificationClass} {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 0.0625rem solid #4f5358;
  border-radius: 0.5rem;
  background: rgba(41, 43, 46, 0.96);
  color: #e7e8ea;
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
  box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.3);
  opacity: 0;
  transform: translateY(-0.375rem);
  transition: opacity 160ms ease, transform 160ms ease;
  word-break: break-word;
}

.${pageNotificationClass}.pp-page-notification--visible {
  opacity: 1;
  transform: translateY(0);
}

.${pageNotificationClass} button {
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1;
  cursor: pointer;
}

.${pageNotificationClass} button:hover {
  opacity: 1;
}

.${pageNotificationClass} .pp-page-notification__body {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  min-width: 0;
  max-height: 14rem;
  overflow: auto;
}

.${pageNotificationClass} .pp-page-notification__value {
  min-width: 0;
  white-space: pre-wrap;
}

.${pageNotificationClass} .pp-page-notification__key {
  color: #aeb4bd;
}

.${pageNotificationClass} .pp-page-notification__details {
  margin: 0;
}

.${pageNotificationClass} .pp-page-notification__summary {
  cursor: pointer;
  list-style-position: inside;
}

.${pageNotificationClass} .pp-page-notification__nested {
  margin-left: 0.75rem;
  border-left: 0.0625rem solid rgba(255, 255, 255, 0.16);
  padding-left: 0.5rem;
  padding-top: 0.1875rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.${pageNotificationClass} .pp-page-notification__truncated {
  opacity: 0.78;
}

.${pageNotificationClass} .pp-page-notification__element {
  color: #91c4ff;
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  cursor: pointer;
}

@media (prefers-color-scheme: light) {
  .${pageNotificationClass} {
    background: rgba(246, 247, 248, 0.98);
    border-color: #d2d6da;
    color: #1d232a;
    box-shadow: 0 0.625rem 1.875rem rgba(18, 24, 32, 0.14);
  }
}
`;
  (document.head ?? document.documentElement).appendChild(style);
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

  const notification = document.createElement("article");
  notification.className = pageNotificationClass;
  notification.setAttribute("role", "status");

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
    notification.classList.remove("pp-page-notification--visible");
    window.setTimeout(() => {
      notification.remove();
    }, 160);
  };

  close.addEventListener("click", remove);

  notification.appendChild(body);
  notification.appendChild(close);
  host.appendChild(notification);

  while (host.children.length > 4) {
    host.firstElementChild?.remove();
  }

  requestAnimationFrame(() => {
    notification.classList.add("pp-page-notification--visible");
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

export const createApi = () => ({
  notification,
});

export const pp = createApi();

export const pageModificationFunctions = [
  "pa.notification",
  "pv.onElementCreated",
  "pq.element",
  pqSelectorReference,
  "ps.applyStyle",
  "pq.propMatches",
  "pq.propContains",
  "pq.propExists",
  "pq.tagMatches",
  "pq.selectorMatches",
  "pq.innerTextMatches",
  "pq.bboxMatches",
  "pq.traverseParents",
];
