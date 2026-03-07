import { describe, expect, test } from "bun:test";

import { getRecordTimelineEntryIds, hasFullRecordSelection } from "../src/entrypoints/sidepanel/tools/record/selection";

describe("record selection helpers", () => {
  const timeline = [{ id: "entry-1" }, { id: "entry-2" }, { id: "entry-3" }];

  test("getRecordTimelineEntryIds returns every timeline id in order", () => {
    expect(getRecordTimelineEntryIds(timeline)).toEqual(["entry-1", "entry-2", "entry-3"]);
  });

  test("hasFullRecordSelection returns true only when every timeline entry is selected", () => {
    expect(hasFullRecordSelection(timeline, [])).toBe(false);
    expect(hasFullRecordSelection(timeline, ["entry-1", "entry-2"])).toBe(false);
    expect(hasFullRecordSelection(timeline, ["entry-1", "entry-2", "entry-3"])).toBe(true);
    expect(hasFullRecordSelection(timeline, ["entry-1", "entry-2", "entry-3", "extra-entry"])).toBe(true);
  });
});
