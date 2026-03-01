import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import log from "loglevel";

import type {
  ElementInfo,
  RecordConverterOpenResult,
  SelectElementAction,
  SelectElementActionResult,
  SelectorOpenResult,
  SelectToolMessage,
} from "@/lib/selection";
import {
  buildScriptRunResponse,
  isScriptRunRequest,
  isScriptRunResponse,
  type ScriptRunRequest,
  type ScriptRunResponse,
} from "@/lib/script-runner";
import type { SidepanelShortcutMessage } from "@/lib/sidepanel-shortcuts";
import { isEditableTarget } from "@/lib/utils/dom-checks";
import { getShortcutTool } from "@/lib/utils/keyboard-shortcuts";
import {
  hoverClass,
  selectedClass,
  hoveredPreviewClass,
  noSelectClass,
  selectorsHoverExclusionClass,
} from "@/lib/constants/selection";
import { HoverManager, ensureSelectionStyles } from "./HoverManager";
import { SelectorPopupManager } from "./SelectorPopupManager";
import { RecordConverterPopupManager } from "./RecordConverterPopupManager";
import { generateElementSelector } from "./popup/selector";
import "@/styles/app.css";

const logger = log.getLogger("select-tool");
logger.setLevel("debug", false);

const filteredSelectionClasses = new Set([hoverClass, selectedClass, hoveredPreviewClass]);
const scriptRunBridgeTimeoutMs = 1800;

const filterSelectionClasses = (value: string | null) => {
  if (!value) return null;
  const tokens = value
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !filteredSelectionClasses.has(t));
  return tokens.length > 0 ? tokens.join(" ") : null;
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
    selector: generateElementSelector(element),
    attributes,
    boundingBox: { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height },
  };
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

const selectorRulePrefixPattern = /^(?:selector|baseSelector):\s*(.+)$/i;

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
    let selectedTarget: Element | null = null;
    let hoveredSelectorElements: Element[] = [];

    logger.debug("select tool content script initialized", { href: window.location.href });

    const hover = new HoverManager(
      () => selectionEnabled,
      (element) => postMessage({ type: "select:hover", payload: element ? getElementInfo(element) : null }),
    );

    const recordManager = new RecordConverterPopupManager(ctx);

    const selectorManager = new SelectorPopupManager(
      ctx,
      getElementInfo,
      () => selectedTarget,
      (el) => {
        selectedTarget = el;
      },
      () => selectionEnabled,
      (enabled, options) => setSelectionEnabled(enabled, options),
      (msg) => postMessage(msg),
    );

    const clearSelected = () => {
      if (!selectedTarget) return;
      selectedTarget.classList.remove(selectedClass);
      selectedTarget = null;
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
      logger.debug("runtime message sent", message);
      void browser.runtime.sendMessage(message).catch((error: unknown) => {
        if (isNoReceiverError(error)) {
          stopSelection("receiver-missing");
          return;
        }
        logger.error("select tool message failed", { type: message.type, error });
      });
    };

    const postMessage = (message: SelectToolMessage) => sendRuntimeMessage(message);

    const isExcludedFromSelection = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest(`.${noSelectClass}`));
    };

    const applySelection = (target: Element) => {
      selectorManager.clear({ resumeSelection: false });
      if (selectedTarget && selectedTarget !== target) selectedTarget.classList.remove(selectedClass);
      selectedTarget = target;
      ensureSelectionStyles();
      selectedTarget.classList.add(selectedClass);
      const info = getElementInfo(target);
      postMessage({ type: "select:selected", payload: info });
      logger.debug("element selected", { target: describeElementCompact(target), selector: info.selector });
    };

    const readClipboardText = async (): Promise<string | null> => {
      if (!window.isSecureContext || typeof navigator.clipboard?.readText !== "function") {
        return null;
      }
      return navigator.clipboard.readText();
    };

    const writeClipboardText = async (value: string): Promise<boolean> => {
      if (!window.isSecureContext || typeof navigator.clipboard?.writeText !== "function") {
        return false;
      }
      await navigator.clipboard.writeText(value);
      return true;
    };

    const clearSelectedAndNotify = () => {
      clearSelected();
      postMessage({ type: "select:selected", payload: null });
    };

    const runSelectElementAction = async (action: SelectElementAction): Promise<SelectElementActionResult> => {
      const target = selectedTarget;
      if (!target?.isConnected) {
        return {
          ok: false,
          error: "Select an element first.",
        };
      }

      if (action === "copy") {
        const copied = await writeClipboardText(target.outerHTML);
        if (!copied) {
          return {
            ok: false,
            error: "Copy is unavailable on this page.",
          };
        }

        return { ok: true };
      }

      if (action === "click") {
        logger.debug("Clicking target", target);
        (target as HTMLElement).click();
        return { ok: true };
      }

      if (action === "cut") {
        const copied = await writeClipboardText(target.outerHTML);
        if (!copied) {
          return {
            ok: false,
            error: "Cut is unavailable on this page.",
          };
        }

        target.remove();
        clearSelectedAndNotify();
        return { ok: true };
      }

      if (action === "paste") {
        const pasted = (await readClipboardText())?.trim();
        if (!pasted) {
          return {
            ok: false,
            error: "Clipboard is empty or unavailable.",
          };
        }

        if (!target.parentElement) {
          return {
            ok: false,
            error: "Selected element has no parent element.",
          };
        }

        target.insertAdjacentHTML("afterend", pasted);
        return { ok: true };
      }

      if (action === "delete") {
        target.remove();
        clearSelectedAndNotify();
        return { ok: true };
      }

      return {
        ok: false,
        error: "Unsupported action.",
      };
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
        hover.clearHoverAndNotify();
        return;
      }
      hover.scheduleHover(getEventTarget(event));
    };

    const onPointerOut = (event: MouseEvent) => {
      if (!selectionEnabled) return;
      if (event.relatedTarget === null) hover.clearHoverAndNotify();
    };

    const onWindowBlur = () => {
      if (selectionEnabled) hover.clearHoverAndNotify();
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
      if (selectorManager.hasPopup) selectorManager.clear({ resumeSelection: false });
      applySelection(target);
      setSelectionEnabled(false, { clearSelection: false });
    };

    const onViewportChange = () => {
      if (!selectionEnabled) return;
      hover.refreshLabel();
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
      hover.dispose();
      clearSelected();
      selectorManager.clear({ resumeSelection: false });
      recordManager.clear();
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
        respond(
          buildScriptRunResponse(request.requestId, "Script runner did not respond. Reload the page and try again."),
        );
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
      logger.debug("select tool message received", selectMessage);
      if (selectMessage.type === "selector:open") {
        recordManager.clear();
        void selectorManager
          .open(selectMessage.payload, selectMessage.mode ?? "pp-api")
          .then((opened) => {
            sendResponse({
              opened,
            } satisfies SelectorOpenResult);
          })
          .catch(() => {
            sendResponse({
              opened: false,
            } satisfies SelectorOpenResult);
          });
        return true;
      }
      if (selectMessage.type === "record:converter:open") {
        const payload = selectMessage.payload;
        if (
          !payload ||
          typeof payload !== "object" ||
          !Array.isArray(payload.timeline) ||
          typeof payload.existingCode !== "string"
        ) {
          logger.error("Invalid record converter open payload", {
            payload,
          });
          sendResponse({
            opened: false,
            error: "Invalid record converter payload.",
          } satisfies RecordConverterOpenResult);
          return false;
        }

        let hasResponded = false;
        const safeSendResponse = (result: RecordConverterOpenResult, reason: string) => {
          logger.debug("record converter open response", {
            reason,
            opened: result.opened,
            error: result.error,
          });
          try {
            sendResponse(result);
          } catch (error: unknown) {
            logger.error("Failed to send record converter open response", {
              reason,
              error,
              result,
            });
          }
        };

        const responseTimeoutId = globalThis.setTimeout(() => {
          if (hasResponded) {
            return;
          }

          hasResponded = true;
          logger.error("Record converter open timed out before responding", {
            timelineSize: payload.timeline.length,
            existingCodeLength: payload.existingCode.length,
          });
          safeSendResponse(
            {
              opened: false,
              error: "Timed out while opening record converter popup.",
            } satisfies RecordConverterOpenResult,
            "timeout",
          );
        }, 4000);

        const reply = (result: RecordConverterOpenResult) => {
          if (hasResponded) {
            return;
          }

          hasResponded = true;
          globalThis.clearTimeout(responseTimeoutId);
          safeSendResponse(result, "resolved");
        };

        if (selectionEnabled) {
          setSelectionEnabled(false, { clearSelection: false });
        }
        selectorManager.clear({ resumeSelection: false });
        void recordManager
          .open(payload)
          .then((result) => {
            reply(result);
          })
          .catch((error: unknown) => {
            logger.error("Failed to handle record converter open request", {
              error,
              timelineSize: payload.timeline.length,
              existingCodeLength: payload.existingCode.length,
            });
            reply({
              opened: false,
              error: "Unable to open record converter popup.",
            });
          });
        return true;
      }
      if (selectMessage.type === "select:parent") {
        if (!selectedTarget) {
          sendResponse({
            ok: false,
            error: "Select an element first.",
          });
          return false;
        }
        const parent = selectedTarget?.parentElement;
        if (!parent) {
          logger.debug("select parent skipped", { reason: "no-parent" });
          sendResponse({
            ok: false,
            error: "Selected element has no parent.",
          });
          return false;
        }
        hover.clearHoverAndNotify();
        applySelection(parent);
        sendResponse({
          ok: true,
          payload: getElementInfo(parent),
        });
        return false;
      }
      if (selectMessage.type === "select:action") {
        void runSelectElementAction(selectMessage.action)
          .then((result) => {
            sendResponse(result);
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Unable to update the selected element.";
            sendResponse({
              ok: false,
              error: message,
            } satisfies SelectElementActionResult);
          });
        return true;
      }
      if (selectMessage.type === "select:toggle") {
        if (selectorManager.hasPopup) {
          if (selectMessage.enabled) {
            selectorManager.resumeSelectionAfterPopup = true;
            if (selectionEnabled) {
              setSelectionEnabled(false);
            } else {
              postMessage({ type: "select:mode", enabled: false });
            }
            return false;
          }
          selectorManager.resumeSelectionAfterPopup = false;
        }
        setSelectionEnabled(selectMessage.enabled, { clearSelection: selectMessage.clearSelection });
      }
      if (selectMessage.type === "selectors:hover") {
        applyHoveredSelectorElements(selectMessage.payload);
      }
      return false;
    });

    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", onShortcutKeyDown, { capture: true });
      selectorManager.clear({ resumeSelection: false });
      recordManager.clear();
    });
  },
});
