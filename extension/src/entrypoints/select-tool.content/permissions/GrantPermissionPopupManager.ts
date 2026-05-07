import { mount, unmount } from "svelte";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import log from "@/lib/logger";
import { noSelectClass, contentUiRootClass } from "@/lib/constants/selection";
import type { GrantPermissionRequestPayload, GrantPermissionResolveResult } from "@/lib/grant-permissions";
import type { GrantPermissionResolveMessage } from "@/lib/grant-permissions";
import { createOpenGenerationGate } from "../lifecycle/open-generation";
import GrantPopup from "./GrantPopup.svelte";

type ContentScriptContext = Parameters<typeof createShadowRootUi>[0];

const logger = log.getLogger("grant-permission-popup-manager");

export class GrantPermissionPopupManager {
  private popupApp: ReturnType<typeof mount> | null = null;
  private shadowUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  private readonly openGate = createOpenGenerationGate();

  constructor(private readonly ctx: ContentScriptContext) {}

  clear(): void {
    this.openGate.invalidate();
    if (this.popupApp) {
      void unmount(this.popupApp);
      this.popupApp = null;
    }
    if (this.shadowUi) {
      this.shadowUi.remove();
      this.shadowUi = null;
    }
    logger.debug("grant permission popup closed");
  }

  private async resolveGrant(payload: GrantPermissionRequestPayload, allow: boolean): Promise<void> {
    const response: unknown = await browser.runtime
      .sendMessage({
        type: "grant:resolve",
        payload: { ...payload, allow },
      } satisfies GrantPermissionResolveMessage)
      .catch((error: unknown) => {
        logger.error("Failed to send grant resolve message", { error });
        return null;
      });

    if (response === null) {
      throw new Error("Unable to communicate with the extension.");
    }

    const result = response as Partial<GrantPermissionResolveResult>;
    if (!result || typeof result.ok !== "boolean") {
      throw new Error("Invalid response from extension.");
    }

    if (!result.ok) {
      throw new Error((result as { ok: false; error: string }).error ?? "Unable to update grant permissions.");
    }
  }

  async open(payload: GrantPermissionRequestPayload): Promise<void> {
    this.clear();
    const openToken = this.openGate.begin();

    try {
      const shadowUi = await createShadowRootUi(this.ctx, {
        name: "pp-grant-permission-popup",
        position: "overlay",
        anchor: "body",
        zIndex: 2147483647,
        onMount: (container: HTMLElement) => {
          const app = mount(GrantPopup, {
            target: container,
            props: {
              scriptName: payload.scriptName,
              grants: payload.grants,
              onResolve: (allow: boolean) => this.resolveGrant(payload, allow),
              onClose: () => this.clear(),
            },
          });
          this.popupApp = app;
          return app;
        },
      });

      if (!this.openGate.isCurrent(openToken)) {
        shadowUi.remove();
        return;
      }

      this.shadowUi = shadowUi;
      this.shadowUi.mount();
      this.shadowUi.shadowHost.classList.add(noSelectClass, contentUiRootClass);
      logger.debug("grant permission popup opened", { scriptName: payload.scriptName });
    } catch (error: unknown) {
      logger.error("Failed to open grant permission popup", { error });
      this.clear();
    }
  }
}
