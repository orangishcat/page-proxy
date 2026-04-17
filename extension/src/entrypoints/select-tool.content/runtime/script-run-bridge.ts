import log from "@/lib/logger";
import {
  buildScriptRunResponse,
  isScriptRunResponse,
  type ScriptRunRequest,
  type ScriptRunResponse,
} from "@/lib/script-runner";

const logger = log.getLogger("run-bridge");

export const scriptRunBridgeTimeoutMs = 1800;

const isWindowSource = (source: MessageEventSource | null): boolean => source === window || source === null;

export const forwardScriptRunToMainWorld = (
  request: ScriptRunRequest,
  sendResponse: (response?: ScriptRunResponse) => void,
): true => {
  const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;
  let settled = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const cleanup = () => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
      timeoutId = null;
    }
    window.removeEventListener("message", onMessage);
  };

  const respond = (response: ScriptRunResponse) => {
    if (settled) return;
    settled = true;
    cleanup();
    sendResponse(response);
  };

  const onMessage = (event: MessageEvent) => {
    if (!isWindowSource(event.source)) return;
    if (!isScriptRunResponse(event.data) || event.data.requestId !== request.requestId) return;
    respond(event.data);
  };

  window.addEventListener("message", onMessage);
  timeoutId = globalThis.setTimeout(() => {
    respond(
      buildScriptRunResponse(
        request.requestId,
        "Script runner did not respond. Reload the page and try again.",
        [],
        [],
        null,
        request.runtimeStorage,
      ),
    );
  }, scriptRunBridgeTimeoutMs);

  window.postMessage(request, targetOrigin);
  return true;
};
