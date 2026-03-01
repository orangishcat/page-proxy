import { mount, unmount } from "svelte";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import log from "loglevel";
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
import PopupContainer from "./PopupContainer.svelte";

type ContentScriptContext = Parameters<typeof createShadowRootUi>[0];

const logger = log.getLogger("select-tool");

export class SelectorPopupManager {
  private popupApp: ReturnType<typeof mount> | null = null;
  private shadowUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  private popupTarget: Element | null = null;
  private popupFrame: number | null = null;
  resumeSelectionAfterPopup = false;

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
    const hadPopup =
      this.popupApp !== null ||
      this.shadowUi !== null ||
      this.popupTarget !== null ||
      this.popupFrame !== null;
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

  async open(requestedInfo: ElementInfo | null, mode: SelectorPopupMode = "pp-api"): Promise<boolean> {
    const target = this.resolveTarget(requestedInfo);
    if (!target) {
      logger.debug("selector popup open skipped", { reason: "no-target" });
      return false;
    }

    ensureSelectionStyles();
    this.clear({ resumeSelection: false });
    if (this.isSelectionEnabled()) {
      this.resumeSelectionAfterPopup = true;
      this.setSelectionEnabled(false, { clearSelection: false });
    } else {
      this.resumeSelectionAfterPopup = false;
      this.onPostMessage({ type: "select:mode", enabled: false });
    }

    if (!target.classList.contains(selectedClass)) {
      this.getSelectedTarget()?.classList.remove(selectedClass);
      target.classList.add(selectedClass);
    }
    this.setSelectedTarget(target);
    const info = this.getElementInfo(target);
    const propertyItems = buildPropertyList(info);
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
          },
        });
        this.popupApp = app;
        return app;
      },
    });

    this.shadowUi.mount();
    this.shadowUi.shadowHost.classList.add(noSelectClass, contentUiRootClass);
    logger.debug("selector popup opened", {
      selector: info.selector,
    });
    return true;
  }
}
