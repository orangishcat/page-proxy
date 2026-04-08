import { injectCSS } from "../pp-style";
import pageNotificationStyles from "./pp-notification-style.css?raw";
import { buildNotificationBody } from "./notification-viewer";

const pageNotificationHostId = "__pageProxyNotificationHost";
const pageNotificationClass = "pp-page-notification";
const noSelectToolClass = "pp-no-select-tool";

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

export const showPageNotification = (values: unknown[]) => {
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
