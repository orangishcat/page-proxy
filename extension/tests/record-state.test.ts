import { beforeEach, describe, expect, test } from "bun:test";
import { get } from "svelte/store";

import { createDefaultAppState } from "../src/lib/app-state/defaults.ts";
import { appStateActions } from "../src/lib/app-state/actions.ts";
import { replaceAppState } from "../src/lib/app-state/state.svelte.ts";
import { appStateSelectors } from "../src/lib/app-state/selectors.ts";

const {
  popRecordPanelTimelineEntry,
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
    replaceAppState(createDefaultAppState());
    setRecordPanelActiveTab(null);
    await flushAsyncWork();
  });

  test("opening the Record tool trims old panels and reloads active tab state", async () => {
    for (let index = 1; index <= 6; index += 1) {
      appStateActions.setRecordPanelState(index, makeRecordState(index));
    }

    setRecordPanelActiveTab(1);
    await flushAsyncWork();

    expect(get(recordPanelState).timeline).toHaveLength(1);

    await prepareRecordToolForDisplay();

    expect(appStateSelectors.getRecordPanelState(1)).toBeNull();
    expect(appStateSelectors.getRecordPanelState(2)).toEqual(makeRecordState(2));
    expect(appStateSelectors.getRecordPanelState(3)).toEqual(makeRecordState(3));
    expect(appStateSelectors.getRecordPanelState(4)).toEqual(makeRecordState(4));
    expect(appStateSelectors.getRecordPanelState(5)).toEqual(makeRecordState(5));
    expect(appStateSelectors.getRecordPanelState(6)).toEqual(makeRecordState(6));
    expect(get(recordPanelState).timeline).toEqual([]);
  });

  test("toggling recording with no actions does not persist state", async () => {
    setRecordPanelActiveTab(10);
    await flushAsyncWork();

    toggleRecordPanelRecording();
    await flushAsyncWork();

    expect(appStateSelectors.getRecordPanelState(10)).toBeNull();
  });

  test("the first recorded action stores state for active tab", async () => {
    setRecordPanelActiveTab(11);
    await flushAsyncWork();

    recordSidepanelAction("Click", "Save button");
    await flushAsyncWork();

    const storedState = appStateSelectors.getRecordPanelState(11);

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

  test("popping the last recorded action updates in-memory and app-state state", async () => {
    setRecordPanelActiveTab(12);
    await flushAsyncWork();

    recordSidepanelAction("Selected element", "selector: .card");
    recordSidepanelAction("Clicked element", "");
    await flushAsyncWork();

    const result = popRecordPanelTimelineEntry();
    await flushAsyncWork();

    expect(result.removed).toMatchObject({
      action: "Clicked element",
      detail: "",
    });
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0]).toMatchObject({
      action: "Selected element",
      detail: "selector: .card",
    });
    expect(get(recordPanelState).timeline).toHaveLength(1);
    expect(appStateSelectors.getRecordPanelState(12)?.timeline).toHaveLength(1);
  });

  test("popping the final recorded action clears record state", async () => {
    setRecordPanelActiveTab(13);
    await flushAsyncWork();

    recordSidepanelAction("Selected element", "selector: .card");
    await flushAsyncWork();

    const result = popRecordPanelTimelineEntry();
    await flushAsyncWork();

    expect(result.removed).toMatchObject({
      action: "Selected element",
      detail: "selector: .card",
    });
    expect(result.timeline).toEqual([]);
    expect(get(recordPanelState).timeline).toEqual([]);
    expect(appStateSelectors.getRecordPanelState(13)).toBeNull();
  });
});
