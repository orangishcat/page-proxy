import { describe, expect, mock, test } from "bun:test";

import type { DevtoolsSelectionChangedRuntimeMessage } from "../src/lib/devtools-selection";
import type { ElementInfo, ElementSelectionContext } from "../src/lib/selection";

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

const { applyDevtoolsSelectionChangedMessage } = await import(
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
