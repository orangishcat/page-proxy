import { describe, expect, test } from "bun:test";

import { buildReviewCodeFromStepPreviews } from "../src/entrypoints/select-tool.content/record-converter/review-code";
import { normalizeRecordTimeline } from "../src/entrypoints/select-tool.content/record-converter/normalize";

const buildTimeline = (entries: Array<{ action: string; detail?: string }>) =>
  entries.map((entry, index) => ({
    id: `step-${index + 1}`,
    action: entry.action,
    detail: entry.detail ?? "",
    timestamp: index + 1,
  }));

describe("buildReviewCodeFromStepPreviews", () => {
  test("uses edited step snippets in functions review mode", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Clicked element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      stepCodeByStepId: {
        "step-1": [
          "async function step1() {",
          "  const selector = pq.selector({",
          '    name: "Selector 1",',
          '    baseSelector: ".edited",',
          "    matches: e => e instanceof HTMLButtonElement",
          "  })",
          "  const selectedElement = await selector.waitUntilMatch()",
          "  return [selectedElement]",
          "}",
        ].join("\n"),
        "step-2": [
          "async function step2(selectedElement) {",
          "  if (selectedElement) {",
          "    selectedElement.dataset.clicked = \"true\"",
          "  }",
          "  return [selectedElement]",
          "}",
        ].join("\n"),
      },
      existingCode: "",
    });

    expect(generated.byMode.functions.rawCode).toContain('baseSelector: ".edited"');
    expect(generated.byMode.functions.rawCode).toContain('selectedElement.dataset.clicked = "true"');
    expect(generated.byMode.functions.rawCode).toContain("const step2Result = await step2(...step1Result)");
  });

  test("uses edited step snippets in combined review mode", () => {
    const { supportedSteps } = normalizeRecordTimeline(
      buildTimeline([
        { action: "Selected element", detail: "selector: .original" },
        { action: "Copied element" },
        { action: "Selected element", detail: "selector: .target" },
        { action: "Pasted element" },
      ]),
    );

    const generated = buildReviewCodeFromStepPreviews({
      steps: supportedSteps,
      stepCodeByStepId: {
        "step-2": [
          "async function step2(selectedElement) {",
          "  const clipboardHtml = selectedElement ? selectedElement.innerHTML : null",
          "  return [selectedElement, clipboardHtml]",
          "}",
        ].join("\n"),
        "step-4": [
          "async function step4(selectedElement, clipboardHtml) {",
          "  if (selectedElement && clipboardHtml) {",
          '    selectedElement.insertAdjacentHTML("beforeend", clipboardHtml)',
          "  }",
          "  return [selectedElement, clipboardHtml]",
          "}",
        ].join("\n"),
      },
      existingCode: "",
    });

    expect(generated.byMode.combined.rawCode).toContain("let clipboardHtml = null");
    expect(generated.byMode.combined.rawCode).toContain("selectedElement ? selectedElement.innerHTML : null");
    expect(generated.byMode.combined.rawCode).toContain('selectedElement.insertAdjacentHTML("beforeend", clipboardHtml)');
    expect(generated.byMode.combined.rawCode).not.toContain("return [selectedElement, clipboardHtml]");
  });
});
