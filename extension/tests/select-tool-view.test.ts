import { describe, expect, test } from "bun:test";

import { wrenchStateClasses } from "../src/entrypoints/sidepanel/tools/select-tool/view";

describe("getFollowDevtoolsButtonStateClasses", () => {
  test("uses the accent background when following the DevTools selection", () => {
    expect(wrenchStateClasses(true)).toContain("bg-accent-500");
    expect(wrenchStateClasses(true)).toContain("opacity-100");
  });

  test("keeps the muted styling when not following the DevTools selection", () => {
    expect(wrenchStateClasses(false)).toContain("opacity-55");
    expect(wrenchStateClasses(false)).not.toContain("bg-accent-500");
  });
});
