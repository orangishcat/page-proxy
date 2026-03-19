import { mount, unmount } from "svelte";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import log from "@/lib/logger";
import { noSelectClass, contentUiRootClass } from "@/lib/constants/selection";
import type {
  RecordConverterOpenPayload,
  RecordConverterOpenResult,
  RecordConverterSaveResult,
  SelectToolMessage,
} from "@/lib/selection";
import type { DevScreenshotCaptureTarget } from "@/lib/dev-screenshots";
import RecordPopup from "./RecordPopup.svelte";

type ContentScriptContext = Parameters<typeof createShadowRootUi>[0];

const logger = log.getLogger("record-popup-manager");

export class RecordConverterPopupManager {
  private popupApp: ReturnType<typeof mount> | null = null;
  private shadowUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;

  constructor(private readonly ctx: ContentScriptContext) {}

  getScreenshotCapture(): DevScreenshotCaptureTarget | null {
    const popupRoot = this.shadowUi?.shadowHost.shadowRoot?.querySelector(`.${contentUiRootClass}`);
    if (!(popupRoot instanceof HTMLElement)) {
      return null;
    }

    return {
      element: popupRoot,
      name: "record-converter",
    };
  }

  clear(): void {
    if (this.popupApp) {
      void unmount(this.popupApp);
      this.popupApp = null;
    }
    if (this.shadowUi) {
      this.shadowUi.remove();
      this.shadowUi = null;
    }
    logger.debug("record converter popup closed");
  }

  private async handleSave(reviewedCode: string): Promise<RecordConverterSaveResult> {
    logger.debug("record converter save requested", { codeLength: reviewedCode.length });

    const response: unknown = await browser.runtime
      .sendMessage({
        type: "record:converter:save",
        payload: { code: reviewedCode },
      } satisfies SelectToolMessage)
      .catch((error: unknown) => {
        logger.error("Failed to save record converter code", { error });
        return null;
      });

    if (response === null) {
      return { ok: false, error: "Unable to save record converter code to the editor." };
    }

    const result = response as Partial<RecordConverterSaveResult> | null;
    if (!result || typeof result.ok !== "boolean") {
      logger.error("Invalid record converter save response", {
        codeLength: reviewedCode.length,
        rawResponse: response,
      });
      return { ok: false, error: "Unable to save record converter code to the editor." };
    }

    if (result.ok) {
      this.clear();
      return result as RecordConverterSaveResult;
    }

    const errorMessage = typeof result.error === "string" ? result.error : undefined;
    logger.error("Unexpected record converter save failure response", {
      codeLength: reviewedCode.length,
      error: errorMessage,
      rawResponse: response,
    });

    return {
      ok: false,
      error: errorMessage ?? "Unable to save record converter code to the editor.",
    };
  }

  async open(payload: RecordConverterOpenPayload): Promise<RecordConverterOpenResult> {
    this.clear();

    try {
      this.shadowUi = await createShadowRootUi(this.ctx, {
        name: "pp-record-converter-popup",
        position: "overlay",
        anchor: "body",
        zIndex: 2147483647,
        onMount: (container: HTMLElement) => {
          const app = mount(RecordPopup, {
            target: container,
            props: {
              payload,
              onCancel: () => this.clear(),
              onSave: (code: string) => this.handleSave(code),
            },
          });
          this.popupApp = app;
          return app;
        },
      });

      this.shadowUi.mount();
      this.shadowUi.shadowHost.classList.add(noSelectClass, contentUiRootClass);
      logger.debug("record converter popup opened", { timelineSize: payload.timeline.length });
      return { opened: true };
    } catch (error: unknown) {
      logger.error("Failed to open record converter popup", { error });
      this.clear();
      return { opened: false, error: "Unable to open record converter popup." };
    }
  }
}
