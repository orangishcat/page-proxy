import { describe, expect, test } from "bun:test";

import { buildGeneratedReviewCode } from "./generate";
import { normalizeRecordTimeline } from "./normalize";

describe("record converter click support", () => {
  test("normalizeRecordTimeline supports click action labels", () => {
    const normalized = normalizeRecordTimeline([
      { id: "entry-1", action: "Selected element", detail: "selector: button", timestamp: 1 },
      { id: "entry-2", action: "click", detail: "", timestamp: 2 },
      { id: "entry-3", action: "Clicked element", detail: "", timestamp: 3 },
    ]);

    expect(normalized.supportedSteps).toHaveLength(3);
    expect(normalized.supportedSteps.map((step) => step.kind)).toEqual(["select-element", "click-element", "click-element"]);
    expect(normalized.supportedSteps.map((step) => step.label)).toEqual(["Selected element", "Click element", "Click element"]);
  });

  test("buildGeneratedReviewCode emits click() for click-element steps", () => {
    const normalized = normalizeRecordTimeline([
      { id: "entry-1", action: "Selected element", detail: "selector: button", timestamp: 1 },
      { id: "entry-2", action: "click", detail: "", timestamp: 2 },
    ]);

    const generated = buildGeneratedReviewCode({
      steps: normalized.supportedSteps,
      parentOptions: {},
      existingCode: "",
      defaultParentUntilSelector: "body",
    });

    expect(generated.byMode.combined.rawCode).toContain("selectedElement.click()");
    expect(generated.byMode.functions.rawCode).toContain("selectedElement.click()");
    expect(generated.byMode.functions.rawCode).toContain("return [selectedElement]");
  });
});
