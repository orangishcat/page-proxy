import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { mount, unmount } from "svelte";
import log from "loglevel";
import { pa } from "@page-proxy/pp";

import type {
  ElementInfo,
  SelectCopyResult,
  SelectDeleteResult,
  SelectPasteLocation,
  SelectPasteResult,
  SelectorOpenResult,
  SelectorPopupMode,
  SelectorSavePayload,
  SelectorSaveResult,
  SelectToolMessage,
} from "@/lib/selection";
import {
  buildScriptRunResponse,
  isScriptRunRequest,
  isScriptRunResponse,
  type ScriptRunRequest,
  type ScriptRunResponse,
} from "@/lib/script-runner";
import type { SidepanelShortcutId, SidepanelShortcutMessage } from "@/lib/sidepanel-shortcuts";
import PopupContainer from "./PopupContainer.svelte";
import "@/styles/app.css";

const logger = log.getLogger("select-tool");
logger.setLevel("debug", false);

const hoverClass = "pp-hover";
const selectedClass = "pp-selected";
const hoveredPreviewClass = "pp-hovered";
const contentUiRootClass = "pp-content-ui-root";
const styleId = "page-proxy-selection-styles";
const selectorLabelId = "page-proxy-selector-label";
const copyIdAttribute = "data-copy-id";
const copyIdPrefix = "pp-copy-";
const filteredSelectionClasses = new Set([hoverClass, selectedClass, hoveredPreviewClass]);
const uiBaseFontSizePx = 16;
const scriptRunBridgeTimeoutMs = 1800;

const selectionStyles = `
.pp-hover { outline: 2px solid #86d24b !important; outline-offset: -1px !important; }
.pp-selected { outline: 2px solid #bb9348 !important; outline-offset: -1px !important; }
.pp-hovered { outline: 2px solid #86d24b !important; outline-offset: -1px !important; }
.pp-selected-label {
  position: fixed;
  z-index: 2147483646;
  background: #282824;
  color: #f2f0ea;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #3F403A;
  box-shadow: 0 4px 8px rgba(0,0,0,0.25);
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
      return "create";
    case "Digit3":
      return "selectors";
    case "Digit4":
      return "help";
    case "Digit5":
      return "share";
    case "Digit6":
      return "record";
    default:
      return null;
  }
};

const selectorRulePrefixPattern = /^(?:selector|baseSelector):\s*(.+)$/i;
const selectorsHoverExclusionClass = "pp-no-select-tool";

const normalizeCssSelector = (value: string) => value.trim().replace(/\s+/g, " ");

const toPreviewCssSelectors = (selectorName: string, rules: string[]) => {
  const candidates: string[] = [selectorName];
  rules.forEach((rule) => {
    const match = rule.match(selectorRulePrefixPattern);
    if (match?.[1]) {
      candidates.push(match[1]);
    }
  });

  const uniqueSelectors = new Set<string>();
  candidates.forEach((candidate) => {
    const normalized = normalizeCssSelector(candidate);
    if (!normalized) {
      return;
    }

    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return;
    }

    if (!CSS.supports(`selector(${normalized})`)) {
      return;
    }

    uniqueSelectors.add(normalized);
  });

  return Array.from(uniqueSelectors);
};

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,

  main(ctx) {
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
    let resumeSelectionAfterPopup = false;
    let hoveredSelectorElements: Element[] = [];
    let copiedTarget: Element | null = null;
    let copiedTargetHadCopyId = false;
    let copiedTargetOriginalCopyId: string | null = null;

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

    const clearSelectorPopup = ({ resumeSelection = true }: { resumeSelection?: boolean } = {}) => {
      const hadPopup = popupApp !== null || shadowUi !== null || popupTarget !== null || popupFrame !== null;
      if (popupApp) {
        void unmount(popupApp);
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
      if (hadPopup) {
        const shouldResumeSelection = resumeSelection && resumeSelectionAfterPopup;
        resumeSelectionAfterPopup = false;
        if (shouldResumeSelection) {
          setSelectionEnabled(true);
        }
      }
    };

    const clearHoveredSelectorElements = () => {
      hoveredSelectorElements.forEach((element) => {
        element.classList.remove(hoveredPreviewClass);
      });
      hoveredSelectorElements = [];
    };

    const applyHoveredSelectorElements = (
      payload: Extract<SelectToolMessage, { type: "selectors:hover" }>["payload"],
    ) => {
      clearHoveredSelectorElements();
      if (!payload) {
        return;
      }

      const selectors = toPreviewCssSelectors(payload.selectorName, payload.rules);
      if (selectors.length === 0) {
        return;
      }

      const matchingElements = new Set<Element>();
      selectors.forEach((selectorText) => {
        Array.from(document.querySelectorAll(selectorText))
          .filter((element) => !element.closest(`.${selectorsHoverExclusionClass}`))
          .forEach((element) => {
            matchingElements.add(element);
          });
      });

      if (matchingElements.size === 0) {
        return;
      }

      ensureSelectionStyles();
      hoveredSelectorElements = Array.from(matchingElements);
      hoveredSelectorElements.forEach((element) => {
        element.classList.add(hoveredPreviewClass);
      });
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

    const sendRuntimeMessage = (message: SelectToolMessage | SidepanelShortcutMessage) => {
      logger.debug("runtime message sent", { type: message.type });
      void browser.runtime.sendMessage(message).catch((error: unknown) => {
        if (isNoReceiverError(error)) {
          stopSelection("receiver-missing");
          return;
        }
        logger.error("select tool message failed", { type: message.type, error });
      });
    };

    const postMessage = (message: SelectToolMessage) => sendRuntimeMessage(message);

    const handleSave = async (payload: SelectorSavePayload): Promise<SelectorSaveResult> => {
      if (!popupTarget?.isConnected) {
        return { ok: false, error: "Selected element is no longer available." };
      }
      const info = getElementInfo(popupTarget);

      logger.debug("selector popup save requested", {
        target: describeElementCompact(popupTarget),
        name: payload.name,
        selector: info.selector,
      });

      logger.debug("runtime message sent", { type: "selector:save" });
      const response: unknown = await browser.runtime
        .sendMessage({ type: "selector:save", payload } satisfies SelectToolMessage)
        .catch((error: unknown) => {
          logger.error("Failed to save selector", { error });
          return null;
        });

      if (response === null) {
        return {
          ok: false,
          error: "Unable to save selector to the editor.",
        };
      }

      const result = response as SelectorSaveResult | undefined;
      if (result?.ok) {
        clearSelectorPopup();
        return result;
      }

      return {
        ok: false,
        error: result?.error ?? "Unable to save selector to the editor.",
      };
    };

    const noSelectClass = "pp-no-select-tool";

    const clearCopiedTarget = () => {
      if (!copiedTarget) {
        return;
      }

      if (copiedTarget.isConnected) {
        if (copiedTargetHadCopyId && copiedTargetOriginalCopyId !== null) {
          copiedTarget.setAttribute(copyIdAttribute, copiedTargetOriginalCopyId);
        } else if (!copiedTargetHadCopyId) {
          copiedTarget.removeAttribute(copyIdAttribute);
        }
      }

      copiedTarget = null;
      copiedTargetHadCopyId = false;
      copiedTargetOriginalCopyId = null;
    };

    const assignCopyId = (target: Element) => {
      clearCopiedTarget();
      Array.from(document.querySelectorAll(`[${copyIdAttribute}]`)).forEach((element) => {
        const marker = element.getAttribute(copyIdAttribute);
        if (marker?.startsWith(copyIdPrefix)) {
          element.removeAttribute(copyIdAttribute);
        }
      });
      copiedTarget = target;
      copiedTargetHadCopyId = target.hasAttribute(copyIdAttribute);
      copiedTargetOriginalCopyId = target.getAttribute(copyIdAttribute);
      const copyId = `${copyIdPrefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      target.setAttribute(copyIdAttribute, copyId);
      return copyId;
    };

    const resolveSelectionTarget = (requestedInfo: ElementInfo | null) => {
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

    const handleCopySelection = (requestedInfo: ElementInfo | null, cut: boolean): SelectCopyResult => {
      const target = resolveSelectionTarget(requestedInfo);
      if (!target) {
        return {
          ok: false,
          error: "Selected element is no longer available.",
        };
      }

      const copyId = assignCopyId(target);
      logger.debug("selection copied", {
        target: describeElementCompact(target),
        copyId,
        cut,
      });

      return {
        ok: true,
        copyId,
        cut,
      };
    };

    const resolveCopiedTarget = (copyId: string) => {
      if (copiedTarget?.isConnected && copiedTarget.getAttribute(copyIdAttribute) === copyId) {
        return copiedTarget;
      }

      const byCopyId = document.querySelector(`[${copyIdAttribute}="${escapeSelector(copyId)}"]`);
      if (byCopyId?.isConnected) {
        copiedTarget = byCopyId;
        copiedTargetHadCopyId = false;
        copiedTargetOriginalCopyId = null;
        return byCopyId;
      }

      return null;
    };

    const handlePasteSelection = (
      requestedInfo: ElementInfo | null,
      options: {
        copyId: string;
        cut: boolean;
        childPosition: number;
        pasteLocation: SelectPasteLocation;
      },
    ): SelectPasteResult => {
      const target = resolveSelectionTarget(requestedInfo);
      if (!target) {
        return {
          ok: false,
          error: "Selected target element is no longer available.",
        };
      }

      const source = resolveCopiedTarget(options.copyId);
      if (!source) {
        return {
          ok: false,
          error: "Copied element is no longer available.",
        };
      }

      if (!options.copyId.startsWith(copyIdPrefix)) {
        return {
          ok: false,
          error: "Invalid copied element reference.",
        };
      }

      if (options.cut && source === target && options.pasteLocation === "child") {
        return {
          ok: false,
          error: "Cannot paste an element into itself.",
        };
      }

      if (options.cut && source.contains(target)) {
        return {
          ok: false,
          error: "Cannot paste an element into its own descendant.",
        };
      }

      if ((options.pasteLocation === "before" || options.pasteLocation === "after") && !target.parentElement) {
        return {
          ok: false,
          error: "Cannot paste before or after the root element.",
        };
      }

      const normalizedChildPosition = Number.isFinite(options.childPosition)
        ? Math.max(1, Math.floor(options.childPosition))
        : 1;
      const result = pa.moveNode(source, normalizedChildPosition - 1, target, {
        pasteLocation: options.pasteLocation,
        copy: !options.cut,
      });

      if (!options.cut && result.getAttribute(copyIdAttribute) === options.copyId) {
        result.removeAttribute(copyIdAttribute);
      }

      if (options.cut) {
        copiedTarget = result;
      }

      logger.debug("selection pasted", {
        source: describeElementCompact(source),
        target: describeElementCompact(target),
        pasteLocation: options.pasteLocation,
        childPosition: normalizedChildPosition,
        cut: options.cut,
      });

      return {
        ok: true,
        copyId: options.copyId,
        cut: options.cut,
      };
    };

    const handleDeleteSelection = (requestedInfo: ElementInfo | null): SelectDeleteResult => {
      const target = resolveSelectionTarget(requestedInfo);
      if (!target) {
        return {
          ok: false,
          error: "Selected element is no longer available.",
        };
      }

      if (target === document.documentElement || target === document.body) {
        return {
          ok: false,
          error: "Cannot delete the root page element.",
        };
      }

      const shouldClearHoverTarget =
        hoverTarget !== null && (hoverTarget === target || target.contains(hoverTarget));
      if (shouldClearHoverTarget) {
        clearHover();
        postMessage({ type: "select:hover", payload: null });
      }

      const shouldClosePopup = popupTarget !== null && (popupTarget === target || target.contains(popupTarget));
      if (shouldClosePopup) {
        clearSelectorPopup({ resumeSelection: false });
      }

      const shouldClearCopiedTarget =
        copiedTarget !== null && (copiedTarget === target || target.contains(copiedTarget));
      if (shouldClearCopiedTarget) {
        clearCopiedTarget();
      }

      clearSelected();
      target.remove();
      postMessage({ type: "select:selected", payload: null });

      logger.debug("selection deleted", {
        target: describeElementCompact(target),
      });

      return {
        ok: true,
      };
    };

    const openSelectorPopup = async (requestedInfo: ElementInfo | null, mode: SelectorPopupMode = "pp-api") => {
      const target = resolveSelectionTarget(requestedInfo);
      if (!target) {
        logger.debug("selector popup open skipped", {
          reason: "no-target",
          selectionEnabled,
        });
        return false;
      }

      ensureSelectionStyles();
      clearSelectorPopup({ resumeSelection: false });
      if (selectionEnabled) {
        resumeSelectionAfterPopup = true;
        setSelectionEnabled(false, { clearSelection: false });
      } else {
        resumeSelectionAfterPopup = false;
        postMessage({ type: "select:mode", enabled: false });
      }

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
          const app = mount(PopupContainer, {
            target: container,
            props: {
              info,
              propertyItems,
              targetElement: popupTarget,
              onSave: handleSave,
              onCancel: clearSelectorPopup,
              mode,
            },
          });
          popupApp = app;
          return app;
        },
      });

      shadowUi.mount();
      shadowUi.shadowHost.classList.add(noSelectClass);
      shadowUi.shadowHost.classList.add(contentUiRootClass);
      logger.debug("selector popup opened", {
        target: describeElementCompact(target),
        selector: info.selector,
      });
      return true;
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
      clearSelectorPopup({ resumeSelection: false });
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
        const offset = uiBaseFontSizePx * 0.5;
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

    const setSelectionEnabled = (enabled: boolean, options: { clearSelection?: boolean } = {}) => {
      const clearSelection = options.clearSelection ?? true;
      if (enabled === selectionEnabled) return;
      selectionEnabled = enabled;
      postMessage({ type: "select:mode", enabled: selectionEnabled });
      if (selectionEnabled) {
        ensureSelectionStyles();
        attachListeners();
        logger.debug("selection enabled");
        return;
      }
      detachListeners();
      postMessage({ type: "select:hover", payload: null });
      if (clearSelection) {
        postMessage({ type: "select:selected", payload: null });
      }
      logger.debug("selection disabled");
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
      if (shadowUi) clearSelectorPopup({ resumeSelection: false });
      applySelection(target);
    };

    const onViewportChange = () => {
      if (!selectionEnabled) return;
      if (hoverTarget) scheduleLabelUpdate(hoverTarget);
    };

    const onShortcutKeyDown = (event: KeyboardEvent) => {
      if (isExcludedFromSelection(event.target) || isExcludedFromSelection(document.activeElement)) return;

      const hasEditableFocus = isEditableTarget(event.target) || isEditableTarget(document.activeElement);
      if (hasEditableFocus) return;

      if (event.key === "Escape" && selectionEnabled) {
        event.preventDefault();
        setSelectionEnabled(false);
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
      clearSelectorPopup({ resumeSelection: false });
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
      clearHoveredSelectorElements();
      logger.debug("select tool listeners detached");
    };

    window.addEventListener("keydown", onShortcutKeyDown, { capture: true });

    const isWindowSource = (source: MessageEventSource | null) => source === window || source === null;

    const forwardScriptRunToMainWorld = (
      request: ScriptRunRequest,
      sendResponse: (response?: ScriptRunResponse) => void,
    ) => {
      const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;
      let settled = false;
      let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId !== null) {
          globalThis.clearTimeout(timeoutId);
          timeoutId = null;
        }
        window.removeEventListener("message", onMessage);
      };

      const respond = (response: ScriptRunResponse) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        sendResponse(response);
      };

      const onMessage = (event: MessageEvent) => {
        if (!isWindowSource(event.source)) {
          return;
        }

        if (!isScriptRunResponse(event.data) || event.data.requestId !== request.requestId) {
          return;
        }

        logger.debug("window message received", { type: event.data.type, requestId: event.data.requestId });
        respond(event.data);
      };

      window.addEventListener("message", onMessage);
      timeoutId = globalThis.setTimeout(() => {
        respond(buildScriptRunResponse(request.requestId, "Script runner did not respond. Reload the page and try again."));
      }, scriptRunBridgeTimeoutMs);

      logger.debug("window message sent", { type: request.type, requestId: request.requestId });
      window.postMessage(request, targetOrigin);
      return true;
    };

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (isScriptRunRequest(message)) {
        logger.debug("script run bridge received", { requestId: message.requestId });
        return forwardScriptRunToMainWorld(message, sendResponse);
      }

      if (!message || typeof message !== "object" || typeof (message as { type?: unknown }).type !== "string") {
        return false;
      }

      const selectMessage = message as SelectToolMessage;
      logger.debug("select tool message received", { type: selectMessage.type });
      if (selectMessage.type === "selector:open") {
        void openSelectorPopup(selectMessage.payload, selectMessage.mode ?? "pp-api").then((opened) => {
          sendResponse({
            opened,
          } satisfies SelectorOpenResult);
        }).catch(() => {
          sendResponse({
            opened: false,
          } satisfies SelectorOpenResult);
        });
        return true;
      }
      if (selectMessage.type === "select:copy") {
        sendResponse(handleCopySelection(selectMessage.payload, selectMessage.cut));
        return false;
      }
      if (selectMessage.type === "select:paste") {
        sendResponse(
          handlePasteSelection(selectMessage.payload, {
            copyId: selectMessage.copyId,
            cut: selectMessage.cut,
            childPosition: selectMessage.childPosition,
            pasteLocation: selectMessage.pasteLocation,
          }),
        );
        return false;
      }
      if (selectMessage.type === "select:delete") {
        sendResponse(handleDeleteSelection(selectMessage.payload));
        return false;
      }
      if (selectMessage.type === "select:parent") {
        if (!selectionEnabled) {
          return false;
        }
        const parent = selectedTarget?.parentElement;
        if (!parent) {
          logger.debug("select parent skipped", { reason: "no-parent" });
          return false;
        }
        clearHoverAndNotify();
        applySelection(parent);
        return false;
      }
      if (selectMessage.type === "select:toggle") {
        if (shadowUi) {
          if (selectMessage.enabled) {
            resumeSelectionAfterPopup = true;
            if (selectionEnabled) {
              setSelectionEnabled(false);
            } else {
              postMessage({ type: "select:mode", enabled: false });
            }
            return false;
          }
          resumeSelectionAfterPopup = false;
        }
        setSelectionEnabled(selectMessage.enabled);
      }
      if (selectMessage.type === "selectors:hover") {
        applyHoveredSelectorElements(selectMessage.payload);
      }
      return false;
    });

    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", onShortcutKeyDown, { capture: true });
    });
  },
});
