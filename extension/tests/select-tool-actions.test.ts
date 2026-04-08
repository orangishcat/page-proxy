import { describe, expect, mock, test } from "bun:test";

import type { DevtoolsSelectionChangedRuntimeMessage } from "../src/lib/devtools-selection";
import type { ElementInfo, ElementSelectionContext } from "../src/lib/selection";
import type { AttachSelectionListenerDeps } from "../src/entrypoints/sidepanel/tools/select-tool/devtools-follow";

const browserMock = {
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(undefined),
      remove: () => Promise.resolve(undefined),
    },
  },
  runtime: {
    onMessage: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
    sendMessage: () => Promise.resolve(null),
  },
  tabs: {
    onActivated: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
    onUpdated: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
    query: () => Promise.resolve([]),
    sendMessage: () => Promise.resolve(null),
  },
  scripting: {
    executeScript: () => Promise.resolve(undefined),
  },
};

void mock.module("wxt/browser", () => ({
  browser: browserMock,
}));

const { applyDevtoolsSelectionChangedMessage, clearActiveSelection, undoLastRecordedAction } = await import(
  "../src/entrypoints/sidepanel/tools/select-tool/actions"
);
const { attachSelectionListener, toggleFollowDevtoolsSelection } = await import(
  "../src/entrypoints/sidepanel/tools/select-tool/actions"
);

const selectedElement: ElementInfo = {
  tag: "button",
  id: "save-button",
  name: "Save",
  className: "primary",
  innerText: "Save",
  selector: "body > button.primary",
  attributes: {
    id: "save-button",
    class: "primary",
  },
  boundingBox: {
    x: 10,
    y: 20,
    width: 100,
    height: 40,
  },
};

const buildSelectionChangedMessage = (): DevtoolsSelectionChangedRuntimeMessage => ({
  type: "devtools:selection:changed",
  tabId: 17,
  selection: {
    info: selectedElement,
    frameId: 0,
    frameUrl: "https://example.com/page",
    updatedAt: 1,
  },
});

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("applyDevtoolsSelectionChangedMessage", () => {
  test("records Selected element when the followed DevTools selection changes", async () => {
    const setSelectionCalls: Array<{ info: ElementInfo | null; context: ElementSelectionContext | undefined }> = [];
    const recordedSelections: ElementInfo[] = [];
    const selectModeStates: boolean[] = [];

    await applyDevtoolsSelectionChangedMessage(buildSelectionChangedMessage(), {
      readActiveTabContext: () =>
        Promise.resolve({
          tabId: 17,
          url: "https://example.com/page",
        }),
      setDevtoolsIntegrationDetected: () => undefined,
      isFollowingDevtoolsSelection: () => true,
      setSelection: (info, context) => {
        setSelectionCalls.push({ info, context });
      },
      setSelectModeEnabled: (enabled) => {
        selectModeStates.push(enabled);
      },
      recordSelectedElement: (info) => {
        recordedSelections.push(info);
      },
    });

    expect(setSelectionCalls).toEqual([
      {
        info: selectedElement,
        context: {
          source: "devtools",
          tabId: 17,
          frameId: 0,
          frameUrl: "https://example.com/page",
        },
      },
    ]);
    expect(selectModeStates).toEqual([false]);
    expect(recordedSelections).toEqual([selectedElement]);
  });
});

describe("undoLastRecordedAction", () => {
  test("reports an error when there is no recorded action to undo", async () => {
    const messages: Array<{ text: string | null; status: "success" | "error" }> = [];

    await undoLastRecordedAction({
      popRecordedAction: () => ({
        removed: null,
        timeline: [],
      }),
      restoreSelectionBySelector: () => Promise.resolve({ ok: true }),
      suppressNextSelectedElementRecord: () => undefined,
      clearSelectedElementRecordSuppression: () => undefined,
      clearSelection: () => undefined,
      setToolMessage: (text, status) => {
        messages.push({ text, status });
      },
    });

    expect(messages).toEqual([{ text: "No recorded action to undo.", status: "error" }]);
  });

  test("restores the previous recorded selector after removing the latest action", async () => {
    const restoreCalls: string[] = [];
    let suppressionCalls = 0;
    const messages: Array<{ text: string | null; status: "success" | "error" }> = [];

    await undoLastRecordedAction({
      popRecordedAction: () => ({
        removed: {
          id: "entry-2",
          action: "Deleted element",
          detail: "",
          timestamp: 2,
        },
        timeline: [
          {
            id: "entry-1",
            action: "Selected element",
            detail: "selector: .card",
            timestamp: 1,
          },
        ],
      }),
      restoreSelectionBySelector: (selector) => {
        restoreCalls.push(selector);
        return Promise.resolve({ ok: true });
      },
      suppressNextSelectedElementRecord: () => {
        suppressionCalls += 1;
      },
      clearSelectedElementRecordSuppression: () => undefined,
      clearSelection: () => undefined,
      setToolMessage: (text, status) => {
        messages.push({ text, status });
      },
    });

    expect(restoreCalls).toEqual([".card"]);
    expect(suppressionCalls).toBe(1);
    expect(messages).toEqual([]);
  });

  test("clears the current selection when the popped entry leaves no recorded selector to restore", async () => {
    let clearSelectionCalls = 0;
    const messages: Array<{ text: string | null; status: "success" | "error" }> = [];

    await undoLastRecordedAction({
      popRecordedAction: () => ({
        removed: {
          id: "entry-1",
          action: "Selected element",
          detail: "selector: .card",
          timestamp: 1,
        },
        timeline: [],
      }),
      restoreSelectionBySelector: () => Promise.resolve({ ok: true }),
      suppressNextSelectedElementRecord: () => undefined,
      clearSelectedElementRecordSuppression: () => undefined,
      clearSelection: () => {
        clearSelectionCalls += 1;
      },
      setToolMessage: (text, status) => {
        messages.push({ text, status });
      },
    });

    expect(clearSelectionCalls).toBe(1);
    expect(messages).toEqual([]);
  });

  test("reports an error when the previous recorded selector cannot be restored", async () => {
    let suppressionCalls = 0;
    let clearSuppressionCalls = 0;
    const messages: Array<{ text: string | null; status: "success" | "error" }> = [];

    await undoLastRecordedAction({
      popRecordedAction: () => ({
        removed: {
          id: "entry-2",
          action: "Deleted element",
          detail: "",
          timestamp: 2,
        },
        timeline: [
          {
            id: "entry-1",
            action: "Selected element",
            detail: "selector: .missing",
            timestamp: 1,
          },
        ],
      }),
      restoreSelectionBySelector: () => Promise.resolve({ ok: false, error: "Unable to restore selection." }),
      suppressNextSelectedElementRecord: () => {
        suppressionCalls += 1;
      },
      clearSelectedElementRecordSuppression: () => {
        clearSuppressionCalls += 1;
      },
      clearSelection: () => undefined,
      setToolMessage: (text, status) => {
        messages.push({ text, status });
      },
    });

    expect(suppressionCalls).toBe(1);
    expect(clearSuppressionCalls).toBe(1);
    expect(messages).toEqual([
      {
        text: "Undid Deleted element, but couldn't restore the previous recorded selection.",
        status: "error",
      },
    ]);
  });
});

describe("toggleFollowDevtoolsSelection", () => {
  test("disables content selection and syncs the followed DevTools selection when enabling follow mode", async () => {
    const followStates: boolean[] = [];
    const selectModeStates: boolean[] = [];
    const contentToggleCalls: Array<{ tabId: number; enabled: boolean }> = [];
    const detectedStates: boolean[] = [];
    const syncCalls: number[] = [];
    const ignoredErrors: string[] = [];

    toggleFollowDevtoolsSelection({
      isFollowingDevtoolsSelection: () => false,
      setFollowDevtoolsSelection: (enabled) => {
        followStates.push(enabled);
      },
      setSelectModeEnabled: (enabled) => {
        selectModeStates.push(enabled);
      },
      readActiveTabContext: () =>
        Promise.resolve({
          tabId: 17,
          url: "https://example.com/page",
        }),
      isRestrictedUrl: () => false,
      runContentSelectionToggle: (tabId, enabled) => {
        contentToggleCalls.push({ tabId, enabled });
        return Promise.resolve();
      },
      requestDevtoolsStatus: () => Promise.resolve(true),
      setDevtoolsIntegrationDetected: (detected) => {
        detectedStates.push(detected);
      },
      syncSelectionFromDevtools: (tabId) => {
        syncCalls.push(tabId);
        return Promise.resolve(true);
      },
      logIgnoredError: (message) => {
        ignoredErrors.push(message);
      },
    });

    await flushPromises();

    expect(followStates).toEqual([true]);
    expect(selectModeStates).toEqual([false]);
    expect(contentToggleCalls).toEqual([{ tabId: 17, enabled: false }]);
    expect(detectedStates).toEqual([true]);
    expect(syncCalls).toEqual([17]);
    expect(ignoredErrors).toEqual([]);
  });
});

describe("attachSelectionListener", () => {
  test("wires runtime listeners and refreshes DevTools state on relevant events", () => {
    const runtimeListeners: Array<(message: unknown) => void> = [];
    const activatedListeners: Array<(activeInfo: { tabId: number }) => void> = [];
    const updatedListeners: Array<(tabId: number, changeInfo: { url?: string; status?: string }, tab: { active: boolean }) => void> = [];
    const statusMessages: unknown[] = [];
    const selectionMessages: unknown[] = [];
    const selectModeStates: boolean[] = [];
    const setSelectionCalls: Array<{ info: ElementInfo | null; context: ElementSelectionContext | undefined }> = [];
    const recordedSelections: ElementInfo[] = [];
    const toolMessages: Array<{ text: string | null; status: "success" | "error" }> = [];
    let refreshCalls = 0;

    const cleanup = attachSelectionListener({
      browser: {
        runtime: {
          onMessage: {
            addListener: (listener: (message: unknown) => void) => {
              runtimeListeners.push(listener as (message: unknown) => void);
            },
            removeListener: (listener: (message: unknown) => void) => {
              const index = runtimeListeners.indexOf(listener as (message: unknown) => void);
              if (index >= 0) {
                runtimeListeners.splice(index, 1);
              }
            },
          },
        },
        tabs: {
          onActivated: {
            addListener: (listener: (activeInfo: { tabId: number }) => void) => {
              activatedListeners.push(listener as (activeInfo: { tabId: number }) => void);
            },
            removeListener: (listener: (activeInfo: { tabId: number }) => void) => {
              const index = activatedListeners.indexOf(listener as (activeInfo: { tabId: number }) => void);
              if (index >= 0) {
                activatedListeners.splice(index, 1);
              }
            },
          },
          onUpdated: {
            addListener: (
              listener: (tabId: number, changeInfo: { url?: string; status?: string }, tab: { active: boolean }) => void,
            ) => {
              updatedListeners.push(
                listener as (tabId: number, changeInfo: { url?: string; status?: string }, tab: { active: boolean }) => void,
              );
            },
            removeListener: (
              listener: (tabId: number, changeInfo: { url?: string; status?: string }, tab: { active: boolean }) => void,
            ) => {
              const index = updatedListeners.indexOf(
                listener as (tabId: number, changeInfo: { url?: string; status?: string }, tab: { active: boolean }) => void,
              );
              if (index >= 0) {
                updatedListeners.splice(index, 1);
              }
            },
          },
        },
      } satisfies AttachSelectionListenerDeps["browser"],
      refreshDevtoolsIntegrationForActiveTab: () => {
        refreshCalls += 1;
      },
      updateDevtoolsStatusForActiveTab: (message) => {
        statusMessages.push(message);
      },
      updateSelectionFromDevtoolsMessage: (message) => {
        selectionMessages.push(message);
      },
      isSelectToolMessage: (message): message is { type: "select:mode"; enabled: boolean } | { type: "select:selected"; payload: ElementInfo | null } =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message.type === "select:mode" || message.type === "select:selected"),
      setSelectModeEnabled: (enabled) => {
        selectModeStates.push(enabled);
      },
      setSelection: (info, context) => {
        setSelectionCalls.push({ info, context });
      },
      shouldSuppressSelectedElementRecord: () => false,
      recordSelectedElement: (info) => {
        recordedSelections.push(info);
      },
      setToolMessage: (text, status) => {
        toolMessages.push({ text, status });
      },
    });

    expect(refreshCalls).toBe(1);
    expect(runtimeListeners).toHaveLength(1);
    expect(activatedListeners).toHaveLength(1);
    expect(updatedListeners).toHaveLength(1);

    runtimeListeners[0]({ type: "devtools:status:changed", tabId: 17, open: true });
    runtimeListeners[0](buildSelectionChangedMessage());
    runtimeListeners[0]({ type: "select:mode", enabled: true });
    runtimeListeners[0]({ type: "select:selected", payload: selectedElement });
    activatedListeners[0]({ tabId: 17 });
    updatedListeners[0](17, { status: "complete" }, { active: true });

    expect(statusMessages).toEqual([{ type: "devtools:status:changed", tabId: 17, open: true }]);
    expect(selectionMessages).toEqual([buildSelectionChangedMessage()]);
    expect(selectModeStates).toEqual([true]);
    expect(setSelectionCalls).toEqual([
      {
        info: selectedElement,
        context: {
          source: "content",
          tabId: null,
          frameId: 0,
          frameUrl: null,
        },
      },
    ]);
    expect(recordedSelections).toEqual([selectedElement]);
    expect(toolMessages).toEqual([{ text: null, status: "error" }]);
    expect(refreshCalls).toBe(3);

    cleanup();

    expect(runtimeListeners).toHaveLength(0);
    expect(activatedListeners).toHaveLength(0);
    expect(updatedListeners).toHaveLength(0);
  });
});

describe("clearActiveSelection", () => {
  test("clears the sidepanel state and tells the content script to remove the selected outline", async () => {
    const sentMessages: Array<{ tabId: number; message: unknown; options?: unknown }> = [];
    browserMock.tabs.query = (() =>
      Promise.resolve([
        {
          id: 17,
          url: "https://example.com/page",
        },
      ])) as typeof browserMock.tabs.query;
    browserMock.tabs.sendMessage = ((tabId: number, message: unknown, options?: unknown) => {
      sentMessages.push({ tabId, message, options });
      return Promise.resolve(undefined);
    }) as unknown as typeof browserMock.tabs.sendMessage;

    await clearActiveSelection();

    expect(sentMessages).toEqual([
      {
        tabId: 17,
        message: {
          type: "select:clear",
        },
        options: {
          frameId: 0,
        },
      },
    ]);
  });
});
