import { describe, expect, test } from "bun:test";

import { createReviewEditorSetupGate } from "../src/entrypoints/select-tool.content/record-converter/review-editor-setup";

describe("createReviewEditorSetupGate", () => {
  test("blocks concurrent setup attempts until the current attempt finishes", () => {
    const gate = createReviewEditorSetupGate();

    expect(gate.begin()).toBe(true);
    expect(gate.begin()).toBe(false);

    gate.succeed();

    expect(gate.begin()).toBe(true);
  });

  test("stops automatic retries after a setup failure until reset", () => {
    const gate = createReviewEditorSetupGate();

    expect(gate.begin()).toBe(true);

    gate.fail();

    expect(gate.begin()).toBe(false);

    gate.reset();

    expect(gate.begin()).toBe(true);
  });
});
