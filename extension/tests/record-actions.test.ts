import { describe, expect, test } from "bun:test";
import { selectionStartsWithSelectedElement } from "../src/entrypoints/sidepanel/tools/record/actions";
import type { RecordTimelineEntry } from "../src/entrypoints/sidepanel/tools/state-storage";

const makeEntry = (action: string, timestamp: number): RecordTimelineEntry => ({
  id: `entry-${timestamp}`,
  action,
  detail: "",
  timestamp,
});

describe("selectionStartsWithSelectedElement", () => {
  test("returns true when the first selected action is Selected element", () => {
    expect(
      selectionStartsWithSelectedElement([
        makeEntry("Selected element", 1),
        makeEntry("Click", 2),
      ]),
    ).toBe(true);
  });

  test("returns false when the first selected action is not Selected element", () => {
    expect(
      selectionStartsWithSelectedElement([
        makeEntry("Click", 1),
        makeEntry("Selected element", 2),
      ]),
    ).toBe(false);
  });
});
