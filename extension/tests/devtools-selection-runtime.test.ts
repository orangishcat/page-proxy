import { beforeEach, describe, expect, mock, test } from "bun:test";

let connectListener: ((port: chrome.runtime.Port) => void) | null = null;
const runtimeSendMessage = mock(() => Promise.resolve());

void mock.module("wxt/browser", () => ({
  browser: {
    runtime: {
      onConnect: {
        addListener: (listener: (port: chrome.runtime.Port) => void) => {
          connectListener = listener;
        },
      },
      sendMessage: runtimeSendMessage,
    },
    webNavigation: {
      getAllFrames: mock(() => Promise.resolve([])),
    },
  },
}));

const { createDevtoolsSelectionRuntimeHandler } = await import("../src/lib/background/devtools-selection");
const { devtoolsSelectionPortName } = await import("../src/lib/devtools-selection");

const createPort = () => {
  let messageListener: ((message: unknown) => void) | null = null;
  let disconnectListener: (() => void) | null = null;

  return {
    port: {
      name: devtoolsSelectionPortName,
      onMessage: {
        addListener: (listener: (message: unknown) => void) => {
          messageListener = listener;
        },
      },
      onDisconnect: {
        addListener: (listener: () => void) => {
          disconnectListener = listener;
        },
      },
      postMessage: mock(() => undefined),
    } as unknown as chrome.runtime.Port,
    emitMessage(message: unknown) {
      messageListener?.(message);
    },
    disconnect() {
      disconnectListener?.();
    },
  };
};

const getStatus = (
  handleRuntimeMessage: ReturnType<typeof createDevtoolsSelectionRuntimeHandler>["handleRuntimeMessage"],
  tabId: number,
) =>
  new Promise<{ open: boolean }>((resolve) => {
    handleRuntimeMessage(
      { type: "devtools:status:get", tabId },
      {} as chrome.runtime.MessageSender,
      (response?: unknown) => resolve(response as { open: boolean }),
    );
  });

describe("createDevtoolsSelectionRuntimeHandler", () => {
  beforeEach(() => {
    runtimeSendMessage.mockClear();
    connectListener = null;
  });

  test("tracks an open DevTools port from a dedicated connect message", async () => {
    const { handleRuntimeMessage } = createDevtoolsSelectionRuntimeHandler();
    const bridge = createPort();

    connectListener?.(bridge.port);

    expect(await getStatus(handleRuntimeMessage, 1833962287)).toEqual({ open: false });

    bridge.emitMessage({
      type: "devtools:connect",
      tabId: 1833962287,
    });

    expect(await getStatus(handleRuntimeMessage, 1833962287)).toEqual({ open: true });
    expect(runtimeSendMessage).toHaveBeenCalledWith({
      type: "devtools:status:changed",
      tabId: 1833962287,
      open: true,
    });
  });
});
