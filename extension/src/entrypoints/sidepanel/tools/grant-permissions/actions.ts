import { browser } from "wxt/browser";

import {
  type GrantPermissionResolveResult,
  type GrantPermissionResolveMessage,
  type GrantPermissionRequestPayload,
} from "@/lib/grant-permissions";

export const resolveGrantPermissionRequest = async (
  payload: GrantPermissionRequestPayload,
  allow: boolean,
): Promise<GrantPermissionResolveResult> => {
  const response = (await browser.runtime.sendMessage({
    type: "grant:resolve",
    payload: {
      ...payload,
      allow,
    },
  } satisfies GrantPermissionResolveMessage)) as unknown;

  if (!response || typeof response !== "object") {
    return {
      ok: false,
      error: "Invalid grant permission response.",
    };
  }

  const result = response as GrantPermissionResolveResult;
  if (result.ok || typeof result.error === "string") {
    return result;
  }

  return {
    ok: false,
    error: "Invalid grant permission response.",
  };
};
