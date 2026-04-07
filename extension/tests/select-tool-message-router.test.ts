import { beforeEach, describe, expect, mock, test } from "bun:test";

const runtimeAddListener = mock(() => undefined);
const forwardScriptRunToMainWorld = mock(() => true);

const browserMock = {
  runtime: {
    onMessage: {
      addListener: runtimeAddListener,
    },
  },
};

void mock.module("wxt/browser", () => ({
  browser: browserMock,
}));

void mock.module("../src/entrypoints/select-tool.content/script-run-bridge", () => ({
  forwardScriptRunToMainWorld,
}));

const { addMessageListener } = await import("../src/entrypoints/select-tool.content/message-router");
const { selectToolHandlerMap } = await import(
  "../src/entrypoints/select-tool.content/message-router/select-tool-handler-map"
);

type RuntimeListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

type ListenerController = {
  recordManager: {
    clear: ReturnType<typeof mock>;
    open: ReturnType<typeof mock>;
  };
  selectorManager: {
    open: ReturnType<typeof mock>;
    clear: ReturnType<typeof mock>;
    hasPopup: boolean;
    resumeSelectionAfterPopup: boolean;
  };
  grantManager: {
    open: ReturnType<typeof mock>;
  };
  hover: {
    clearHoverAndNotify: ReturnType<typeof mock>;
  };
  selectedTarget: Element | null;
  selectionEnabled: boolean;
  clearSelectedAndNotify: ReturnType<typeof mock>;
  applySelection: ReturnType<typeof mock>;
  applyHoveredSelectorElements: ReturnType<typeof mock>;
  runAction: ReturnType<typeof mock>;
  setSelectionEnabled: ReturnType<typeof mock>;
  postMessage: ReturnType<typeof mock>;
};

const createController = (): ListenerController => ({
  recordManager: {
    clear: mock(() => undefined),
    open: mock(() => Promise.resolve({ opened: true })),
  },
  selectorManager: {
    open: mock(() => Promise.resolve(true)),
    clear: mock(() => undefined),
    hasPopup: false,
    resumeSelectionAfterPopup: false,
  },
  grantManager: {
    open: mock(() => Promise.resolve(undefined)),
  },
  hover: {
    clearHoverAndNotify: mock(() => undefined),
  },
  selectedTarget: null,
  selectionEnabled: false,
  clearSelectedAndNotify: mock(() => undefined),
  applySelection: mock(() => undefined),
  applyHoveredSelectorElements: mock(() => undefined),
  runAction: mock(() => Promise.resolve({ ok: true })),
  setSelectionEnabled: mock(() => undefined),
  postMessage: mock(() => undefined),
});

const getRegisteredListener = (): RuntimeListener => {
  const calls = runtimeAddListener.mock.calls as unknown[][];
  const listener = calls[calls.length - 1]?.[0];
  if (!listener) {
    throw new Error("Expected a runtime message listener to be registered.");
  }
  return listener as unknown as RuntimeListener;
};

describe("selectToolHandlerMap", () => {
  beforeEach(() => {
    runtimeAddListener.mockClear();
    forwardScriptRunToMainWorld.mockClear();
  });

  test("routes every inbound select-tool message type through the handler map", () => {
    expect(Object.keys(selectToolHandlerMap).sort()).toEqual([
      "record:converter:open",
      "select:action",
      "select:clear",
      "select:parent",
      "select:restore",
      "select:toggle",
      "selector:open",
      "selectors:hover",
    ]);
  });

  test("selector:open clears the record manager and responds asynchronously", async () => {
    const ctrl = createController();
    const sendResponse = mock(() => undefined);

    const returnsAsync = selectToolHandlerMap["selector:open"](
      {
        payload: null,
      },
      { ctrl: ctrl as never, sendResponse },
    );

    expect(returnsAsync).toBe(true);
    expect(ctrl.recordManager.clear).toHaveBeenCalledTimes(1);

    await Promise.resolve();

    expect(ctrl.selectorManager.open).toHaveBeenCalledWith(null, "pp-api", undefined, undefined, {
      applyStyle: undefined,
    });
    expect(sendResponse).toHaveBeenCalledWith({ opened: true });
  });

  test("select:clear clears hover and selection synchronously", () => {
    const ctrl = createController();
    const sendResponse = mock(() => undefined);

    const returnsAsync = selectToolHandlerMap["select:clear"]({}, { ctrl: ctrl as never, sendResponse });

    expect(returnsAsync).toBe(false);
    expect(ctrl.hover.clearHoverAndNotify).toHaveBeenCalledTimes(1);
    expect(ctrl.clearSelectedAndNotify).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });
});

describe("addMessageListener", () => {
  beforeEach(() => {
    runtimeAddListener.mockClear();
    forwardScriptRunToMainWorld.mockClear();
  });

  test("bypasses the select-tool handler map for script:run messages", () => {
    const ctrl = createController();
    addMessageListener(ctrl as never);
    const listener = getRegisteredListener();
    const sendResponse = mock(() => undefined);

    const result = listener(
      {
        type: "script:run",
        requestId: "req-1",
        code: "console.log('hello')",
        scriptName: "Example",
        runtimeStorage: { pt: {}, pn: {} },
      },
      null,
      sendResponse,
    );

    expect(result).toBe(true);
    expect(forwardScriptRunToMainWorld).toHaveBeenCalledWith(
      expect.objectContaining({ type: "script:run", requestId: "req-1" }),
      sendResponse,
    );
  });

  test("bypasses the select-tool handler map for grant:request messages", () => {
    const ctrl = createController();
    addMessageListener(ctrl as never);
    const listener = getRegisteredListener();
    const sendResponse = mock(() => undefined);

    const result = listener(
      {
        type: "grant:request",
        payload: {
          scriptName: "Example",
          grants: ["run-on-page-load"],
        },
      },
      null,
      sendResponse,
    );

    expect(result).toBe(false);
    expect(ctrl.grantManager.open).toHaveBeenCalledWith({
      scriptName: "Example",
      grants: ["run-on-page-load"],
    });
  });

  test("returns false for invalid and outbound-only select-tool messages", () => {
    const ctrl = createController();
    addMessageListener(ctrl as never);
    const listener = getRegisteredListener();
    const sendResponse = mock(() => undefined);

    expect(listener(null, null, sendResponse)).toBe(false);
    expect(listener({ type: "select:selected", payload: null }, null, sendResponse)).toBe(false);
  });
});
