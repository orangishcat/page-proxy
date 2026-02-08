import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { mount, unmount } from "svelte";
import log from "loglevel";

import type { ElementInfo, SelectorSavePayload, SelectToolMessage } from "@/lib/selection";
import type { SidepanelShortcutId, SidepanelShortcutMessage } from "@/lib/sidepanel-shortcuts";
import SelectorPopupContainer from "./SelectorPopupContainer.svelte";
import "@/styles/app.css";

const logger = log.getLogger("select-tool");
logger.setLevel("debug", false);

const hoverClass = "pp-hover";
const selectedClass = "pp-selected";
const styleId = "page-proxy-selection-styles";
const selectorLabelId = "page-proxy-selector-label";
const filteredSelectionClasses = new Set([hoverClass, selectedClass]);

const selectionStyles = `
.pp-hover { outline: 0.125rem solid #86d24b !important; outline-offset: -0.0625rem !important; }
.pp-selected { outline: 0.125rem solid #bb9348 !important; outline-offset: -0.0625rem !important; }
.pp-selected-label {
  position: fixed;
  z-index: 2147483646;
  background: #282824;
  color: #f2f0ea;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.4;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #3F403A;
  box-shadow: 0 0.25rem 0.5rem rgba(0,0,0,0.25);
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (prefers-color-scheme: light) {
  .pp-selected-label { background: #f7f4ee; color: #1f1d18; border-color: #d9d2c2; }
}
`;

const filterSelectionClasses = (value: string | null) => {
  if (!value) return null;
  const tokens = value
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !filteredSelectionClasses.has(t));
  return tokens.length > 0 ? tokens.join(" ") : null;
};

const escapeSelector = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`);
};

const getElementSelector = (element: Element) => {
  if (element.id) return `#${escapeSelector(element.id)}`;
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && segments.length < 4) {
    let segment = current.tagName.toLowerCase();
    const classList = Array.from(current.classList)
      .filter((t) => t && !filteredSelectionClasses.has(t))
      .slice(0, 2);
    if (classList.length > 0) segment += `.${classList.map(escapeSelector).join(".")}`;
    const parent = current.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c instanceof Element && c.tagName === current?.tagName);
      if (sameTag.length > 1) segment += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
    }
    segments.unshift(segment);
    if (current.tagName.toLowerCase() === "body") break;
    current = current.parentElement;
  }
  return segments.join(" > ");
};

const getElementInfo = (element: Element): ElementInfo => {
  const rect = element.getBoundingClientRect();
  const innerText = element instanceof HTMLElement ? element.innerText.trim() : "";
  const attributes = Object.fromEntries(
    Array.from(element.attributes)
      .map((attr) => {
        if (attr.name === "class") {
          const filtered = filterSelectionClasses(attr.value);
          return filtered ? ([attr.name, filtered] as const) : null;
        }
        return [attr.name, attr.value] as const;
      })
      .filter((e): e is readonly [string, string] => e !== null),
  );
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    name: element.getAttribute("name") ?? element.getAttribute("aria-label") ?? null,
    className: filterSelectionClasses(element.getAttribute("class")),
    innerText: innerText.length > 0 && innerText.length < 500 ? innerText : null,
    selector: getElementSelector(element),
    attributes,
    boundingBox: { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height },
  };
};

type PropertyItem = {
  key: string;
  label: string;
  value: string;
  rawValue: string | ElementInfo["boundingBox"];
  primary: boolean;
};

const formatBoundingBoxCompact = (box: ElementInfo["boundingBox"]) =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

const getPrimaryPropertyItems = (info: ElementInfo): PropertyItem[] => {
  const items: PropertyItem[] = [];
  if (info.tag) items.push({ key: "tag", label: "Tag", value: info.tag, rawValue: info.tag, primary: true });
  if (info.id) items.push({ key: "id", label: "ID", value: info.id, rawValue: info.id, primary: true });
  if (info.className)
    items.push({ key: "class", label: "Class", value: info.className, rawValue: info.className, primary: true });
  if (info.name) items.push({ key: "name", label: "Name", value: info.name, rawValue: info.name, primary: true });
  items.push({ key: "selector", label: "Selector", value: info.selector, rawValue: info.selector, primary: true });
  items.push({
    key: "bbox",
    label: "BBox",
    value: formatBoundingBoxCompact(info.boundingBox),
    rawValue: info.boundingBox,
    primary: true,
  });
  if (info.innerText)
    items.push({
      key: "innerText",
      label: "Inner text",
      value: info.innerText,
      rawValue: info.innerText,
      primary: false,
    });
  return items;
};

const buildPropertyList = (info: ElementInfo | null): PropertyItem[] => {
  if (!info) return [];
  const properties = getPrimaryPropertyItems(info);
  const reservedKeys = new Set(["id", "class", "name", "tag", "selector"]);
  Object.entries(info.attributes)
    .filter(([k, v]) => !reservedKeys.has(k) && v.length > 0)
    .forEach(([k, v]) => {
      properties.push({ key: k, label: k, value: v, rawValue: v, primary: false });
    });
  return properties;
};

const truncate = (value: string, maxLength = 120) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;

const describeElement = (element: Element) => {
  const info = getElementInfo(element);
  return `${info.tag}${info.id ? `#${info.id}` : ""}${info.className ? `.${info.className.replace(" ", ".")}` : ""}`;
};

const describeElementCompact = (element: Element | null) => {
  if (!element) return "none";
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((t) => t.length > 0 && !filteredSelectionClasses.has(t))
    .slice(0, 2)
    .join(".");
  return `${element.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ""}`;
};

const getEventTarget = (event: Event): Element | null => {
  for (const target of event.composedPath()) if (target instanceof Element) return target;
  return event.target instanceof Element ? event.target : null;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
};

const getShortcutTool = (event: KeyboardEvent): SidepanelShortcutId | null => {
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return null;
  switch (event.code) {
    case "Digit1":
      return "select";
    case "Digit2":
      return "new-element";
    case "Digit3":
      return "selectors";
    case "Digit4":
      return "help";
    case "Digit5":
      return "share";
    default:
      return null;
  }
};

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    let selectionEnabled = false;
    let hoverTarget: Element | null = null;
    let selectedTarget: Element | null = null;
    let hoverFrame: number | null = null;
    let queuedHoverTarget: Element | null = null;
    let labelFrame: number | null = null;
    let queuedLabelTarget: Element | null = null;
    let popupFrame: number | null = null;
    let popupTarget: Element | null = null;
    let popupApp: ReturnType<typeof mount> | null = null;
    let shadowUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;

    logger.debug("select tool content script initialized", { href: window.location.href });

    const ensureSelectionStyles = () => {
      if (document.getElementById(styleId)) return;
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = selectionStyles;
      (document.head ?? document.documentElement).appendChild(style);
      logger.debug("selection styles injected");
    };

    const ensureSelectorLabel = () => {
      const existing = document.getElementById(selectorLabelId);
      if (existing) return existing as HTMLDivElement;
      const label = document.createElement("div");
      label.id = selectorLabelId;
      label.className = "pp-selected-label";
      label.dataset.pageProxy = "selector-label";
      document.body.appendChild(label);
      return label;
    };

    const removeSelectorLabel = () => document.getElementById(selectorLabelId)?.remove();

    const clearHover = () => {
      if (!hoverTarget) return;
      hoverTarget.classList.remove(hoverClass);
      hoverTarget = null;
      queuedLabelTarget = null;
      removeSelectorLabel();
    };

    const clearSelected = () => {
      if (!selectedTarget) return;
      selectedTarget.classList.remove(selectedClass);
      selectedTarget = null;
    };

    const clearSelectorPopup = () => {
      if (popupApp) {
        unmount(popupApp);
        popupApp = null;
      }
      if (shadowUi) {
        shadowUi.remove();
        shadowUi = null;
      }
      popupTarget = null;
      if (popupFrame !== null) {
        window.cancelAnimationFrame(popupFrame);
        popupFrame = null;
      }
      logger.debug("selector popup closed");
    };

    const isNoReceiverError = (error: unknown) => {
      if (!error) return false;
      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : typeof (error as { message?: unknown }).message === "string"
              ? (error as { message: string }).message
              : "";
      return (
        message.includes("Receiving end does not exist") ||
        message.includes("Could not establish connection") ||
        message.includes("No receiving end")
      );
    };

    const stopSelection = (reason: string) => {
      if (!selectionEnabled) return;
      selectionEnabled = false;
      detachListeners();
      logger.debug("selection stopped", { reason });
    };

    const sendRuntimeMessage = (message: SelectToolMessage | SidepanelShortcutMessage) =>
      void browser.runtime.sendMessage(message).catch((error: unknown) => {
        if (isNoReceiverError(error)) {
          stopSelection("receiver-missing");
          return;
        }
        logger.error("select tool message failed", { type: message.type, error });
      });

    const postMessage = (message: SelectToolMessage) => sendRuntimeMessage(message);

    const handleSave = (payload: SelectorSavePayload) => {
      if (!popupTarget?.isConnected) return;
      const info = getElementInfo(popupTarget);

      logger.debug("selector popup save requested", {
        target: describeElementCompact(popupTarget),
        name: payload.name,
        selector: payload.selector || info.selector,
      });

      void browser.runtime
        .sendMessage({ type: "selector:save", payload } satisfies SelectToolMessage)
        .then(() => clearSelectorPopup())
        .catch(() => logger.error("Failed to save selector"));
    };

    const noSelectClass = "pp-no-select-tool";

    const resolvePopupTarget = (requestedInfo: ElementInfo | null) => {
      if (selectedTarget?.isConnected) {
        return selectedTarget;
      }

      if (requestedInfo?.id) {
        const byId = document.getElementById(requestedInfo.id);
        if (byId?.isConnected) {
          selectedTarget = byId;
          return byId;
        }
      }

      if (requestedInfo?.selector) {
        const bySelector = document.querySelector(requestedInfo.selector);
        if (bySelector?.isConnected) {
          selectedTarget = bySelector;
          return bySelector;
        }
      }

      const selectedElement = document.querySelector(`.${selectedClass}`);
      if (selectedElement?.isConnected) {
        selectedTarget = selectedElement;
        return selectedElement;
      }

      return null;
    };

    const openSelectorPopup = async (requestedInfo: ElementInfo | null) => {
      const target = resolvePopupTarget(requestedInfo);
      if (!target) {
        postMessage({ type: "select:selected", payload: null });
        logger.debug("selector popup open skipped", {
          reason: "no-target",
          selectionEnabled,
        });
        return;
      }

      ensureSelectionStyles();
      clearSelectorPopup();

      if (!target.classList.contains(selectedClass)) {
        clearSelected();
        target.classList.add(selectedClass);
      }

      selectedTarget = target;
      const info = getElementInfo(target);
      const propertyItems = buildPropertyList(info);
      popupTarget = target;

      shadowUi = await createShadowRootUi(ctx, {
        name: "pp-selector-popup",
        position: "overlay",
        anchor: "body",
        zIndex: 2147483647,
        onMount(container: HTMLElement) {
          const app = mount(SelectorPopupContainer, {
            target: container,
            props: {
              info,
              propertyItems,
              targetElement: popupTarget,
              onSave: handleSave,
              onCancel: clearSelectorPopup,
            },
          });
          popupApp = app;
          return app;
        },
      });

      shadowUi.mount();
      shadowUi.shadowHost.classList.add(noSelectClass);
      logger.debug("selector popup opened", {
        target: describeElementCompact(target),
        selector: info.selector,
      });
    };

    const isExcludedFromSelection = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest(`.${noSelectClass}`));
    };

    const clearHoverAndNotify = () => {
      clearHover();
      postMessage({ type: "select:hover", payload: null });
    };

    const applySelection = (target: Element) => {
      clearSelectorPopup();
      if (selectedTarget && selectedTarget !== target) selectedTarget.classList.remove(selectedClass);
      selectedTarget = target;
      ensureSelectionStyles();
      selectedTarget.classList.add(selectedClass);
      const info = getElementInfo(target);
      postMessage({ type: "select:selected", payload: info });
      logger.debug("element selected", { target: describeElementCompact(target), selector: info.selector });
    };

    const scheduleLabelUpdate = (target: Element | null) => {
      queuedLabelTarget = target;
      if (labelFrame !== null) return;
      labelFrame = window.requestAnimationFrame(() => {
        labelFrame = null;
        const currentTarget = queuedLabelTarget;
        if (!currentTarget?.isConnected || !selectionEnabled) {
          removeSelectorLabel();
          return;
        }
        const label = ensureSelectorLabel();
        label.textContent = truncate(describeElement(currentTarget));
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const offset = 0.5 * rootFontSize;
        const maxWidth = Math.max(0, window.innerWidth - offset * 2);
        label.style.maxWidth = `${maxWidth}px`;
        label.style.top = "0px";
        label.style.left = "0px";
        const rect = currentTarget.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const topCandidate = rect.top - labelRect.height - offset;
        const top = topCandidate > offset ? topCandidate : rect.bottom + offset;
        const left = Math.min(Math.max(offset, rect.left), window.innerWidth - labelRect.width - offset);
        label.style.top = `${Math.max(offset, top)}px`;
        label.style.left = `${Math.max(offset, left)}px`;
      });
    };

    const flushHover = () => {
      hoverFrame = null;
      if (!selectionEnabled) return;
      const nextTarget = queuedHoverTarget;
      if (nextTarget === hoverTarget) return;
      if (hoverTarget) hoverTarget.classList.remove(hoverClass);
      hoverTarget = nextTarget;
      if (hoverTarget) {
        ensureSelectionStyles();
        hoverTarget.classList.add(hoverClass);
      }
      scheduleLabelUpdate(hoverTarget);
      postMessage({ type: "select:hover", payload: nextTarget ? getElementInfo(nextTarget) : null });
    };

    const scheduleHover = (target: Element | null) => {
      queuedHoverTarget = target;
      if (hoverFrame !== null) return;
      hoverFrame = window.requestAnimationFrame(flushHover);
    };

    const stopEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!selectionEnabled) return;
      if (isExcludedFromSelection(event.target)) {
        clearHoverAndNotify();
        return;
      }
      scheduleHover(getEventTarget(event));
    };

    const onPointerOut = (event: MouseEvent) => {
      if (!selectionEnabled) return;
      if (event.relatedTarget === null) clearHoverAndNotify();
    };

    const onWindowBlur = () => {
      if (selectionEnabled) clearHoverAndNotify();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!selectionEnabled || isExcludedFromSelection(event.target)) return;
      stopEvent(event);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!selectionEnabled || isExcludedFromSelection(event.target)) return;
      stopEvent(event);
    };

    const onClick = (event: MouseEvent) => {
      if (!selectionEnabled || isExcludedFromSelection(event.target)) return;
      const target = getEventTarget(event);
      stopEvent(event);
      if (!target) return;
      if (shadowUi) clearSelectorPopup();
      applySelection(target);
    };

    const onViewportChange = () => {
      if (!selectionEnabled) return;
      if (hoverTarget) scheduleLabelUpdate(hoverTarget);
    };

    const onShortcutKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return;
      if (event.key === "Escape" && shadowUi) {
        clearSelectorPopup();
        return;
      }
      const tool = getShortcutTool(event);
      if (!tool) return;
      sendRuntimeMessage({
        type: "sidepanel:shortcut",
        payload: { tool },
      } satisfies SidepanelShortcutMessage);
    };

    const attachListeners = () => {
      window.addEventListener("pointermove", onPointerMove, { capture: true });
      window.addEventListener("mouseout", onPointerOut, { capture: true });
      window.addEventListener("blur", onWindowBlur);
      window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: false });
      window.addEventListener("pointerup", onPointerUp, { capture: true, passive: false });
      window.addEventListener("click", onClick, { capture: true, passive: false });
      window.addEventListener("scroll", onViewportChange, { capture: true });
      window.addEventListener("resize", onViewportChange);
      logger.debug("select tool listeners attached");
    };

    const detachListeners = () => {
      window.removeEventListener("pointermove", onPointerMove, { capture: true });
      window.removeEventListener("mouseout", onPointerOut, { capture: true });
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("pointerup", onPointerUp, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("scroll", onViewportChange, { capture: true });
      window.removeEventListener("resize", onViewportChange);
      clearHover();
      clearSelected();
      clearSelectorPopup();
      queuedHoverTarget = null;
      if (hoverFrame !== null) {
        window.cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
      if (labelFrame !== null) {
        window.cancelAnimationFrame(labelFrame);
        labelFrame = null;
      }
      if (popupFrame !== null) {
        window.cancelAnimationFrame(popupFrame);
        popupFrame = null;
      }
      logger.debug("select tool listeners detached");
    };

    window.addEventListener("keydown", onShortcutKeyDown, { capture: true });

    browser.runtime.onMessage.addListener((message: SelectToolMessage) => {
      logger.debug("select tool message received", { type: message.type });
      if (message.type === "selector:open") {
        void openSelectorPopup(message.payload);
        return;
      }
      if (message.type === "select:parent") {
        if (!selectionEnabled) return;
        const parent = selectedTarget?.parentElement;
        if (!parent) {
          logger.debug("select parent skipped", { reason: "no-parent" });
          return;
        }
        clearHoverAndNotify();
        applySelection(parent);
        return;
      }
      if (message.type === "select:toggle") {
        if (message.enabled === selectionEnabled) return;
        selectionEnabled = message.enabled;
        if (selectionEnabled) {
          ensureSelectionStyles();
          attachListeners();
          logger.debug("selection enabled");
          return;
        }
        detachListeners();
        postMessage({ type: "select:hover", payload: null });
        postMessage({ type: "select:selected", payload: null });
        logger.debug("selection disabled");
      }
    });

    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", onShortcutKeyDown, { capture: true });
    });
  },
});
