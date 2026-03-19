import { beforeEach, describe, expect, mock, test } from "bun:test";
import { get } from "svelte/store";

type StorageShape = Record<string, unknown>;

const storageSlot = globalThis as typeof globalThis & {
  __pageProxyRecordStorageState?: StorageShape;
};

const getStorageState = () => {
  if (!storageSlot.__pageProxyRecordStorageState) {
    storageSlot.__pageProxyRecordStorageState = {};
  }

  return storageSlot.__pageProxyRecordStorageState;
};

const cloneStorageState = () => ({ ...getStorageState() });

const storageApi = {
  get: (keys: null | string | string[]) => {
    if (keys === null) {
      return Promise.resolve(cloneStorageState());
    }

    if (typeof keys === "string") {
      const storageState = getStorageState();
      return Promise.resolve(keys in storageState ? { [keys]: storageState[keys] } : {});
    }

    const storageState = getStorageState();
    return Promise.resolve(keys.reduce<StorageShape>((result, key) => {
      if (key in storageState) {
        result[key] = storageState[key];
      }
      return result;
    }, {}));
  },
  set: (items: StorageShape) => {
    const storageState = getStorageState();
    Object.assign(storageState, items);
    return Promise.resolve();
  },
  remove: (keys: string | string[]) => {
    const storageState = getStorageState();
    const normalizedKeys = Array.isArray(keys) ? keys : [keys];
    normalizedKeys.forEach((key) => {
      delete storageState[key];
    });
    return Promise.resolve();
  },
};

void mock.module("wxt/browser", () => ({
  browser: {
    storage: {
      local: storageApi,
    },
  },
}));

const {
  prepareRecordToolForDisplay,
  recordPanelState,
  recordSidepanelAction,
  setRecordPanelActiveTab,
  toggleRecordPanelRecording,
} = await import("../src/entrypoints/sidepanel/tools/record/state");

const flushAsyncWork = async () => {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
};

const makeRecordState = (updatedAt: number) => ({
  isRecording: false,
  timeline: [
    {
      id: `entry-${updatedAt}`,
      action: "Click",
      detail: "",
      timestamp: updatedAt,
    },
  ],
  updatedAt,
});

describe("record tool state", () => {
  beforeEach(async () => {
    const storageState = getStorageState();
    Object.keys(storageState).forEach((key) => {
      delete storageState[key];
    });
    setRecordPanelActiveTab(null);
    await flushAsyncWork();
  });

  test("opening the Record tool trims old recordings and reloads the active tab state", async () => {
    const storageState = getStorageState();
    for (let index = 1; index <= 6; index += 1) {
      storageState[`sidepanel:recordPanel:${index}`] = makeRecordState(index);
    }

    setRecordPanelActiveTab(1);
    await flushAsyncWork();

    expect(get(recordPanelState).timeline).toHaveLength(1);

    await prepareRecordToolForDisplay();

    expect("sidepanel:recordPanel:1" in storageState).toBe(false);
    expect(Object.keys(storageState).sort()).toEqual([
      "sidepanel:recordPanel:2",
      "sidepanel:recordPanel:3",
      "sidepanel:recordPanel:4",
      "sidepanel:recordPanel:5",
      "sidepanel:recordPanel:6",
    ]);
    expect(get(recordPanelState).timeline).toEqual([]);
  });

  test("toggling recording with no actions does not create storage", async () => {
    const storageState = getStorageState();
    setRecordPanelActiveTab(10);
    await flushAsyncWork();

    toggleRecordPanelRecording();
    await flushAsyncWork();

    expect(storageState).toEqual({});
  });

  test("the first recorded action creates storage for the active tab", async () => {
    const storageState = getStorageState();
    setRecordPanelActiveTab(11);
    await flushAsyncWork();

    recordSidepanelAction("Click", "Save button");
    await flushAsyncWork();

    const storedState = storageState["sidepanel:recordPanel:11"] as
      | {
          isRecording: boolean;
          timeline: Array<{
            id: string;
            action: string;
            detail: string;
            timestamp: number;
          }>;
          updatedAt: number;
        }
      | undefined;

    expect(storedState).toBeDefined();
    expect(storedState?.isRecording).toBe(true);
    expect(storedState?.timeline).toHaveLength(1);
    expect(storedState?.timeline[0]).toMatchObject({
      action: "Click",
      detail: "Save button",
    });
    expect(typeof storedState?.timeline[0]?.id).toBe("string");
    expect(typeof storedState?.timeline[0]?.timestamp).toBe("number");
    expect(typeof storedState?.updatedAt).toBe("number");
  });
});
