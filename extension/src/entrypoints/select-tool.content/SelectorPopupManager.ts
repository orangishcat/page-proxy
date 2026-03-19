import { mount, unmount } from "svelte";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import log from "@/lib/logger";
import { buildPropertyList } from "@/lib/utils/element-info";
import { noSelectClass, contentUiRootClass, selectedClass } from "@/lib/constants/selection";
import type {
  ElementInfo,
  SelectorPopupMode,
  SelectorSavePayload,
  SelectorSaveResult,
  SelectToolMessage,
} from "@/lib/selection";
import { ensureSelectionStyles } from "./HoverManager";
import { readBaseSelectorFromCode } from "./popup/base-selector";
import { normalizeSelectorFromCssEditor, readDeclarationSourceFromCssEditor, parseCssDeclarations } from "./css-editor-utils";
import PopupContainer from "./PopupContainer.svelte";
import type { DevScreenshotCaptureTarget } from "@/lib/dev-screenshots";

type ContentScriptContext = Parameters<typeof createShadowRootUi>[0];

const logger = log.getLogger("select-popup-manager");

export class SelectorPopupManager {
  private popupApp: ReturnType<typeof mount> | null = null;
  private shadowUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  private popupTarget: Element | null = null;
  private popupFrame: number | null = null;
  private popupMode: SelectorPopupMode | null = null;
  resumeSelectionAfterPopup = false;
  private applyStyleMode = false;

  constructor(
    private readonly ctx: ContentScriptContext,
    private readonly getElementInfo: (element: Element) => ElementInfo,
    private readonly getSelectedTarget: () => Element | null,
    private readonly setSelectedTarget: (el: Element | null) => void,
    private readonly isSelectionEnabled: () => boolean,
    private readonly setSelectionEnabled: (enabled: boolean, options?: { clearSelection?: boolean }) => void,
    private readonly onPostMessage: (msg: SelectToolMessage) => void,
  ) {}

  get hasPopup(): boolean {
    return this.popupApp !== null || this.shadowUi !== null;
  }

  clear({ resumeSelection = true }: { resumeSelection?: boolean } = {}): void {
    this.applyStyleMode = false;
    this.popupMode = null;
    const hadPopup =
      this.popupApp !== null || this.shadowUi !== null || this.popupTarget !== null || this.popupFrame !== null;
    if (this.popupApp) {
      void unmount(this.popupApp);
      this.popupApp = null;
    }
    if (this.shadowUi) {
      this.shadowUi.remove();
      this.shadowUi = null;
    }
    this.popupTarget = null;
    if (this.popupFrame !== null) {
      window.cancelAnimationFrame(this.popupFrame);
      this.popupFrame = null;
    }
    logger.debug("selector popup closed");
    if (hadPopup) {
      const shouldResume = resumeSelection && this.resumeSelectionAfterPopup;
      this.resumeSelectionAfterPopup = false;
      if (shouldResume) {
        this.setSelectionEnabled(true);
      }
    }
  }

  getScreenshotCapture(): DevScreenshotCaptureTarget | null {
    const popupRoot = this.shadowUi?.shadowHost.shadowRoot?.querySelector(`.${contentUiRootClass}`);
    if (!(popupRoot instanceof HTMLElement)) {
      return null;
    }

    return {
      element: popupRoot,
      name: this.popupMode === "css" ? "css-inspector" : "selector-popup",
    };
  }

  private resolveTarget(requestedInfo: ElementInfo | null): Element | null {
    const selected = this.getSelectedTarget();
    if (selected?.isConnected) return selected;
    if (requestedInfo?.id) {
      const byId = document.getElementById(requestedInfo.id);
      if (byId?.isConnected) {
        this.setSelectedTarget(byId);
        return byId;
      }
    }
    if (requestedInfo?.selector) {
      const bySelector = document.querySelector(requestedInfo.selector);
      if (bySelector?.isConnected) {
        this.setSelectedTarget(bySelector);
        return bySelector;
      }
    }
    const selectedEl = document.querySelector(`.${selectedClass}`);
    if (selectedEl?.isConnected) {
      this.setSelectedTarget(selectedEl);
      return selectedEl;
    }
    return null;
  }

  private async handleSave(payload: SelectorSavePayload): Promise<SelectorSaveResult> {
    if (!this.popupTarget?.isConnected) {
      return { ok: false, error: "Selected element is no longer available." };
    }

    if (this.applyStyleMode) {
      const backtickMatch = /`([\s\S]*?)`/.exec(payload.code);
      if (!backtickMatch) {
        return { ok: false, error: "Unable to extract CSS from the editor content." };
      }
      const declarationText = readDeclarationSourceFromCssEditor(backtickMatch[1].trim());
      const declarations = parseCssDeclarations(declarationText);
      if (declarations.length === 0) {
        return { ok: false, error: "No CSS declarations found to apply." };
      }
      const cssValues: Record<string, string> = {};
      for (const decl of declarations) {
        cssValues[decl.key] = decl.value;
      }
      const target = this.popupTarget;
      if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) {
        return { ok: false, error: "Selected element does not support inline styles." };
      }
      for (const [key, value] of Object.entries(cssValues)) {
        target.style.setProperty(key, value);
      }
      logger.debug("runtime message sent", { type: "selector:apply-style:save" });
      await browser.runtime
        .sendMessage({ type: "selector:apply-style:save", cssValues } satisfies SelectToolMessage)
        .catch((error: unknown) => {
          logger.error("Failed to send apply-style:save", { error });
        });
      this.clear();
      return { ok: true };
    }

    logger.debug("runtime message sent", { type: "selector:save" });
    const response: unknown = await browser.runtime
      .sendMessage({ type: "selector:save", payload } satisfies SelectToolMessage)
      .catch((error: unknown) => {
        logger.error("Failed to save selector", { error });
        return null;
      });
    if (response === null) {
      return { ok: false, error: "Unable to save selector to the editor." };
    }
    const result = response as SelectorSaveResult | undefined;
    if (result?.ok) {
      this.clear();
      return result;
    }
    return { ok: false, error: result?.error ?? "Unable to save selector to the editor." };
  }

  private resolveTargetFromSelector(selector: string | null | undefined): Element | null {
    if (!selector) return null;
    const found = document.querySelector(selector);
    return found?.isConnected ? found : null;
  }

  async open(
    requestedInfo: ElementInfo | null,
    mode: SelectorPopupMode = "pp-api",
    initialCssContent?: string,
    initialCode?: string,
    options?: { applyStyle?: boolean },
  ): Promise<boolean> {
    let target = this.resolveTarget(requestedInfo);
    const selector =
      mode === "pp-api"
        ? initialCode && readBaseSelectorFromCode(initialCode)
        : initialCssContent && normalizeSelectorFromCssEditor(initialCssContent);

    if (!target) target = this.resolveTargetFromSelector(selector);

    ensureSelectionStyles();
    this.clear({ resumeSelection: false });
    // Set applyStyleMode after clear() to avoid being wiped by the reset inside clear().
    this.applyStyleMode = options?.applyStyle === true;
    this.popupMode = mode;
    if (this.isSelectionEnabled()) {
      this.resumeSelectionAfterPopup = true;
      this.setSelectionEnabled(false, { clearSelection: false });
    } else {
      this.resumeSelectionAfterPopup = false;
      this.onPostMessage({ type: "select:mode", enabled: false });
    }

    if (target) {
      if (!target.classList.contains(selectedClass)) {
        this.getSelectedTarget()?.classList.remove(selectedClass);
        target.classList.add(selectedClass);
      }
      this.setSelectedTarget(target);
    }

    const info = target ? this.getElementInfo(target) : null;
    const propertyItems = info ? buildPropertyList(info) : [];
    this.popupTarget = target;

    this.shadowUi = await createShadowRootUi(this.ctx, {
      name: "pp-selector-popup",
      position: "overlay",
      anchor: "body",
      zIndex: 2147483647,
      onMount: (container: HTMLElement) => {
        const app = mount(PopupContainer, {
          target: container,
          props: {
            info,
            propertyItems,
            targetElement: this.popupTarget,
            onSave: (p: SelectorSavePayload) => this.handleSave(p),
            onCancel: () => this.clear(),
            mode,
            initialCssContent,
            initialCode,
          },
        });
        this.popupApp = app;
        return app;
      },
    });

    this.shadowUi.mount();
    this.shadowUi.shadowHost.classList.add(noSelectClass, contentUiRootClass);
    logger.debug("selector popup opened", {
      info,
      target: this.popupTarget,
      mode,
      initialCssContent,
      initialCode,
    });
    return true;
  }
}
