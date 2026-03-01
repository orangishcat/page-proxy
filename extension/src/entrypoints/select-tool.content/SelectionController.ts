import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import log from "loglevel";
import type { SelectElementAction, SelectElementActionResult, SelectToolMessage } from "@/lib/selection";
import type { SidepanelShortcutMessage } from "@/lib/sidepanel-shortcuts";
import { isEditableTarget } from "@/lib/utils/dom-checks";
import { getShortcutTool } from "@/lib/utils/keyboard-shortcuts";
import {
  selectedClass,
  noSelectClass,
  hoveredPreviewClass,
  selectorsHoverExclusionClass,
} from "@/lib/constants/selection";
import { HoverManager, ensureSelectionStyles } from "./HoverManager";
import { SelectorPopupManager } from "./SelectorPopupManager";
import { RecordConverterPopupManager } from "./RecordConverterPopupManager";
import { getElementInfo, describeElementCompact, getEventTarget } from "./element-info";
import { toPreviewCssSelectors } from "./selector-preview";
import { runSelectElementAction } from "./element-actions";

type ContentScriptContext = Parameters<typeof createShadowRootUi>[0];

const logger = log.getLogger("selection-manager");

export class SelectionController {
  selectionEnabled = false;
  selectedTarget: Element | null = null;
  private hoveredSelectorElements: Element[] = [];

  readonly hover: HoverManager;
  readonly selectorManager: SelectorPopupManager;
  readonly recordManager: RecordConverterPopupManager;

  constructor(ctx: ContentScriptContext) {
    this.hover = new HoverManager(
      () => this.selectionEnabled,
      (element) => this.postMessage({ type: "select:hover", payload: element ? getElementInfo(element) : null }),
    );
    this.recordManager = new RecordConverterPopupManager(ctx);
    this.selectorManager = new SelectorPopupManager(
      ctx,
      getElementInfo,
      () => this.selectedTarget,
      (el) => {
        this.selectedTarget = el;
      },
      () => this.selectionEnabled,
      (enabled, options) => this.setSelectionEnabled(enabled, options),
      (msg) => this.postMessage(msg),
    );
  }

  clearSelected = (): void => {
    if (!this.selectedTarget) return;
    this.selectedTarget.classList.remove(selectedClass);
    this.selectedTarget = null;
  };

  clearHoveredSelectorElements = (): void => {
    this.hoveredSelectorElements.forEach((element) => element.classList.remove(hoveredPreviewClass));
    this.hoveredSelectorElements = [];
  };

  applyHoveredSelectorElements = (
    payload: Extract<SelectToolMessage, { type: "selectors:hover" }>["payload"],
  ): void => {
    this.clearHoveredSelectorElements();
    if (!payload) return;
    const selectors = toPreviewCssSelectors(payload.selectorName, payload.rules);
    if (selectors.length === 0) return;

    const matchingElements = new Set<Element>();
    selectors.forEach((selectorText) => {
      Array.from(document.querySelectorAll(selectorText))
        .filter((element) => !element.closest(`.${selectorsHoverExclusionClass}`))
        .forEach((element) => matchingElements.add(element));
    });
    if (matchingElements.size === 0) return;

    ensureSelectionStyles();
    this.hoveredSelectorElements = Array.from(matchingElements);
    this.hoveredSelectorElements.forEach((element) => element.classList.add(hoveredPreviewClass));
  };

  private isNoReceiverError = (error: unknown): boolean => {
    const msg =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message
            : "";
    return (
      msg.includes("Receiving end does not exist") ||
      msg.includes("Could not establish connection") ||
      msg.includes("No receiving end")
    );
  };

  stopSelection = (reason: string): void => {
    if (!this.selectionEnabled) return;
    this.selectionEnabled = false;
    this.detachListeners();
    logger.debug("selection stopped", { reason });
  };

  sendRuntimeMessage = (message: SelectToolMessage | SidepanelShortcutMessage): void => {
    logger.debug("runtime message sent", message);
    void browser.runtime.sendMessage(message).catch((error: unknown) => {
      if (this.isNoReceiverError(error)) {
        this.stopSelection("receiver-missing");
        return;
      }
      logger.error("select tool message failed", { type: message.type, error });
    });
  };

  postMessage = (message: SelectToolMessage): void => this.sendRuntimeMessage(message);

  isExcludedFromSelection = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(`.${noSelectClass}`));
  };

  applySelection = (target: Element): void => {
    this.selectorManager.clear({ resumeSelection: false });
    if (this.selectedTarget && this.selectedTarget !== target) {
      this.selectedTarget.classList.remove(selectedClass);
    }
    this.selectedTarget = target;
    ensureSelectionStyles();
    this.selectedTarget.classList.add(selectedClass);
    const info = getElementInfo(target);
    this.postMessage({ type: "select:selected", payload: info });
    logger.debug("element selected", { target: describeElementCompact(target), selector: info.selector });
  };

  clearSelectedAndNotify = (): void => {
    this.clearSelected();
    this.postMessage({ type: "select:selected", payload: null });
  };

  runAction = (action: SelectElementAction): Promise<SelectElementActionResult> =>
    runSelectElementAction(action, this.selectedTarget, this.clearSelectedAndNotify);

  private stopEvent = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  setSelectionEnabled = (enabled: boolean, options: { clearSelection?: boolean } = {}): void => {
    const clearSelection = options.clearSelection ?? true;
    if (enabled === this.selectionEnabled) return;
    this.selectionEnabled = enabled;
    this.postMessage({ type: "select:mode", enabled: this.selectionEnabled });
    if (this.selectionEnabled) {
      ensureSelectionStyles();
      this.attachListeners();
      logger.debug("selection enabled");
      return;
    }
    this.detachListeners();
    this.postMessage({ type: "select:hover", payload: null });
    if (clearSelection) this.postMessage({ type: "select:selected", payload: null });
    logger.debug("selection disabled");
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.selectionEnabled) return;
    if (this.isExcludedFromSelection(event.target)) {
      this.hover.clearHoverAndNotify();
      return;
    }
    this.hover.scheduleHover(getEventTarget(event));
  };

  private onPointerOut = (event: MouseEvent): void => {
    if (!this.selectionEnabled) return;
    if (event.relatedTarget === null) this.hover.clearHoverAndNotify();
  };

  private onWindowBlur = (): void => {
    if (this.selectionEnabled) this.hover.clearHoverAndNotify();
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.selectionEnabled || this.isExcludedFromSelection(event.target)) return;
    this.stopEvent(event);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.selectionEnabled || this.isExcludedFromSelection(event.target)) return;
    this.stopEvent(event);
  };

  private onClick = (event: MouseEvent): void => {
    if (!this.selectionEnabled || this.isExcludedFromSelection(event.target)) return;
    const target = getEventTarget(event);
    this.stopEvent(event);
    if (!target) return;
    if (this.selectorManager.hasPopup) this.selectorManager.clear({ resumeSelection: false });
    this.applySelection(target);
    this.setSelectionEnabled(false, { clearSelection: false });
  };

  private onViewportChange = (): void => {
    if (!this.selectionEnabled) return;
    this.hover.refreshLabel();
  };

  onShortcutKeyDown = (event: KeyboardEvent): void => {
    if (this.isExcludedFromSelection(event.target) || this.isExcludedFromSelection(document.activeElement)) return;
    if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return;
    if (event.key === "Escape" && this.selectionEnabled) {
      event.preventDefault();
      this.setSelectionEnabled(false);
      return;
    }
    const tool = getShortcutTool(event);
    if (!tool) return;
    this.sendRuntimeMessage({ type: "sidepanel:shortcut", payload: { tool } } satisfies SidepanelShortcutMessage);
  };

  attachListeners = (): void => {
    window.addEventListener("pointermove", this.onPointerMove, { capture: true });
    window.addEventListener("mouseout", this.onPointerOut, { capture: true });
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("pointerdown", this.onPointerDown, { capture: true, passive: false });
    window.addEventListener("pointerup", this.onPointerUp, { capture: true, passive: false });
    window.addEventListener("click", this.onClick, { capture: true, passive: false });
    window.addEventListener("scroll", this.onViewportChange, { capture: true });
    window.addEventListener("resize", this.onViewportChange);
    logger.debug("select tool listeners attached");
  };

  detachListeners = (): void => {
    window.removeEventListener("pointermove", this.onPointerMove, { capture: true });
    window.removeEventListener("mouseout", this.onPointerOut, { capture: true });
    window.removeEventListener("blur", this.onWindowBlur);
    window.removeEventListener("pointerdown", this.onPointerDown, { capture: true });
    window.removeEventListener("pointerup", this.onPointerUp, { capture: true });
    window.removeEventListener("click", this.onClick, { capture: true });
    window.removeEventListener("scroll", this.onViewportChange, { capture: true });
    window.removeEventListener("resize", this.onViewportChange);
    this.hover.dispose();
    this.clearSelected();
    this.selectorManager.clear({ resumeSelection: false });
    this.recordManager.clear();
    this.clearHoveredSelectorElements();
    logger.debug("select tool listeners detached");
  };
}
