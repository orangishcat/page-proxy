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
    addMessageListener(ctrl);

    browser.runtime.onMessage.addListener((message, sender) => {
      const type = isRecord(message) && typeof message.type === "string" ? message.type : "<unknown>";

      logger.debug(`[${type}]`, { message: message as unknown, sender });
    });

    window.addEventListener("keydown", ctrl.onShortcutKeyDown, { capture: true });

    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", ctrl.onShortcutKeyDown, { capture: true });
      ctrl.selectorManager.clear({ resumeSelection: false });
      ctrl.recordManager.clear();
    });
  },
});
