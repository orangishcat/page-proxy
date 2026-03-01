import log from "loglevel";
import { defineContentScript } from "wxt/utils/define-content-script";
import { SelectionController } from "./SelectionController";
import { addMessageListener } from "./message-router";
import "@/styles/app.css";

const logger = log.getLogger("select-content-script");
logger.setLevel("debug", false);

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

    window.addEventListener("keydown", ctrl.onShortcutKeyDown, { capture: true });

    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", ctrl.onShortcutKeyDown, { capture: true });
      ctrl.selectorManager.clear({ resumeSelection: false });
      ctrl.recordManager.clear();
    });
  },
});
