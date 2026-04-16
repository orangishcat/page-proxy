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
  const postMessage = mock(() => undefined);

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
      postMessage,
    } as unknown as chrome.runtime.Port,
    postMessage,
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

  test("does not broadcast a null selection when get-selected fails", async () => {
    const { handleRuntimeMessage } = createDevtoolsSelectionRuntimeHandler();
    const bridge = createPort();

    connectListener?.(bridge.port);
    bridge.emitMessage({
      type: "devtools:connect",
      tabId: 1833962287,
    });
    bridge.emitMessage({
      type: "devtools:selection:update",
      tabId: 1833962287,
      selection: {
        info: {
          tag: "div",
          id: null,
          name: null,
          className: null,
          innerText: null,
          selector: "body > div",
          attributes: {},
          boundingBox: { x: 0, y: 0, width: 10, height: 10 },
        },
        frameId: 0,
        frameUrl: "https://knowt.com/home",
        updatedAt: 1,
      },
    });

    runtimeSendMessage.mockClear();

    const responsePromise = new Promise<{ ok: boolean; selection: unknown; error?: string }>((resolve) => {
      handleRuntimeMessage(
        { type: "devtools:selection:get", tabId: 1833962287 },
        {} as chrome.runtime.MessageSender,
        (response?: unknown) => resolve(response as { ok: boolean; selection: unknown; error?: string }),
      );
    });

    const postMessageCalls = bridge.postMessage.mock.calls as unknown[][];
    const lastCommandCall = postMessageCalls.at(-1);
    const commandRequest = lastCommandCall?.[0] as { requestId: string } | undefined;
    bridge.emitMessage({
      type: "devtools:command:result",
      requestId: commandRequest?.requestId,
      ok: false,
      selection: null,
      error: "boom",
    });

    expect(await responsePromise).toEqual({
      ok: false,
      selection: null,
      error: "boom",
    });
    expect(runtimeSendMessage).not.toHaveBeenCalledWith({
      type: "devtools:selection:changed",
      tabId: 1833962287,
      selection: null,
    });
  });
});
