import log from "loglevel";

import type { SelectToolMessage } from "@/lib/selection";
import { isRestrictedUrl, readActiveTabContext, sendSelectToolMessage } from "../select-tool/content-messaging";

type SelectorsHoverPayload = {
  selectorName: string;
  rules: string[];
};

const logger = log.getLogger("selectors-tool-actions");
logger.setLevel("debug", false);

export const sendSelectorsHover = (payload: SelectorsHoverPayload | null) => {
  logger.debug("selectors hover preview requested", {
    selectorName: payload?.selectorName ?? null,
    hasPayload: payload !== null,
  });

  void readActiveTabContext()
    .then(async (tabContext) => {
      if (!tabContext || isRestrictedUrl(tabContext.url)) {
        return;
      }

      await sendSelectToolMessage(
        tabContext.tabId,
        {
          type: "selectors:hover",
          payload,
        } satisfies SelectToolMessage,
        0,
      ).catch(() => undefined);
    })
    .catch(() => undefined);
};
