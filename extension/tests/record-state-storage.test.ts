import { beforeEach, describe, expect, mock, test } from "bun:test";

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

const { trimStoredRecordPanelStates } = await import("../src/entrypoints/sidepanel/tools/state-storage");

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

describe("trimStoredRecordPanelStates", () => {
  beforeEach(() => {
    const storageState = getStorageState();
    Object.keys(storageState).forEach((key) => {
      delete storageState[key];
    });
  });

  test("keeps the five most recent recorded tabs globally", async () => {
    const storageState = getStorageState();
    for (let index = 1; index <= 7; index += 1) {
      storageState[`sidepanel:recordPanel:${index}`] = makeRecordState(index);
    }
    storageState["unrelated:key"] = { keep: true };

    await trimStoredRecordPanelStates();

    expect(Object.keys(storageState).sort()).toEqual([
      "sidepanel:recordPanel:3",
      "sidepanel:recordPanel:4",
      "sidepanel:recordPanel:5",
      "sidepanel:recordPanel:6",
      "sidepanel:recordPanel:7",
      "unrelated:key",
    ]);
  });

  test("removes empty stored recordings and leaves malformed entries untouched", async () => {
    const storageState = getStorageState();
    storageState["sidepanel:recordPanel:1"] = makeRecordState(1);
    storageState["sidepanel:recordPanel:2"] = {
      isRecording: true,
      timeline: [],
      updatedAt: 2,
    };
    storageState["sidepanel:recordPanel:3"] = {
      isRecording: "yes",
      timeline: [],
      updatedAt: 3,
    };

    await trimStoredRecordPanelStates();

    expect(storageState["sidepanel:recordPanel:1"]).toEqual(makeRecordState(1));
    expect("sidepanel:recordPanel:2" in storageState).toBe(false);
    expect(storageState["sidepanel:recordPanel:3"]).toEqual({
      isRecording: "yes",
      timeline: [],
      updatedAt: 3,
    });
  });
});
