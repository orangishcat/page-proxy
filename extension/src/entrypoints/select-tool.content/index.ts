import log from "@/lib/logger";
import { defineContentScript } from "wxt/utils/define-content-script";
import { SelectionController } from "./controller/SelectionController";
import { addMessageListener } from "./message-router";
import "@/styles/app.css";
import { browser } from "wxt/browser";
import { isRecord } from "@/lib/utils/type-guards";

const logger = log.getLogger("select-content-script");

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,

  main(ctx) {
    logger.debug("select tool content script initialized", { href: window.location.href });

    const ctrl = new SelectionController(ctx);
    const removeMessageListener = addMessageListener(ctrl);

    const debugMessageListener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      const type = isRecord(message) && typeof message.type === "string" ? message.type : "<unknown>";

      logger.debug(`[${type}]`, { message: message, sender });
    };
    browser.runtime.onMessage.addListener(debugMessageListener);
    const removeDebugMessageListener = () => browser.runtime.onMessage.removeListener(debugMessageListener);

    window.addEventListener("keydown", ctrl.onShortcutKeyDown, { capture: true });

    let hasCleanedUp = false;
    const cleanup = () => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;
      removeMessageListener();
      removeDebugMessageListener();
      window.removeEventListener("keydown", ctrl.onShortcutKeyDown, { capture: true });
      window.removeEventListener("unload", cleanup);
      ctrl.detachListeners();
      ctrl.grantManager.clear();
    };

    ctx.onInvalidated(cleanup);
    window.addEventListener("unload", cleanup, { once: true });
  },
});
