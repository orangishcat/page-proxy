import { describe, expect, mock, test } from "bun:test";

import { clearActiveSelection, undoLastRecordedAction } from "../src/entrypoints/sidepanel/tools/select-tool/actions";

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
